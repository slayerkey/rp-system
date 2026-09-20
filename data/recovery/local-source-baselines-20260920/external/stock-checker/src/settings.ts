export type ThemeName = "dark" | "minimal" | "pro";

/** Sparkline + change window. Pressing the key cycles through these. */
export type Timeframe = "1D" | "1W" | "1M" | "1Y";

/** Settings shared across every install of the plugin. */
export type GlobalSettings = {
	finnhubApiKey?: string;
	refreshSeconds?: number;
};

/** Settings for a stock/index or crypto key. */
export type QuoteSettings = {
	/** Custom symbol typed by the user; overrides the preset when set. */
	symbol?: string;
	/** Symbol chosen from the popular-symbols dropdown. */
	preset?: string;
	/** "heatmap" shows every symbol in the list as a color-coded grid instead of rotating through them. */
	displayStyle?: "price" | "heatmap";
	timeframe?: Timeframe;
	showName?: boolean;
	showSparkline?: boolean;
	theme?: ThemeName;
	/** Holdings, for the position P/L line. Stored as strings by the inspector. */
	shares?: number | string;
	avgCost?: number | string;
	/** Price alert thresholds. */
	alertAbove?: number | string;
	alertBelow?: number | string;
	/** Seconds between symbols when several are listed (comma-separated). */
	rotateSeconds?: number | string;
	/** Opt-in 52-week range bar (stocks only; costs one extra low-frequency API call). */
	showRange?: boolean;
};

export type ClockSettings = {
	theme?: ThemeName;
	/** Exchange id from EXCHANGES, e.g. "US", "LSE", "TSE". */
	exchange?: string;
	/** Candle length in minutes for the progress band; 0 hides it. */
	candleMinutes?: number | string;
};

export type HeatmapSettings = {
	/** Comma-separated tickers or coins. */
	symbols?: string;
	market?: "stocks" | "crypto";
	theme?: ThemeName;
};

export type FearGreedSettings = {
	theme?: ThemeName;
};

export type EarningsSettings = {
	symbol?: string;
	preset?: string;
	theme?: ThemeName;
};
