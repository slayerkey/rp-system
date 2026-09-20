import streamDeck, {
	action,
	SingletonAction,
	type KeyAction,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import { keyImage, Pulse, type Imageable } from "../lib/svg";
import { THEME } from "../lib/theme";
import { fetchIss, haversineKm, logError, type IssPosition } from "../lib/api";

/** Home location + range live in GLOBAL settings so every ISS key shares them. */
export type IssGlobal = { location?: string; homeLat?: number; homeLon?: number; visibleKm?: number; units?: "km" | "mi" };

/** Pickable cities (all within the ISS's ±51.6° orbit so it really can pass overhead). */
export const LOCATIONS: Record<string, { name: string; lat: number; lon: number }> = {
	losangeles: { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
	newyork: { name: "New York", lat: 40.7128, lon: -74.006 },
	toronto: { name: "Toronto", lat: 43.6532, lon: -79.3832 },
	london: { name: "London", lat: 51.5074, lon: -0.1278 },
	rome: { name: "Rome", lat: 41.9028, lon: 12.4964 },
	tokyo: { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
	sydney: { name: "Sydney", lat: -33.8688, lon: 151.2093 },
	saopaulo: { name: "São Paulo", lat: -23.5505, lon: -46.6333 }
};

const DEFAULT = { lat: 34.0522, lon: -118.2437, visibleKm: 2000 }; // Los Angeles

/**
 * ISS Overhead — polls the ISS every 10s and shows which way to look for it (a compass arrow) and
 * how far away it is. Pulses white + "OVERHEAD" when it's within range. Pick a city or set custom
 * coordinates in the property inspector; the choice is shared across all ISS keys.
 */
@action({ UUID: "com.ratpack.nasaspacetracker.iss" })
export class IssOverhead extends SingletonAction<IssGlobal> {
	private timer?: ReturnType<typeof setInterval>;
	private last?: IssPosition;
	private home = { lat: DEFAULT.lat, lon: DEFAULT.lon, visibleKm: DEFAULT.visibleKm, label: "Los Angeles", miles: false };
	private readonly pulses = new Map<string, Pulse>();

	/** Resolve location preset / custom coords + units from global settings. */
	setHome(g: IssGlobal): void {
		const miles = g.units === "mi";
		const loc = g.location && g.location !== "custom" ? LOCATIONS[g.location] : undefined;
		if (loc) {
			this.home = { lat: loc.lat, lon: loc.lon, visibleKm: numOr(g.visibleKm, DEFAULT.visibleKm), label: loc.name, miles };
		} else {
			// Custom: prioritise the distance — no city label.
			this.home = { lat: numOr(g.homeLat, DEFAULT.lat), lon: numOr(g.homeLon, DEFAULT.lon), visibleKm: numOr(g.visibleKm, DEFAULT.visibleKm), label: "", miles };
		}
		this.renderAll();
	}

	override onWillAppear(ev: WillAppearEvent<IssGlobal>): void {
		if (ev.action.isKey()) this.render(ev.action);
		this.ensureTimer();
	}

	override onKeyDown(_ev: KeyDownEvent<IssGlobal>): void {
		// Open NASA's live "Spot the Station" tracking map.
		void streamDeck.system.openUrl("https://spotthestation.nasa.gov/tracking_map.cfm");
	}

	override onWillDisappear(ev: WillDisappearEvent<IssGlobal>): void {
		this.pulses.get(ev.action.id)?.stop();
		this.pulses.delete(ev.action.id);
		if (this.actions[Symbol.iterator]().next().done) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	private ensureTimer(): void {
		if (this.timer) return;
		void this.tick();
		this.timer = setInterval(() => void this.tick(), 10_000);
	}

	private async tick(): Promise<void> {
		try {
			this.last = await fetchIss();
		} catch (err) {
			logError("ISS", err);
		}
		this.renderAll();
	}

	private renderAll(): void {
		for (const a of this.actions) if (a.isKey()) this.render(a);
	}

	private render(act: KeyAction<IssGlobal>): void {
		const pos = this.last;
		if (!pos) {
			this.stopPulse(act.id);
			act.setImage(locating());
			return;
		}
		const km = haversineKm(this.home.lat, this.home.lon, pos.latitude, pos.longitude);
		const bearing = bearingDeg(this.home.lat, this.home.lon, pos.latitude, pos.longitude);
		const dist = Math.round(this.home.miles ? km * 0.621371 : km);
		const unit = this.home.miles ? "mi" : "km";

		if (km <= this.home.visibleKm) {
			const altDisp = Math.round(this.home.miles ? pos.altitude * 0.621371 : pos.altitude);
			this.runPulse(act, [overheadFrame(altDisp, unit, 0.9), overheadFrame(altDisp, unit, 0.2)]);
			return;
		}
		this.stopPulse(act.id);
		act.setImage(globeFrame(dist, unit, bearing, this.home.label));
	}

	private runPulse(act: KeyAction<IssGlobal>, frames: string[]): void {
		this.stopPulse(act.id);
		const pulse = new Pulse(() => this.visible(act.id), frames, 480);
		this.pulses.set(act.id, pulse);
		pulse.start();
	}

	private stopPulse(id: string): void {
		this.pulses.get(id)?.stop();
		this.pulses.delete(id);
	}

	private *visible(id: string): Generator<Imageable> {
		for (const a of this.actions) if (a.id === id && a.isKey()) yield a;
	}
}

function numOr(v: unknown, d: number): number {
	const n = typeof v === "string" ? parseFloat(v) : (v as number);
	return Number.isFinite(n) ? n : d;
}

/** Initial compass bearing from home to the ISS, degrees 0-360 (0 = North). */
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const toR = (d: number) => (d * Math.PI) / 180;
	const dLon = toR(lon2 - lon1);
	const y = Math.sin(dLon) * Math.cos(toR(lat2));
	const x = Math.cos(toR(lat1)) * Math.sin(toR(lat2)) - Math.sin(toR(lat1)) * Math.cos(toR(lat2)) * Math.cos(dLon);
	return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_FULL = ["NORTH", "NORTHEAST", "EAST", "SOUTHEAST", "SOUTH", "SOUTHWEST", "WEST", "NORTHWEST"];
function cardinal(deg: number): string {
	return COMPASS_FULL[Math.round(deg / 45) % 8];
}

const CX = 72;
const CY = 54;

/** Satellite glyph centred at (cx, cy). */
function sat(cx: number, cy: number, color: string): string {
	return (
		`<rect x="${cx - 9}" y="${cy - 4}" width="8" height="8" rx="1" fill="${THEME.blue}"/>` +
		`<rect x="${cx + 1}" y="${cy - 4}" width="8" height="8" rx="1" fill="${THEME.blue}"/>` +
		`<rect x="${cx - 4}" y="${cy - 6}" width="8" height="12" rx="2" fill="${color}"/>`
	);
}

const GCX = 72;
const GCY = 44;
const GR = 26;

/**
 * Earth view: a little globe with you at the centre and a bold arrow pointing to where the ISS is
 * (up = North), the direction spelled out, and the distance. "It's on the Earth, to the WEST."
 */
function globeFrame(dist: number, unit: string, bearing: number, label: string): string {
	const dir = cardinal(bearing);
	const dirSize = dir.length > 5 ? 20 : 24;
	const rad = (bearing * Math.PI) / 180;
	const tipX = GCX + (GR + 4) * Math.sin(rad);
	const tipY = GCY - (GR + 4) * Math.cos(rad);
	const a1 = rad + (152 * Math.PI) / 180;
	const a2 = rad - (152 * Math.PI) / 180;
	const head = `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(tipX + 10 * Math.sin(a1)).toFixed(1)},${(tipY - 10 * Math.cos(a1)).toFixed(1)} ${(tipX + 10 * Math.sin(a2)).toFixed(1)},${(tipY - 10 * Math.cos(a2)).toFixed(1)}`;

	const globe =
		`<defs><radialGradient id="oc" cx="40%" cy="35%"><stop offset="0" stop-color="#1b3a6b"/><stop offset="1" stop-color="#08152c"/></radialGradient>` +
		`<clipPath id="gc"><circle cx="${GCX}" cy="${GCY}" r="${GR}"/></clipPath></defs>` +
		`<circle cx="${GCX}" cy="${GCY}" r="${GR}" fill="url(#oc)" stroke="${THEME.blue}" stroke-width="1.5"/>` +
		`<g clip-path="url(#gc)">` +
		`<ellipse cx="${GCX}" cy="${GCY}" rx="9" ry="${GR}" fill="none" stroke="#2f5a96" stroke-width="1" opacity="0.7"/>` +
		`<ellipse cx="${GCX}" cy="${GCY}" rx="18" ry="${GR}" fill="none" stroke="#2f5a96" stroke-width="1" opacity="0.5"/>` +
		`<line x1="${GCX - GR}" y1="${GCY}" x2="${GCX + GR}" y2="${GCY}" stroke="#2f5a96" stroke-width="1" opacity="0.7"/>` +
		`<path d="M54,33 q9,-7 17,-1 q6,5 -3,10 q-11,4 -16,-3 z" fill="#2e7d52"/>` +
		`<path d="M80,52 q10,-3 13,4 q2,7 -8,8 q-9,0 -10,-7 z" fill="#2e7d52"/>` +
		`<circle cx="60" cy="58" r="5" fill="#2e7d52"/>` +
		`</g>` +
		`<text x="${GCX}" y="${GCY - GR - 3}" text-anchor="middle" font-size="9" font-weight="700" fill="${THEME.grey}">N</text>` +
		`<line x1="${GCX}" y1="${GCY}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="${THEME.blueBright}" stroke-width="4" stroke-linecap="round"/>` +
		`<polygon points="${head}" fill="${THEME.blueBright}"/>` +
		sat(tipX, tipY, THEME.white) +
		`<circle cx="${GCX}" cy="${GCY}" r="2.6" fill="#ffffff"/>`;

	return keyImage({
		bg: THEME.bg,
		bg2: "#03050c",
		raw: globe,
		lines: [
			{ text: dir, y: 96, size: dirSize, color: THEME.white, weight: 800, spacing: 1 },
			{ text: `${dist.toLocaleString()} ${unit}${label ? ` · ${label}` : ""}`, y: 120, size: 12, color: THEME.textDim, weight: 600 }
		]
	});
}

function overheadFrame(alt: number, unit: string, glowA: number): string {
	return keyImage({
		bg: "#0a1430",
		bg2: "#03050c",
		glow: `rgba(255,255,255,${glowA})`,
		raw: sat(CX, 50, THEME.white),
		lines: [
			{ text: "OVERHEAD", y: 92, size: 20, color: THEME.white, weight: 800, spacing: 1 },
			{ text: `look up! · ${alt} ${unit}`, y: 116, size: 13, color: THEME.blueBright, weight: 700 }
		]
	});
}

function locating(): string {
	return keyImage({
		bg: THEME.bg,
		bg2: "#03050c",
		border: "#15203c",
		raw: sat(CX, CY, THEME.grey),
		lines: [{ text: "LOCATING ISS…", y: 110, size: 14, color: THEME.textDim, weight: 700, spacing: 1 }]
	});
}
