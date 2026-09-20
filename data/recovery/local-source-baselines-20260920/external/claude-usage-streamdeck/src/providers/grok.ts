// Grok (xAI) adapter — reads rate-limit quota from grok.com's internal API.
// Auth: raw Cookie header value from grok.com. To get it:
//   1. Log in at grok.com, open DevTools → Network tab
//   2. Find any request to grok.com, click it → Headers → Request Headers → Cookie
//   3. Copy the entire Cookie header value and paste it below
// This avoids guessing specific cookie names since both reference implementations
// (grok-usage-watch, grok-limit-ui-extension) use credentials:"include" in-browser.
// UNVALIDATED: endpoint confirmed via reverse-engineered browser extensions.
import type { Provider, WindowData, FetchResult } from "./types";

const RATE_LIMITS_URL = "https://grok.com/rest/rate-limits";

const MODELS = [
	{ requestKind: "DEFAULT", modelName: "grok-3", key: "default", label: "GROK 3" },
	{ requestKind: "DEFAULT", modelName: "grok-4-heavy", key: "grok4", label: "GROK 4" },
	{ requestKind: "REASONING", modelName: "grok-3", key: "reasoning", label: "REASON" },
	{ requestKind: "DEEPSEARCH", modelName: "grok-3", key: "deepsearch", label: "DEEP" },
] as const;

function resetsAt(waitSeconds: number): string | undefined {
	return waitSeconds > 0 ? new Date(Date.now() + waitSeconds * 1000).toISOString() : undefined;
}

// Extract x-csrf-token from cookie string if present (ct0= or x-csrf-token=)
function extractCsrf(cookieStr: string): string | undefined {
	const ct0 = cookieStr.match(/(?:^|;\s*)ct0=([^;]+)/)?.[1];
	return ct0?.trim();
}

async function queryModel(
	cookieStr: string,
	requestKind: string,
	modelName: string,
): Promise<{ status: number; ok: boolean; body?: any; text?: string }> {
	const csrf = extractCsrf(cookieStr);
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Cookie: cookieStr,
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
		Referer: "https://grok.com/",
		Origin: "https://grok.com",
	};
	if (csrf) headers["x-csrf-token"] = csrf;
	try {
		const res = await fetch(RATE_LIMITS_URL, {
			method: "POST",
			headers,
			body: JSON.stringify({ requestKind, modelName }),
		});
		if (!res.ok) return { status: res.status, ok: false, text: await res.text() };
		return { status: res.status, ok: true, body: await res.json() };
	} catch (e) {
		return { status: 0, ok: false, text: String(e) };
	}
}

async function fetchUsage(token: string): Promise<FetchResult> {
	try {
		// Query all models in parallel; first result drives error classification
		const responses = await Promise.all(MODELS.map((m) => queryModel(token, m.requestKind, m.modelName)));
		const first = responses[0];

		if (first.status === 401 || first.status === 403) return { ok: false, status: first.status, reason: "auth" };
		if (first.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
		if (!first.ok) {
			if (first.text?.startsWith("<") || first.text?.includes("<!DOCTYPE")) {
				return { ok: false, status: first.status, reason: "blocked" };
			}
			return { ok: false, status: first.status, reason: "error", detail: first.text?.slice(0, 120) };
		}

		const windows: WindowData[] = [];
		for (let i = 0; i < MODELS.length; i++) {
			const r = responses[i];
			if (!r.ok || !r.body) continue;
			const total = Number(r.body.totalQueries ?? 0);
			if (total === 0) continue;
			const remaining = Number(r.body.remainingQueries ?? 0);
			const waitSecs = Number(r.body.waitTimeSeconds ?? r.body.lowEffortRateLimits?.waitTimeSeconds ?? 0);
			windows.push({
				key: MODELS[i].key,
				label: MODELS[i].label,
				utilization: Math.round(((total - remaining) / total) * 100),
				resetsAt: resetsAt(waitSecs),
			});
		}

		return { ok: true, usage: { windows } };
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}

export const grokProvider: Provider = {
	id: "grok",
	displayName: "Grok",
	brand: "#FF3B5C",
	windows: [
		{ key: "default", label: "GROK 3", cyclable: true },
		{ key: "grok4", label: "GROK 4", cyclable: true },
		{ key: "reasoning", label: "REASON", cyclable: true },
		{ key: "deepsearch", label: "DEEP", cyclable: true },
	],
	defaultWindow: "default",
	fetchUsage,
};
