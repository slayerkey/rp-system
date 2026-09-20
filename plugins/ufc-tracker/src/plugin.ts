import streamDeck, { action } from "@elgato/streamdeck";

import { EventCardBase, NextEventBase } from "../../_shared/src/actions/event";
import { configureSport } from "../../_shared/src/sport";
import { startTracking } from "../../_shared/src/tracker";

streamDeck.logger.setLevel("info");

// MMA is an event sport: one card holds a dozen bouts between two fighters, with no score and
// no table. So this plugin registers the event actions rather than the team ones, and carries no
// team list at all. Fighters are named, never pictured: no photos, no Octagon iconography.
configureSport({ league: { sport: "mma", league: "ufc" }, teams: [], model: "fights" });

const ACCENT = "#b7202e";

@action({ UUID: "com.packrat.ufc-tracker.event" })
class NextEvent extends NextEventBase {
	protected override kicker(): string {
		return "UFC";
	}

	protected override accent(): string {
		return ACCENT;
	}
}

@action({ UUID: "com.packrat.ufc-tracker.card" })
class FightCard extends EventCardBase {
	protected override kicker(): string {
		return "CARD";
	}

	protected override accent(): string {
		return ACCENT;
	}

	protected override emptyDetail(): string {
		return "not posted yet";
	}
}

const nextEvent = new NextEvent();
const card = new FightCard();

streamDeck.actions.registerAction(nextEvent);
streamDeck.actions.registerAction(card);

// Polling has to wait for the connection: the first thing a poll does is write the cache to
// global settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => startTracking([nextEvent, card]));
