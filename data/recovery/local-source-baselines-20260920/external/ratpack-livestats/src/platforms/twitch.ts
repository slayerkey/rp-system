import type { PlatformConfig, PlatformCreds, PlatformResult, StatSnapshot } from "./types";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HELIX = "https://api.twitch.tv/helix";
const DEBUG_FILE = join(homedir(), "Desktop", "ratpack-debug.txt");
function dbg(msg: string) { try { appendFileSync(DEBUG_FILE, `[${new Date().toISOString()}] twitch: ${msg}\n`); } catch { /**/ } }

async function helixGet(
	path: string,
	params: Record<string, string>,
	token: string,
	clientId: string,
): Promise<Response> {
	const qs = new URLSearchParams(params);
	return fetch(`${HELIX}${path}?${qs}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			"Client-Id": clientId,
		},
	});
}

/** Get app-level access token (client credentials) for public endpoints. */
async function getAppToken(clientId: string, clientSecret: string): Promise<string | null> {
	try {
		const res = await fetch("https://id.twitch.tv/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				grant_type: "client_credentials",
			}),
		});
		const data = (await res.json()) as { access_token?: string };
		return data.access_token ?? null;
	} catch {
		return null;
	}
}

// Cache app token per client_id to avoid redundant requests
const appTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function resolveToken(creds: PlatformCreds): Promise<string | null> {
	// Prefer user OAuth token (has follower/sub scopes)
	if (creds.accessToken) return creds.accessToken;

	// Fall back to app token for public stream info
	const clientId = creds.clientId ?? "";
	const clientSecret = (creds as unknown as Record<string, string>).clientSecret ?? "";
	if (!clientId || !clientSecret) return null;

	const cached = appTokenCache.get(clientId);
	if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

	const token = await getAppToken(clientId, clientSecret);
	if (token) appTokenCache.set(clientId, { token, expiresAt: Date.now() + 3_600_000 });
	return token;
}

async function fetchStats(creds: PlatformCreds): Promise<PlatformResult> {
	const clientId = creds.clientId ?? "";
	const username = creds.username ?? "";
	const userId = creds.userId ?? "";

	if (!clientId || (!username && !userId)) {
		dbg(`no-creds: clientId=${!!clientId} username=${username} userId=${userId}`);
		return { ok: false, status: 401, reason: "auth", detail: "Missing Twitch credentials" };
	}

	const token = await resolveToken(creds);
	if (!token) { dbg("no token resolved"); return { ok: false, status: 401, reason: "auth", detail: "No Twitch token available" }; }

	const now = Date.now();
	const snapshots: StatSnapshot[] = [];

	// ── Resolve userId from username if needed ──────────────────────────────
	let uid = userId;
	if (!uid && username) {
		try {
			const userRes = await helixGet("/users", { login: username }, token, clientId);
			if (userRes.status === 401) return { ok: false, status: 401, reason: "auth" };
			if (userRes.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
			if (userRes.ok) {
				const ud = (await userRes.json()) as { data?: Array<{ id?: string }> };
				uid = ud.data?.[0]?.id ?? "";
			}
		} catch {
			return { ok: false, status: 0, reason: "error" };
		}
	}

	if (!uid) return { ok: false, status: 404, reason: "auth", detail: "Twitch user not found" };

	dbg(`poll uid=${uid} hasAccessToken=${!!creds.accessToken}`);

	// ── Stream status (app token works for this) ────────────────────────────
	try {
		const streamRes = await helixGet("/streams", { user_id: uid }, token, clientId);
		dbg(`streams status=${streamRes.status}`);
		if (streamRes.status === 401) return { ok: false, status: 401, reason: "auth" };
		if (streamRes.status === 429) return { ok: false, status: 429, reason: "rate-limited" };

		if (streamRes.ok) {
			const sd = (await streamRes.json()) as {
				data?: Array<{ viewer_count?: number; started_at?: string; type?: string }>;
			};
			const stream = sd.data?.[0];
			const isLive = !!stream && stream.type === "live";
			snapshots.push({
				platform: "twitch",
				metric: "live_viewers",
				value: isLive ? (stream.viewer_count ?? 0) : 0,
				fetchedAt: now,
				liveStatus: isLive ? "live" : "offline",
				streamStartedAt: isLive ? stream.started_at : undefined,
			});
		} else {
			dbg(`streams non-ok body: ${await streamRes.text().catch(() => "?")}`);
		}
	} catch (err) {
		dbg(`streams fetch threw: ${String(err)}`);
	}

	// ── Follower count (requires user token + moderator:read:followers) ──────
	if (creds.accessToken) {
		try {
			const followRes = await helixGet(
				"/channels/followers",
				{ broadcaster_id: uid, first: "1" },
				creds.accessToken,
				clientId,
			);
			dbg(`followers status=${followRes.status}`);
			if (followRes.status === 401) return { ok: false, status: 401, reason: "auth" };
			if (followRes.ok) {
				const fd = (await followRes.json()) as { total?: number; data?: Array<{ followed_at?: string }> };
				snapshots.push({ platform: "twitch", metric: "followers", value: fd.total ?? 0, fetchedAt: now });

				// New followers today
				const todayMidnight = new Date();
				todayMidnight.setHours(0, 0, 0, 0);
				// We'd need to page through followers to count today's — use a smaller approximation
				// by pulling a larger page and counting recent ones
				const recentRes = await helixGet(
					"/channels/followers",
					{ broadcaster_id: uid, first: "100" },
					creds.accessToken,
					clientId,
				);
				if (recentRes.ok) {
					const rd = (await recentRes.json()) as { data?: Array<{ followed_at?: string }> };
					const todayCount = (rd.data ?? []).filter(
						(f) => f.followed_at && new Date(f.followed_at) >= todayMidnight,
					).length;
					snapshots.push({ platform: "twitch", metric: "followers_today", value: todayCount, fetchedAt: now });
				}
			}
		} catch {
			// Non-fatal — follower count may not be available without the scope
		}

		// ── Subscriber count (requires channel:read:subscriptions) ─────────────
		try {
			const subRes = await helixGet(
				"/subscriptions",
				{ broadcaster_id: uid, first: "1" },
				creds.accessToken,
				clientId,
			);
			if (subRes.ok) {
				const subData = (await subRes.json()) as { total?: number };
				if (subData.total !== undefined) {
					snapshots.push({ platform: "twitch", metric: "twitch_subs", value: subData.total, fetchedAt: now });
				}
			}
		} catch {
			// Non-fatal — only available for affiliates/partners
		}
	}

	if (snapshots.length === 0) { dbg("no snapshots — returning error"); return { ok: false, status: 0, reason: "error", detail: "No data returned" }; }
	return { ok: true, snapshots };
}

export const twitch: PlatformConfig = {
	id: "twitch",
	displayName: "Twitch",
	brandColor: "#9146FF",
	studioUrl: "https://dashboard.twitch.tv",
	availableMetrics: ["followers", "followers_today", "live_viewers", "twitch_subs"],
	defaultMetric: "followers",
	pollIntervalMs: 300_000,
	livePollIntervalMs: 90_000,
	fetchStats,
};
