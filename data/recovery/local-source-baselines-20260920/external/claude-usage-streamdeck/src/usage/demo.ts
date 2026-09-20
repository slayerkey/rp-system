// Synthetic usage for Demo mode: lets the plugin be shown working without a live
// subscription (recording a functionality video, or trying styles before pasting a
// token). Values sweep 3% → 97% on a loop so every colour state and the reset
// countdown are visible within a short recording. No network, and real history on
// disk is never read or written while demo mode is on.
import { provider } from "../providers/active";
import type { Usage, WindowData } from "../providers/types";
import { dayKey, type Sample } from "./history";

const CYCLE_MS = 120_000; // one full fill-then-reset sweep
const RESET_SPAN_MS = 5 * 3_600_000; // a full window reads as ~5h on the countdown
export const DEMO_INTERVAL_MS = 1_500; // poll fast so the keys visibly animate

/** Spread windows evenly around the cycle (0, ¼, ½, ¾ …) so no two keys show the
 *  same number at the same time — a hash of the key can collide and read as a bug. */
function windowPhase(key: string): number {
	const i = provider.windows.findIndex((w) => w.key === key);
	return i < 0 ? 0 : i / Math.max(provider.windows.length, 1);
}

function phaseAt(key: string, now: number): number {
	return (((now / CYCLE_MS + windowPhase(key)) % 1) + 1) % 1;
}

function utilAt(key: string, now: number): number {
	return Math.round(3 + phaseAt(key, now) * 94);
}

/** Stable pseudo-random 0..1 from a string, for per-day heatmap variety. */
function hash01(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return ((h >>> 0) % 997) / 997;
}

export function demoUsage(now = Date.now()): Usage {
	const windows: WindowData[] = provider.windows.map((w) => {
		const t = phaseAt(w.key, now);
		return {
			key: w.key,
			label: w.label,
			utilization: utilAt(w.key, now),
			// Counts down as the window fills, then rolls over with it.
			resetsAt: new Date(now + (1 - t) * RESET_SPAN_MS).toISOString(),
		};
	});
	return { windows };
}

/** A trailing curve so the Sparkline style has something to draw. */
export function demoSamples(now = Date.now(), n = 60): Sample[] {
	const out: Sample[] = [];
	for (let i = n - 1; i >= 0; i--) {
		const t = now - i * (CYCLE_MS / n);
		const s: Sample = {};
		for (const w of provider.windows) s[w.key] = utilAt(w.key, t);
		out.push(s);
	}
	return out;
}

/** Two weeks of plausible peaks so the Heatmap style has something to draw. */
export function demoDaily(now = Date.now()): Record<string, number> {
	const daily: Record<string, number> = {};
	const primary = provider.windows[0]?.key ?? "demo";
	for (let i = 13; i >= 0; i--) {
		const t = now - i * 86_400_000;
		const k = dayKey(t);
		daily[k] = i === 0 ? utilAt(primary, now) : 30 + Math.round(hash01(k) * 65);
	}
	return daily;
}
