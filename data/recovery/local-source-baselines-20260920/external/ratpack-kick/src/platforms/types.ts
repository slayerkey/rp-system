export type PlatformId = "kick";

export type MetricKey = "followers" | "live_viewers" | "followers_today";

export type DisplayMode =
	| "number"
	| "full"
	| "milestone"
	| "trend"
	| "live"
	| "platform_icon";

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
	username?: string;
}

export type PlatformResult =
	| { ok: true; snapshots: StatSnapshot[] }
	| { ok: false; status: number; reason: "auth" | "rate-limited" | "error"; detail?: string };

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
	metric?: MetricKey;
	displayMode?: DisplayMode;
	theme?: "oled" | "creator";
	milestoneTarget?: number;
	milestoneAuto?: boolean;
	deltaWindow?: "today" | "7d";
};
