import streamDeck, { action } from "@elgato/streamdeck";

import { EventCardBase, NextEventBase } from "../../_shared/src/actions/event";
import { RankingsBase } from "../../_shared/src/actions/rankings";
import { configureSport } from "../../_shared/src/sport";
import { startTracking } from "../../_shared/src/tracker";

streamDeck.logger.setLevel("info");

// Racing is an event sport: one race holds a field of forty drivers in finishing order, and the
// season table ranks drivers on championship points rather than wins and losses. Drivers are
// named, never pictured, and no team liveries or manufacturer marks appear anywhere.
configureSport({ league: { sport: "racing", league: "nascar-premier" }, teams: [], model: "race" });

const ACCENT = "#e4a11b";

@action({ UUID: "com.packrat.nascar-tracker.event" })
class NextRace extends NextEventBase {
	protected override kicker(): string {
		return "NEXT";
	}

	protected override accent(): string {
		return ACCENT;
	}
}

@action({ UUID: "com.packrat.nascar-tracker.card" })
class RaceField extends EventCardBase {
	protected override kicker(): string {
		return "FIELD";
	}

	protected override accent(): string {
		return ACCENT;
	}

	protected override emptyDetail(): string {
		return "before green flag";
	}
}

@action({ UUID: "com.packrat.nascar-tracker.standings" })
class DriverStandings extends RankingsBase {
	protected override kicker(): string {
		return "CUP";
	}

	protected override accent(): string {
		return ACCENT;
	}
}

const nextRace = new NextRace();
const field = new RaceField();
const standings = new DriverStandings();

streamDeck.actions.registerAction(nextRace);
streamDeck.actions.registerAction(field);
streamDeck.actions.registerAction(standings);

// Polling has to wait for the connection: the first thing a poll does is write the cache to
// global settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => startTracking([nextRace, field, standings]));
