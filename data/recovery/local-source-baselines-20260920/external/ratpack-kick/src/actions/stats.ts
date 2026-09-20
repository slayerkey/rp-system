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
import type { StatsSettings, MetricKey, DisplayMode, StatSnapshot } from "../platforms/types";
import { poller, type PollState } from "../stats/poller";
import { estimateDaysToMilestone, nextMilestone } from "../stats/milestone";
import { computeDelta, recentValues, getMetricHistory } from "../stats/history";
import { renderKey, renderMessage, renderPlatformIcon, renderAchievement, type RenderCtx } from "../render/svg";
import { cycleMode } from "../render/themes";
import type { ThemeName } from "../render/themes";

const LONG_PRESS_MS = 500;
const METRIC_CYCLE: MetricKey[] = ["followers", "live_viewers", "followers_today"];
const MODE_CYCLE: DisplayMode[] = ["number", "full", "milestone", "trend", "live"];

interface GlobalSettings {
	kick?: { username: string };
}

type Keyish = { setImage(image: string): Promise<void>; setSettings(s: StatsSettings): Promise<void> };

const achievementActive = new Map<string, { value: number; clearsAt: number }>();

@action({ UUID: "com.ratpack.kick.stats" })
export class KickAction extends SingletonAction<StatsSettings> {
	private readonly handles = new Map<string, Keyish>();
	private readonly settings = new Map<string, StatsSettings>();
	private readonly pollOff = new Map<string, () => void>();
	private readonly pressAt = new Map<string, number>();
	private readonly pollState = new Map<string, PollState>();
	private globalSettings: GlobalSettings = {};

	override async onWillAppear(ev: WillAppearEvent<StatsSettings>): Promise<void> {
		const id = ev.action.id;
		this.handles.set(id, ev.action as unknown as Keyish);
		this.settings.set(id, ev.payload.settings);
		const gs = (await streamDeck.settings.getGlobalSettings()) as GlobalSettings | null;
		this.globalSettings = gs ?? {};
		this.subscribe(id);
	}

