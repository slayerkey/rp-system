// GitHub Copilot adapter. Reads AI credit usage from the GitHub billing API.
// Auto-loads the GitHub OAuth token from the gh CLI credentials file.
//
// Personal Copilot bills AI credits to the user, so /users/{login}/... answers. A licence
// provided by an employer (Copilot Business or Enterprise) bills them to the organization
// instead, so that personal record does not exist and GitHub returns 404. The poller maps
// any non-auth failure to "offline", which is why a company account sat on "Offline" with
// nothing useful in the log.
//
// So: try the personal record first, then the billing record of each org the token can see.
// Every attempt is recorded with its URL and HTTP status and returned in `detail`, which the
// poller writes to the plugin log. A support report can then name the endpoint that answered
// instead of guessing.
//
// VALIDATED against a company-managed account 2026-08-20 by a customer who sent the attempt
// log, which is exactly what that log was built for. Two things were wrong:
//
//   1. Neither billing endpoint exists for an Enterprise Managed User. The personal record
//      404s, and both org records 404 as well, because org membership is additionally gated
//      (one org refuses classic PATs outright, the other requires SAML SSO authorisation).
//      So every documented path is closed to this whole class of account.
//   2. PLAN_LIMITS was fiction. The real account reported entitlement 20000 on a "business"
//      plan against the 300 hardcoded here, so every business reading was wrong by ~66x.
//
// The fix for both is /copilot_internal/user, which answers for company-managed accounts and
// returns the entitlement rather than making us guess it. It is undocumented, so it runs LAST,
// after every documented endpoint has been given its chance, and a failure there leaves the
// existing error message untouched.
//
// Still unvalidated: Copilot Pro/Pro+/Max personal accounts.
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import type { Provider, WindowData, WindowDef, FetchResult } from "./types";

const GH_API = "https://api.github.com";

/**
 * Monthly AI credit allowance per plan. Only a fallback: these are published figures, and a
 * real company-managed account reported an entitlement 66x the "business" number below. Any
 * response that carries its own entitlement must be believed over this table.
 */
const PLAN_LIMITS: Record<string, number> = {
	pro: 1500,
	proplus: 7000,
	max: 20000,
	business: 300,
	enterprise: 1000,
};

export const COPILOT_WINDOWS: WindowDef[] = [
	{ key: "pro", label: "PRO", cyclable: true },
	{ key: "proplus", label: "PRO+", cyclable: true },
	{ key: "max", label: "MAX", cyclable: true },
	{ key: "business", label: "BIZ", cyclable: true },
	{ key: "enterprise", label: "ENT", cyclable: true },
];

/** How many orgs to probe before giving up, so a user in many orgs can't stall the poll. */
const MAX_ORGS = 5;

function readGhToken(): string | undefined {
	const candidates = [
		// Windows
		join(process.env.APPDATA ?? "", "GitHub CLI", "hosts.yml"),
		// Mac/Linux
		join(homedir(), ".config", "gh", "hosts.yml"),
	];
	for (const p of candidates) {
		try {
			const content = readFileSync(p, "utf8");
			const m = content.match(/oauth_token:\s*(\S+)/);
			if (m?.[1]) return m[1];
		} catch { /* try next */ }
	}
	return undefined;
}

