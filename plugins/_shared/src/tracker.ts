/**
 * The polling loop every sport tracker runs, kept here so a new sport does not restate it.
 *
 * One poll serves every key on the deck: today's board covers live scores, a much less frequent
 * month-long range answers "who is next", and standings refresh only while a standings key is
 * visible. Actions never fetch, they paint from the cache this writes, which holds the request
 * rate to one call per league per tier no matter how many keys are placed.
 *
 * Each league keeps its own clock. That matters as soon as one plugin serves more than one sport:
 * a deck following a live NFL game and nine dormant leagues costs one call every 45 seconds plus
 * nine an hour, not ten every 45 seconds. It also staggers the traffic for free, because leagues
 * fall due at different moments rather than all firing on the same tick.
 */
import streamDeck from "@elgato/streamdeck";

import { leagueKey, patchCache, readCache } from "./cache";
import { createEspnClient, type EspnLeague, fetchScoreboardJson, fetchStandingsJson, type Game } from "./espn";
import { parseFightCard, parseRaceField, parseRankings, type RankRow } from "./event";
import { isDue, type PollTier, refreshNow, startPoller, tierFor } from "./poller";
import { type LeagueTarget, targetsFor, trackedIn } from "./sport";
import { hasCurrentGame } from "./view";

/** Anything that paints keys and can say what data it needs. Every shared action implements it. */
export type TrackerSurface = {
	trackedTeamIds(): string[];
	wantsStandings(): boolean;
	/** True when a key needs a whole league's board rather than one team's game. */
	wantsBoardFor?(): EspnLeague[];
	repaint(): Promise<void>;
};

/**
 * How far ahead "who do they play next" looks.
 *
 * Ten days was not enough. Between the last preseason game and week one an NFL team can have
 * nothing scheduled for the better part of three weeks, and the key went blank rather than
 * answering the question. This is still one request per league: only the date range grew.
 */
const UPCOMING_DAYS = 30;
const UPCOMING_MAX_AGE_MS = 6 * 60 * 60_000;
const STANDINGS_MAX_AGE_MS = 30 * 60_000;
/** Floor on how often the "nothing scheduled" case may re-ask, so a quiet week is not hammered. */
const RETRY_FLOOR_MS = 15 * 60_000;

/** Per-league clock and cadence input, so leagues do not share one global tier. */
export type LeagueState = {
	lastPollMs: number;
	/** Last known games for this league's tracked teams, used only to choose its cadence. */
	games: Game[];
};

let surfaces: TrackerSurface[] = [];
const leagues = new Map<string, LeagueState>();
/** Score and state per game id at the previous poll, for the "they just scored" flash. */
let previous = new Map<string, string>();
let changed = new Set<string>();

