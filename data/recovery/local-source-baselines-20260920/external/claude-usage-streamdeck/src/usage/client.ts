// Two ways to read Claude usage, same response shape:
//  - OAuth endpoint (api.anthropic.com) with an sk-ant-oat token — the easy auto-load default,
//    but Anthropic rate-limits it aggressively, so it's "best effort".
//  - claude.ai web endpoint with a pasted sk-ant-sid session key — reliable fallback.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ORGS_URL = "https://claude.ai/api/organizations";
const OAUTH_URL = "https://api.anthropic.com/api/oauth/usage";
const DEFAULT_UA_VERSION = "2.0.5";

export interface UsageWindow {
	utilization: number; // 0..100
	resets_at: string; // ISO-8601
}

export interface ExtraUsage {
	is_enabled: boolean;
	monthly_limit: number | null;
	used_credits: number | null;
	utilization: number | null;
	currency: string | null;
}

// The newer shape: one entry per active limit. Model-specific weekly caps (Fable, Opus)
// only ever show up here, so this is what we read them from — the top-level
// `seven_day_*` fields below are the legacy fallback.
export interface LimitEntry {
	kind: string; // "session" | "weekly_all" | "weekly_opus" | "weekly_fable" | …
	group: string; // "session" | "weekly"
	percent: number;
	resets_at: string;
	scope: string | null;
}

export interface UsageResponse {
	five_hour: UsageWindow | null;
	seven_day: UsageWindow | null;
	seven_day_opus: UsageWindow | null;
	seven_day_sonnet: UsageWindow | null;
	extra_usage: ExtraUsage | null;
	limits?: LimitEntry[]; // absent on the OAuth endpoint
}

export type FetchResult =
	| { ok: true; data: UsageResponse }
	| { ok: false; status: number; reason: "auth" | "rate-limited" | "blocked" | "error"; detail?: string };

// --- claude.ai (session key) ---

const BROWSER_HEADERS: Record<string, string> = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	Accept: "application/json, text/plain, */*",
	"Accept-Language": "en-US,en;q=0.9",
	Referer: "https://claude.ai/settings/usage",
	Origin: "https://claude.ai",
	"sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
	"sec-ch-ua-mobile": "?0",
	"sec-ch-ua-platform": '"Windows"',
	"sec-fetch-dest": "empty",
	"sec-fetch-mode": "cors",
	"sec-fetch-site": "same-origin",
	"anthropic-client-platform": "web_claude_ai",
};

const orgIdCache = new Map<string, string>();

interface Raw {
	status: number;
	ct: string | null;
	body: string;
}

function isCloudflare(r: Raw): boolean {
	return (r.ct?.includes("html") ?? false) || r.body.includes("Just a moment");
}

function failure(r: Raw): Extract<FetchResult, { ok: false }> | null {
	if (isCloudflare(r)) return { ok: false, status: r.status, reason: "blocked" };
	if (r.status === 401 || r.status === 403) return { ok: false, status: r.status, reason: "auth" };
	if (r.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
	if (r.status < 200 || r.status >= 300) return { ok: false, status: r.status, reason: "error", detail: r.body.slice(0, 120) };
	return null;
}

async function get(url: string, sessionKey: string): Promise<Raw> {
	const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Cookie: `sessionKey=${sessionKey}` } });
	return { status: res.status, ct: res.headers.get("content-type"), body: await res.text() };
}

export async function fetchUsage(sessionKey: string): Promise<FetchResult> {
	try {
		let orgId = orgIdCache.get(sessionKey);
		if (!orgId) {
			const r = await get(ORGS_URL, sessionKey);
			const fail = failure(r);
			if (fail) return fail;
			const arr = JSON.parse(r.body);
			orgId = (Array.isArray(arr) ? arr[0] : arr)?.uuid;
			if (!orgId) return { ok: false, status: 0, reason: "error", detail: "no organization uuid" };
			orgIdCache.set(sessionKey, orgId);
		}
		const u = await get(`${ORGS_URL}/${orgId}/usage`, sessionKey);
		const fail = failure(u);
		if (fail) {
			if (fail.reason === "auth") orgIdCache.delete(sessionKey);
			return fail;
		}
		return { ok: true, data: JSON.parse(u.body) as UsageResponse };
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}

// --- OAuth endpoint (local oat token) ---

let cachedVersion: string | undefined;
function userAgent(): string {
	if (!cachedVersion) {
		const candidates = [
			join(process.env.APPDATA ?? "", "npm/node_modules/@anthropic-ai/claude-code/package.json"),
			join(homedir(), ".claude/local/node_modules/@anthropic-ai/claude-code/package.json"),
		];
		for (const c of candidates) {
			try {
				const v = JSON.parse(readFileSync(c, "utf8")).version;
				if (v) { cachedVersion = v; break; }
			} catch { /* try next */ }
		}
		cachedVersion ??= DEFAULT_UA_VERSION;
	}
	return `claude-code/${cachedVersion}`;
}

export async function fetchUsageOAuth(token: string): Promise<FetchResult> {
	try {
		const res = await fetch(OAUTH_URL, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				"anthropic-beta": "oauth-2025-04-20",
				"User-Agent": userAgent(),
				"Content-Type": "application/json",
			},
		});
		if (res.status === 401 || res.status === 403) return { ok: false, status: res.status, reason: "auth" };
		if (res.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
		if (!res.ok) return { ok: false, status: res.status, reason: "error", detail: await res.text().catch(() => "") };
		return { ok: true, data: (await res.json()) as UsageResponse };
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}
