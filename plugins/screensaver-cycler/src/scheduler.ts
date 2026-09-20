/**
 * The always-on background scheduler.
 *
 * This runs in the plugin process, NOT in any action instance, so it keeps working
 * regardless of which Stream Deck page is showing or whether the button that turned
 * it on is currently visible. Config lives in global settings; the Cycle and Schedule
 * buttons only flip `enabled` and write their config here. That is the whole reason
 * scheduling is not tied to a visible key: a per-action timer would pause the moment
 * you switched Stream Deck pages.
 */
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { advanceIndex, setActive } from "./screensaver";

export type ScheduleRule = { time: string; path: string }; // time is "HH:MM", 24h

export type GlobalConfig = {
	cycle?: { enabled: boolean; intervalMin: number; paths: string[] };
	schedule?: { enabled: boolean; rules: ScheduleRule[] };
};

export async function getConfig(): Promise<GlobalConfig> {
	return ((await streamDeck.settings.getGlobalSettings()) as GlobalConfig) ?? {};
}

/** Merge a partial config into global settings (shallow: whole `cycle`/`schedule` replaced). */
export async function patchConfig(patch: GlobalConfig): Promise<void> {
	const next = { ...(await getConfig()), ...patch };
	await streamDeck.settings.setGlobalSettings(next as unknown as JsonObject);
}

// Runtime state, in-memory only. Resets on plugin restart (cycle simply starts from the
// top of the list again), which is why none of it needs to be persisted.
let cycleIndex = -1;
let lastCycleMs = 0;
let lastScheduleMinute = "";

function hhmm(d = new Date()): string {
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function applySafe(scrPath: string, who: string): void {
	try {
		setActive(scrPath);
		streamDeck.logger.info(`[${who}] active screensaver -> ${scrPath}`);
	} catch (error) {
		streamDeck.logger.error(`[${who}] failed to set screensaver`, error);
	}
}

async function tick(): Promise<void> {
	const cfg = await getConfig();

	const sc = cfg.schedule;
	if (sc?.enabled && sc.rules?.length) {
		const now = hhmm();
		// One fire per minute at most, so a 30s cadence can't apply the same rule twice.
		if (now !== lastScheduleMinute) {
			const rule = sc.rules.find((r) => r.time === now);
			if (rule?.path) {
				lastScheduleMinute = now;
				applySafe(rule.path, "schedule");
			}
		}
	}

	const cy = cfg.cycle;
	if (cy?.enabled && cy.paths?.length) {
		const everyMs = Math.max(1, cy.intervalMin || 5) * 60_000;
		if (Date.now() - lastCycleMs >= everyMs) {
			lastCycleMs = Date.now();
			cycleIndex = advanceIndex(cy.paths.length, cycleIndex);
			applySafe(cy.paths[cycleIndex], "cycle");
		}
	}
}

let handle: NodeJS.Timeout | null = null;

/** Start the 30s ticker. Idempotent. */
export function startScheduler(): void {
	if (handle) return;
	handle = setInterval(() => void tick(), 30_000);
}
