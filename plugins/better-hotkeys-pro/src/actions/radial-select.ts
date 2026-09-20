import { action, type KeyDownEvent, type SendToPluginEvent, SingletonAction, type WillAppearEvent } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { type RadialSettings, radialTarget } from "../mouse-settings";
import { handlePiProbe } from "../pi-bridge";
import { radialSvg } from "../radial-icon";
import { sleep } from "../util";
import { press, release } from "../held-keys";
import { cursorPos, mouseButtonEvent, mouseMoveBy, mouseMoveTo, sendInputs } from "../input";

/**
 * Picks one slot from an in-game radial / wheel menu with a single deck key.
 *
 * The order here is load-bearing and was got wrong the first time: the selection is
 * committed (open key released) BEFORE the cursor is returned. Returning first snaps the
 * cursor back to the centre while the wheel is still open, so the game commits "nothing"
 * -- and because the flick-out and snap-back are milliseconds apart, it looks like the
 * cursor never moved at all.
 *
 * Wheels are fuzzy -- they only want a rough direction -- so once the timing is right
 * this is reliable, and it generalises to any wheel: weapons, emotes, builds, poses.
 */
@action({ UUID: "com.packrat.betterhotkeyspro.radialselect" })
export class RadialSelect extends SingletonAction<RadialSettings> {
	private readonly running = new Set<string>();

	override onWillAppear(ev: WillAppearEvent<RadialSettings>): Promise<void> | void {
		// The key face shows the actual direction and reach that's configured.
		if (ev.action.isKey()) return ev.action.setImage(radialSvg(ev.payload.settings));
	}

	override async onKeyDown(ev: KeyDownEvent<RadialSettings>): Promise<void> {
		const context = ev.action.id;
		if (this.running.has(context)) return;
		this.running.add(context);

		const s = ev.payload.settings;
		const openDelay = Math.max(0, s.openDelayMs ?? 120);
		const hold = Math.max(0, s.holdMs ?? 80);
		const step = Math.max(0, s.stepDelayMs ?? 25);
		const startedAt = cursorPos();
		const { origin, target } = radialTarget(s);

		try {
			if (s.openVk) {
				press(context, [{ kind: "key", vk: s.openVk, mode: "scancode" }]);
				await sleep(openDelay); // let the wheel actually appear before moving
			}

			if ((s.moveStyle ?? "point") === "flick") {
				// Centre, then a relative shove in the chosen direction -- what raw-input
				// wheels (cursor hidden) actually read.
				sendInputs([mouseMoveTo(origin.x, origin.y)]);
				await sleep(step);
				sendInputs([mouseMoveBy(target.x - origin.x, target.y - origin.y)]);
			} else {
				sendInputs([mouseMoveTo(target.x, target.y)]);
			}
			await sleep(hold); // hold on the slot so the game registers the hover

			if (s.confirmClick) {
				sendInputs([mouseButtonEvent("left", true), mouseButtonEvent("left", false)]);
				await sleep(step);
			}

			// Commit FIRST -- release the open key while the cursor is still on the slot.
			if (s.openVk) {
				release(context);
				await sleep(step);
			}

			// Only now is it safe to move the cursor back; the wheel has closed.
			if (s.returnCursor) {
				sendInputs([mouseMoveTo(startedAt.x, startedAt.y)]);
			}
		} catch (error) {
			await ev.action.showAlert();
			throw error;
		} finally {
			if (s.openVk) release(context); // safety net if we threw before committing
			this.running.delete(context);
		}
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, RadialSettings>): Promise<void> {
		await handlePiProbe(ev.action.id, ev.payload);
		// A settings change from the PI repaints the face to match.
		if (ev.action.isKey()) await ev.action.setImage(radialSvg(await ev.action.getSettings()));
	}
}
