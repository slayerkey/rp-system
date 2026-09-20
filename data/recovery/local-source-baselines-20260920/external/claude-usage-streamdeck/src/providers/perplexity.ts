// Perplexity adapter — reads Pro/Research/Labs quota from the Perplexity web API.
// Auth: Perplexity session cookie from perplexity.ai (log in, then DevTools).
// Totals are hardcoded (no server-side total in the response):
//   Pro queries: ~200 per week (resets Monday 00:00 UTC)
//   Research queries: ~20 per week
//   Labs queries: ~25 per day (resets midnight UTC)
// UNVALIDATED: endpoint confirmed via Greasyfork userscripts that use the same API.
import type { Provider, WindowData, FetchResult } from "./types";

// Cache-bust param matches the Greasyfork userscript pattern that confirmed this endpoint
const rateUrl = () => `https://www.perplexity.ai/rest/rate-limit/all?t=${Date.now()}`;

const TOTALS = { pro: 200, research: 20, agentic: 5, labs: 25 };

const SESSION_COOKIE_NAMES = [
	"__Secure-authjs.session-token",
	"authjs.session-token",
	"__Secure-next-auth.session-token",
	"next-auth.session-token",
] as const;

/**
 * Accept the value users most commonly paste, while also tolerating `name=value`
 * and a full Cookie header copied from browser developer tools. Only the session
 * cookie is forwarded; unrelated browser cookies are discarded.
 */
function sessionCookie(raw: string): string {
	const input = raw.trim().replace(/^Cookie:\s*/i, "");
	for (const part of input.split(";")) {
		const item = part.trim();
		const separator = item.indexOf("=");
		if (separator < 1) continue;
		const name = item.slice(0, separator).trim();
		if (SESSION_COOKIE_NAMES.includes(name as (typeof SESSION_COOKIE_NAMES)[number])) {
			return `${name}=${item.slice(separator + 1).trim()}`;
		}
	}
	// Perplexity's current production cookie name. Older names above remain
	// accepted for accounts or deployments that still expose them.
	return `__Secure-next-auth.session-token=${input}`;
}

function nextMonday(): string {
	const now = new Date();
	const day = now.getUTCDay(); // 0=Sun
	const daysUntil = day === 0 ? 1 : 8 - day;
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntil)).toISOString();
}

function nextMidnight(): string {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function utilization(remaining: number, total: number): number {
	return Math.round(((total - remaining) / total) * 100);
}

async function fetchUsage(token: string): Promise<FetchResult> {
	try {
		const res = await fetch(rateUrl(), {
			headers: {
				Cookie: sessionCookie(token),
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				Referer: "https://www.perplexity.ai/",
			},
		});
		if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, reason: "auth" };
		if (res.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
		const ct = res.headers.get("content-type") ?? "";
		const body = await res.text();
		if (ct.includes("html") || body.startsWith("<")) return { ok: false, status: res.status, reason: "blocked" };
		if (!res.ok) return { ok: false, status: res.status, reason: "error", detail: body.slice(0, 120) };

		const j = JSON.parse(body);
		const weekly = nextMonday();
		const daily = nextMidnight();

		const windows: WindowData[] = [
			{
				key: "pro",
				label: "PRO",
				utilization: utilization(Number(j.remaining_pro ?? TOTALS.pro), TOTALS.pro),
				resetsAt: weekly,
			},
			{
				key: "research",
				label: "RESEARCH",
				utilization: utilization(Number(j.remaining_research ?? TOTALS.research), TOTALS.research),
				resetsAt: weekly,
			},
			{
				key: "agentic",
				label: "AGENTIC",
				utilization: utilization(Number(j.remaining_agentic_research ?? TOTALS.agentic), TOTALS.agentic),
				resetsAt: weekly,
			},
			{
				key: "labs",
				label: "LABS",
				utilization: utilization(Number(j.remaining_labs ?? TOTALS.labs), TOTALS.labs),
				resetsAt: daily,
			},
		];

		return { ok: true, usage: { windows } };
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}

export const perplexityProvider: Provider = {
	id: "perplexity",
	displayName: "Perplexity",
	brand: "#20B2AA",
	windows: [
		{ key: "pro", label: "PRO", cyclable: true },
		{ key: "research", label: "RESEARCH", cyclable: true },
		{ key: "agentic", label: "AGENTIC", cyclable: true },
		{ key: "labs", label: "LABS", cyclable: true },
	],
	defaultWindow: "pro",
	fetchUsage,
};
