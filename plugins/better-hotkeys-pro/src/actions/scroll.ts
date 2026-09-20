import { action, type KeyDownEvent, SingletonAction } from "@elgato/streamdeck";

import type { ScrollSettings } from "../mouse-settings";
import { clamp, sleep } from "../util";
import { mouseWheel, sendInputs, wheelToActiveWindow } from "../input";

/**
 * Turns the mouse wheel by N notches per press, up, down, left or right. Some games bind
 * weapon or tool cycling to the wheel, and stock Stream Deck can't reach it at all.
 *
 * A single press can also throw several notches with a short gap between them, for menus
 * that ignore one big jump but follow a series of clicks.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.scroll" })
export class Scroll extends SingletonAction<ScrollSettings> {
	override async onKeyDown(ev: KeyDownEvent<ScrollSettings>): Promise<void> {
		const s = ev.payload.settings;
		const notches = s.notches ?? -1; // default: one notch down, the common "next" direction
		const repeat = Math.round(clamp(s.repeat ?? 1, 1, 100));
		const interval = Math.max(0, s.interval ?? 40);
		const axis = s.axis ?? "vertical";

		// Aiming at the active window is best effort: it can't work on macOS, and it fails on
		// a window that has nothing to post to. Falling through to a real wheel event leaves
		// those cases behaving exactly as they did before the setting existed.
		const turn = (): void => {
			if (s.target === "active" && wheelToActiveWindow(notches, axis)) return;
			sendInputs([mouseWheel(notches, axis)]);
		};

		try {
			for (let i = 0; i < repeat; i++) {
				turn();
				if (i < repeat - 1) await sleep(interval);
			}
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		}
	}
}
