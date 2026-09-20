import { type ClipboardGlobalSettings, type HistoryEntry, pushEntry } from "../../clipboard-manager/src/history";

export const PRO_HISTORY_LIMIT = 50;
export const PRO_PIN_LIMIT = 20;

export type ProGlobalSettings = ClipboardGlobalSettings & {
	pinned?: HistoryEntry[];
};

function validEntries(entries: HistoryEntry[] | undefined, limit: number): HistoryEntry[] {
	const seen = new Set<string>();
	const clean: HistoryEntry[] = [];
	for (const entry of entries ?? []) {
		if (!entry || typeof entry.text !== "string" || entry.text.length === 0 || !Number.isFinite(entry.copiedAt)) continue;
		if (seen.has(entry.text)) continue;
		seen.add(entry.text);
		clean.push({ text: entry.text, copiedAt: entry.copiedAt });
		if (clean.length === limit) break;
	}
	return clean;
}

export function normaliseState(settings: ProGlobalSettings): ProGlobalSettings {
	return {
		...settings,
		history: validEntries(settings.history, PRO_HISTORY_LIMIT),
		pinned: validEntries(settings.pinned, PRO_PIN_LIMIT)
	};
}

export function allEntries(settings: ProGlobalSettings): HistoryEntry[] {
	const state = normaliseState(settings);
	const pinned = state.pinned ?? [];
	const pinnedText = new Set(pinned.map((entry) => entry.text));
	return [...pinned, ...(state.history ?? []).filter((entry) => !pinnedText.has(entry.text))];
}

export function pinEntry(settings: ProGlobalSettings, entry: HistoryEntry): ProGlobalSettings {
	const state = normaliseState(settings);
	return {
		...state,
		pinned: [entry, ...(state.pinned ?? []).filter((item) => item.text !== entry.text)].slice(0, PRO_PIN_LIMIT),
		history: (state.history ?? []).filter((item) => item.text !== entry.text)
	};
}

export function unpinEntry(settings: ProGlobalSettings, entry: HistoryEntry, now: number = Date.now()): ProGlobalSettings {
	const state = normaliseState(settings);
	const history = pushEntry(state.history ?? [], entry.text, now, PRO_HISTORY_LIMIT) ?? state.history ?? [];
	return {
		...state,
		pinned: (state.pinned ?? []).filter((item) => item.text !== entry.text),
		history
	};
}

export function entriesForSource(settings: ProGlobalSettings, source: "recent" | "pinned"): HistoryEntry[] {
	const state = normaliseState(settings);
	return source === "pinned" ? state.pinned ?? [] : state.history ?? [];
}

export function searchEntries(settings: ProGlobalSettings, query: string): HistoryEntry[] {
	const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return allEntries(settings);
	return allEntries(settings).filter((entry) => {
		const haystack = entry.text.toLocaleLowerCase();
		return terms.every((term) => haystack.includes(term));
	});
}
