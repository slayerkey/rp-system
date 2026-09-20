/**
 * Bundle entry for the Xeneon Edge sports widget.
 *
 * The widget is plain JS with no build step, but the ESPN client, sport registry, poll cadence
 * and view helpers are the most expensive code in the tracker line to maintain. Hand-porting them
 * would fork them and the two copies would drift, so they are compiled instead, by
 * bundle-sports-widget.mjs, and consumed as the SportsData global.
 *
 * All eleven sports, both data models. A game between two sides has a score; a UFC card and a
 * race weekend have a field, parsed by event.ts and drawn as their own kind of cell.
 *
 * targetsFor() is deliberately NOT exported. It adds every registered "fights" or "race" league to
 * the poll set whether or not anything is following it, which is right for the Stream Deck plugin
 * (whose event keys are always placed) and wrong here, where the leagues to poll are exactly the
 * ones the user named. The widget builds its own target list from the settings instead.
 */
import { createEspnClient, fetchScoreboardJson, gameForTeam, sidesFor } from "../src/espn";
import { registerSports, teamById, sportOf, sportById, allSports, qualify, leagueForRef } from "../src/sport";
import { parseFightCard, parseRaceField, currentEvent } from "../src/event";
import { tierFor, isDue, BASE_TICK_MS } from "../src/poller";
import { sortForBoard, countdown, startLines } from "../src/view";
import { displayColor, luminance } from "../src/badge";
import { SPORTS, SPORT_ACCENT } from "../../ultimate-sports/src/sports";

registerSports(SPORTS);

export {
	SPORT_ACCENT,
	createEspnClient,
	fetchScoreboardJson,
	gameForTeam,
	sidesFor,
	teamById,
	sportOf,
	sportById,
	allSports,
	qualify,
	leagueForRef,
	parseFightCard,
	parseRaceField,
	currentEvent,
	tierFor,
	isDue,
	BASE_TICK_MS,
	sortForBoard,
	countdown,
	startLines,
	displayColor,
	luminance
};
