/** Network helpers for the NASA Space Tracker: ISS position, launches, APOD, and geo math. */
import streamDeck from "@elgato/streamdeck";
import jpeg from "jpeg-js";

const UA = { "user-agent": "RatpackNasaSpaceTracker/1.0 (Stream Deck plugin)" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch JSON with a per-attempt timeout and retries. NASA's APOD endpoint in particular is
 * frequently slow or returns gateway errors, so we retry a few times before giving up.
 */
async function getJson<T>(url: string, { timeoutMs = 9000, retries = 3 } = {}): Promise<T> {
	let lastErr: unknown;
	for (let i = 0; i <= retries; i++) {
		try {
			const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return (await res.json()) as T;
		} catch (err) {
			lastErr = err;
			if (i < retries) await sleep(700 * (i + 1));
		}
	}
	throw lastErr;
}

// ── ISS ────────────────────────────────────────────────────────────────────────
export type IssPosition = { latitude: number; longitude: number; altitude: number; velocity: number; visibility: string };

export async function fetchIss(): Promise<IssPosition> {
	// Primary: wheretheiss.at — includes real altitude/velocity.
	try {
		return await getJson<IssPosition>("https://api.wheretheiss.at/v1/satellites/25544", { timeoutMs: 6000, retries: 1 });
	} catch {
		// Fallback: open-notify gives lat/lon only; the ISS orbits at a steady ~420 km.
		type ON = { iss_position: { latitude: string; longitude: string } };
		const d = await getJson<ON>("http://api.open-notify.org/iss-now.json", { timeoutMs: 6000, retries: 2 });
		return {
			latitude: parseFloat(d.iss_position.latitude),
			longitude: parseFloat(d.iss_position.longitude),
			altitude: 420,
			velocity: 27600,
			visibility: ""
		};
	}
}

/** Great-circle distance between two lat/lon points in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ── Launches (Launch Library 2) ──────────────────────────────────────────────────
export type Launch = { name: string; rocket: string; net: string };

/** Next orbital launches, soonest first. Anonymous LL2 is rate-limited, so call this hourly. */
export async function fetchLaunches(limit = 5): Promise<Launch[]> {
	type LL2 = { results: { name: string; net: string; rocket?: { configuration?: { name?: string } } }[] };
	const data = await getJson<LL2>(
		`https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=${limit}&hide_recent_previous=true`
	);
	// LL2 `name` is formatted "Rocket | Mission"; the rocket config carries a clean rocket name.
	return (data.results ?? []).map((r) => {
		const parts = (r.name ?? "").split("|");
		const mission = (parts.length > 1 ? parts.slice(1).join("|") : parts[0]).trim() || "Unknown mission";
		return {
			name: mission,
			rocket: r.rocket?.configuration?.name?.trim() || (parts.length > 1 ? parts[0].trim() : ""),
			net: r.net
		};
	});
}

// ── APOD ─────────────────────────────────────────────────────────────────────────
export type Apod = { title: string; url: string; hdurl?: string; media_type: string; date: string };

export function fetchApod(apiKey: string): Promise<Apod> {
	const key = apiKey?.trim() || "DEMO_KEY";
	return getJson<Apod>(`https://api.nasa.gov/planetary/apod?api_key=${encodeURIComponent(key)}`);
}

/**
 * Download an image and return it as a raster data URI for `setImage`. We deliberately avoid an
 * image-processing dependency (it complicates bundling a .streamDeckPlugin); Stream Deck scales
 * the raster to the key itself. APOD's standard `url` images are modest (~300 KB), so this is fine.
 */
export async function fetchImageDataUri(url: string, retries = 2): Promise<string> {
	let lastErr: unknown;
	for (let i = 0; i <= retries; i++) {
		try {
			const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
			if (!res.ok) throw new Error(`image HTTP ${res.status}`);
			const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
			const bytes = Buffer.from(await res.arrayBuffer());
			// Downscale JPEGs to a small square so even huge APOD photos load instantly on the key.
			if (mime === "image/jpeg" || mime === "image/jpg") {
				try {
					return jpegToSquare(bytes, 288);
				} catch {
					/* fall back to the raw image */
				}
			}
			return `data:${mime};base64,${bytes.toString("base64")}`;
		} catch (err) {
			lastErr = err;
			if (i < retries) await sleep(700);
		}
	}
	throw lastErr;
}

/** Cover-crop a JPEG to a centred square and re-encode small, using pure-JS jpeg-js (bundles clean). */
function jpegToSquare(bytes: Buffer, size: number): string {
	const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024 });
	const side = Math.min(img.width, img.height);
	const ox = ((img.width - side) / 2) | 0;
	const oy = ((img.height - side) / 2) | 0;
	const out = Buffer.alloc(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const sx = ox + (((x * side) / size) | 0);
			const sy = oy + (((y * side) / size) | 0);
			const si = (sy * img.width + sx) * 4;
			const di = (y * size + x) * 4;
			out[di] = img.data[si];
			out[di + 1] = img.data[si + 1];
			out[di + 2] = img.data[si + 2];
			out[di + 3] = 255;
		}
	}
	const enc = jpeg.encode({ data: out, width: size, height: size }, 72);
	return `data:image/jpeg;base64,${Buffer.from(enc.data).toString("base64")}`;
}

export function logError(scope: string, err: unknown): void {
	streamDeck.logger.warn(`${scope}: ${err instanceof Error ? err.message : String(err)}`);
}
