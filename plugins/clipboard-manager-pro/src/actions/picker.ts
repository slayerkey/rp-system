import streamDeck, {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { keyImage, messageBadge, previewText, slotBadge } from "../../../clipboard-manager/src/badge";
import { searchEntries, type ProGlobalSettings } from "../history-pro";
import { pasteEntry, type PasteMode } from "../paste-entry";
import { readState } from "../store";

export type PickerSettings = {
	query?: string;
	selectedCopiedAt?: number;
	customName?: string;
	previewLength?: number;
	pasteMode?: PasteMode;
};

const HOLD_MS = 600;

@action({ UUID: "com.packrat.clipboardpro.picker" })
export class HistoryPicker extends SingletonAction<PickerSettings> {
	private readonly config = new Map<string, PickerSettings>();
	private readonly pressedAt = new Map<string, number>();

	constructor() {
		super();
		streamDeck.settings.onDidReceiveGlobalSettings<ProGlobalSettings>((ev) => void this.repaintAll(ev.settings));
	}

	override async onWillAppear(ev: WillAppearEvent<PickerSettings>): Promise<void> {
		this.config.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings, await readState());
	}

	override onWillDisappear(ev: WillDisappearEvent<PickerSettings>): void {
		this.config.delete(ev.action.id);
		this.pressedAt.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<PickerSettings>): Promise<void> {
		this.config.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings, await readState());
	}

	override onKeyDown(ev: KeyDownEvent<PickerSettings>): void {
		this.pressedAt.set(ev.action.id, Date.now());
	}

	override async onKeyUp(ev: KeyUpEvent<PickerSettings>): Promise<void> {
		const heldFor = Date.now() - (this.pressedAt.get(ev.action.id) ?? Date.now());
		this.pressedAt.delete(ev.action.id);
		const settings = ev.payload.settings;
		const state = await readState();
		const matches = searchEntries(state, settings.query ?? "");
		if (matches.length === 0) {
			await ev.action.showAlert();
			return;
		}

		const currentIndex = Math.max(0, matches.findIndex((entry) => entry.copiedAt === settings.selectedCopiedAt));
		if (heldFor >= HOLD_MS) {
			const next = matches[(currentIndex + 1) % matches.length];
			const updated = { ...settings, selectedCopiedAt: next.copiedAt };
			this.config.set(ev.action.id, updated);
			await ev.action.setSettings(updated);
			await this.paint(ev.action, updated, state);
			await ev.action.showOk();
			return;
		}

		try {
			await pasteEntry(matches[currentIndex].text, settings.pasteMode ?? "direct");
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error("History picker paste failed.", error);
			await ev.action.showAlert();
		}
	}

	private async repaintAll(state: ProGlobalSettings): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, this.config.get(instance.id) ?? {}, state);
		}
	}

	private async paint(key: KeyAction<PickerSettings>, settings: PickerSettings, state: ProGlobalSettings): Promise<void> {
		const matches = searchEntries(state, settings.query ?? "");
		const selected = matches.find((entry) => entry.copiedAt === settings.selectedCopiedAt) ?? matches[0];
		if (!selected) {
			await key.setImage(keyImage(messageBadge(settings.customName?.trim() || "SEARCH", "no match", "change filter")));
			return;
		}
		await key.setImage(
			keyImage(
				slotBadge({
					slotIndex: 1,
					label: settings.customName?.trim() || `SEARCH ${matches.indexOf(selected) + 1}/${matches.length}`,
					preview: previewText(selected.text, settings.previewLength ?? 40),
					pasteMode: settings.pasteMode ?? "direct"
				})
			)
		);
	}
}
