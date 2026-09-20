import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { type KeySettings, vksFrom } from "../keys";
import { isHeld, pressKeys, release } from "../held-keys";

/**
 * Press once to hold keys down; press again to release. This is what makes sprint
 * and rotate-lock possible without holding a finger on the deck.
 *
 * The manifest sets DisableAutomaticStates, because Stream Deck's built-in state
 * toggle would advance the icon on press regardless of whether the keys actually
 * went down, and would fight setState. State here is always derived from the
 * held-keys registry, so the icon cannot lie about what is held.
 */
@action({ UUID: "com.packrat.betterhotkeys.togglekey" })
export class ToggleKey extends SingletonAction<KeySettings> {
	override onWillAppear(ev: WillAppearEvent<KeySettings>): Promise<void> | void {
		if (ev.action.isKey()) {
			return ev.action.setState(isHeld(ev.action.id) ? 1 : 0);
		}
	}

	override async onKeyDown(ev: KeyDownEvent<KeySettings>): Promise<void> {
		const context = ev.action.id;

		if (isHeld(context)) {
			release(context);
			if (ev.action.isKey()) await ev.action.setState(0);
			return;
		}

		const vks = vksFrom(ev.payload.settings);
		if (vks.length === 0) {
			await ev.action.showAlert();
			return;
		}

		try {
			pressKeys(context, vks, ev.payload.settings.mode ?? "scancode");
			if (ev.action.isKey()) await ev.action.setState(1);
		} catch (error) {
			release(context);
			if (ev.action.isKey()) await ev.action.setState(0);
			await ev.action.showAlert();
			throw error;
		}
	}

	override onWillDisappear(ev: WillDisappearEvent<KeySettings>): Promise<void> | void {
		// A toggle must not survive page navigation -- an invisible held key that the
		// user can no longer see or press again is the worst possible outcome.
		release(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<KeySettings>): Promise<void> {
		release(ev.action.id);
		if (ev.action.isKey()) await ev.action.setState(0);
	}
}
