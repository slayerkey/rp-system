import streamDeck, { type KeyAction } from "@elgato/streamdeck";

import { areaRect, type PointSettings } from "./mouse-settings";
import { cursorPos, monitors } from "./input";

/**
 * "Capture cursor position", done so it actually works.
 *
 * The obvious version -- a button in the property inspector that reads the cursor --
 * is self-defeating: to click that button you must first move the pointer onto it, so
 * it captures the property inspector, never the place you cared about.
 *
 * So capture is armed instead. The PI arms it, the user moves the pointer wherever
 * they like, and the physical Stream Deck key does the reading. The deck key is the
 * one input that doesn't move the mouse.
 *
 * While armed, the key captures rather than performing its normal action -- pressing
 * "click at a point" during setup shouldn't fire a click into whatever is underneath.
 */
/** Which pair of fields a capture fills. "point" for click/move; a drag has two ends. */
export type CaptureSlot = "point" | "from" | "to";

/** Settings any capturable action shares: an area plus one or two point fields. */
type CaptureSettings = PointSettings & {
	fromXPct?: number;
	fromYPct?: number;
	toXPct?: number;
	toYPct?: number;
};

const armed = new Map<string, CaptureSlot>();

/** Nothing should stay armed forever if the user wanders off. */
const TIMEOUT_MS = 30_000;
const timers = new Map<string, NodeJS.Timeout>();

export function isArmed(context: string): boolean {
	return armed.has(context);
}

export function armedSlot(context: string): CaptureSlot | null {
	return armed.get(context) ?? null;
}

export function arm(context: string, slot: CaptureSlot = "point"): void {
	armed.set(context, slot);
	clearTimeout(timers.get(context));
	timers.set(
		context,
		setTimeout(() => {
			disarm(context);
			void streamDeck.ui.sendToPropertyInspector({ probe: "armed", armed: false, timedOut: true });
		}, TIMEOUT_MS)
	);
}

export function disarm(context: string): void {
	armed.delete(context);
	clearTimeout(timers.get(context));
	timers.delete(context);
}

type Captured = { slot: CaptureSlot; xPct: number; yPct: number; area: PointSettings["area"]; monitorIndex?: number };

const pct = (v: number, origin: number, size: number) =>
	Math.round(Math.min(100, Math.max(0, ((v - origin) / (size - 1)) * 100)) * 10) / 10;

/**
 * Reads the cursor and writes it into settings as a percentage, automatically switching
 * the area to whichever monitor the cursor is actually on. So dropping the pointer on the
 * second screen and capturing just works, instead of clamping to the first screen's edge.
 *
 * `slot` chooses which field pair gets written -- a single point, or one end of a drag.
 */
export async function captureInto(action: KeyAction, settings: CaptureSettings, slot: CaptureSlot = "point"): Promise<Captured> {
	disarm(action.id);

	const { x, y } = cursorPos();
	const mons = monitors();
	const idx = mons.findIndex((m) => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height);

	let area: PointSettings["area"] = settings.area ?? "primary";
	let monitorIndex = settings.monitorIndex ?? 0;
	let rect = areaRect(settings);

	if (idx >= 0) {
		const m = mons[idx];
		rect = m;
		if (m.primary) {
			area = "primary";
		} else {
			area = "monitor";
			monitorIndex = idx;
		}
	}

	const xPct = pct(x, rect.x, rect.width);
	const yPct = pct(y, rect.y, rect.height);
	const point =
		slot === "to" ? { toXPct: xPct, toYPct: yPct } : slot === "from" ? { fromXPct: xPct, fromYPct: yPct } : { xPct, yPct };

	await action.setSettings({ ...settings, ...point, area, monitorIndex });
	const result: Captured = { slot, xPct, yPct, area, monitorIndex };
	await streamDeck.ui.sendToPropertyInspector({ probe: "capture", ...result });
	await action.showOk();

	return result;
}
