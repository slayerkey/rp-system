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
	"__Host-authjs.session-token",
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
	// Refuse copied headers without a recognized session cookie; never forward
	// unrelated cookie values as if they were a Perplexity session.
	if (input.includes(";") || /^[A-Za-z0-9_.-]+=(?!$)/.test(input)) return "";
	return `__Secure-next-auth.session-token=${input.replace(/^["\x27]|["\x27]$/g, "")}`;
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
		const cookie = sessionCookie(token);
		if (!cookie) return { ok: false, status: 0, reason: "auth" };
		const res = await fetch(rateUrl(), {
			headers: {
				Cookie: cookie,
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
				Referer: "https://www.perplexity.ai/",
			},
		});
		const ct = res.headers.get("content-type") ?? "";
		const body = await res.text();
		// A Cloudflare HTML challenge can use HTTP 403. It is not evidence that
		// the customer pasted an expired cookie.
		if (ct.includes("html") || body.trimStart().startsWith("<")) return { ok: false, status: res.status, reason: "blocked" };
		if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, reason: "auth" };
		if (res.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
		if (!res.ok) return { ok: false, status: res.status, reason: "error", detail: body.slice(0, 120) };

		const j = JSON.parse(body);
		// Missing API fields are unavailable, not a healthy 0% reading.
		const weekly = nextMonday();
		const daily = nextMidnight();
		const windows: WindowData[] = [];
		const add = (field: string, key: string, label: string, total: number, reset: string): void => {
			const raw = j?.[field];
			if (raw === null || raw === undefined || raw === "") return;
			const remaining = Number(raw);
			if (!Number.isFinite(remaining) || remaining < 0) return;
			windows.push({key,label,utilization: Math.max(0, Math.min(100, utilization(remaining, total))),resetsAt:reset});
		};
		add("remaining_pro","pro","PRO",TOTALS.pro,weekly);
		add("remaining_research","research","RESEARCH",TOTALS.research,weekly);
		add("remaining_agentic_research","agentic","AGENTIC",TOTALS.agentic,weekly);
		add("remaining_labs","labs","LABS",TOTALS.labs,daily);
		if (!windows.length) return { ok: false, status: res.status, reason: "error", detail: "usage response fields unavailable" };

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
