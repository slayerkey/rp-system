import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { emptySlotBadge, keyImage, previewText, slotBadge } from "../badge";
import { write } from "../clipboard/clipboard";
import { noteOwnWrite } from "../clipboard/watcher";
import { type ClipboardGlobalSettings, entryForSlot, type HistoryEntry } from "../history";
import { ensureAccessibilityPermission, sendPasteChord } from "../paste/input";

export type SlotSettings = {
	/** Which copy this key holds. 1 is the most recent, matching how the keys read left to right. */
	slotIndex?: number;
	previewLength?: number;
	/** `direct` pastes into whatever has focus. `restore` only puts the text back on the clipboard. */
	pasteMode?: "direct" | "restore";
};

const DEFAULT_PREVIEW_LENGTH = 40;

@action({ UUID: "com.packrat.clipboard.slot" })
export class ClipboardSlot extends SingletonAction<SlotSettings> {
	/** Per key settings, kept here because a key's settings are only readable asynchronously. */
	private readonly config = new Map<string, SlotSettings>();

	constructor() {
		super();

		// The watcher writes the history to global settings, and Stream Deck echoes that back
		// here. Repainting from the echo is what keeps every slot key current without each one
		// polling the clipboard for itself.
		streamDeck.settings.onDidReceiveGlobalSettings<ClipboardGlobalSettings>((ev) => {
			void this.repaintAll(ev.settings.history ?? []);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<SlotSettings>): Promise<void> {
		this.config.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings, await readHistory());
	}

	override onWillDisappear(ev: WillDisappearEvent<SlotSettings>): void {
		this.config.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SlotSettings>): Promise<void> {
		this.config.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings, await readHistory());
	}

	/** One press, one action: put the slot's text back on the clipboard, then paste it. */
	override async onKeyDown(ev: KeyDownEvent<SlotSettings>): Promise<void> {
		const settings = ev.payload.settings;
		const entry = settings.slotIndex ? entryForSlot(await readHistory(), settings.slotIndex) : undefined;
		if (!entry) {
			await ev.action.showAlert();
			return;
		}

		try {
			if (!(await write(entry.text))) {
				throw new Error("Another program is holding the clipboard open.");
			}
			noteOwnWrite(entry.text);

			if ((settings.pasteMode ?? "direct") === "direct") {
				// Throws with the System Settings instructions when macOS has not granted
				// Accessibility, which the catch below turns into a visible alert on the key.
				if (!(await ensureAccessibilityPermission())) {
					throw new Error(
						"Accessibility permission not granted. Open System Settings > Privacy & Security > Accessibility, enable Stream Deck, then try again."
					);
				}
				sendPasteChord();
			}

			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Slot ${settings.slotIndex} could not be pasted.`, error);
			await ev.action.showAlert();
		}
	}

	private async repaintAll(history: HistoryEntry[]): Promise<void> {
		for (const instance of this.actions) {
			if (!instance.isKey()) continue;
			await this.paint(instance, this.config.get(instance.id) ?? {}, history);
		}
	}

	private async paint(key: KeyAction<SlotSettings>, settings: SlotSettings, history: HistoryEntry[]): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));

		if (!settings.slotIndex) {
			await show(emptySlotBadge({ slotIndex: 0, reason: "pick" }));
			return;
		}

		const entry = entryForSlot(history, settings.slotIndex);
		if (!entry) {
			await show(emptySlotBadge({ slotIndex: settings.slotIndex, reason: history.length === 0 ? "cold" : "short" }));
			return;
		}

		await show(
			slotBadge({
				slotIndex: settings.slotIndex,
				preview: previewText(entry.text, settings.previewLength ?? DEFAULT_PREVIEW_LENGTH),
				pasteMode: settings.pasteMode ?? "direct"
			})
		);
	}
}

async function readHistory(): Promise<HistoryEntry[]> {
	const { history = [] } = await streamDeck.settings.getGlobalSettings<ClipboardGlobalSettings>();
	return history;
}
