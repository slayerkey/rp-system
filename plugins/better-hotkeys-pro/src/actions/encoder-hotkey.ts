import {
	action,
	type DialDownEvent,
	type DialRotateEvent,
	type DialUpEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { expandHotkey, type Hotkey } from "../keys";
import { isHeld, pressKeys, release } from "../held-keys";
import { keyEvent, mouseWheel, sendInputs, wheelToActiveWindow } from "../input";
import type { ScrollAxis, ScrollTarget } from "../mouse-settings";
import { clamp } from "../util";

/**
 * General-purpose dial: rotate, push, and touchscreen tap each send an independent
 * hotkey. One action instead of a per-profile one-off, so every current and future
 * Stream Deck + profile gets dial support without new plugin code.
 *
 * Turning can send either a hotkey or the mouse wheel (rotateMode). Scrolling shares the
 * exact same step-size and acceleration maths as the hotkey path, because the thing that
 * makes a dial feel right -- slow turn nudges, fast flick travels -- is identical either
 * way, and plenty of apps bind to the wheel with no keyboard equivalent to map instead.
 *
 * Settings shape is a contract with the ratpack-projects profile builder (see
 * common.py) -- if a field name here changes, it has to change there too.
 */
export type EncoderHotkeySettings = {
	rotateCW?: Hotkey;
	rotateCCW?: Hotkey;
	push?: Hotkey;
	touchTap?: Hotkey;
	/** Keystrokes (or wheel notches) emitted per rotation tick. */
	stepSize?: number;
	/** Fast spins emit extra steps -- fine control vs. scrubbing. */
	acceleration?: boolean;
	/** What turning the dial sends. Absent = "hotkey", so existing setups are unchanged. */
	rotateMode?: "hotkey" | "scroll";
	/** Scroll mode: swap which way the wheel turns. Default is clockwise = wheel up. */
	invertScroll?: boolean;
	/** Scroll mode: which wheel to turn. Absent = "vertical", so existing dials are unchanged. */
	scrollAxis?: ScrollAxis;
	/** Scroll mode: where the scroll lands. Absent = "pointer", the ordinary behaviour. */
	scrollTarget?: ScrollTarget;
};

/** A tap is a complete down-then-up, same as Auto-Repeat's key mode -- nothing is ever
 * left held, so a dropped tick from a fast spin costs nothing to skip. */
function tap(vks: number[]): void {
	if (vks.length === 0) return;
	try {
		sendInputs([...vks.map((vk) => keyEvent(vk, true)), ...[...vks].reverse().map((vk) => keyEvent(vk, false))]);
	} catch {
		// A single dropped tick mid-spin is not worth tearing the dial down over.
	}
}

@action({ UUID: "com.packrat.betterhotkeyspro.encoderhotkey" })
export class EncoderHotkey extends SingletonAction<EncoderHotkeySettings> {
	override onDialRotate(ev: DialRotateEvent<EncoderHotkeySettings>): void {
		const { ticks, settings } = ev.payload;
		if (ticks === 0) return;

		const scroll = settings.rotateMode === "scroll";
		// Hotkey mode needs a bound key to do anything; scroll mode never does.
		const vks = scroll ? [] : expandHotkey(ticks > 0 ? settings.rotateCW : settings.rotateCCW);
		if (!scroll && vks.length === 0) return;

		const stepSize = clamp(settings.stepSize ?? 1, 1, 50);
		const abs = Math.abs(ticks);
		// Fine spins tap once per tick; fast ones (more than a few ticks in one event)
		// get extra taps on top, so a quick flick scrubs further than a slow nudge.
		let count = Math.round(abs * stepSize);
		if (settings.acceleration && abs > 3) count += Math.round((abs - 3) * stepSize);
		const n = Math.max(1, count);

		if (scroll) {
			// One event carrying N notches, not N events: the OS already treats notch
			// count as the magnitude, and apps that smooth-scroll animate it far better
			// than a burst of separate clicks.
			const up = ticks > 0 !== !!settings.invertScroll;
			const amount = up ? n : -n;
			const axis = settings.scrollAxis ?? "vertical";
			try {
				// Same best-effort aim as the Scroll key: fall back to a real wheel event
				// wherever posting to the active window isn't possible.
				if (!(settings.scrollTarget === "active" && wheelToActiveWindow(amount, axis))) {
					sendInputs([mouseWheel(amount, axis)]);
				}
			} catch {
				// A dropped tick mid-spin is not worth tearing the dial down over.
			}
			return;
		}

		for (let i = 0; i < n; i++) tap(vks);
	}

	override onDialDown(ev: DialDownEvent<EncoderHotkeySettings>): void {
		const vks = expandHotkey(ev.payload.settings.push);
		if (vks.length === 0) return;

		try {
			pressKeys(ev.action.id, vks);
		} catch {
			release(ev.action.id);
		}
	}

	override onDialUp(ev: DialUpEvent<EncoderHotkeySettings>): void {
		if (isHeld(ev.action.id)) release(ev.action.id);
	}

	override onTouchTap(ev: TouchTapEvent<EncoderHotkeySettings>): void {
		tap(expandHotkey(ev.payload.settings.touchTap));
	}

	override onWillDisappear(ev: WillDisappearEvent<EncoderHotkeySettings>): void {
		// A push held into a page navigation must not strand the key down.
		release(ev.action.id);
	}
}
