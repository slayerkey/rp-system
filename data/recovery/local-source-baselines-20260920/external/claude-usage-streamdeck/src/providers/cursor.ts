// Cursor adapter — cursor.com session token → monthly plan-usage quota.
// The old `/api/usage` endpoint this used is Cursor's *legacy* per-model request
// counter and requires a `?user=<id>` query param (derived from the session token)
// that this adapter never sent — every call 401'd and surfaced as "Expired, re-paste
// your session key" even with a fresh, valid token. `/api/usage-summary` is the
// current endpoint: cookie-only (no extra params). VALIDATED 2026-07-19 against a
// real free-tier Cursor account. Uses Cursor's own precomputed `totalPercentUsed`
// rather than dividing used/limit ourselves — on a free/Hobby account with zero
// included quota, limit is legitimately 0, which totalPercentUsed handles cleanly
// (reports 0%) where a used/limit division would not.
import type { Provider, WindowData, FetchResult } from "./types";

const USAGE_URL = "https://cursor.com/api/usage-summary";
const HEADERS: Record<string, string> = {
	Accept: "application/json",
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function normalize(j: any): WindowData[] {
	const out: WindowData[] = [];
	const plan = j?.individualUsage?.plan;
	if (plan && typeof plan.totalPercentUsed === "number") {
		out.push({
			key: "month",
			label: "MONTH",
			utilization: Math.round(plan.totalPercentUsed),
			resetsAt: j?.billingCycleEnd,
		});
	}
	return out;
}

async function fetchUsage(token: string): Promise<FetchResult> {
	try {
		const res = await fetch(USAGE_URL, { headers: { ...HEADERS, Cookie: `WorkosCursorSessionToken=${token}` } });
		if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, reason: "auth" };
		if (res.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
		const ct = res.headers.get("content-type") ?? "";
		const body = await res.text();
		if (ct.includes("html") || body.startsWith("<")) return { ok: false, status: res.status, reason: "blocked" };
		if (!res.ok) return { ok: false, status: res.status, reason: "error", detail: body.slice(0, 120) };
		return { ok: true, usage: { windows: normalize(JSON.parse(body)) } };
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}

export const cursorProvider: Provider = {
	id: "cursor",
	displayName: "Cursor",
	brand: "#6B8AFF",
	windows: [{ key: "month", label: "MONTH", cyclable: true }],
	defaultWindow: "month",
	fetchUsage,
};
