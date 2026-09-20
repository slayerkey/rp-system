import { DataProvider, Quote, RateLimitError } from "./provider";

const BASE = "https://finnhub.io/api/v1";
const TIMEOUT_MS = 8000;

/**
 * Finnhub implementation for stocks/ETFs/indices. /quote is one symbol per call,
 * but the free tier allows 60 calls/min with no daily cap. Company names come from
 * /stock/profile2 and are cached for the session so they cost one call per symbol.
 */
export class FinnhubProvider implements DataProvider {
	private readonly names = new Map<string, string>();

	async getBatchQuotes(symbols: string[], apiKey: string): Promise<Map<string, Quote>> {
		const out = new Map<string, Quote>();
		if (symbols.length === 0) {
			return out;
		}

		const results = await Promise.allSettled(symbols.map((s) => this.fetchOne(s, apiKey)));

		let rateLimited = false;
		let badKey = false;
		results.forEach((r, i) => {
			if (r.status === "fulfilled") {
				if (r.value) {
					out.set(symbols[i], r.value);
				}
			} else if (r.reason instanceof RateLimitError) {
				rateLimited = true;
			} else if (r.reason instanceof Error && r.reason.message === "invalid-key") {
				badKey = true;
			}
		});

		// Only surface a fatal error if nothing came back at all.
		if (out.size === 0 && badKey) {
			throw new Error("Invalid API key");
		}
		if (out.size === 0 && rateLimited) {
			throw new RateLimitError();
		}
		return out;
	}

	private async fetchOne(symbol: string, apiKey: string): Promise<Quote | undefined> {
		const q = await this.get(`/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
		// Finnhub returns zeros for an unknown symbol.
		if (!q || typeof q.c !== "number" || q.c === 0) {
			return undefined;
		}

		let name = this.names.get(symbol);
		if (name === undefined) {
			name = await this.fetchName(symbol, apiKey);
			this.names.set(symbol, name);
		}

		return {
			symbol,
			name: name || undefined,
			price: q.c,
			change: typeof q.d === "number" ? q.d : 0,
			changePercent: typeof q.dp === "number" ? q.dp : 0,
			dayHigh: typeof q.h === "number" ? q.h : undefined,
			dayLow: typeof q.l === "number" ? q.l : undefined,
			prevClose: typeof q.pc === "number" ? q.pc : undefined,
			timestamp: Date.now(),
		};
	}

	private async fetchName(symbol: string, apiKey: string): Promise<string> {
		try {
			const p = await this.get(`/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
			return p && typeof p.name === "string" ? p.name : "";
		} catch {
			return "";
		}
	}

	private async get(path: string): Promise<any> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		let res: Response;
		try {
			res = await fetch(`${BASE}${path}`, { signal: controller.signal });
		} finally {
			clearTimeout(timer);
		}
		if (res.status === 429) {
			throw new RateLimitError();
		}
		if (res.status === 401) {
			throw new Error("invalid-key");
		}
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return res.json();
	}
}
