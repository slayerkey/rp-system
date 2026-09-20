import {
	action,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
	type KeyDownEvent,
	type KeyUpEvent,
	type DidReceiveSettingsEvent,
	type SendToPluginEvent,
	type JsonObject,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StatsSettings, StatSnapshot, PlatformId, MetricKey, DisplayMode } from "../platforms/types";
import { poller, type PollState } from "../stats/poller";
import { estimateDaysToMilestone, nextMilestone } from "../stats/milestone";
import { computeStreak } from "../stats/streak";
import { computeDelta, recentValues, getMetricHistory } from "../stats/history";
import {
	renderKey,
	renderMessage,
	renderPlatformIcon,
	renderMulti,
	type RenderCtx,
} from "../render/svg";
import { cycleMode } from "../render/themes";
import type { ThemeName } from "../render/themes";
import { youtube } from "../platforms/youtube";
import { twitch } from "../platforms/twitch";
import { startOAuthCallbackServer, refreshTwitchToken } from "../auth/oauth";

const LONG_PRESS_MS = 500;

const DEBUG_FILE = join(homedir(), "Desktop", "ratpack-debug.txt");

function dbgLog(msg: string): void {
	try { appendFileSync(DEBUG_FILE, `[${new Date().toISOString()}] ${msg}\n`); } catch { /* */ }
}

