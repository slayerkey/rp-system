/** A normalised quote, provider-agnostic. */
export type Quote = {
	symbol: string;
	name?: string;
	price: number;
	/** Change over the provider's reference period (daily for stocks, 24h for crypto). */
	change: number;
	changePercent: number;
	dayHigh?: number;
	dayLow?: number;
	prevClose?: number;
	/** Epoch ms when the quote was fetched. */
	timestamp: number;
};

export interface DataProvider {
	/** Fetch quotes for several symbols, batching into one request where possible. */
	getBatchQuotes(symbols: string[], apiKey: string): Promise<Map<string, Quote>>;
}

/** Thrown when the provider signals a rate-limit hit, so the poller can back off. */
export class RateLimitError extends Error {
	constructor(message = "Rate limit reached") {
		super(message);
		this.name = "RateLimitError";
	}
}
