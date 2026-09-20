import type { StatSnapshot, PlatformCreds, PlatformResult } from "../platforms/types";
import { kick } from "../platforms/kick";
import type { ChannelHistory } from "./history";
import { loadHistory, recordHistory } from "./history";

export type PollStatus = "loading" | "ok" | "no-creds" | "auth" | "rate-limited" | "offline";

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
	creds: PlatformCreds;
	state: PollState;
	listeners: Set<Listener>;
	timer?: ReturnType<typeof setTimeout>;
	backoff: number;
	inflight: boolean;
}

function intervalFor(isLive: boolean): number {
	return isLive ? kick.livePollIntervalMs : kick.pollIntervalMs;
}

class Poller {
	private readonly entries = new Map<string, Entry>();

	subscribe(credKey: string, creds: PlatformCreds, listener: Listener): () => void {
		let e = this.entries.get(credKey);
		if (!e) {
			e = {
				credKey,
				creds,
				state: { status: "loading", snapshots: [], stale: false, history: loadHistory(credKey), isLive: false },
				listeners: new Set(),
				backoff: 0,
				inflight: false,
			};
			this.entries.set(credKey, e);
			void this.poll(e);
		} else {
			e.creds = creds;
		}
		e.listeners.add(listener);
		listener(e.state);
		return () => {
			const entry = this.entries.get(credKey);
			if (!entry) return;
			entry.listeners.delete(listener);
			if (entry.listeners.size === 0) {
				if (entry.timer) clearTimeout(entry.timer);
				this.entries.delete(credKey);
			}
		};
	}

	refresh(credKey: string): void {
		const e = this.entries.get(credKey);
		if (e && !e.inflight) void this.poll(e);
	}

	private schedule(e: Entry): void {
		if (e.timer) clearTimeout(e.timer);
		const interval = intervalFor(e.state.isLive) * 2 ** e.backoff + Math.random() * JITTER;
		e.timer = setTimeout(() => void this.poll(e), interval);
	}

	private async poll(e: Entry): Promise<void> {
		if (e.inflight) return;
		e.inflight = true;
		try {
			if (!e.creds.username) {
				this.set(e, { ...e.state, status: "no-creds", stale: false });
				return;
			}

			const result: PlatformResult = await kick.fetchStats(e.creds);

			if (result.ok) {
				e.backoff = 0;
				for (const snap of result.snapshots) {
					recordHistory(e.credKey, e.state.history, snap.metric, snap.value);
				}
				const wasLive = e.state.isLive;
				const isLive = result.snapshots.some((s) => s.liveStatus === "live");
				this.set(e, { status: "ok", snapshots: result.snapshots, fetchedAt: Date.now(), stale: false, history: e.state.history, isLive });
				if (isLive !== wasLive) this.schedule(e);
				return;
			}

			const reason = result.reason;
			e.backoff = reason === "rate-limited" ? Math.min(e.backoff + 1, MAX_BACKOFF) : 0;
			const status: PollStatus = reason === "auth" ? "auth" : reason === "rate-limited" ? "rate-limited" : "offline";
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
