import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Quote } from "./provider";

export type Channel = "stocks" | "crypto";
type Store = { stocks: Record<string, Quote>; crypto: Record<string, Quote> };

const FILE = join(tmpdir(), "mcc-quote-cache.json");
const WRITE_DELAY_MS = 30_000;

let store: Store = { stocks: {}, crypto: {} };
let timer: ReturnType<typeof setTimeout> | undefined;

/** Load last-known quotes from disk so keys show a value instantly on startup. */
export function loadCache(): Store {
	try {
		const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Store>;
		store = { stocks: parsed.stocks ?? {}, crypto: parsed.crypto ?? {} };
	} catch {
		store = { stocks: {}, crypto: {} };
	}
	return store;
}

/** Record a fresh quote and schedule a throttled write to disk. */
export function remember(channel: Channel, symbol: string, quote: Quote): void {
	store[channel][symbol] = quote;
	if (!timer) {
		timer = setTimeout(() => {
			timer = undefined;
			try {
				writeFileSync(FILE, JSON.stringify(store));
			} catch {
				// Best-effort cache; ignore write failures.
			}
		}, WRITE_DELAY_MS);
	}
}
