/**
 * The one background ticker every tracker runs.
 *
 * It lives in the plugin process, not in an action instance, for the same reason
 * plugins/screensaver-cycler/src/scheduler.ts does: a timer owned by a key pauses the moment
 * the user switches Stream Deck pages, which would silently freeze scores on a device whose
 * whole UI is pages. Nothing in this file imports the Stream Deck SDK, so the cadence rules
 * below can be tested as plain functions.
 */
import type { Game } from "./espn";

export type PollTier = "live" | "soon" | "idle";

/** How long to wait between polls in each tier. */
export const TIER_MS: Record<PollTier, number> = {
	live: 45_000,
	soon: 10 * 60_000,
	idle: 60 * 60_000
};

/** The ticker wakes on this cadence and decides whether the current tier is due yet. */
export const BASE_TICK_MS = 15_000;
/** A tip-off this close counts as live, so the key flips over within a poll of the real start. */
export const LIVE_LEAD_MS = 15 * 60_000;
/** A game further out than this does not justify the ten minute cadence. */
export const SOON_WINDOW_MS = 6 * 60 * 60_000;

/**
 * Cadence for the tracked teams' games only. An empty list means nothing is being tracked
 * (or the season is over), which is the idle case: one poll an hour is plenty.
 */
export function tierFor(games: Game[], nowMs: number): PollTier {
	let soon = false;
	for (const g of games) {
		if (g.state === "in") return "live";
		if (g.state !== "pre") continue;
		const startMs = Date.parse(g.startIso);
		if (!Number.isFinite(startMs)) continue;
		const until = startMs - nowMs;
		if (until <= LIVE_LEAD_MS) return "live";
		if (until <= SOON_WINDOW_MS) soon = true;
	}
	return soon ? "soon" : "idle";
}

/**
 * Cached data counts as stale once it has outlived three polls of the current tier, which is
 * roughly "the source has been unreachable long enough that the user should know."
 */
export function isStale(fetchedAt: number, nowMs: number, tier: PollTier): boolean {
	if (!fetchedAt) return true;
	return nowMs - fetchedAt > TIER_MS[tier] * 3;
}

/**
 * Whether one league's own clock says it is due for a poll.
 *
 * Each league carries its own last-poll timestamp and its own tier, which is what stops a deck
 * spanning many sports from polling every league at the cadence of its most urgent one. A league
 * that has never been polled is always due, so a cold start fills in immediately.
 */
export function isDue(lastPollMs: number, games: Game[], nowMs: number): boolean {
	if (lastPollMs === 0) return true;
	return nowMs - lastPollMs >= TIER_MS[tierFor(games, nowMs)];
}

export type PollerOptions = {
	/**
	 * Does the actual fetch and repaint. Never called twice concurrently.
	 *
	 * `force` is true when a key has just appeared or changed and the user is waiting on an
	 * answer. The runner is expected to ignore its own per-league pacing in that case: a key
	 * asking for data nobody has fetched yet must not wait out another league's interval.
	 */
	run: (force: boolean) => Promise<void>;
	/** Read fresh each tick so the cadence follows the data. */
	tier: () => PollTier;
	onError: (error: unknown) => void;
};

let handle: NodeJS.Timeout | null = null;
let lastRunMs = 0;
let running = false;
let options: PollerOptions | null = null;

async function maybeRun(force: boolean): Promise<void> {
	if (!options || running) return;
	const now = Date.now();
	if (!force && now - lastRunMs < TIER_MS[options.tier()]) return;
	running = true;
	lastRunMs = now;
	try {
		await options.run(force);
	} catch (error) {
		// A failed poll must never take the ticker down with it.
		options.onError(error);
	} finally {
		running = false;
	}
}

/**
 * Starts the ticker. Idempotent.
 *
 * It deliberately does not poll immediately. A poll writes to global settings, and a settings
 * request sent in the gap between the websocket opening and Stream Deck completing the plugin
 * registration handshake is simply dropped: the promise never resolves and the poll wedges
 * forever. The first poll comes from the first tick, or sooner from refreshNow() once a key
 * appears, and by then registration has always finished.
 */
export function startPoller(opts: PollerOptions): void {
	options = opts;
	if (handle) return;
	handle = setInterval(() => void maybeRun(false), BASE_TICK_MS);
}

/** Forces a poll now, for when the user changes a setting and expects the key to catch up. */
export function refreshNow(): void {
	void maybeRun(true);
}
