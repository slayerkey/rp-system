import {
	action,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { armedSlot, captureInto, disarm } from "../capture";
import { areaRect, clampPct, type DragSettings } from "../mouse-settings";
import { handlePiProbe } from "../pi-bridge";
import { sleep } from "../util";
import { press, release } from "../held-keys";
import { mouseMoveTo, pctToPixels, sendInputs } from "../input";

/**
 * Press at point A, travel to point B, release. Sliders, paint strokes, drag-and-drop.
 *
 * The travel happens in small steps rather than one jump: many apps only recognise a
 * drag if they see intermediate motion between the button-down and the button-up.
 *
 * The two endpoints can be set by capturing the cursor -- arm "From" or "To" in the
 * inspector, move the pointer there, and press the deck key to read it.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.mousedrag" })
export class MouseDrag extends SingletonAction<DragSettings> {
	private readonly running = new Set<string>();

	override onWillDisappear(ev: WillDisappearEvent<DragSettings>): Promise<void> | void {
		disarm(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<DragSettings>): Promise<void> {
		const context = ev.action.id;

		// Armed for capture: read the cursor into the From or To end instead of dragging.
		const slot = armedSlot(context);
		if (slot && ev.action.isKey()) {
			await captureInto(ev.action, ev.payload.settings, slot);
			return;
		}

		if (this.running.has(context)) return;
		this.running.add(context);

		const s = ev.payload.settings;
		const button = s.button ?? "left";
		const rect = areaRect(s);
		const from = pctToPixels(clampPct(s.fromXPct ?? 25), clampPct(s.fromYPct ?? 50), rect);
		const to = pctToPixels(clampPct(s.toXPct ?? 75), clampPct(s.toYPct ?? 50), rect);
		const duration = Math.max(0, s.durationMs ?? 250);
		const steps = Math.max(1, Math.round(duration / 16)); // ~60 moves/sec

		try {
			// Land at A, then press. Held via the registry so a crash mid-drag releases it.
			sendInputs([mouseMoveTo(from.x, from.y)]);
			await sleep(20);
			press(context, [{ kind: "mouse", button }]);
			await sleep(20);

			for (let i = 1; i <= steps; i++) {
				const t = i / steps;
				const x = Math.round(from.x + (to.x - from.x) * t);
				const y = Math.round(from.y + (to.y - from.y) * t);
				sendInputs([mouseMoveTo(x, y)]);
				await sleep(duration / steps);
			}

			await sleep(20);
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		} finally {
			release(context); // always let the button up, however the drag ended
			this.running.delete(context);
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, DragSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
	}
}
