import streamDeck, {
	action,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillAppearEvent
} from "@elgato/streamdeck";

import { keyImage, messageBadge, previewText, slotBadge } from "../../../clipboard-manager/src/badge";
import { pasteEntry } from "../paste-entry";
import { readState } from "../store";

export type ClipboardProDialSettings = {
	index?: number;
};

@action({ UUID: "com.packrat.clipboardpro.dial" })
export class ClipboardProDial extends SingletonAction<ClipboardProDialSettings> {
	override async onWillAppear(ev: WillAppearEvent<ClipboardProDialSettings>): Promise<void> {
		if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ClipboardProDialSettings>): Promise<void> {
		if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onDialRotate(ev: DialRotateEvent<ClipboardProDialSettings>): Promise<void> {
		const history = (await readState()).history ?? [];
		if (history.length === 0) {
			if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
			return;
		}

		const index = normalise((ev.payload.settings.index ?? 0) + ev.payload.ticks, history.length);
		const settings = { ...ev.payload.settings, index };
		await ev.action.setSettings(settings);
		if (ev.action.isDial()) await this.paint(ev.action, settings, history);
	}

	override async onDialDown(ev: DialDownEvent<ClipboardProDialSettings>): Promise<void> {
		const history = (await readState()).history ?? [];
		const entry = history[normalise(ev.payload.settings.index ?? 0, history.length)];
		if (!entry) return;

		try {
			await pasteEntry(entry.text, "direct");
		} catch (error) {
			streamDeck.logger.error("Clipboard Pro dial paste failed.", error);
		}
	}

	/** Touching the strip returns directly to the newest history entry. */
	override async onTouchTap(ev: TouchTapEvent<ClipboardProDialSettings>): Promise<void> {
		const settings = { ...ev.payload.settings, index: 0 };
		await ev.action.setSettings(settings);
		if (ev.action.isDial()) await this.paint(ev.action, settings);
	}

	private async paint(
		dial: DialAction<ClipboardProDialSettings>,
		settings: ClipboardProDialSettings,
		history: Array<{ text: string; copiedAt: number }> = []
	): Promise<void> {
		if (history.length === 0) history = (await readState()).history ?? [];

		if (history.length === 0) {
			await dial.setFeedback({
				icon: keyImage(messageBadge("HISTORY", "no copied text", "copy something first")),
				title: "Clipboard Pro",
				value: "No history"
			});
			return;
		}

		const index = normalise(settings.index ?? 0, history.length);
		const entry = history[index];
		const preview = previewText(entry.text, 90);

		await dial.setFeedback({
			icon: keyImage(
				slotBadge({
					slotIndex: index + 1,
					label: `HISTORY ${index + 1}/${history.length}`,
					preview: previewText(entry.text, 40),
					pasteMode: "direct"
				})
			),
			title: `Clipboard Pro ${index + 1}/${history.length}`,
			value: preview
		});
	}
}

function normalise(index: number, length: number): number {
	if (length <= 0) return 0;
	return ((index % length) + length) % length;
}