function openBrowser(url: string): void {
	if (!/^https?:\/\//.test(url)) return;
	dbgLog(`openBrowser: ${url}`);
	void streamDeck.system.openUrl(url);
}

// Per-platform metric cycle order
const METRIC_CYCLE: Record<PlatformId, MetricKey[]> = {
	youtube: ["subscribers", "total_views", "video_count", "live_viewers", "upload_streak"],
	twitch: ["followers", "live_viewers", "twitch_subs", "followers_today"],
};

// Platform studio URLs
const STUDIO_URLS: Record<PlatformId, string> = {
	youtube: youtube.studioUrl,
	twitch: twitch.studioUrl,
};

// Global credentials store (shared across all keys).
interface GlobalSettings {
	youtube?: { apiKey: string; channelId: string };
	twitch?: { clientId: string; clientSecret?: string; accessToken?: string; refreshToken?: string; userId?: string; username?: string; expiresAt?: number };
}

type Keyish = { setImage(image: string): Promise<void>; setSettings(s: StatsSettings): Promise<void> };

// Track milestone-crossed state per key
const achievementActive = new Map<string, { value: number; clearsAt: number }>();

@action({ UUID: "com.ratpack.livestats.stats" })
export class StatsAction extends SingletonAction<StatsSettings> {
	private readonly handles = new Map<string, Keyish>();
	private readonly settings = new Map<string, StatsSettings>();
	private readonly pollOff = new Map<string, () => void>();
	private readonly pressAt = new Map<string, number>();
	private pollState = new Map<string, PollState>();
	private globalSettings: GlobalSettings = {};
	private twitchRefreshing = false;
	private twitchLastRefreshAttempt = 0;

	/** Refresh the Twitch access token using the stored refresh token. Returns true if successful. */
	private async attemptTwitchRefresh(): Promise<boolean> {
		const tc = this.globalSettings.twitch;
		if (!tc?.refreshToken || !tc?.clientId) return false;
		if (this.twitchRefreshing) return false;
		if (Date.now() - this.twitchLastRefreshAttempt < 300_000) return false; // debounce: once per 5 min
		this.twitchRefreshing = true;
		this.twitchLastRefreshAttempt = Date.now();
		try {
			const tokens = await refreshTwitchToken(tc.clientId, tc.refreshToken, tc.clientSecret);
			const gs: GlobalSettings = { ...this.globalSettings };
			gs.twitch = { ...gs.twitch!, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt };
			this.globalSettings = gs;
			await streamDeck.settings.setGlobalSettings(gs as unknown as JsonObject);
			dbgLog(`Twitch token refreshed, expires ${new Date(tokens.expiresAt).toISOString()}`);
			return true;
		} catch (err) {
			dbgLog(`Twitch token refresh failed: ${String(err)}`);
			return false;
		} finally {
			this.twitchRefreshing = false;
		}
	}

	override async onWillAppear(ev: WillAppearEvent<StatsSettings>): Promise<void> {
		const id = ev.action.id;
		this.handles.set(id, ev.action as unknown as Keyish);
		this.settings.set(id, ev.payload.settings);

		// Load global settings (credentials)
		const gs = (await streamDeck.settings.getGlobalSettings()) as GlobalSettings | null;
		this.globalSettings = gs ?? {};

		// Proactively refresh Twitch token if expired or within 1 hour of expiry
		const tc = this.globalSettings.twitch;
		if ((ev.payload.settings.platform ?? "youtube") === "twitch" && tc?.accessToken && tc?.refreshToken) {
			if (!tc.expiresAt || tc.expiresAt < Date.now() + 3_600_000) {
				await this.attemptTwitchRefresh();
			}
		}

		this.subscribe(id, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<StatsSettings>): void {
		const id = ev.action.id;
		this.pollOff.get(id)?.();
		for (const m of [this.handles, this.settings, this.pollOff, this.pressAt, this.pollState]) m.delete(id);
		achievementActive.delete(id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<StatsSettings>): Promise<void> {
		const id = ev.action.id;
		const prev = this.settings.get(id);
		const next = ev.payload.settings;
		this.settings.set(id, next);

		// Re-subscribe if platform changed
		if (prev?.platform !== next.platform || prev?.account !== next.account) {
			this.pollOff.get(id)?.();
			this.subscribe(id, next);
		} else {
			this.render(id);
		}
	}

	override onKeyDown(ev: KeyDownEvent<StatsSettings>): void {
		this.pressAt.set(ev.action.id, Date.now());
	}

	override async onKeyUp(ev: KeyUpEvent<StatsSettings>): Promise<void> {
		const id = ev.action.id;
		const dwell = Date.now() - (this.pressAt.get(id) ?? Date.now());
		const s: StatsSettings = { ...(this.settings.get(id) ?? ev.payload.settings) };
		const platform = s.platform ?? "youtube";

		// Platform icon key: short press → open studio; long press → skip
		if (s.displayMode === "platform_icon") {
			if (dwell < LONG_PRESS_MS) {
				openBrowser(STUDIO_URLS[platform]);
			} else {
				// Long press on icon key: refresh all keys for this platform
				poller.refresh(platform, this.credKey(platform));
			}
			return;
		}

		// Achievement: any press dismisses
		if (achievementActive.has(id)) {
			achievementActive.delete(id);
			this.render(id);
			return;
		}

		if (dwell >= LONG_PRESS_MS) {
			// Long press: cycle metric
			const cycle = METRIC_CYCLE[platform];
			const current = s.metric ?? cycle[0];
			s.metric = cycleMode(cycle, current);
		} else {
			// Short press: cycle display mode
			const availableModes: DisplayMode[] = ["number", "full", "milestone", "trend", "live"];
			s.displayMode = cycleMode(availableModes, s.displayMode ?? "number");
		}

		this.settings.set(id, s);
		await (ev.action as unknown as Keyish).setSettings(s);
		this.render(id);

		// Opportunistic refresh
		poller.refresh(platform, this.credKey(platform));
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonObject, StatsSettings>): Promise<void> {
		const msg = ev.payload as Record<string, unknown>;
		const eventName = String(msg.event ?? "unknown");

		dbgLog(`onSendToPlugin received: ${eventName}`);

		// Always ack so PI can confirm the round-trip works
		try {
			await streamDeck.ui.sendToPropertyInspector({ event: "debug_ack", received: eventName });
		} catch { /* */ }

		if (msg.event === "startOAuthServer") {
			const clientId = String(msg.clientId ?? "");
			const clientSecret = String(msg.clientSecret ?? "");
			const verifier = String(msg.verifier ?? "");
			const state = String(msg.state ?? "");
			if (!clientId || !verifier || !state) return;
			dbgLog(`startOAuthServer: starting server for ${clientId}`);
			try {
				const tokens = await startOAuthCallbackServer(clientId, clientSecret, verifier, state);
				const gs: GlobalSettings = { ...this.globalSettings };
				gs.twitch = {
					clientId,
					clientSecret: clientSecret || undefined,
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					expiresAt: tokens.expiresAt,
					userId: tokens.userId,
					username: tokens.username,
				};
				this.globalSettings = gs;
				await streamDeck.settings.setGlobalSettings(gs as unknown as JsonObject);
				// Notify PI so status updates immediately
				try {
					await streamDeck.ui.sendToPropertyInspector({ event: "globalSettings", payload: gs });
				} catch { /**/ }
				// Re-subscribe all Twitch keys
				for (const [kid, ks] of this.settings) {
					if (ks.platform === "twitch") {
						this.pollOff.get(kid)?.();
						this.subscribe(kid, ks);
					}
				}
				// Force an immediate poll — re-subscribe alone won't kick one off
				// when the poller entry already exists for this credKey
				poller.refresh("twitch", this.credKey("twitch"));
			} catch (err) {
				streamDeck.logger.error("Twitch OAuth failed:", String(err));
			}
		}

		if (msg.event === "saveYouTube") {
			const gs: GlobalSettings = { ...this.globalSettings };
			gs.youtube = { apiKey: String(msg.apiKey ?? ""), channelId: String(msg.channelId ?? "") };
			this.globalSettings = gs;
			await streamDeck.settings.setGlobalSettings(gs as unknown as JsonObject);
			for (const [kid, ks] of this.settings) {
				if (ks.platform === "youtube") {
					this.pollOff.get(kid)?.();
					this.subscribe(kid, ks);
				}
			}
		}

		if (msg.event === "getGlobalSettings") {
			const gs = (await streamDeck.settings.getGlobalSettings()) as GlobalSettings | null;
			this.globalSettings = gs ?? {};
			await streamDeck.ui.sendToPropertyInspector({ event: "globalSettings", payload: this.globalSettings });
		}

		if (msg.event === "openUrl" && typeof msg.url === "string") {
			openBrowser(msg.url);
		}
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Private
	// ─────────────────────────────────────────────────────────────────────────

	private credKey(platform: PlatformId): string {
		if (platform === "youtube") return this.globalSettings.youtube?.channelId ?? "yt_default";
		if (platform === "twitch") return this.globalSettings.twitch?.username ?? "tw_default";
		return "default";
	}

	private credsFor(platform: PlatformId): import("../platforms/types").PlatformCreds {
		if (platform === "youtube") {
			return {
				apiKey: this.globalSettings.youtube?.apiKey,
				channelId: this.globalSettings.youtube?.channelId,
			};
		}
		if (platform === "twitch") {
			const tc = this.globalSettings.twitch;
			return {
				clientId: tc?.clientId,
				accessToken: tc?.accessToken,
				refreshToken: tc?.refreshToken,
				userId: tc?.userId,
				username: tc?.username,
			};
		}
		return {};
	}

	private subscribe(id: string, s: StatsSettings): void {
		const platform = s.platform ?? "youtube";
		const credKey = this.credKey(platform);
		const creds = this.credsFor(platform);

		this.pollOff.set(
			id,
			poller.subscribe(credKey, platform, creds, (state) => {
				// On Twitch auth error, try refreshing the token then resubscribe all Twitch keys
				if (state.status === "auth" && platform === "twitch") {
					void this.attemptTwitchRefresh().then((refreshed) => {
						if (refreshed) {
							setTimeout(() => {
								for (const [kid, ks] of this.settings) {
									if (ks.platform === "twitch") {
										this.pollOff.get(kid)?.();
										this.subscribe(kid, ks);
									}
								}
							}, 0);
							return;
						}
						this.pollState.set(id, state);
						this.render(id);
					});
					return;
				}
				this.pollState.set(id, state);
				this.checkAchievement(id, state);
				this.render(id);
			}),
		);
	}

	/** Check if a milestone was just crossed and activate achievement mode. */
	private checkAchievement(id: string, state: PollState): void {
		if (state.status !== "ok") return;
		const s = this.settings.get(id);
		if (!s || s.displayMode === "platform_icon") return;

		const metric = s.metric ?? "subscribers";
		const snap = state.snapshots.find((sn) => sn.metric === metric);
		if (!snap) return;

		const target = s.milestoneTarget ?? (s.milestoneAuto !== false ? nextMilestone(snap.value) : undefined);
		if (!target) return;

		// Check history to see if we JUST crossed this milestone (previous value < target, current >= target)
		const history = getMetricHistory(state.history, snap.platform, metric);
		if (history.length < 2) return;
		const prev = history[history.length - 2].value;
		if (prev < target && snap.value >= target) {
			achievementActive.set(id, { value: target, clearsAt: Date.now() + 60_000 });
			setTimeout(() => {
				if (achievementActive.get(id)?.value === target) {
					achievementActive.delete(id);
					this.render(id);
				}
			}, 60_000);
		}
	}

	private render(id: string): void {
		const handle = this.handles.get(id);
		if (!handle) return;
		void handle.setImage(this.buildImage(id));
	}

	private buildImage(id: string): string {
		const s = this.settings.get(id) ?? {};
		const platform: PlatformId = s.platform ?? "youtube";
		const theme: ThemeName = s.theme ?? "oled";
		const metric: MetricKey = s.metric ?? (platform === "youtube" ? "subscribers" : "followers");
		const mode: DisplayMode = s.displayMode ?? "number";

		// Platform icon key — always renders regardless of poll state
		if (mode === "platform_icon") return renderPlatformIcon(platform, { theme });

		// Multi-stat key
		if (mode === "multi") {
			const ytState = this.getStateFor("youtube");
			const twState = this.getStateFor("twitch");
			const ytOk = ytState?.status === "ok";
			const twOk = twState?.status === "ok";
			const tw = (m: string) => twState?.snapshots.find((sn) => sn.metric === m) ?? null;
			const yt = (m: string) => ytState?.snapshots.find((sn) => sn.metric === m) ?? null;

			// Synthesize subs_today from history delta
			const subsDeltaVal = ytState ? computeDelta(ytState.history, "youtube", "subscribers", 1) : undefined;
			const subsTodaySnap: StatSnapshot | null = subsDeltaVal !== undefined
				? { platform: "youtube", metric: "subs_today", value: subsDeltaVal, fetchedAt: Date.now() }
				: null;

			let multiSnaps;
			if (ytOk && twOk) {
				// Both: reliable stats only — followers_today avoids null twitch_subs for non-affiliates
				multiSnaps = [
					{ snap: tw("followers"), label: "TW FOL" },
					{ snap: yt("subscribers"), label: "YT SUBS" },
					{ snap: tw("live_viewers"), label: "TW LIVE" },
					{ snap: tw("followers_today"), label: "FOL+" },
				];
			} else if (twOk) {
				// Twitch only
				multiSnaps = [
					{ snap: tw("followers"), label: "FOLLOW" },
					{ snap: tw("live_viewers"), label: "LIVE" },
					{ snap: tw("twitch_subs"), label: "SUBS" },
					{ snap: tw("followers_today"), label: "FOL+" },
				];
			} else {
				// YouTube only
				multiSnaps = [
					{ snap: yt("subscribers"), label: "SUBS" },
					{ snap: subsTodaySnap, label: "SUBS+" },
					{ snap: yt("live_viewers"), label: "LIVE" },
					{ snap: yt("upload_streak"), label: "STREAK" },
				];
			}
			return renderMulti(multiSnaps, { theme });
		}

		const state = this.pollState.get(id);

		if (!state || state.status === "loading") return renderMessage("Loading…", [], platform, theme);
		if (state.status === "no-creds") return renderMessage("Setup", ["Add credentials", "in settings"], platform, theme);
		if (state.status === "auth") return renderMessage("Auth Error", ["Check your", "credentials"], platform, theme);
		if (state.status === "quota") return renderMessage("Quota", ["YouTube quota", "exceeded today"], platform, theme);
		if (state.status === "rate-limited") return renderMessage("Rate limit", ["Retrying…"], platform, theme);
		if (state.status === "offline") {
			if (state.stale && state.snapshots.length > 0) {
				// Show stale data with muted color
				const snap = state.snapshots.find((sn) => sn.metric === metric);
				if (snap) return this.buildKeyImage(id, snap, s, state, theme, mode);
			}
			return renderMessage("Offline", ["Retrying…"], platform, theme);
		}

		const snap = state.snapshots.find((sn) => sn.metric === metric);
		if (!snap) {
			return renderMessage("No data", [metric], platform, theme);
		}

		return this.buildKeyImage(id, snap, s, state, theme, mode);
	}

	private buildKeyImage(
		id: string,
		snap: StatSnapshot,
		s: StatsSettings,
		state: PollState,
		theme: ThemeName,
		mode: DisplayMode,
	): string {
		// Achievement overrides everything
		const achievement = achievementActive.get(id);
		if (achievement) {
			return renderKey(snap, { mode: "achievement", theme, achievementValue: achievement.value });
		}

		const metric = snap.metric;
		const platform = snap.platform;

		// Streak mode
		if (mode === "streak" || metric === "upload_streak") {
			const uploadDates = (global as Record<string, unknown>).__yt_upload_dates as string[] | undefined;
			const { days, lastUploadAgo } = computeStreak(uploadDates ?? []);
			return renderKey(snap, { mode: "streak", theme, streakDays: days, lastUploadAgo });
		}

		// Trend mode
		if (mode === "trend") {
			const history = recentValues(state.history, platform, metric, 14);
			const delta = computeDelta(state.history, platform, metric, s.deltaWindow === "7d" ? 7 : 1);
			const trendSnap = { ...snap, delta, deltaWindow: s.deltaWindow ?? "today" };
			return renderKey(trendSnap, { mode: "trend", theme, trendHistory: history });
		}

		// Milestone mode
		if (mode === "milestone") {
			const target = s.milestoneTarget ?? nextMilestone(snap.value);
			const history = getMetricHistory(state.history, platform, metric);
			const daysEta = estimateDaysToMilestone(snap.value, target, history);
			return renderKey(snap, {
				mode: "milestone",
				theme,
				milestoneTarget: target,
				daysEta,
			});
		}

		// Live mode
		if (mode === "live") {
			const liveSnap = state.snapshots.find((sn) => sn.metric === "live_viewers") ?? snap;
			return renderKey(liveSnap, { mode: "live", theme });
		}

		// Big number / full number
		const ctx: RenderCtx = {
			mode: mode === "full" ? "full" : "number",
			theme,
			milestoneTarget: s.milestoneTarget,
			milestoneAuto: s.milestoneAuto !== false,
		};
		return renderKey(snap, ctx);
	}

	private getStateFor(platform: PlatformId): PollState | undefined {
		for (const [id, s] of this.settings) {
			if (s.platform === platform) return this.pollState.get(id);
		}
		return undefined;
	}
}
