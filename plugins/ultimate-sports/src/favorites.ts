/**
 * The one favourites list, shared by every key on the deck.
 *
 * This is the thing a pile of separate trackers cannot do. In a standalone tracker each key is
 * configured on its own and knows only its own team; here the list is picked once and every key
 * reads it, which is what makes a single "my teams" key possible at all.
 *
 * Stored in Stream Deck's global settings beside the tracker cache, for the same reasons the cache
 * lives there: every action instance sees the same copy, and it survives a plugin restart. Entries
 * are qualified references ("nfl::12"), never bare ESPN ids, because an id alone is ambiguous the
 * moment two leagues are registered.
 */
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

/** Everything else in global settings belongs to the tracker cache, which must survive a write. */
type GlobalShape = Record<string, unknown> & { favorites?: unknown };

const KEY = "favorites";

function clean(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	for (const item of raw) if (typeof item === "string" && item) seen.add(item);
	return [...seen];
}

export async function readFavorites(): Promise<string[]> {
	const all = ((await streamDeck.settings.getGlobalSettings()) ?? {}) as GlobalShape;
	return clean(all[KEY]);
}

/**
 * Replaces the list.
 *
 * Read-modify-write over the whole global settings object, the same shape patchCache uses, so a
 * favourites write never drops a cached league and a cache write never drops the favourites.
 */
export async function writeFavorites(refs: string[]): Promise<void> {
	const all = ((await streamDeck.settings.getGlobalSettings()) ?? {}) as GlobalShape;
	await streamDeck.settings.setGlobalSettings({ ...all, [KEY]: clean(refs) } as unknown as JsonObject);
}
