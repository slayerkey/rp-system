import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { readCache, type TrackerCache } from "../../_shared/src/cache";
import type { HelldiversSnapshot } from "./model";

type HelldiversCache = TrackerCache & { helldiversStats?: HelldiversSnapshot };

export async function readSnapshot(): Promise<HelldiversSnapshot | null> {
	const cache = (await readCache()) as HelldiversCache;
	return cache.helldiversStats ?? null;
}

export async function writeSnapshot(snapshot: HelldiversSnapshot): Promise<void> {
	const cache = await readCache();
	await streamDeck.settings.setGlobalSettings({ ...cache, helldiversStats: snapshot } as unknown as JsonObject);
}

