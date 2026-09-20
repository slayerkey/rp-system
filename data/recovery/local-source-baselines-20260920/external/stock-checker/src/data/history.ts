// Free historical series for sparklines and weekly/monthly views.
// Stocks: Yahoo Finance chart API. Crypto: CoinGecko market_chart. Neither needs a key.
// Cached with a per-timeframe TTL so keys refresh cheaply. On error we keep the last series.

type Series = number[];

const cache = new Map<string, { points: Series; at: number }>();
const POINTS = 48;
const TIMEOUT_MS = 8000;

function ttlFor(timeframe: string): number {
	return timeframe === "1D" ? 180_000 : 1_800_000;
}

export async function getHistory(symbol: string, timeframe: string, crypto: boolean): Promise<Series | undefined> {
	const key = `${crypto ? "c" : "s"}:${symbol}:${timeframe}`;
	const hit = cache.get(key);
	if (hit && Date.now() - hit.at < ttlFor(timeframe)) {
		return hit.points;
	}
	try {
		const points = crypto ? await coinGecko(symbol, timeframe) : await yahoo(symbol, timeframe);
		if (points && points.length > 1) {
			cache.set(key, { points, at: Date.now() });
			return points;
		}
	} catch {
		// Keep last good series on failure.
	}
	return hit?.points;
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, { signal: controller.signal, headers });
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

const YAHOO_RANGES: Record<string, [string, string]> = {
	"1D": ["1d", "5m"],
	"1W": ["5d", "30m"],
	"1M": ["1mo", "1d"],
	"1Y": ["1y", "1wk"],
};

async function yahoo(ticker: string, timeframe: string): Promise<Series | undefined> {
	const [range, interval] = YAHOO_RANGES[timeframe] ?? YAHOO_RANGES["1D"];
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
	const json = await fetchJson(url, { "user-agent": "Mozilla/5.0" });
	const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
	if (!Array.isArray(closes)) {
		return undefined;
	}
	return downsample(closes.filter((n: unknown): n is number => typeof n === "number" && Number.isFinite(n)), POINTS);
}

const COINGECKO_DAYS: Record<string, string> = { "1D": "1", "1W": "7", "1M": "30", "1Y": "365" };

async function coinGecko(id: string, timeframe: string): Promise<Series | undefined> {
	const days = COINGECKO_DAYS[timeframe] ?? "1";
	const interval = timeframe === "1D" ? "" : "&interval=daily";
	const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}${interval}`;
	const json = await fetchJson(url, { accept: "application/json" });
	const prices = json?.prices;
	if (!Array.isArray(prices)) {
		return undefined;
	}
	return downsample(
		prices.map((p: number[]) => p[1]).filter((n: unknown): n is number => typeof n === "number" && Number.isFinite(n)),
		POINTS,
	);
}

function downsample(arr: Series, n: number): Series {
	if (arr.length <= n) {
		return arr;
	}
	const out: Series = [];
	const step = (arr.length - 1) / (n - 1);
	for (let i = 0; i < n; i++) {
		out.push(arr[Math.round(i * step)]);
	}
	return out;
}
