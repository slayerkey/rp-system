import {
	action,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { type KeySettings, vksFrom } from "../keys";
import { isHeld, pressKeys, release } from "../held-keys";

/**
 * Holds keys down for exactly as long as the Stream Deck key is physically held.
 *
 * This is the primitive the stock Hotkey action lacks: it always pairs key-down with
 * key-up, so it can only ever tap.
 *
 * Note: inside a Multi Action, Stream Deck delivers keyUp immediately after keyDown,
 * so this degrades to a tap. That is correct behaviour, not a bug.
 */
@action({ UUID: "com.packrat.betterhotkeys.holdkey" })
export class HoldKey extends SingletonAction<KeySettings> {
	override onWillAppear(ev: WillAppearEvent<KeySettings>): Promise<void> | void {
		// State is derived from what is actually held, never from payload.state.
		if (ev.action.isKey()) {
			return ev.action.setState(isHeld(ev.action.id) ? 1 : 0);
		}
	}

	override async onKeyDown(ev: KeyDownEvent<KeySettings>): Promise<void> {
		const vks = vksFrom(ev.payload.settings);
		if (vks.length === 0) {
			await ev.action.showAlert();
			return;
		}

		try {
			pressKeys(ev.action.id, vks, ev.payload.settings.mode ?? "scancode");
			if (ev.action.isKey()) await ev.action.setState(1);
		} catch (error) {
			// Never let the icon claim a key is held when the press failed.
			release(ev.action.id);
			if (ev.action.isKey()) await ev.action.setState(0);
			await ev.action.showAlert();
			throw error;
		}
	}

	override async onKeyUp(ev: KeyUpEvent<KeySettings>): Promise<void> {
		release(ev.action.id);
		if (ev.action.isKey()) await ev.action.setState(0);
	}

	override onWillDisappear(ev: WillDisappearEvent<KeySettings>): Promise<void> | void {
		// Page/profile navigation while held must not strand the key down.
		release(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<KeySettings>): Promise<void> {
		// The old key set is the one we are holding; drop it before the new one applies.
		release(ev.action.id);
		if (ev.action.isKey()) await ev.action.setState(0);
	}
}
