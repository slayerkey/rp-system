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

import { keyImage, messageBadge, previewText, slotBadge } from "../badge";
import { write } from "../clipboard/clipboard";
import { noteOwnWrite } from "../clipboard/watcher";
import { type ClipboardGlobalSettings, type HistoryEntry } from "../history";
import { ensureAccessibilityPermission, sendPasteChord } from "../paste/input";

export type ClipboardDialSettings = {
	index?: number;
};

@action({ UUID: "com.packrat.clipboard.dial" })
export class ClipboardDial extends SingletonAction<ClipboardDialSettings> {
	override async onWillAppear(ev: WillAppearEvent<ClipboardDialSettings>): Promise<void> {
		if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ClipboardDialSettings>): Promise<void> {
		if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onDialRotate(ev: DialRotateEvent<ClipboardDialSettings>): Promise<void> {
		const history = await readHistory();
		if (history.length === 0) {
			if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
			return;
		}

		const index = normalise((ev.payload.settings.index ?? 0) + ev.payload.ticks, history.length);
		const settings = { ...ev.payload.settings, index };
		await ev.action.setSettings(settings);
		if (ev.action.isDial()) await this.paint(ev.action, settings, history);
	}

	override async onDialDown(ev: DialDownEvent<ClipboardDialSettings>): Promise<void> {
		const history = await readHistory();
		const entry = history[normalise(ev.payload.settings.index ?? 0, history.length)];
		if (!entry) return;

		try {
			await paste(entry);
		} catch (error) {
			streamDeck.logger.error("Clipboard dial paste failed.", error);
		}
	}

	/** Touching the strip is a fast way back to the newest copy. */
	override async onTouchTap(ev: TouchTapEvent<ClipboardDialSettings>): Promise<void> {
		const settings = { ...ev.payload.settings, index: 0 };
		await ev.action.setSettings(settings);
		if (ev.action.isDial()) await this.paint(ev.action, settings);
	}

	private async paint(
		dial: DialAction<ClipboardDialSettings>,
		settings: ClipboardDialSettings,
		history: HistoryEntry[] = []
	): Promise<void> {
		if (history.length === 0) history = await readHistory();

		if (history.length === 0) {
			await dial.setFeedback({
				icon: keyImage(messageBadge("CLIPBOARD", "no copied text", "copy something first")),
				title: "Clipboard",
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
					label: `COPY ${index + 1}/${history.length}`,
					preview: previewText(entry.text, 40),
					pasteMode: "direct"
				})
			),
			title: `Clipboard ${index + 1}/${history.length}`,
			value: preview
		});
	}
}

function normalise(index: number, length: number): number {
	if (length <= 0) return 0;
	return ((index % length) + length) % length;
}

async function readHistory(): Promise<HistoryEntry[]> {
	const { history = [] } = await streamDeck.settings.getGlobalSettings<ClipboardGlobalSettings>();
	return history;
}

async function paste(entry: HistoryEntry): Promise<void> {
	if (!(await write(entry.text))) throw new Error("Another program is holding the clipboard open.");
	noteOwnWrite(entry.text);
	if (!(await ensureAccessibilityPermission())) {
		throw new Error("Accessibility permission is required to paste from the Stream Deck.");
	}
	sendPasteChord();
}
