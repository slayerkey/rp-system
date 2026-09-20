import {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { deviceIdOf, type MicSettings } from "../mic-settings";
import { handlePiProbe } from "../pi-bridge";
import { getMute, toggleMute } from "../win32/audio";

/**
 * One button that mutes / unmutes a microphone at the Windows level -- every app sees
 * it muted, so it works for Discord, OBS, games, everything at once. State 0 = live,
 * state 1 = muted, driven from the real device state so the icon can't lie.
 *
 * A slow shared poll keeps the icon honest when something else changes the mute (muting
 * in Discord, a headset button, Voicemeeter). It only runs while a mute button is
 * actually on screen.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.mutemic" })
export class MuteMic extends SingletonAction<MicSettings> {
	private static readonly visible = new Map<string, { action: KeyAction; id: string | null }>();
	private static poll: NodeJS.Timeout | undefined;

	override async onWillAppear(ev: WillAppearEvent<MicSettings>): Promise<void> {
		if (!ev.action.isKey()) return;
		MuteMic.visible.set(ev.action.id, { action: ev.action, id: deviceIdOf(ev.payload.settings) });
		MuteMic.ensurePolling();
		await this.paint(ev.action, deviceIdOf(ev.payload.settings));
	}

	override onWillDisappear(ev: WillDisappearEvent<MicSettings>): Promise<void> | void {
		MuteMic.visible.delete(ev.action.id);
		MuteMic.ensurePolling();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MicSettings>): Promise<void> {
		if (!ev.action.isKey()) return;
		MuteMic.visible.set(ev.action.id, { action: ev.action, id: deviceIdOf(ev.payload.settings) });
		await this.paint(ev.action, deviceIdOf(ev.payload.settings));
	}

	override async onKeyDown(ev: KeyDownEvent<MicSettings>): Promise<void> {
		const id = deviceIdOf(ev.payload.settings);
		try {
			const muted = toggleMute(id);
			if (ev.action.isKey()) await ev.action.setState(muted ? 1 : 0);
		} catch {
			await ev.action.showAlert(); // device vanished (unplugged headset), etc.
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, MicSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
	}

	private async paint(action: KeyAction, id: string | null): Promise<void> {
		const muted = getMute(id);
		if (muted === null) {
			await action.showAlert();
			return;
		}
		await action.setState(muted ? 1 : 0);
	}

	private static ensurePolling(): void {
		if (MuteMic.visible.size > 0 && !MuteMic.poll) {
			MuteMic.poll = setInterval(() => MuteMic.refresh(), 1000);
		} else if (MuteMic.visible.size === 0 && MuteMic.poll) {
			clearInterval(MuteMic.poll);
			MuteMic.poll = undefined;
		}
	}

	private static refresh(): void {
		for (const { action, id } of MuteMic.visible.values()) {
			const muted = getMute(id);
			if (muted !== null) void action.setState(muted ? 1 : 0);
		}
	}
}
