const URL = "https://api.alternative.me/fng/?limit=1";
const TIMEOUT_MS = 8000;
// Updates roughly once a day; poll far less often than live quotes.
const TTL_MS = 30 * 60 * 1000;

export type FearGreed = { value: number; label: string };

let cached: { data?: FearGreed; at: number } = { at: 0 };

/** Crypto Fear & Greed Index (alternative.me). Keyless, market-wide, no per-symbol variant. */
export async function getFearGreed(): Promise<FearGreed | undefined> {
	if (cached.data && Date.now() - cached.at < TTL_MS) {
		return cached.data;
	}
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		let res: Response;
		try {
			res = await fetch(URL, { signal: controller.signal, headers: { accept: "application/json" } });
		} finally {
			clearTimeout(timer);
		}
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		const json: any = await res.json();
		const item = json?.data?.[0];
		const value = parseInt(item?.value, 10);
		const data =
			Number.isFinite(value) && typeof item?.value_classification === "string"
				? { value, label: item.value_classification as string }
				: undefined;
		cached = { data, at: Date.now() };
		return data;
	} catch {
		return cached.data;
	}
}
