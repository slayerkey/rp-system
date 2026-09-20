import {
	action,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { captureInto, disarm, isArmed } from "../capture";
import { type MoveSettings, resolvePoint } from "../mouse-settings";
import { handlePiProbe } from "../pi-bridge";
import { mouseMoveBy, mouseMoveTo, sendInputs } from "../input";

/**
 * Moves the cursor, either to an X/Y percentage of a screen or by a pixel offset.
 *
 * Percentages rather than pixels so a button set up on 1080p still lands in the right
 * place on 1440p or 4K.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.movemouse" })
export class MoveMouse extends SingletonAction<MoveSettings> {
	override onWillDisappear(ev: WillDisappearEvent<MoveSettings>): Promise<void> | void {
		disarm(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<MoveSettings>): Promise<void> {
		const { settings } = ev.payload;

		// While armed, the key reads the cursor instead of moving it -- otherwise the
		// capture would only ever record where this button already points.
		if (ev.action.isKey() && isArmed(ev.action.id)) {
			await captureInto(ev.action, settings);
			return;
		}

		try {
			if (settings.relative) {
				// Pixels, not percentages: a nudge is a nudge regardless of screen size.
				sendInputs([mouseMoveBy(settings.dx ?? 0, settings.dy ?? 0)]);
			} else {
				const { x, y } = resolvePoint(settings);
				sendInputs([mouseMoveTo(x, y)]);
			}
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, MoveSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
	}
}
