/**
 * Sports Tracker Ultimate: every sport on one deck, from one plugin process.
 *
 * The standalone trackers each call configureSport() once and serve a single league. This one
 * calls registerSports() with all eleven and lets each key say which sport it means, which is what
 * makes a shared favourites list and a dial that spans leagues possible at all.
 *
 * Everything below is registration. The behaviour lives in plugins/_shared: the ESPN client, the
 * per-league poller, the key renderer, and the action base classes. Reuse, never rewrite.
 */
import streamDeck from "@elgato/streamdeck";

import { registerSports } from "../../_shared/src/sport";
import { startTracking } from "../../_shared/src/tracker";

import { ScoreDial } from "./actions/dial";
import { MyTeams } from "./actions/my-teams";
import {
	DriverStandings,
	EventCard,
	NextEvent,
	Scoreboard,
	Standings,
	TeamScore
} from "./actions/sport-actions";
import { SPORTS } from "./sports";

streamDeck.logger.setLevel("info");

registerSports(SPORTS);

const myTeams = new MyTeams();
const dial = new ScoreDial();
const score = new TeamScore();
const standings = new Standings();
const scoreboard = new Scoreboard();
const nextEvent = new NextEvent();
const card = new EventCard();
const rankings = new DriverStandings();

for (const a of [myTeams, dial, score, standings, scoreboard, nextEvent, card, rankings]) {
	streamDeck.actions.registerAction(a);
}

// One poll serves every key. The tracker asks each surface what data it needs, then fetches once
// per league per tier, so a deck spanning six sports costs six requests rather than six per key.
//
// Polling has to wait for the connection: the first thing a poll does is write the cache to global
// settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => {
	startTracking([myTeams, dial, score, standings, scoreboard, nextEvent, card, rankings]);
});
