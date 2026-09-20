const BASE = "https://finnhub.io/api/v1/stock/metric";
const TIMEOUT_MS = 8000;
// 52-week high/low barely moves intraday, so this is cached far longer than live quotes
// to keep the opt-in range bar from meaningfully adding to API spend.
const TTL_MS = 30 * 60 * 1000;

export type FiftyTwoWeek = { low: number; high: number };

const cache = new Map<string, { data?: FiftyTwoWeek; at: number }>();

export async function getFiftyTwoWeek(symbol: string, apiKey: string): Promise<FiftyTwoWeek | undefined> {
	const hit = cache.get(symbol);
	if (hit && Date.now() - hit.at < TTL_MS) {
		return hit.data;
	}
	try {
		const url = `${BASE}?symbol=${encodeURIComponent(symbol)}&metric=price&token=${apiKey}`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		let res: Response;
		try {
			res = await fetch(url, { signal: controller.signal });
		} finally {
			clearTimeout(timer);
		}
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		const json: any = await res.json();
		const low = json?.metric?.["52WeekLow"];
		const high = json?.metric?.["52WeekHigh"];
		const data = typeof low === "number" && typeof high === "number" ? { low, high } : undefined;
		cache.set(symbol, { data, at: Date.now() });
		return data;
	} catch {
		return hit?.data;
	}
}
