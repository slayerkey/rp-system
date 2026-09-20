import type { PlatformConfig, PlatformCreds, PlatformResult, StatSnapshot } from "./types";

const BASE = "https://www.googleapis.com/youtube/v3";

async function apiFetch(path: string, params: Record<string, string>, apiKey: string): Promise<Response> {
	const qs = new URLSearchParams({ ...params, key: apiKey });
	return fetch(`${BASE}${path}?${qs}`);
}

async function fetchStats(creds: PlatformCreds): Promise<PlatformResult> {
	const { apiKey, channelId } = creds;
	if (!apiKey || !channelId) {
		return { ok: false, status: 401, reason: "auth", detail: "Missing API key or channel ID" };
	}

	const now = Date.now();
	const todayMidnight = new Date();
	todayMidnight.setHours(0, 0, 0, 0);
	const snapshots: StatSnapshot[] = [];

	// ── Channel statistics ──────────────────────────────────────────────────
	let chanRes: Response;
	try {
		chanRes = await apiFetch("/channels", { part: "statistics", id: channelId }, apiKey);
	} catch {
		return { ok: false, status: 0, reason: "error", detail: "Network error" };
	}

	if (chanRes.status === 403) return { ok: false, status: 403, reason: "quota" };
	if (chanRes.status === 400 || chanRes.status === 401) return { ok: false, status: chanRes.status, reason: "auth" };
	if (!chanRes.ok) return { ok: false, status: chanRes.status, reason: "error" };

	const chanData = (await chanRes.json()) as {
		items?: Array<{ statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean } }>;
	};

	const stats = chanData.items?.[0]?.statistics;
	if (!stats) return { ok: false, status: 404, reason: "auth", detail: "Channel not found" };

	const subscribers = parseInt(stats.subscriberCount ?? "0", 10);
	const totalViews = parseInt(stats.viewCount ?? "0", 10);
	const videoCount = parseInt(stats.videoCount ?? "0", 10);

	snapshots.push({ platform: "youtube", metric: "subscribers", value: subscribers, fetchedAt: now });
	snapshots.push({ platform: "youtube", metric: "total_views", value: totalViews, fetchedAt: now });
	snapshots.push({ platform: "youtube", metric: "video_count", value: videoCount, fetchedAt: now });

	// ── Active live stream ──────────────────────────────────────────────────
	try {
		const liveRes = await apiFetch(
			"/search",
			{ part: "id", channelId, eventType: "live", type: "video" },
			apiKey,
		);
		if (liveRes.ok) {
			const liveData = (await liveRes.json()) as { items?: Array<{ id: { videoId?: string } }> };
			const videoId = liveData.items?.[0]?.id?.videoId;
			if (videoId) {
				const vidRes = await apiFetch("/videos", { part: "liveStreamingDetails", id: videoId }, apiKey);
				if (vidRes.ok) {
					const vidData = (await vidRes.json()) as {
						items?: Array<{ liveStreamingDetails?: { concurrentViewers?: string; actualStartTime?: string } }>;
					};
					const live = vidData.items?.[0]?.liveStreamingDetails;
					if (live) {
						snapshots.push({
							platform: "youtube",
							metric: "live_viewers",
							value: parseInt(live.concurrentViewers ?? "0", 10),
							fetchedAt: now,
							liveStatus: "live",
							streamStartedAt: live.actualStartTime,
						});
					}
				}
			} else {
				// No active live stream
				snapshots.push({ platform: "youtube", metric: "live_viewers", value: 0, fetchedAt: now, liveStatus: "offline" });
			}
		}
	} catch {
		// Non-fatal — live info is best-effort
	}

	// ── Recent uploads for streak ───────────────────────────────────────────
	try {
		const actRes = await apiFetch(
			"/activities",
			{ part: "snippet", channelId, maxResults: "10", type: "upload" },
			apiKey,
		);
		if (actRes.ok) {
			const actData = (await actRes.json()) as {
				items?: Array<{ snippet?: { publishedAt?: string } }>;
			};
			const uploadDates = (actData.items ?? [])
				.map((it) => it.snippet?.publishedAt)
				.filter((d): d is string => !!d);
			if (uploadDates.length > 0) {
				// Store as upload_streak metric — actual streak computed in action
				snapshots.push({
					platform: "youtube",
					metric: "upload_streak",
					value: uploadDates.length,
					fetchedAt: now,
					// Encode dates in delta field as count, store dates via side-channel below
				});
				// Attach dates as a side channel via the global
				(global as Record<string, unknown>).__yt_upload_dates = uploadDates;
			}
		}
	} catch {
		// Non-fatal
	}

	return { ok: true, snapshots };
}

export const youtube: PlatformConfig = {
	id: "youtube",
	displayName: "YouTube",
	brandColor: "#FF0000",
	studioUrl: "https://studio.youtube.com",
	availableMetrics: ["subscribers", "total_views", "video_count", "live_viewers", "upload_streak"],
	defaultMetric: "subscribers",
	pollIntervalMs: 600_000,
	livePollIntervalMs: 120_000,
	fetchStats,
};
