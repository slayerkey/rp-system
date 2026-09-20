export const PLUGIN_UUID = "com.ratpack.marketcommandcenter";

export const ACTIONS = {
	ticker: `${PLUGIN_UUID}.ticker`,
	crypto: `${PLUGIN_UUID}.crypto`,
	clock: `${PLUGIN_UUID}.clock`,
	heatmap: `${PLUGIN_UUID}.heatmap`,
	feargreed: `${PLUGIN_UUID}.feargreed`,
	earnings: `${PLUGIN_UUID}.earnings`,
} as const;

export const DEFAULTS = {
	refreshSeconds: 60,
	theme: "dark" as const,
	/** Preloaded so a freshly dropped key works immediately. */
	stockSymbol: "SPY",
	cryptoSymbol: "BTC",
	/** A single company, not an index fund — SPY has no earnings report to count down to. */
	earningsSymbol: "AAPL",
};

/** Per-minute request budgets enforced by the poller's token bucket. */
export const RATE = {
	/** Finnhub free tier allows 60 calls/min; leave headroom for one-off profile lookups. */
	stocksPerMinute: 55,
	/** CoinGecko keyless tier is generous; one batched call covers every coin. */
	cryptoPerMinute: 25,
};

/** When US markets are closed, equities barely move, so poll them slowly. */
export const MARKET_CLOSED_INTERVAL_MS = 15 * 60 * 1000;
