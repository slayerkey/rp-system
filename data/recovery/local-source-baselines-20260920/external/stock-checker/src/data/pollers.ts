import streamDeck from "@elgato/streamdeck";

import { DEFAULTS, MARKET_CLOSED_INTERVAL_MS, RATE } from "../config";
import { getMarketState } from "../market/calendar";
import type { GlobalSettings } from "../settings";
import { loadCache, remember } from "./cache";
import { CoinGeckoProvider } from "./coingecko";
import { FinnhubProvider } from "./finnhub";
import { Poller } from "./poller";

let finnhubKey: string | undefined;
let refreshSeconds = DEFAULTS.refreshSeconds;

const stockProvider = new FinnhubProvider();
const cryptoProvider = new CoinGeckoProvider();

/** Equities use the user's free Finnhub key; slow right down when markets are closed. */
export const equityPoller = new Poller(
	stockProvider,
	() => finnhubKey,
	() =>
		getMarketState().session === "closed"
			? Math.max(refreshSeconds * 1000, MARKET_CLOSED_INTERVAL_MS)
			: refreshSeconds * 1000,
	{
		creditsPerMinute: RATE.stocksPerMinute,
		costPerSymbol: true,
		requiresKey: true,
		onQuote: (symbol, quote) => remember("stocks", symbol, quote),
	},
);

/** Crypto needs no key and one request covers every coin. */
export const cryptoPoller = new Poller(cryptoProvider, () => "", () => refreshSeconds * 1000, {
	creditsPerMinute: RATE.cryptoPerMinute,
	costPerSymbol: false,
	requiresKey: false,
	onQuote: (symbol, quote) => remember("crypto", symbol, quote),
});

/** The user's Finnhub key, for the low-frequency metrics/earnings fetchers (52w range, earnings date). */
export function getFinnhubKey(): string | undefined {
	return finnhubKey;
}

function apply(settings: GlobalSettings): void {
	finnhubKey = settings.finnhubApiKey?.trim() || undefined;
	const seconds = Number(settings.refreshSeconds);
	if (Number.isFinite(seconds) && seconds >= 15) {
		refreshSeconds = seconds;
	}
}

/** Seed caches, load global settings once connected, and keep pollers in sync. */
export async function initGlobalSettings(): Promise<void> {
	const cache = loadCache();
	for (const [symbol, quote] of Object.entries(cache.stocks)) {
		equityPoller.prime(symbol, quote);
	}
	for (const [symbol, quote] of Object.entries(cache.crypto)) {
		cryptoPoller.prime(symbol, quote);
	}

	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	apply(settings);
	streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => apply(ev.settings));
}
