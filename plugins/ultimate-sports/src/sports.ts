/**
 * Every sport this plugin serves, in the order the picker should read.
 *
 * This is the whole difference between the combined plugin and a standalone tracker. A tracker
 * calls configureSport() once with one of these; this one calls registerSports() with all of them
 * and lets each key say which it means. Nothing else in the shared core is sport aware.
 *
 * Two data models, not one. NBA, NFL, NHL, MLB, WNBA, college and soccer are games between two
 * sides with a score. UFC, NASCAR and Formula 1 are events with a field: a card of bouts or a grid
 * of drivers, no score and no win-loss table.
 *
 * Formula 1 rides the same race model NASCAR proved, on ESPN's own racing/f1 path. That is worth
 * stating plainly because the original plan had it on a different provider whose terms forbid
 * commercial use; ESPN serves it on the identical endpoint shape as everything else here.
 */
import type { SportConfig } from "../../_shared/src/sport";

import { CBB_TEAMS } from "./teams/cbb";
import { CFB_TEAMS } from "./teams/cfb";
import { MLB_TEAMS } from "./teams/mlb";
import { NBA_TEAMS } from "./teams/nba";
import { NFL_TEAMS } from "./teams/nfl";
import { NHL_TEAMS } from "./teams/nhl";
import { COMPETITIONS, TEAMS as SOCCER_TEAMS } from "./teams/soccer";
import { WNBA_TEAMS } from "./teams/wnba";

export const SPORTS: SportConfig[] = [
	{ id: "nfl", label: "NFL", league: { sport: "football", league: "nfl" }, teams: NFL_TEAMS },
	{ id: "nba", label: "NBA", league: { sport: "basketball", league: "nba" }, teams: NBA_TEAMS },
	{ id: "nhl", label: "NHL", league: { sport: "hockey", league: "nhl" }, teams: NHL_TEAMS },
	{ id: "mlb", label: "MLB", league: { sport: "baseball", league: "mlb" }, teams: MLB_TEAMS },
	{
		id: "cfb",
		label: "College Football",
		league: { sport: "football", league: "college-football" },
		teams: CFB_TEAMS
	},
	{
		id: "cbb",
		label: "College Basketball",
		league: { sport: "basketball", league: "mens-college-basketball" },
		teams: CBB_TEAMS
	},
	{ id: "wnba", label: "WNBA", league: { sport: "basketball", league: "wnba" }, teams: WNBA_TEAMS },
	// The only team sport whose clubs span leagues: every row carries its own competition.
	{
		id: "soccer",
		label: "Soccer",
		league: { sport: "soccer", league: "eng.1" },
		teams: SOCCER_TEAMS,
		flatTable: true
	},
	{ id: "ufc", label: "UFC", league: { sport: "mma", league: "ufc" }, teams: [], model: "fights" },
	{
		id: "nascar",
		label: "NASCAR",
		league: { sport: "racing", league: "nascar-premier" },
		teams: [],
		model: "race"
	},
	{ id: "f1", label: "Formula 1", league: { sport: "racing", league: "f1" }, teams: [], model: "race" }
];

/** The event sports, for the keys that only make sense against a card or a grid. */
export const EVENT_SPORTS = SPORTS.filter((s) => s.model === "fights" || s.model === "race");

/** The team sports, for the keys that need a score or a table. */
export const TEAM_SPORTS = SPORTS.filter((s) => s.model === undefined || s.model === "team");

/**
 * Competitions a scoreboard key can be pointed at, per sport.
 *
 * Only soccer has more than one. The rest report their single league so the property inspector
 * can use one uniform shape instead of special casing soccer the way the standalone tracker did.
 */
export function competitionsFor(sportId: string): { id: string; name: string }[] {
	if (sportId === "soccer") return COMPETITIONS;
	const cfg = SPORTS.find((s) => s.id === sportId);
	return cfg ? [{ id: cfg.league.league, name: cfg.label ?? cfg.league.league }] : [];
}

/** Accent colour per sport, for the faces that have no team colour to borrow. */
export const SPORT_ACCENT: Record<string, string> = {
	ufc: "#b7202e",
	nascar: "#e4a11b",
	f1: "#e10600"
};
