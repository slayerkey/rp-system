// Shared ChatGPT/Codex usage fetch — both hit chatgpt.com/backend-api/wham/usage.
//
// Confirmed by probing the live host: /backend-api/wham/usage exists (401 with no
// credential, 404 for made-up paths), it is reachable from Node with no Cloudflare
// challenge, and it requires a Bearer token — a session cookie alone gets 401.
// The request shape (Bearer + ChatGPT-Account-Id) matches what the Codex CLI sends.
// Response field names confirmed against a live Plus account 2026-09-03 with
// scripts/validate-chatgpt.mjs; re-run it if the endpoint changes.
//
// The pasted credential can be either:
//   - an accessToken from chatgpt.com/api/auth/session (starts with "eyJ") — short-lived
//   - the __Secure-next-auth.session-token cookie — long-lived, exchanged for a fresh
//     accessToken here on demand, so the key stops reading "Expired" every few days
import type { WindowData, FetchResult } from "./types";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
const SESSION_URL = "https://chatgpt.com/api/auth/session";
const HEADERS: Record<string, string> = {
	Accept: "application/json",
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

/** Pasting from a browser JSON viewer routinely drags along quotes, the field name,
 *  or a stray newline — all of which 401 and look like an expired token. */
export function sanitizeToken(raw: string): string {
	let t = raw.trim().replace(/\s+/g, "");
	t = t.replace(/^"?accessToken"?:?/i, "");
	t = t.replace(/^Bearer/i, "");
	t = t.replace(/^["'`,]+|["'`,;]+$/g, "");
	return t.trim();
}

function jwtPayload(token: string): any {
	try {
		const part = token.split(".")[1];
		if (!part) return undefined;
		return JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
	} catch {
		return undefined;
	}
}

/** The account the token belongs to; the endpoint 401s for workspace members without it. */
function accountIdFrom(token: string): string | undefined {
	const p = jwtPayload(token);
	return p?.["https://api.openai.com/auth"]?.chatgpt_account_id ?? p?.chatgpt_account_id ?? undefined;
}

function expiresAt(token: string): number {
	const exp = jwtPayload(token)?.exp;
	return typeof exp === "number" ? exp * 1000 : 0;
}

// cookie → the accessToken last minted from it, reused until just before it expires.
const tokenCache = new Map<string, { token: string; until: number }>();
const REFRESH_MARGIN_MS = 5 * 60_000;

type Raw = { status: number; ct: string; body: string };

function isBlocked(r: Raw): boolean {
	return r.ct.includes("html") || r.body.startsWith("<") || r.body.includes("Just a moment");
}

/** Cloudflare serves its challenge as a 403, so that check has to come first —
 *  otherwise a block is reported to the user as an expired token. */
function failure(r: Raw): Extract<FetchResult, { ok: false }> | null {
	if (isBlocked(r)) return { ok: false, status: r.status, reason: "blocked" };
	if (r.status === 401 || r.status === 403) return { ok: false, status: r.status, reason: "auth" };
	if (r.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
	if (r.status < 200 || r.status >= 300) return { ok: false, status: r.status, reason: "error", detail: r.body.slice(0, 120) };
	return null;
}

async function get(url: string, headers: Record<string, string>): Promise<Raw> {
	const res = await fetch(url, { headers: { ...HEADERS, ...headers } });
	return { status: res.status, ct: res.headers.get("content-type") ?? "", body: await res.text() };
}

/**
 * An accessToken is a JWS: three dot-separated parts, none empty, and a payload that
 * decodes to JSON. The session cookie is a JWE, five parts with an empty second one
 * (header..iv.ciphertext.tag).
 *
 * Both start with "eyJ", because a JWE header is base64url JSON too
 * ({"alg":"dir","enc":"A256GCM"}). A startsWith("eyJ") check therefore sent every pasted
 * session cookie down the Bearer path, where the only possible outcome is a 401 and a key
 * reading "Expired". Customer-reported 2026-08-31: pasting the cookie the help text
 * recommends could never have worked.
 */
function isAccessToken(t: string): boolean {
	const parts = t.split(".");
	return parts.length === 3 && !!parts[1] && jwtPayload(t) !== undefined;
}

/** Turn whatever the user pasted into a usable accessToken. */
async function resolveAccessToken(input: string): Promise<{ token: string } | Extract<FetchResult, { ok: false }>> {
	if (isAccessToken(input)) return { token: input };

	const cached = tokenCache.get(input);
	if (cached && cached.until > Date.now()) return { token: cached.token };

	const r = await get(SESSION_URL, { Cookie: `__Secure-next-auth.session-token=${input}` });
	const fail = failure(r);
	if (fail) return fail;
	let token: unknown;
	try {
		token = JSON.parse(r.body)?.accessToken;
	} catch {
		return { ok: false, status: r.status, reason: "error", detail: "could not parse session response" };
	}
	// A logged-out session returns 200 with no accessToken — that's an auth failure,
	// not a transport error, so the key tells the user to re-paste.
	if (typeof token !== "string" || !token) return { ok: false, status: r.status, reason: "auth" };

	const exp = expiresAt(token);
	tokenCache.set(input, { token, until: exp ? exp - REFRESH_MARGIN_MS : Date.now() + 30 * 60_000 });
	return { token };
}

function normalize(j: any): WindowData[] {
	const out: WindowData[] = [];
	const rl = j?.rate_limit ?? j?.rate_limits ?? j?.usage ?? j ?? {};
	const add = (key: string, label: string, o: any): void => {
		if (!o) return;
		const util =
			o.used_percent ??
			o.utilization ??
			(o.percent_left != null ? 100 - o.percent_left : undefined) ??
			(o.used != null && o.limit ? (o.used / o.limit) * 100 : undefined) ??
			// Some windows report what is LEFT rather than what is spent; invert those into
			// the same used% every render style already speaks.
			(o.remaining != null && o.total ? (1 - o.remaining / o.total) * 100 : undefined) ??
			(o.balance != null && o.granted ? (1 - o.balance / o.granted) * 100 : undefined);
		const secs = o.reset_after_seconds ?? o.resets_in_seconds;
		// reset_at is unix seconds, not an ISO string.
		const reset =
			typeof o.reset_at === "number"
				? new Date(o.reset_at * 1000).toISOString()
				: (o.resets_at ?? o.reset_at ?? (secs != null ? new Date(Date.now() + secs * 1000).toISOString() : undefined));
		if (util != null) out.push({ key, label, utilization: Math.round(util), resetsAt: reset });
	};
	add("five_hour", "5H", rl.primary_window ?? rl.primary ?? rl.five_hour ?? rl["5h"]);
	add("seven_day", "WEEK", rl.secondary_window ?? rl.secondary ?? rl.weekly ?? rl.seven_day ?? rl["7d"]);
	addCredits(out, j, rl);
	return out;
}

/**
 * Credits are a balance, not a ratio.
 *
 * Confirmed against a live Plus account 2026-09-03: they arrive as a top-level `credits`
 * object holding a STRING `balance` next to a `has_credits` flag, and the response carries
 * no total, grant or limit to divide by. So there is nothing to take a percentage of, and
 * this is the one window that reports a raw count instead of a utilization.
 *
 * The old code ran this through the same percentage path as the 5h and weekly windows,
 * which requires a denominator, so the window was dropped for every account and the key
 * fell through to its not-available face. A customer holding 473 credits was told they had
 * none (reported 2026-09-02). A zero balance is therefore rendered as a plain "0", which is
 * true, rather than as a claim about what the plan includes.
 */
function addCredits(out: WindowData[], j: any, rl: any): void {
	const c = rl?.credits ?? j?.credits ?? j?.credit_balance;
	if (!c || typeof c !== "object") return;
	if (c.unlimited === true) {
		out.push({ key: "credits", label: "CREDITS", utilization: 0, unlimited: true });
		return;
	}
	// `balance` is a string on the live endpoint, so it has to be coerced before use.
	const balance = Number(c.balance ?? c.remaining ?? c.amount);
	if (!Number.isFinite(balance)) return;
	out.push({ key: "credits", label: "CREDITS", utilization: 0, count: balance });
}

export async function fetchChatGptUsage(rawToken: string): Promise<FetchResult> {
	try {
		const input = sanitizeToken(rawToken);
		if (!input) return { ok: false, status: 0, reason: "auth" };

		const resolved = await resolveAccessToken(input);
		if ("ok" in resolved) return resolved;
		const token = resolved.token;

		const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
		const accountId = accountIdFrom(token);
		if (accountId) headers["ChatGPT-Account-Id"] = accountId;

		const r = await get(USAGE_URL, headers);
		const fail = failure(r);
		if (fail) {
			if (fail.reason === "auth") tokenCache.delete(input);
			return fail;
		}
		return { ok: true, usage: { windows: normalize(JSON.parse(r.body)) } };
	} catch (e) {
		return { ok: false, status: 0, reason: "error", detail: String(e) };
	}
}

export const CHATGPT_WINDOWS = [
	{ key: "five_hour", label: "5H", cyclable: true },
	{ key: "seven_day", label: "WEEK", cyclable: true },
	// Off the long-press cycle, like Claude's extra credits: plenty of accounts have no
	// credit balance at all, and a dead face in the middle of the cycle reads as a bug.
	// This face now means only "the balance could not be read". It must never say the plan
	// has no credits, because it also fires for account shapes we simply do not recognise.
	{ key: "credits", label: "CREDITS", cyclable: false, naLines: ["credits", "unavailable"] as [string, string] },
];

// Exported for scripts/validate-chatgpt.mjs and local checks.
export const __internals = { normalize, accountIdFrom, sanitizeToken };