function nextMonthStart(): string {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function sumCredits(usageItems: unknown): number {
	if (!Array.isArray(usageItems)) return 0;
	return usageItems.reduce((total: number, item: any) => {
		// netQuantity is 0 when fully discounted (Copilot Pro included), use grossQuantity
		const qty = item?.netQuantity ?? item?.grossQuantity ?? item?.quantity ?? 0;
		return total + (Number(qty) || 0);
	}, 0);
}

/**
 * An org's billing report covers every seat, so it has to be narrowed to this user before
 * it means anything. Field naming is not consistent across GitHub's billing responses, so
 * match on whichever user-ish field is present. If none is, the report is already scoped to
 * the caller and every row counts.
 */
function forUser(usageItems: unknown, login: string): unknown {
	if (!Array.isArray(usageItems)) return usageItems;
	const key = ["username", "userLogin", "actor", "login"].find((k) =>
		usageItems.some((i: any) => typeof i?.[k] === "string")
	);
	if (!key) return usageItems;
	const want = login.toLowerCase();
	return usageItems.filter((i: any) => String(i?.[key] ?? "").toLowerCase() === want);
}

type Attempt = { url: string; status: number };

/** Renders the attempt trail for the plugin log, e.g. "users/x 404, organizations/y 403". */
function trail(attempts: Attempt[]): string {
	return attempts.map((a) => `${a.url.replace(GH_API + "/", "")} ${a.status}`).join(", ");
}

/**
 * A 403 on an org resource is usually a SAML/SSO authorisation problem rather than a bad
 * token, and GitHub says so in a header. Worth naming exactly: the fix is a click on the
 * token, not a new token.
 */
function ssoHint(res: Response): string {
	const sso = res.headers.get("x-github-sso");
	return sso ? ` (SSO authorisation required for this token: ${sso})` : "";
}

/**
 * The undocumented per-user quota record. Unlike the billing endpoints this is scoped to the
 * caller already, and it reports the entitlement, so nothing has to be looked up or guessed.
 *
 * Shape confirmed from a live Copilot Business account:
 *   { copilot_plan: "business", quota_id: "premium_interactions", entitlement: 20000,
 *     credits_used: 6978, remaining: 13021.8, percent_remaining: 65.1,
 *     quota_reset_date: "2026-09-01" }
 *
 * Returns null on anything unexpected so the caller falls through to its existing error.
 */
async function readInternalQuota(
	headers: Record<string, string>,
	attempts: Attempt[],
): Promise<{ utilization: number; resetsAt?: string; plan?: string } | null> {
	const url = `${GH_API}/copilot_internal/user`;
	const res = await fetch(url, { headers });
	attempts.push({ url, status: res.status });
	if (res.status === 429) throw { rateLimited: true };
	if (!res.ok) return null;

	const body: any = await res.json();

	// Prefer the server's own percentage; fall back to the raw counters if it is absent.
	let utilization: number | null = null;
	const pctRemaining = Number(body?.percent_remaining);
	if (isFinite(pctRemaining)) {
		utilization = 100 - pctRemaining;
	} else {
		const used = Number(body?.credits_used);
		const entitlement = Number(body?.entitlement);
		// An entitlement of 0 is unlimited or unmetered, not a divide-by-zero.
		if (isFinite(used) && isFinite(entitlement) && entitlement > 0) {
			utilization = (used / entitlement) * 100;
		}
	}
	if (utilization === null) return null;

	const reset = body?.quota_reset_date;
	return {
		utilization: Math.max(0, Math.min(100, Math.round(utilization))),
		// The API sends a bare date; widen it to ISO-8601 like every other resetsAt.
		resetsAt: typeof reset === "string" && reset ? new Date(`${reset}T00:00:00Z`).toISOString() : undefined,
		plan: typeof body?.copilot_plan === "string" ? body.copilot_plan : undefined,
	};
}

async function fetchUsage(token: string): Promise<FetchResult> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "ratpack-copilot-usage/1.0",
	};
	const attempts: Attempt[] = [];
	let orgHint = "";

	try {
		// Resolve username. Failures here really are about the token itself.
		const userRes = await fetch(`${GH_API}/user`, { headers });
		attempts.push({ url: `${GH_API}/user`, status: userRes.status });
		if (userRes.status === 401 || userRes.status === 403) {
			return { ok: false, status: userRes.status, reason: "auth", detail: `/user rejected${ssoHint(userRes)}` };
		}
		if (userRes.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
		if (!userRes.ok) return { ok: false, status: userRes.status, reason: "error", detail: trail(attempts) };
		const user: any = await userRes.json();
		const login: string = user?.login;
		if (!login) return { ok: false, status: 0, reason: "error", detail: "no login in /user response" };

		const now = new Date();
		const params = new URLSearchParams({
			year: String(now.getUTCFullYear()),
			month: String(now.getUTCMonth() + 1),
		});

		/** Reads one billing record. `null` means "not this one, keep looking". */
		const read = async (url: string): Promise<number | null> => {
			const res = await fetch(`${url}?${params}`, { headers });
			attempts.push({ url, status: res.status });
			if (res.status === 429) throw { rateLimited: true };
			if (!res.ok) return null;
			const body: any = await res.json();
			const items = body?.usageItems;
			// An empty report is a real answer for a personal account with no spend, but it
			// is also what a wrong-scope endpoint returns, so only accept a non-empty one
			// here and let a genuinely idle account fall through to the zero at the end.
			const rows = forUser(items, login);
			return Array.isArray(rows) && rows.length > 0 ? sumCredits(rows) : null;
		};

		// 1. Personal AI credit record: the only one a Copilot Pro/Pro+/Max account needs.
		let credits = await read(`${GH_API}/users/${login}/settings/billing/ai_credit/usage`);

		// 2. Company-managed licence: the credits are on the org's record, not the user's.
		if (credits === null) {
			const orgsRes = await fetch(`${GH_API}/user/orgs?per_page=${MAX_ORGS}`, { headers });
			attempts.push({ url: `${GH_API}/user/orgs`, status: orgsRes.status });
			// An org list that comes back 403 is a token-authorisation problem, not a missing
			// org. Enterprise setups hit this constantly: one org bans classic PATs, another
			// needs the token authorised for SAML SSO. Carry that into the failure detail
			// rather than leaving a bare 403 in the trail.
			if (orgsRes.status === 403) orgHint = ssoHint(orgsRes) || " (token is not authorised to list orgs)";
			const orgs: string[] = orgsRes.ok
				? ((await orgsRes.json()) as any[])
						.map((o) => o?.login)
						.filter((l): l is string => typeof l === "string")
						.slice(0, MAX_ORGS)
				: [];
			for (const org of orgs) {
				credits = await read(`${GH_API}/organizations/${org}/settings/billing/ai_credit/usage`);
				if (credits !== null) break;
			}
		}

		// 3. Last resort, and the only thing that answers for an Enterprise Managed User or a
		//    company-managed Copilot Business seat: the undocumented per-user quota record.
		//    It reports its own entitlement, so it needs no PLAN_LIMITS lookup.
		if (credits === null) {
			const quota = await readInternalQuota(headers, attempts);
			if (quota) {
				// This account has exactly one quota, so every window carries the same real
				// number rather than a per-plan guess. Keeping all five means a window the
				// user previously selected still resolves; ordering the account's actual plan
				// first makes it the primary, which is what the bridge publishes.
				const windows: WindowData[] = COPILOT_WINDOWS.map((w) => ({
					key: w.key,
					label: w.label,
					utilization: quota.utilization,
					resetsAt: quota.resetsAt ?? nextMonthStart(),
				}));
				const mine = quota.plan ? windows.findIndex((w) => w.key === quota.plan) : -1;
				if (mine > 0) windows.unshift(...windows.splice(mine, 1));
				return { ok: true, usage: { windows } };
			}
		}

		if (credits === null) {
			// Nothing answered. The trail is the whole point of this branch: it turns a bare
			// "Offline" into a line naming every endpoint tried and what each returned.
			const last = attempts[attempts.length - 1]?.status ?? 0;
			return {
				ok: false,
				status: last,
				reason: "error",
				detail: `no billing record found. Tried: ${trail(attempts)}${orgHint}`,
			};
		}

		const resetsAt = nextMonthStart();
		const windows: WindowData[] = COPILOT_WINDOWS.map((w) => ({
			key: w.key,
			label: w.label,
			utilization: Math.min(100, Math.round((credits / PLAN_LIMITS[w.key]) * 100)),
			resetsAt,
		}));

		return { ok: true, usage: { windows } };
	} catch (e) {
		if ((e as any)?.rateLimited) return { ok: false, status: 429, reason: "rate-limited" };
		// A corporate proxy or blocked egress to api.github.com lands here, not on an HTTP
		// status, so say which host failed rather than just "offline".
		return { ok: false, status: 0, reason: "error", detail: `${String(e)}${attempts.length ? ` after: ${trail(attempts)}` : ""}` };
	}
}

export const copilotProvider: Provider = {
	id: "copilot",
	displayName: "Copilot",
	brand: "#8957E5",
	windows: COPILOT_WINDOWS,
	defaultWindow: "pro",
	autoLoadToken: readGhToken,
	fetchUsage,
};