/** Most urgent first: the deck's tier is the tier of its most urgent league. */
const TIER_ORDER: PollTier[] = ["live", "soon", "idle"];

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function yyyymmdd(d: Date): string {
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** ESPN accepts a date range on the scoreboard, which is how one call covers a whole week. */
export function upcomingRange(now: Date, days = UPCOMING_DAYS): string {
	const end = new Date(now.getTime() + days * 24 * 60 * 60_000);
	return `${yyyymmdd(now)}-${yyyymmdd(end)}`;
}

function trackedRefs(): string[] {
	return [...new Set(surfaces.flatMap((s) => s.trackedTeamIds()))];
}

/** Leagues with a key on the deck: the tracked teams' competitions plus any board keys. */
function activeTargets(): LeagueTarget[] {
	const boards = surfaces.flatMap((s) => s.wantsBoardFor?.() ?? []);
	return targetsFor(trackedRefs(), boards);
}

export function currentTier(): PollTier {
	const now = Date.now();
	let best = TIER_ORDER.length - 1;
	for (const state of leagues.values()) {
		const at = TIER_ORDER.indexOf(tierFor(state.games, now));
		if (at >= 0 && at < best) best = at;
	}
	return TIER_ORDER[best];
}

/** True when this game's score or state moved on the last poll. Cleared by the next one. */
export function justChanged(gameId: string): boolean {
	return changed.has(gameId);
}

/** Diffs this poll against the last one so a score or a kick-off can light the key up. */
function markChanges(games: Game[]): void {
	const next = new Map<string, string>();
	for (const g of games) {
		const signature = `${g.state}:${g.home.score}:${g.away.score}`;
		const before = previous.get(g.id);
		if (before !== undefined && before !== signature) changed.add(g.id);
		next.set(g.id, signature);
	}
	for (const [id, sig] of previous) if (!next.has(id)) next.set(id, sig);
	previous = next;
}

/**
 * The event sports poll differently: one scoreboard call gives the whole card or field, and the
 * championship table replaces standings. There is no per-team next-game window to maintain.
 */
async function pollEventLeague(target: LeagueTarget, key: string, state: LeagueState, now: number): Promise<void> {
	const json = await fetchScoreboardJson(target.league);
	if (json !== null) {
		const parsed = target.cfg.model === "race" ? parseRaceField(json) : parseFightCard(json);
		await patchCache("events", key, { events: parsed, fetchedAt: now });
		// Cadence follows the event itself: a card in progress polls like a live game.
		state.games = parsed.map((e) => ({
			id: e.id,
			state: e.state,
			startIso: e.startIso,
			statusShort: e.statusShort,
			link: e.link,
			home: { teamId: "", abbr: "", score: 0, homeAway: "home" as const },
			away: { teamId: "", abbr: "", score: 0, homeAway: "away" as const }
		}));
	}

	const cache = await readCache();
	if (surfaces.some((s) => s.wantsStandings()) && now - (cache.rankings?.[key]?.fetchedAt ?? 0) > STANDINGS_MAX_AGE_MS) {
		const rows = await fetchRankingsFor(target.league);
		if (rows !== null) await patchCache("rankings", key, { rows, fetchedAt: now });
	}
}

async function pollTeamLeague(target: LeagueTarget, key: string, state: LeagueState, now: number): Promise<void> {
	const client = createEspnClient(target.league);
	const teamIds = trackedIn(trackedRefs(), key);

	const games = await client.scoreboard();
	if (games !== null) {
		markChanges(games);
		await patchCache("boards", key, { games, fetchedAt: now });
		state.games = games.filter((g) => teamIds.includes(g.home.teamId) || teamIds.includes(g.away.teamId));
	}

	const cache = await readCache();

	// The next-game window is expensive and barely changes; refresh it a few times a day, or
	// straight away when a tracked team has nothing on today's board and nothing cached ahead.
	const upcomingSnapshot = cache.upcoming?.[key];
	const upcomingAge = now - (upcomingSnapshot?.fetchedAt ?? 0);
	const missing = teamIds.some((id) => !hasCurrentGame(upcomingSnapshot?.games ?? [], id, now));
	if (teamIds.length > 0 && (upcomingAge > UPCOMING_MAX_AGE_MS || (missing && upcomingAge > RETRY_FLOOR_MS))) {
		const ahead = await client.scoreboard(upcomingRange(new Date(now)));
		if (ahead !== null) await patchCache("upcoming", key, { games: ahead, fetchedAt: now });
	}

	if (surfaces.some((s) => s.wantsStandings()) && now - (cache.standings?.[key]?.fetchedAt ?? 0) > STANDINGS_MAX_AGE_MS) {
		const rows = await client.standings();
		if (rows !== null) await patchCache("standings", key, { rows, fetchedAt: now });
	}
}

/**
 * @param force Set when a key just appeared or its settings changed. Per-league pacing is skipped
 * for that pass, because the key is waiting on data its league may not have fetched yet: a
 * standings key placed a minute after a score key would otherwise sit on "loading" until the
 * league's own interval came round, which could be an hour.
 */
async function poll(force = false): Promise<void> {
	const now = Date.now();
	const targets = activeTargets();
	changed = new Set();
	let polled = 0;

	for (const target of targets) {
		const key = leagueKey(target.league);
		const state = leagues.get(key) ?? { lastPollMs: 0, games: [] };
		leagues.set(key, state);
		if (!force && !isDue(state.lastPollMs, state.games, now)) continue;
		state.lastPollMs = now;
		polled++;

		if (target.cfg.model === "fights" || target.cfg.model === "race") {
			await pollEventLeague(target, key, state, now);
		} else {
			await pollTeamLeague(target, key, state, now);
		}
	}

	// Forget leagues nobody is watching any more, so a removed key stops holding the tier down.
	const active = new Set(targets.map((t) => leagueKey(t.league)));
	for (const key of [...leagues.keys()]) if (!active.has(key)) leagues.delete(key);

	for (const surface of surfaces) await surface.repaint();

	// One line per poll: enough to see the cadence tier change and to tell a network problem from
	// a parsing problem when a user reports a key that stopped updating.
	streamDeck.logger.info(
		`[tracker] tier=${currentTier()} leagues=${targets.length} polled=${polled}${force ? " forced" : ""}` +
			` tracked=${trackedRefs().length}` +
			(changed.size ? ` changed=${changed.size}` : "")
	);
}

async function fetchRankingsFor(league: EspnLeague): Promise<RankRow[] | null> {
	const json = await fetchStandingsJson(league);
	return json === null ? null : parseRankings(json);
}

export function startTracking(list: TrackerSurface[]): void {
	surfaces = list;
	startPoller({
		run: poll,
		tier: currentTier,
		onError: (error) => streamDeck.logger.error("[tracker] poll failed", error)
	});
}

/** Called when a key appears or its settings change and the user expects an immediate answer. */
export function pokeTracker(): void {
	refreshNow();
}

/** Test seam: drops every league's clock and the score-change history. */
export function resetTracker(): void {
	surfaces = [];
	leagues.clear();
	previous = new Map();
	changed = new Set();
}
