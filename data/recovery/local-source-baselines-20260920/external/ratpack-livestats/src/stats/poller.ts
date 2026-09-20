// One shared poller per credential key. Calls each platform adapter, keeps last-good
// data, backs off on rate limits, records history, detects live → fast-poll switch.
import type { PlatformId, StatSnapshot, PlatformCreds, PlatformResult } from "../platforms/types";
import { youtube } from "../platforms/youtube";
import { twitch } from "../platforms/twitch";
import type { ChannelHistory } from "./history";
import { loadHistory, recordHistory } from "./history";

export type PollStatus = "loading" | "ok" | "no-creds" | "auth" | "rate-limited" | "quota" | "offline";

export interface PollState {
	status: PollStatus;
	snapshots: StatSnapshot[];
	fetchedAt?: number;
	stale: boolean;
	history: ChannelHistory;
	isLive: boolean;
}

type Listener = (state: PollState) => void;

const JITTER = 15_000;
const MAX_BACKOFF = 4;

interface Entry {
	credKey: string;
	platform: PlatformId;
	creds: PlatformCreds;
	state: PollState;
	listeners: Set<Listener>;
	timer?: ReturnType<typeof setTimeout>;
	backoff: number;
	inflight: boolean;
}

function intervalFor(platform: PlatformId, isLive: boolean): number {
	if (platform === "twitch" && isLive) return 90_000;
	if (platform === "twitch") return 300_000;
	if (platform === "youtube" && isLive) return 120_000;
	if (platform === "youtube") return 600_000;
	return 300_000;
}

function platformAdapter(platform: PlatformId): { fetchStats: (creds: PlatformCreds) => Promise<PlatformResult> } {
	if (platform === "youtube") return youtube;
	if (platform === "twitch") return twitch;
	throw new Error(`Unknown platform: ${platform}`);
}

class Poller {
	private readonly entries = new Map<string, Entry>();

	subscribe(credKey: string, platform: PlatformId, creds: PlatformCreds, listener: Listener): () => void {
		const mapKey = `${platform}:${credKey}`;
		let e = this.entries.get(mapKey);
		if (!e) {
			e = {
				credKey,
				platform,
				creds,
				state: { status: "loading", snapshots: [], stale: false, history: loadHistory(credKey), isLive: false },
				listeners: new Set(),
				backoff: 0,
				inflight: false,
			};
			this.entries.set(mapKey, e);
			void this.poll(e);
		} else {
			// Update creds in case they changed
			e.creds = creds;
		}
		e.listeners.add(listener);
		listener(e.state);
		return () => {
			const entry = this.entries.get(mapKey);
			if (!entry) return;
			entry.listeners.delete(listener);
			if (entry.listeners.size === 0) {
				if (entry.timer) clearTimeout(entry.timer);
				this.entries.delete(mapKey);
			}
		};
	}

	refresh(platform: PlatformId, credKey: string): void {
		const e = this.entries.get(`${platform}:${credKey}`);
		if (e && !e.inflight) void this.poll(e);
	}

	private schedule(e: Entry): void {
		if (e.timer) clearTimeout(e.timer);
		const base = intervalFor(e.platform, e.state.isLive);
		const interval = base * 2 ** e.backoff + Math.random() * JITTER;
		e.timer = setTimeout(() => void this.poll(e), interval);
	}

	private async poll(e: Entry): Promise<void> {
		if (e.inflight) return;
		e.inflight = true;
		try {
			const hasAnyCreds = e.creds.apiKey || e.creds.accessToken;
			if (!hasAnyCreds && e.platform !== "twitch") {
				this.set(e, { ...e.state, status: "no-creds", stale: false });
				return;
			}

			const result = await platformAdapter(e.platform).fetchStats(e.creds);

			if (result.ok) {
				e.backoff = 0;

				// Record history
				for (const snap of result.snapshots) {
					recordHistory(e.credKey, e.state.history, snap.platform, snap.metric, snap.value);
				}

				// Detect live status change
				const wasLive = e.state.isLive;
				const isLive = result.snapshots.some((s) => s.liveStatus === "live");

				this.set(e, {
					status: "ok",
					snapshots: result.snapshots,
					fetchedAt: Date.now(),
					stale: false,
					history: e.state.history,
					isLive,
				});

				// If live status changed, reschedule with new interval
				if (isLive !== wasLive) this.schedule(e);
				return;
			}

			// Error handling
			const reason = result.reason;
			e.backoff = reason === "rate-limited" ? Math.min(e.backoff + 1, MAX_BACKOFF) : 0;
			const status: PollStatus =
				reason === "auth" ? "auth" :
				reason === "rate-limited" ? "rate-limited" :
				reason === "quota" ? "quota" :
				"offline";

			this.set(e, { ...e.state, status, stale: e.state.snapshots.length > 0 });
		} finally {
			e.inflight = false;
			this.schedule(e);
		}
	}

	private set(e: Entry, state: PollState): void {
		e.state = state;
		for (const l of e.listeners) l(state);
	}
}

export const poller = new Poller();
