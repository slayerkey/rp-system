import streamDeck, { action } from "@elgato/streamdeck";

import { ScoreboardBase } from "../../_shared/src/actions/scoreboard";
import { StandingsBase } from "../../_shared/src/actions/standings";
import { TeamScoreBase } from "../../_shared/src/actions/team-score";
import { configureSport } from "../../_shared/src/sport";
import { startTracking } from "../../_shared/src/tracker";
import { TEAMS } from "./teams";

streamDeck.logger.setLevel("info");

// Everything sport specific about this plugin lives in this one call. The actions, the polling,
// the key faces and the settings protocol are all shared with the other trackers.
configureSport({ league: { sport: "football", league: "nfl" }, teams: TEAMS });

@action({ UUID: "com.packrat.nfl-tracker.score" })
class TeamScore extends TeamScoreBase {}

@action({ UUID: "com.packrat.nfl-tracker.standings" })
class Standings extends StandingsBase {}

@action({ UUID: "com.packrat.nfl-tracker.scoreboard" })
class Scoreboard extends ScoreboardBase {}

const score = new TeamScore();
const standings = new Standings();
const scoreboard = new Scoreboard();

streamDeck.actions.registerAction(score);
streamDeck.actions.registerAction(standings);
streamDeck.actions.registerAction(scoreboard);

// Polling has to wait for the connection: the first thing a poll does is write the cache to
// global settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => startTracking([score, standings, scoreboard]));
