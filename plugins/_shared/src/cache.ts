/**
 * Last known good store for tracker data, kept in Stream Deck's global settings the way
 * plugins/screensaver-cycler/src/scheduler.ts keeps its config. Two things fall out of that for
 * free: every action instance reads the same copy, and the data survives a plugin restart, which
 * is what makes the offline fallback work on a cold start with no network.
 *
 * Everything is keyed by league path ("basketball/nba", "soccer/eng.1"). Most trackers only ever
 * have one key in there; soccer has one per competition the user is actually following.
 */
import streamDeck from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import type { EspnLeague, Game, StandingsRow } from "./espn";
import type { RankRow, SportEvent } from "./event";

export type GameSnapshot = { games: Game[]; fetchedAt: number };
export type StandingsSnapshot = { rows: StandingsRow[]; fetchedAt: number };
export type EventSnapshot = { events: SportEvent[]; fetchedAt: number };
export type RankSnapshot = { rows: RankRow[]; fetchedAt: number };

export type TrackerCache = {
	/** Today's games per league, refreshed on every poll. */
	boards?: Record<string, GameSnapshot>;
	/** A wider date range per league, refreshed rarely, to answer "who do they play next". */
	upcoming?: Record<string, GameSnapshot>;
	standings?: Record<string, StandingsSnapshot>;
	/** Fight cards and race fields, for the sports whose unit is an event, not a game. */
	events?: Record<string, EventSnapshot>;
	/** Championship tables: drivers, riders. */
	rankings?: Record<string, RankSnapshot>;
};

export function leagueKey(league: EspnLeague): string {
	return `${league.sport}/${league.league}`;
}

export async function readCache(): Promise<TrackerCache> {
	return ((await streamDeck.settings.getGlobalSettings()) as TrackerCache) ?? {};
}

/** Merges one league's slice in place, so writing a board never drops another league's. */
export async function patchCache(
	section: keyof TrackerCache,
	key: string,
	value: GameSnapshot | StandingsSnapshot | EventSnapshot | RankSnapshot
): Promise<void> {
	const current = await readCache();
	const next = { ...current, [section]: { ...(current[section] ?? {}), [key]: value } };
	await streamDeck.settings.setGlobalSettings(next as unknown as JsonObject);
}

export function board(cache: TrackerCache, league: EspnLeague): GameSnapshot | undefined {
	return cache.boards?.[leagueKey(league)];
}

export function upcoming(cache: TrackerCache, league: EspnLeague): GameSnapshot | undefined {
	return cache.upcoming?.[leagueKey(league)];
}

export function standings(cache: TrackerCache, league: EspnLeague): StandingsSnapshot | undefined {
	return cache.standings?.[leagueKey(league)];
}

export function events(cache: TrackerCache, league: EspnLeague): EventSnapshot | undefined {
	return cache.events?.[leagueKey(league)];
}

export function rankings(cache: TrackerCache, league: EspnLeague): RankSnapshot | undefined {
	return cache.rankings?.[leagueKey(league)];
}
