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

import { captureInto, disarm, isArmed } from "../capture";
import { type ClickSettings, resolvePoint } from "../mouse-settings";
import { handlePiProbe } from "../pi-bridge";
import { mouseButtonEvent, mouseMoveTo, sendInputs } from "../input";

/**
 * Left / right / middle click, either where the cursor already is or at an X/Y
 * percentage of a screen.
 *
 * Stock Stream Deck cannot send mouse buttons at all, so this exists purely because
 * the Hotkey action is keyboard-only.
 */
@action({ UUID: "com.packrat.betterhotkeys.clickmouse" })
export class ClickMouse extends SingletonAction<ClickSettings> {
	override onWillAppear(ev: WillAppearEvent<ClickSettings>): Promise<void> | void {
		if (ev.action.isKey()) return paintButton(ev.action, "clickmouse", ev.payload.settings.button);
	}

	override onWillDisappear(ev: WillDisappearEvent<ClickSettings>): Promise<void> | void {
		disarm(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ClickSettings>): Promise<void> | void {
		if (ev.action.isKey()) return paintButton(ev.action, "clickmouse", ev.payload.settings.button);
	}

	override async onKeyDown(ev: KeyDownEvent<ClickSettings>): Promise<void> {
		const { settings } = ev.payload;

		// While armed, the key reads the cursor instead of clicking -- firing a real
		// click into whatever is under the pointer during setup would be rude.
		if (ev.action.isKey() && isArmed(ev.action.id)) {
			await captureInto(ev.action, settings);
			return;
		}

		const button = settings.button ?? "left";
		try {
			const events: unknown[] = [];
			if (settings.atPoint) {
				const { x, y } = resolvePoint(settings);
				events.push(mouseMoveTo(x, y));
			}
			events.push(mouseButtonEvent(button, true), mouseButtonEvent(button, false));

			// One batch: nothing can slip between the move and the click, so the button
			// can't land somewhere the user didn't aim.
			sendInputs(events);
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, ClickSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
	}
}

/** Keeps the key image showing the mouse button that's actually selected. */
export async function paintButton(
	key: KeyAction,
	folder: string,
	button: string | undefined,
	stateful = false
): Promise<void> {
	const b = button ?? "left";
	if (stateful) {
		await key.setImage(`imgs/actions/${folder}/key_${b}`, { state: 0 });
		await key.setImage(`imgs/actions/${folder}/key_${b}_on`, { state: 1 });
	} else {
		await key.setImage(`imgs/actions/${folder}/key_${b}`);
	}
}
