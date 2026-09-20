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

import { emptySlotBadge, keyImage, previewText, slotBadge } from "../../../clipboard-manager/src/badge";
import { type HistoryEntry } from "../../../clipboard-manager/src/history";
import { entriesForSource, pinEntry, type ProGlobalSettings, unpinEntry } from "../history-pro";
import { pasteEntry, type PasteMode } from "../paste-entry";
import { readState, writeState } from "../store";

export type EntrySettings = {
	source?: "recent" | "pinned";
	slotIndex?: number;
	customName?: string;
	previewLength?: number;
	pasteMode?: PasteMode;
};

const HOLD_MS = 600;

@action({ UUID: "com.packrat.clipboardpro.slot" })
export class ClipboardEntry extends SingletonAction<EntrySettings> {
	private readonly config = new Map<string, EntrySettings>();
	private readonly pressedAt = new Map<string, number>();

	constructor() {
		super();
		streamDeck.settings.onDidReceiveGlobalSettings<ProGlobalSettings>((ev) => void this.repaintAll(ev.settings));
	}

	override async onWillAppear(ev: WillAppearEvent<EntrySettings>): Promise<void> {
		this.config.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings, await readState());
	}

	override onWillDisappear(ev: WillDisappearEvent<EntrySettings>): void {
		this.config.delete(ev.action.id);
		this.pressedAt.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<EntrySettings>): Promise<void> {
		this.config.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings, await readState());
	}

	override onKeyDown(ev: KeyDownEvent<EntrySettings>): void {
		this.pressedAt.set(ev.action.id, Date.now());
	}

	override async onKeyUp(ev: KeyUpEvent<EntrySettings>): Promise<void> {
		const heldFor = Date.now() - (this.pressedAt.get(ev.action.id) ?? Date.now());
		this.pressedAt.delete(ev.action.id);
		const settings = ev.payload.settings;
		const state = await readState();
		const source = settings.source ?? "recent";
		const entry = entriesForSource(state, source)[(settings.slotIndex ?? 1) - 1];
		if (!entry) {
			await ev.action.showAlert();
			return;
		}

		try {
			if (heldFor >= HOLD_MS) {
				await writeState(source === "pinned" ? unpinEntry(state, entry) : pinEntry(state, entry));
			} else {
				await pasteEntry(entry.text, settings.pasteMode ?? "direct");
			}
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error("Clipboard entry action failed.", error);
			await ev.action.showAlert();
		}
	}

	private async repaintAll(state: ProGlobalSettings): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, this.config.get(instance.id) ?? {}, state);
		}
	}

	private async paint(key: KeyAction<EntrySettings>, settings: EntrySettings, state: ProGlobalSettings): Promise<void> {
		const source = settings.source ?? "recent";
		const slotIndex = settings.slotIndex ?? 1;
		const entry = entriesForSource(state, source)[slotIndex - 1];
		if (!entry) {
			await key.setImage(keyImage(emptySlotBadge({ slotIndex, reason: (state.history?.length ?? 0) === 0 ? "cold" : "short" })));
			return;
		}
		await key.setImage(keyImage(entryBadge(entry, settings, source, slotIndex)));
	}
}

function entryBadge(entry: HistoryEntry, settings: EntrySettings, source: "recent" | "pinned", slotIndex: number): string {
	return slotBadge({
		slotIndex,
		label: settings.customName?.trim() || `${source === "pinned" ? "PIN" : "RECENT"} ${slotIndex}`,
		preview: previewText(entry.text, settings.previewLength ?? 40),
		pasteMode: settings.pasteMode ?? "direct"
	});
}
