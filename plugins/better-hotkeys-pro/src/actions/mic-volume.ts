import { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { deviceIdOf, type MicVolumeSettings } from "../mic-settings";
import { handlePiProbe } from "../pi-bridge";
import { nudgeVolume, setVolume } from "../win32/audio";

/**
 * Sets a microphone's input level, or nudges it up/down by a step each press. Shows the
 * resulting level briefly as the key title so a "mic up" button gives feedback.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.micvolume" })
export class MicVolume extends SingletonAction<MicVolumeSettings> {
	override async onKeyDown(ev: KeyDownEvent<MicVolumeSettings>): Promise<void> {
		const s = ev.payload.settings;
		const id = deviceIdOf(s);
		try {
			let level: number;
			if ((s.volMode ?? "set") === "nudge") {
				level = nudgeVolume(id, (s.delta ?? 5) / 100);
			} else {
				const target = Math.min(100, Math.max(0, s.level ?? 75)) / 100;
				setVolume(id, target);
				level = target;
			}
			if (ev.action.isKey()) {
				await ev.action.setTitle(`${Math.round(level * 100)}%`);
				setTimeout(() => void ev.action.setTitle(""), 800);
			}
		} catch {
			await ev.action.showAlert();
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, MicVolumeSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
	}
}
