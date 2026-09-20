export type PlatformId = "youtube" | "twitch";

export type MetricKey =
	| "subscribers"
	| "total_views"
	| "video_count"
	| "views_today"
	| "views_7day"
	| "subs_today"
	| "live_viewers"
	| "followers"
	| "followers_today"
	| "twitch_subs"
	| "estimated_revenue"
	| "comments_today"
	| "upload_streak"
	| "stream_status";

export type DisplayMode =
	| "number"
	| "full"
	| "milestone"
	| "trend"
	| "live"
	| "platform_icon"
	| "achievement"
	| "streak"
	| "multi";

export interface StatSnapshot {
	platform: PlatformId;
	metric: MetricKey;
	value: number;
	delta?: number;
	deltaWindow?: "today" | "7d";
	fetchedAt: number;
	liveStatus?: "offline" | "live";
	streamStartedAt?: string;
	peakViewers?: number;
}

export interface PlatformCreds {
	apiKey?: string;
	channelId?: string;
	accessToken?: string;
	refreshToken?: string;
	userId?: string;
	username?: string;
	clientId?: string;
}

export type PlatformResult =
	| { ok: true; snapshots: StatSnapshot[] }
	| { ok: false; status: number; reason: "auth" | "rate-limited" | "quota" | "error"; detail?: string };

export interface PlatformConfig {
	id: PlatformId;
	displayName: string;
	brandColor: string;
	studioUrl: string;
	availableMetrics: MetricKey[];
	defaultMetric: MetricKey;
	pollIntervalMs: number;
	livePollIntervalMs: number;
	fetchStats(creds: PlatformCreds): Promise<PlatformResult>;
}

export type StatsSettings = {
	platform?: PlatformId;
	metric?: MetricKey;
	displayMode?: DisplayMode;
	theme?: "oled" | "creator";
	milestoneTarget?: number;
	milestoneAuto?: boolean;
	showDelta?: boolean;
	deltaWindow?: "today" | "7d";
	account?: string;
};
