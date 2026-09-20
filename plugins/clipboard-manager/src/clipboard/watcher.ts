import streamDeck from "@elgato/streamdeck";

import { type ClipboardGlobalSettings, type HistoryEntry, pushEntry, SLOTS } from "../history";
import { read, sequenceNumber } from "./clipboard";

/**
 * How often the clipboard is checked.
 *
 * Windows gets the shorter interval because a tick that finds no change is a single
 * GetClipboardSequenceNumber call and nothing else. macOS has no such counter, so every tick
 * spawns pbpaste and the interval is longer to match what that actually costs.
 */
const INTERVAL_MS = process.platform === "darwin" ? 600 : 400;

/** The last text the watcher saw, so a repeat read is not mistaken for a fresh copy. */
let lastSeen: string | null = null;
let lastSequence: number | null = null;
let timer: NodeJS.Timeout | null = null;
let ticking = false;
let historyLimit = SLOTS;

type WatcherGlobalSettings = ClipboardGlobalSettings & {
	/** Optional data owned by a paid-tier caller. The watcher preserves it without using it. */
	pinned?: HistoryEntry[];
};

async function tick(): Promise<void> {
	// A tick that overruns its interval would otherwise stack up behind this one, and on
	// macOS that means several pbpaste processes racing to report the same clipboard.
	if (ticking) return;
	ticking = true;

	try {
		const sequence = sequenceNumber();
		if (sequence !== null) {
			if (sequence === lastSequence) return;
			lastSequence = sequence;
		}

		// Null means the clipboard holds an image, files, or nothing at all. Lite shows text,
		// so there is nothing to record and nothing to report.
		const text = await read();
		if (text === null || text === lastSeen) return;
		lastSeen = text;

		const settings = await streamDeck.settings.getGlobalSettings<WatcherGlobalSettings>();
		const { history = [] } = settings;
		const next = pushEntry(history, text, Date.now(), historyLimit);
		if (next === null) return;

		await streamDeck.settings.setGlobalSettings({ ...settings, history: next });
		streamDeck.logger.debug(`Recorded a copy of ${text.length} characters. History now holds ${next.length}.`);
	} catch (error) {
		streamDeck.logger.error("Clipboard check failed.", error);
	} finally {
		ticking = false;
	}
}

/**
 * Starts the single clipboard poller. Called once from plugin.ts, never per action instance:
 * the history is one list shared by every slot key, so one watcher fills it however many keys
 * are on the deck, including none.
 *
 * Must run after connect() resolves, because the first change it finds writes global settings
 * and that call never resolves while the websocket is still coming up.
 */
export function startWatcher(options: { historyLimit?: number } = {}): void {
	if (timer) return;
	historyLimit = Math.max(1, Math.floor(options.historyLimit ?? SLOTS));
	timer = setInterval(() => void tick(), INTERVAL_MS);
	streamDeck.logger.info(`Watching the clipboard every ${INTERVAL_MS}ms with ${historyLimit} history entries.`);
}

/**
 * Tells the watcher that a paste just rewrote the clipboard, so the next tick does not read
 * that back as a fresh copy and shuffle the slot the user pressed to the front.
 */
export function noteOwnWrite(text: string): void {
	lastSeen = text;
	lastSequence = sequenceNumber();
}
