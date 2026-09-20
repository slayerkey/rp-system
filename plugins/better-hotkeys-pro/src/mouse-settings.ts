import { type MouseButton, monitors, pctToPixels, type Rect, virtualScreen } from "./input";

/** Which area an X/Y percentage is measured against. */
export type Target =
	| { area: "cursor" } // don't move; act where the pointer already is
	| { area: "virtual" } // the whole desktop, all monitors
	| { area: "primary" }
	| { area: "monitor"; index: number };

export type PointSettings = {
	/** Percentages, not pixels, so a layout survives 1080p -> 4K. */
	xPct?: number;
	yPct?: number;
	area?: Target["area"];
	monitorIndex?: number;
};

export type ClickSettings = PointSettings & {
	button?: MouseButton;
	atPoint?: boolean;
};

export type MoveSettings = PointSettings & {
	relative?: boolean;
	dx?: number;
	dy?: number;
};

export type HoldMouseSettings = {
	button?: MouseButton;
};

export type ScrollSettings = {
	/** Signed notches per press: positive scrolls up/away (or right), negative down (or left). */
	notches?: number;
	/** Repeat the scroll this many times in one press, for a long throw. */
	repeat?: number;
	/** Milliseconds between repeats. */
	interval?: number;
	/** Which wheel to turn. Absent = "vertical", so setups made before this stay put. */
	axis?: ScrollAxis;
	/** Where the scroll lands. Absent = "pointer", the ordinary Windows behaviour. */
	target?: ScrollTarget;
};

export type ScrollAxis = "vertical" | "horizontal";

/**
 * "pointer" lets Windows deliver the wheel wherever the mouse is resting, which is what a
 * real wheel does. "active" posts it to the window in front instead, for people who keep
 * the pointer somewhere else entirely.
 */
export type ScrollTarget = "pointer" | "active";

export type RepeatWhat = "key" | "click";

export type RepeatSettings = ClickSettings & {
	what?: RepeatWhat;
	/** Keys to tap, when `what` is "key". Same shape as the keyboard actions. */
	keys?: { vk: number }[];
	/** Repeats per second. */
	hz?: number;
	/** Stop automatically after this many seconds. 0 or absent = until toggled off. */
	maxSeconds?: number;
};

export type DragSettings = {
	button?: MouseButton;
	area?: Target["area"];
	monitorIndex?: number;
	/** Start point, as a percentage of the area. */
	fromXPct?: number;
	fromYPct?: number;
	/** End point. */
	toXPct?: number;
	toYPct?: number;
	/** Milliseconds the drag takes; longer is more reliable for finicky apps. */
	durationMs?: number;
};

export type RadialSettings = {
	/** Key that opens the wheel (e.g. R). Held during, released at the end. */
	openVk?: number;
	/** Direction, degrees clockwise from straight up. */
	angle?: number;
	/** How far to push the cursor, as a percentage of the area's short side. */
	distance?: number;
	area?: Target["area"];
	monitorIndex?: number;
	/** Optional custom origin; when absent the wheel is centred on the area. */
	originXPct?: number;
	originYPct?: number;
	useCustomOrigin?: boolean;
	/**
	 * How the cursor is pushed toward the slot:
	 *  - "point": jump the cursor to the exact screen point (works when the wheel
	 *    uses the visible OS cursor).
	 *  - "flick": centre first, then move by a relative delta (works for wheels that
	 *    read raw mouse motion and hide the cursor).
	 */
	moveStyle?: "point" | "flick";
	/** Left-click once the cursor is in position, to commit the selection. */
	confirmClick?: boolean;
	/** Put the cursor back where it started -- AFTER the selection commits. */
	returnCursor?: boolean;
	/** Wait after pressing the open key, so the wheel has time to appear. */
	openDelayMs?: number;
	/** Hold at the slot before committing, so the game registers the hover. */
	holdMs?: number;
	/** Small gap between the minor steps (click, return). */
	stepDelayMs?: number;
};

/**
 * Where a radial selection pushes the cursor, in virtual-desktop pixels.
 *
 * Angle is clockwise from straight up, matching how a player thinks about a wheel:
 * 0deg is up, 90deg is right, 180deg down, 270deg left. Distance is a percentage of the
 * area's SHORT side, so the reach is circular regardless of a wide monitor's aspect.
 */
export function radialTarget(settings: RadialSettings): { origin: { x: number; y: number }; target: { x: number; y: number } } {
	const rect = areaRect(settings);

	const origin = settings.useCustomOrigin
		? pctToPixels(clampPct(settings.originXPct ?? 50), clampPct(settings.originYPct ?? 50), rect)
		: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };

	const radius = (clampPct(settings.distance ?? 60) / 100) * (Math.min(rect.width, rect.height) / 2);
	const rad = ((settings.angle ?? 0) * Math.PI) / 180;

	return {
		origin,
		target: {
			x: Math.round(origin.x + Math.sin(rad) * radius),
			y: Math.round(origin.y - Math.cos(rad) * radius) // screen y grows downward
		}
	};
}

/**
 * Resolves the rectangle a percentage is relative to.
 *
 * Falls back to the virtual screen when a chosen monitor has gone away -- someone
 * unplugging a display should not make a button start throwing.
 */
export function areaRect(settings: PointSettings): Rect {
	switch (settings.area ?? "primary") {
		case "virtual":
			return virtualScreen();
		case "monitor": {
			const all = monitors();
			return all[settings.monitorIndex ?? 0] ?? virtualScreen();
		}
		case "primary":
		default: {
			const all = monitors();
			return all.find((m) => m.primary) ?? virtualScreen();
		}
	}
}

/** Where a click or move should land, in virtual-desktop pixels. */
export function resolvePoint(settings: PointSettings): { x: number; y: number } {
	const rect = areaRect(settings);
	const x = clampPct(settings.xPct ?? 50);
	const y = clampPct(settings.yPct ?? 50);
	return pctToPixels(x, y, rect);
}

export function clampPct(value: number): number {
	if (!Number.isFinite(value)) return 50;
	return Math.min(100, Math.max(0, value));
}
