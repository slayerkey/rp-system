import { makeSnapshot, type HelldiversSnapshot } from "./model";

const API_ROOT = "https://api.helldivers2.dev/api/v1";
const CLIENT_NAME = "packrat-streamdeck";
// registry.json has no support email yet. NEEDS.md records the contact URL fallback.
const SUPPORT_CONTACT = "https://marketplace.elgato.com/@packrat";
const REQUEST_TIMEOUT_MS = 12_000;

async function fetchJson(path: string): Promise<unknown | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${API_ROOT}/${path}`, {
			headers: {
				"Accept-Language": "en-US",
				"X-Super-Client": CLIENT_NAME,
				"X-Super-Contact": SUPPORT_CONTACT
			},
			signal: controller.signal
		});
		if (!response.ok) return null;
		return (await response.json()) as unknown;
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

/** Every failed endpoint returns null, so callers retain the complete last known good snapshot. */
export async function fetchSnapshot(nowMs = Date.now()): Promise<HelldiversSnapshot | null> {
	const [war, campaigns, assignments, planets] = await Promise.all([
		fetchJson("war"),
		fetchJson("campaigns"),
		fetchJson("assignments"),
		fetchJson("planets")
	]);
	if (war === null || campaigns === null || assignments === null || planets === null) return null;
	return makeSnapshot(war, campaigns, assignments, planets, nowMs);
}

