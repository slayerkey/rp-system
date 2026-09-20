/** How many copies are kept. Four keys, four slots. */
export const SLOTS = 4;

export type HistoryEntry = {
	/** The full text, never the truncated preview. This is what a press pastes. */
	text: string;
	copiedAt: number;
};

export type ClipboardGlobalSettings = {
	/** Newest first, so index 0 is slot 1. Capped at SLOTS. */
	history?: HistoryEntry[];
};

/**
 * Adds a copy to the front of the history, or reports that nothing changed.
 *
 * Returns null when the text already sits at the front, which happens whenever the user
 * presses copy twice on the same selection. Pushing it would fill the deck with four
 * identical slots.
 */
export function pushEntry(history: HistoryEntry[], text: string, now: number, limit: number = SLOTS): HistoryEntry[] | null {
	if (history[0]?.text === text) return null;
	const safeLimit = Math.max(1, Math.floor(limit));
	return [{ text, copiedAt: now }, ...history.filter((entry) => entry.text !== text)].slice(0, safeLimit);
}

/** The entry a slot key shows, or undefined when fewer things have been copied than that. */
export function entryForSlot(history: HistoryEntry[], slotIndex: number): HistoryEntry | undefined {
	return history[slotIndex - 1];
}
