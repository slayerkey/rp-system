import streamDeck, { action } from "@elgato/streamdeck";

import { ScoreboardBase } from "../../_shared/src/actions/scoreboard";
import { StandingsBase } from "../../_shared/src/actions/standings";
import { TeamScoreBase } from "../../_shared/src/actions/team-score";
import { configureSport } from "../../_shared/src/sport";
import { startTracking } from "../../_shared/src/tracker";
import { COMPETITIONS, TEAMS } from "./teams";

streamDeck.logger.setLevel("info");

// Everything sport specific about this plugin lives in this one call. The actions, the polling,
// the key faces and the settings protocol are all shared with the other trackers.
// Soccer is the multi-competition case: each club carries its own league id, so a deck can
// follow the Premier League and LaLiga at once. eng.1 is only the fallback for a scoreboard key
// that has not picked a competition yet. flatTable tells the standings key to show points.
configureSport({ league: { sport: "soccer", league: "eng.1" }, teams: TEAMS, flatTable: true });

@action({ UUID: "com.packrat.soccer-tracker.score" })
class TeamScore extends TeamScoreBase {}

@action({ UUID: "com.packrat.soccer-tracker.standings" })
class Standings extends StandingsBase {}

@action({ UUID: "com.packrat.soccer-tracker.scoreboard" })
class Scoreboard extends ScoreboardBase {
	override competitions(): { id: string; name: string }[] {
		return COMPETITIONS;
	}
}

const score = new TeamScore();
const standings = new Standings();
const scoreboard = new Scoreboard();

streamDeck.actions.registerAction(score);
streamDeck.actions.registerAction(standings);
streamDeck.actions.registerAction(scoreboard);

// Polling has to wait for the connection: the first thing a poll does is write the cache to
// global settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => startTracking([score, standings, scoreboard]));
