// One shared poller per provider+credential. Provider-agnostic: calls that provider's
// fetchUsage, keeps last-good data, backs off on 429, records persistent history.
import streamDeck from "@elgato/streamdeck";
import { providerById } from "../providers/active";
import type { Usage } from "../providers/types";
import { loadHistory, recordHistory, type History, type Sample } from "./history";
import { DEMO_INTERVAL_MS, demoDaily, demoSamples, demoUsage } from "./demo";
import { getIntervalMs, isDemo, onChange } from "./token";
import { publish } from "./bridge";

export type UsageStatus = "loading" | "ok" | "no-token" | "auth" | "rate-limited" | "blocked" | "offline";

export interface UsageState {
	status: UsageStatus;
	usage?: Usage; // last-good usage
	fetchedAt?: number;
	stale: boolean;
	samples?: Sample[]; // recent history (for sparkline)
	daily?: Record<string, number>; // dayKey → peak primary util (for heatmap)
}

type Listener = (state: UsageState) => void;

interface Entry {
	providerId: string;
	token: string; // "" → auto-load
	state: UsageState;
	listeners: Set<Listener>;
	timer?: ReturnType<typeof setTimeout>;
	backoff: number;
	inflight: boolean;
	history: History;
}

/** Entries are per provider AND per token: several providers auto-load, so "" is not unique. */
function keyFor(providerId: string, token: string): string {
	return `${providerId}:${token || "auto"}`;
}

const JITTER = 20_000;
const MAX_BACKOFF = 4;

class Poller {
	private readonly entries = new Map<string, Entry>();

	subscribe(providerId: string, token: string, listener: Listener): () => void {
		const key = keyFor(providerId, token);
		let e = this.entries.get(key);
		if (!e) {
			e = {
				providerId,
				token,
				state: { status: "loading", stale: false },
				listeners: new Set(),
				backoff: 0,
				inflight: false,
				history: loadHistory(providerId, token),
			};
			this.entries.set(key, e);
			void this.poll(e);
		}
		e.listeners.add(listener);
		listener(e.state);
		return () => {
			const entry = this.entries.get(key);
			if (!entry) return;
			entry.listeners.delete(listener);
			if (entry.listeners.size === 0) {
				if (entry.timer) clearTimeout(entry.timer);
				this.entries.delete(key);
			}
		};
	}

	refresh(providerId: string, token: string): void {
		const e = this.entries.get(keyFor(providerId, token));
		if (e && !e.inflight) void this.poll(e);
	}

	refreshAll(): void {
		for (const e of this.entries.values()) if (!e.inflight) void this.poll(e);
	}

	private schedule(e: Entry): void {
		if (e.timer) clearTimeout(e.timer);
		const interval = isDemo() ? DEMO_INTERVAL_MS : getIntervalMs() * 2 ** e.backoff + Math.random() * JITTER;
		e.timer = setTimeout(() => void this.poll(e), interval);
	}

	private async poll(e: Entry): Promise<void> {
		if (e.inflight) return;
		e.inflight = true;
		try {
			if (isDemo()) {
				// Sample data: no network, no token required, and the on-disk history
				// is deliberately left untouched so a demo can't corrupt real trends.
				this.set(e, {
					status: "ok",
					usage: demoUsage(),
					fetchedAt: Date.now(),
					stale: false,
					samples: demoSamples(),
					daily: demoDaily(),
				});
				return;
			}
			const provider = providerById(e.providerId);
			const token = e.token || provider.autoLoadToken?.() || "";
			if (!token) {
				this.set(e, { status: "no-token", stale: false });
				return;
			}
			const r = await provider.fetchUsage(token);
			if (r.ok) {
				e.backoff = 0;
				const sample: Sample = {};
				for (const w of r.usage.windows) sample[w.key] = w.count ?? w.utilization;
				recordHistory(e.providerId, e.token, e.history, sample, r.usage.windows[0]?.utilization ?? null);
				this.set(e, {
					status: "ok",
					usage: r.usage,
					fetchedAt: Date.now(),
					stale: false,
					samples: [...e.history.samples],
					daily: { ...e.history.daily },
				});
				return;
			}
			// Field reports say "it just says Expired" — log the HTTP status behind it so
			// the next one is diagnosable. Never log the token.
			streamDeck.logger.warn(`${e.providerId} usage fetch failed: ${r.reason} (HTTP ${r.status})${r.detail ? `: ${r.detail}` : ""}`);
			e.backoff = r.reason === "rate-limited" ? Math.min(e.backoff + 1, MAX_BACKOFF) : 0;
			const status: UsageStatus =
				r.reason === "auth" ? "auth" : r.reason === "rate-limited" ? "rate-limited" : r.reason === "blocked" ? "blocked" : "offline";
			this.set(e, { ...e.state, status, stale: e.state.usage !== undefined });
		} finally {
			e.inflight = false;
			this.schedule(e);
		}
	}

	private set(e: Entry, state: UsageState): void {
		e.state = state;
		for (const l of e.listeners) l(state);
		// Every reading passes through here, so this is the one place the local usage
		// bridge has to hook to stay in step with what the key is showing.
		publish(e.providerId, providerById(e.providerId).displayName, state);
	}
}

export const poller = new Poller();

// Toggling Demo mode should switch every key over at once rather than waiting out
// the current interval.
let lastDemo = isDemo();
onChange(() => {
	const now = isDemo();
	if (now !== lastDemo) {
		lastDemo = now;
		poller.refreshAll();
	}
});
