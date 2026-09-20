import { DataProvider, Quote, RateLimitError } from "./provider";

const BASE = "https://api.coingecko.com/api/v3/simple/price";
const TIMEOUT_MS = 8000;

/**
 * CoinGecko implementation for crypto. Needs no API key, and a single request
 * returns price + 24h change for every requested coin id, so all crypto keys
 * cost one call per tick. Symbols here are CoinGecko ids (e.g. "bitcoin").
 */
export class CoinGeckoProvider implements DataProvider {
	async getBatchQuotes(ids: string[], _apiKey: string): Promise<Map<string, Quote>> {
		const out = new Map<string, Quote>();
		if (ids.length === 0) {
			return out;
		}

		const url = `${BASE}?ids=${ids.map(encodeURIComponent).join(",")}&vs_currencies=usd&include_24hr_change=true`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		let res: Response;
		try {
			res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
		} finally {
			clearTimeout(timer);
		}

		if (res.status === 429) {
			throw new RateLimitError();
		}
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}

		const data: any = await res.json();
		for (const id of ids) {
			const d = data?.[id];
			if (d && typeof d.usd === "number") {
				const price = d.usd;
				const pct = typeof d.usd_24h_change === "number" ? d.usd_24h_change : 0;
				const prev = price / (1 + pct / 100);
				out.set(id, {
					symbol: id,
					price,
					change: price - prev,
					changePercent: pct,
					timestamp: Date.now(),
				});
			}
		}
		return out;
	}
}
