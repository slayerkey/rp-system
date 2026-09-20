import {
	action,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { deviceIdOf, type PttSettings } from "../mic-settings";
import { handlePiProbe } from "../pi-bridge";
import { setMute } from "../win32/audio";

/**
 * Hold to talk, release to mute -- or the reverse (push-to-mute). This is the mic use
 * the whole plugin is built around: the deck key behaves like a physical PTT button.
 *
 * "talk" mode: held = live, released = muted (the classic radio button).
 * "mute" mode: held = muted, released = live (cough button).
 *
 * State 1 while held so the key visibly lights during transmission.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.pushtotalk" })
export class PushToTalk extends SingletonAction<PttSettings> {
	override onWillAppear(ev: WillAppearEvent<PttSettings>): Promise<void> | void {
		if (ev.action.isKey()) return ev.action.setState(0);
	}

	override async onKeyDown(ev: KeyDownEvent<PttSettings>): Promise<void> {
		const s = ev.payload.settings;
		const id = deviceIdOf(s);
		const heldMeansMuted = (s.mode ?? "talk") === "mute";
		try {
			setMute(id, heldMeansMuted);
			if (ev.action.isKey()) await ev.action.setState(1);
		} catch {
			await ev.action.showAlert();
		}
	}

	override async onKeyUp(ev: KeyUpEvent<PttSettings>): Promise<void> {
		const s = ev.payload.settings;
		const id = deviceIdOf(s);
		// Resting state is the opposite of the held state.
		const restMuted = (s.mode ?? "talk") === "talk";
		try {
			setMute(id, restMuted);
		} catch {
			/* nothing useful to show on release */
		}
		if (ev.action.isKey()) await ev.action.setState(0);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, PttSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
	}
}
