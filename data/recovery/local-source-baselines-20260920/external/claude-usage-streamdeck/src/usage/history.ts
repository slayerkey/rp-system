// Persists usage history to disk (per account) so the Sparkline + Heatmap survive restarts.
// Stored under ~/.ratpack-claude-usage, keyed by a hash of the token (never the token itself).
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = join(homedir(), ".ratpack-claude-usage");
const MAX_SAMPLES = 240; // ~6h at 90s — plenty for the sparkline
const MAX_DAYS = 14;

export type Sample = Record<string, number>; // windowKey → utilization

export interface History {
	samples: Sample[];
	daily: Record<string, number>; // dayKey → peak primary-window utilization that day
}

export function dayKey(t = Date.now()): string {
	const d = new Date(t);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Keyed by provider as well as token: the combined build juggles all eight at once, and
// several of them autoload their token (so the token part is the same "auto" for each).
function fileFor(providerId: string, token: string): string {
	const h = createHash("sha256").update(`${providerId}:${token || "auto"}`).digest("hex").slice(0, 12);
	return join(DIR, `history-${h}.json`);
}

/** Pre-combined-build filename: hashed on the token alone. Read-only, for migration. */
function legacyFileFor(token: string): string {
	const h = createHash("sha256").update(token || "auto").digest("hex").slice(0, 12);
	return join(DIR, `history-${h}.json`);
}

function read(path: string): History | null {
	try {
		const h = JSON.parse(readFileSync(path, "utf8")) as Partial<History>;
		return { samples: h.samples ?? [], daily: h.daily ?? {} };
	} catch {
		return null;
	}
}

export function loadHistory(providerId: string, token: string): History {
	// Falling back to the old token-only filename keeps an existing customer's heatmap and
	// sparkline intact across the update that introduced provider-scoped history.
	return read(fileFor(providerId, token)) ?? read(legacyFileFor(token)) ?? { samples: [], daily: {} };
}

export function recordHistory(providerId: string, token: string, h: History, sample: Sample, primaryUtil: number | null): void {
	h.samples.push(sample);
	if (h.samples.length > MAX_SAMPLES) h.samples.splice(0, h.samples.length - MAX_SAMPLES);

	if (primaryUtil !== null) {
		const k = dayKey();
		h.daily[k] = Math.max(h.daily[k] ?? 0, primaryUtil);
	}
	const days = Object.keys(h.daily).sort();
	while (days.length > MAX_DAYS) {
		const oldest = days.shift();
		if (oldest) delete h.daily[oldest];
	}

	try {
		mkdirSync(DIR, { recursive: true });
		writeFileSync(fileFor(providerId, token), JSON.stringify(h));
	} catch {
		/* best-effort persistence */
	}
}
