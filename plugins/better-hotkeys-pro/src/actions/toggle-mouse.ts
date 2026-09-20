import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import type { HoldMouseSettings } from "../mouse-settings";
import { isHeld, press, release } from "../held-keys";
import { paintButton } from "./click-mouse";

/**
 * Press once to hold a mouse button down, press again to let go.
 *
 * The hands-free counterpart to Hold Mouse Button: rotate-lock you don't have to keep
 * a finger on, or drag-panning across a long canvas.
 *
 * Worth knowing: with left-button toggled on, the machine behaves as though you are
 * mid-drag everywhere -- including over the Stream Deck app itself. Pressing the deck
 * key again still releases it, because the deck key isn't the mouse.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.togglemouse" })
export class ToggleMouse extends SingletonAction<HoldMouseSettings> {
	override async onWillAppear(ev: WillAppearEvent<HoldMouseSettings>): Promise<void> {
		if (!ev.action.isKey()) return;
		await paintButton(ev.action, "togglemouse", ev.payload.settings.button, true);
		await ev.action.setState(isHeld(ev.action.id) ? 1 : 0);
	}

	override async onKeyDown(ev: KeyDownEvent<HoldMouseSettings>): Promise<void> {
		const context = ev.action.id;

		if (isHeld(context)) {
			release(context);
			if (ev.action.isKey()) await ev.action.setState(0);
			return;
		}

		try {
			press(context, [{ kind: "mouse", button: ev.payload.settings.button ?? "left" }]);
			if (ev.action.isKey()) await ev.action.setState(1);
		} catch (error) {
			release(context);
			if (ev.action.isKey()) await ev.action.setState(0);
			await ev.action.showAlert();
			throw error;
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<HoldMouseSettings>): Promise<void> | void {
		// A toggle must not survive page navigation: a held button the user can no
		// longer see or press again is the worst possible outcome.
		release(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<HoldMouseSettings>): Promise<void> {
		release(ev.action.id);
		if (!ev.action.isKey()) return;
		await paintButton(ev.action, "togglemouse", ev.payload.settings.button, true);
		await ev.action.setState(0);
	}
}
