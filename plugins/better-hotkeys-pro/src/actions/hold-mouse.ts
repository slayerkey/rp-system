import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import type { HoldMouseSettings } from "../mouse-settings";
import { isHeld, press, release } from "../held-keys";
import { paintButton } from "./click-mouse";

/**
 * Holds a mouse button down while the Stream Deck key is held. Rotate-lock,
 * drag-panning, hold-to-aim.
 *
 * Mouse buttons go through the same held-input registry and crash journal as keys --
 * a stuck right-button is worse than a stuck Shift, because you can't even dismiss the
 * menu it opens.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.holdmouse" })
export class HoldMouse extends SingletonAction<HoldMouseSettings> {
	override async onWillAppear(ev: WillAppearEvent<HoldMouseSettings>): Promise<void> {
		if (!ev.action.isKey()) return;
		await paintButton(ev.action, "holdmouse", ev.payload.settings.button, true);
		await ev.action.setState(isHeld(ev.action.id) ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent<HoldMouseSettings>): Promise<void> {
		try {
			press(ev.action.id, [{ kind: "mouse", button: ev.payload.settings.button ?? "left" }]);
			if (ev.action.isKey()) await ev.action.setState(1);
		} catch (error) {
			release(ev.action.id);
			if (ev.action.isKey()) await ev.action.setState(0);
			await ev.action.showAlert();
			throw error;
		}
	}

	override async onKeyUp(ev: KeyUpEvent<HoldMouseSettings>): Promise<void> {
		release(ev.action.id);
		if (ev.action.isKey()) await ev.action.setState(0);
	}

	override onWillDisappear(ev: WillDisappearEvent<HoldMouseSettings>): Promise<void> | void {
		release(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<HoldMouseSettings>): Promise<void> {
		// The button being held is the old one; drop it before the new choice applies.
		release(ev.action.id);
		if (!ev.action.isKey()) return;
		await paintButton(ev.action, "holdmouse", ev.payload.settings.button, true);
		await ev.action.setState(0);
	}
}
