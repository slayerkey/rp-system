import streamDeck from "@elgato/streamdeck";
import { LiveScoreAction } from "./actions/liveScore.js";
import { TablePositionAction } from "./actions/tablePosition.js";
import { LineupAction } from "./actions/lineupAction.js";
import { TopScorersAction } from "./actions/topScorers.js";
import { MatchStatsAction } from "./actions/matchStats.js";

streamDeck.actions.registerAction(new LiveScoreAction());
streamDeck.actions.registerAction(new TablePositionAction());
streamDeck.actions.registerAction(new LineupAction());
streamDeck.actions.registerAction(new TopScorersAction());
streamDeck.actions.registerAction(new MatchStatsAction());
streamDeck.connect();