	override onWillDisappear(ev: WillDisappearEvent<StatsSettings>): void {
		const id = ev.action.id;
		this.pollOff.get(id)?.();
		for (const m of [this.handles, this.settings, this.pollOff, this.pressAt, this.pollState]) m.delete(id);
		achievementActive.delete(id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<StatsSettings>): Promise<void> {
		const id = ev.action.id;
		this.settings.set(id, ev.payload.settings);
		this.render(id);
	}

	override onKeyDown(ev: KeyDownEvent<StatsSettings>): void {
		this.pressAt.set(ev.action.id, Date.now());
	}

	override async onKeyUp(ev: KeyUpEvent<StatsSettings>): Promise<void> {
		const id = ev.action.id;
		const dwell = Date.now() - (this.pressAt.get(id) ?? Date.now());
		const s: StatsSettings = { ...(this.settings.get(id) ?? ev.payload.settings) };

		if (s.displayMode === "platform_icon") {
			if (dwell >= LONG_PRESS_MS) poller.refresh(this.credKey());
			else void streamDeck.system.openUrl("https://kick.com/dashboard");
			return;
		}

		if (achievementActive.has(id)) {
			achievementActive.delete(id);
			this.render(id);
			return;
		}

		if (dwell >= LONG_PRESS_MS) {
			s.metric = cycleMode(METRIC_CYCLE, s.metric ?? "followers");
		} else {
			s.displayMode = cycleMode(MODE_CYCLE, s.displayMode ?? "number");
		}

		this.settings.set(id, s);
		await (ev.action as unknown as Keyish).setSettings(s);
		this.render(id);
		poller.refresh(this.credKey());
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonObject, StatsSettings>): Promise<void> {
		const msg = ev.payload as Record<string, unknown>;

		if (msg.event === "saveKick") {
			const username = String(msg.username ?? "").trim().toLowerCase();
			if (!username) return;
			const gs: GlobalSettings = { ...this.globalSettings, kick: { username } };
			this.globalSettings = gs;
			await streamDeck.settings.setGlobalSettings(gs as unknown as JsonObject);
			// Resubscribe all keys with new username
			for (const [kid] of this.settings) {
				this.pollOff.get(kid)?.();
				this.subscribe(kid);
			}
		}

		if (msg.event === "getGlobalSettings") {
			const gs = (await streamDeck.settings.getGlobalSettings()) as GlobalSettings | null;
			this.globalSettings = gs ?? {};
			try {
				await (ev.action as unknown as { sendToPropertyInspector: (p: unknown) => Promise<void> })
					.sendToPropertyInspector({ event: "globalSettings", payload: this.globalSettings });
			} catch { /**/ }
		}

		if (msg.event === "openUrl" && typeof msg.url === "string") {
			if (/^https?:\/\//.test(msg.url)) void streamDeck.system.openUrl(msg.url);
		}
	}

	private credKey(): string {
		return this.globalSettings.kick?.username ?? "kick_default";
	}

	private subscribe(id: string): void {
		const creds = { username: this.globalSettings.kick?.username };
		this.pollOff.set(id, poller.subscribe(this.credKey(), creds, (state) => {
			this.pollState.set(id, state);
			this.checkAchievement(id, state);
			this.render(id);
		}));
	}

	private checkAchievement(id: string, state: PollState): void {
		if (state.status !== "ok") return;
		const s = this.settings.get(id);
		if (!s || s.displayMode === "platform_icon") return;
		const metric = s.metric ?? "followers";
		const snap = state.snapshots.find((sn) => sn.metric === metric);
		if (!snap) return;
		const target = s.milestoneTarget ?? (s.milestoneAuto !== false ? nextMilestone(snap.value) : undefined);
		if (!target) return;
		const history = getMetricHistory(state.history, metric);
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
		const theme: ThemeName = s.theme ?? "oled";
		const metric: MetricKey = s.metric ?? "followers";
		const mode: DisplayMode = s.displayMode ?? "number";

		if (mode === "platform_icon") return renderPlatformIcon({ theme });

		const state = this.pollState.get(id);
		if (!state || state.status === "loading") return renderMessage("Loading…", [], theme);
		if (state.status === "no-creds") return renderMessage("Setup", ["Enter your Kick", "channel in settings"], theme);
		if (state.status === "auth") return renderMessage("Not Found", ["Check your channel", "name in settings"], theme);
		if (state.status === "rate-limited") return renderMessage("Rate limit", ["Retrying…"], theme);
		if (state.status === "offline") {
			if (state.stale && state.snapshots.length > 0) {
				const snap = state.snapshots.find((sn) => sn.metric === metric);
				if (snap) return this.buildKeyImage(id, snap, s, state, theme, mode);
			}
			return renderMessage("Offline", ["Retrying…"], theme);
		}

		// followers_today is derived from history delta — show 0 until a second day of data exists
		if (metric === "followers_today") {
			const delta = computeDelta(state.history, "followers", 1);
			const synth: StatSnapshot = {
				platform: "kick", metric: "followers_today",
				value: delta ?? 0, fetchedAt: Date.now(),
			};
			return this.buildKeyImage(id, synth, s, state, theme, mode);
		}

		const snap = state.snapshots.find((sn) => sn.metric === metric);
		if (!snap) return renderMessage("No data", [metric], theme);
		return this.buildKeyImage(id, snap, s, state, theme, mode);
	}

	private buildKeyImage(id: string, snap: StatSnapshot, s: StatsSettings, state: PollState, theme: ThemeName, mode: DisplayMode): string {
		const achievement = achievementActive.get(id);
		if (achievement) return renderAchievement(snap, achievement.value, { theme });

		const channelName = this.globalSettings.kick?.username;

		if (mode === "trend") {
			const history = recentValues(state.history, snap.metric === "followers_today" ? "followers" : snap.metric, 14);
			const delta = computeDelta(state.history, snap.metric === "followers_today" ? "followers" : snap.metric, s.deltaWindow === "7d" ? 7 : 1);
			const trendSnap = { ...snap, delta, deltaWindow: s.deltaWindow ?? "today" };
			return renderKey(trendSnap, { mode: "trend", theme, trendHistory: history, channelName });
		}

		if (mode === "milestone") {
			const target = s.milestoneTarget ?? nextMilestone(snap.value);
			const history = getMetricHistory(state.history, snap.metric === "followers_today" ? "followers" : snap.metric);
			const daysEta = estimateDaysToMilestone(snap.value, target, history);
			return renderKey(snap, { mode: "milestone", theme, milestoneTarget: target, daysEta, channelName });
		}

		if (mode === "live") {
			const liveSnap = state.snapshots.find((sn) => sn.metric === "live_viewers") ?? snap;
			return renderKey(liveSnap, { mode: "live", theme });
		}

		const ctx: RenderCtx = { mode: mode === "full" ? "full" : "number", theme, milestoneTarget: s.milestoneTarget, milestoneAuto: s.milestoneAuto !== false, channelName };
		return renderKey(snap, ctx);
	}
}
