import type { PlatformConfig, PlatformCreds, PlatformResult, StatSnapshot } from "./types";

const KICK_API = "https://kick.com/api/v2/channels";

interface KickChannel {
	followersCount?: number;
	followers_count?: number;
	subscription_enabled?: boolean;
	subscribers_count?: number;
	livestream: null | {
		viewer_count?: number;
		viewers?: number;
		created_at?: string;
		is_live?: boolean;
	};
}

async function fetchStats(creds: PlatformCreds): Promise<PlatformResult> {
	const username = creds.username ?? "";
	if (!username) return { ok: false, status: 401, reason: "auth", detail: "No channel username set" };

	let res: Response;
	try {
		res = await fetch(`${KICK_API}/${encodeURIComponent(username.toLowerCase())}`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0 (compatible; ratpack-kick/1.0)",
			},
		});
	} catch {
		return { ok: false, status: 0, reason: "error" };
	}

	if (res.status === 404) return { ok: false, status: 404, reason: "auth", detail: `Channel "${username}" not found` };
	if (res.status === 429) return { ok: false, status: 429, reason: "rate-limited" };
	if (!res.ok) return { ok: false, status: res.status, reason: "error" };

	let data: KickChannel;
	try {
		data = (await res.json()) as KickChannel;
	} catch {
		return { ok: false, status: 0, reason: "error" };
	}

	const now = Date.now();
	const snapshots: StatSnapshot[] = [];

	// Kick API uses camelCase followersCount (unusual — handle both forms)
	const followers = data.followersCount ?? data.followers_count ?? 0;
	snapshots.push({ platform: "kick", metric: "followers", value: followers, fetchedAt: now });

	// Live stream info
	const stream = data.livestream;
	const isLive = !!stream && stream.is_live !== false;
	const viewers = stream ? (stream.viewer_count ?? stream.viewers ?? 0) : 0;
	snapshots.push({
		platform: "kick",
		metric: "live_viewers",
		value: viewers,
		fetchedAt: now,
		liveStatus: isLive ? "live" : "offline",
		streamStartedAt: isLive ? (stream?.created_at ?? undefined) : undefined,
	});

	return { ok: true, snapshots };
}

export const kick: PlatformConfig = {
	id: "kick",
	displayName: "Kick",
	brandColor: "#53FC18",
	studioUrl: "https://kick.com/dashboard",
	availableMetrics: ["followers", "live_viewers", "followers_today"],
	defaultMetric: "followers",
	pollIntervalMs: 300_000,
	livePollIntervalMs: 90_000,
	fetchStats,
};
