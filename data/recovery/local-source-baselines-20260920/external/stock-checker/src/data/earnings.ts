const BASE = "https://finnhub.io/api/v1/calendar/earnings";
const TIMEOUT_MS = 8000;
// Earnings dates don't move within a day, so this is cached for hours, not minutes.
const TTL_MS = 6 * 60 * 60 * 1000;
const WINDOW_DAYS = 120;

export type NextEarnings = { date: string; hour?: "bmo" | "amc" | "dmh" };

const cache = new Map<string, { data?: NextEarnings | null; at: number }>();

function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Next scheduled earnings date for a symbol, or null when none is scheduled within the window. */
export async function getNextEarnings(symbol: string, apiKey: string): Promise<NextEarnings | null | undefined> {
	const hit = cache.get(symbol);
	if (hit && Date.now() - hit.at < TTL_MS) {
		return hit.data;
	}
	try {
		const now = new Date();
		const to = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);
		const url = `${BASE}?from=${isoDate(now)}&to=${isoDate(to)}&symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
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
		const list: any[] = Array.isArray(json?.earningsCalendar) ? json.earningsCalendar : [];
		list.sort((a, b) => String(a.date).localeCompare(String(b.date)));
		const next = list.find((e) => typeof e.date === "string");
		const data: NextEarnings | null = next ? { date: next.date, hour: next.hour } : null;
		cache.set(symbol, { data, at: Date.now() });
		return data;
	} catch {
		return hit?.data;
	}
}
