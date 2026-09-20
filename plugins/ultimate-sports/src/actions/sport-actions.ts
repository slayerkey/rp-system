/**
 * The six shared actions, bound to a plugin that serves every sport rather than one.
 *
 * In a standalone tracker these subclasses are one line each, because the sport is a process-wide
 * constant. Here each key carries its own sport, so the only real work is answering the property
 * inspector's questions: which sports exist, and which competitions does the chosen one have.
 *
 * The team-facing actions need no sport setting at all. A saved favourite is a qualified reference
 * ("nfl::12"), so the team already knows which league it belongs to and the shared base resolves
 * it. Only the sports with no team to hang off -- the league board and the three event sports --
 * have to be told.
 */
import { action, type SendToPluginEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { type BoardSettings, ScoreboardBase } from "../../../_shared/src/actions/scoreboard";
import { EventCardBase, type EventSettings, NextEventBase } from "../../../_shared/src/actions/event";
import { RankingsBase, type RankingsSettings } from "../../../_shared/src/actions/rankings";
import { StandingsBase } from "../../../_shared/src/actions/standings";
import { TeamScoreBase } from "../../../_shared/src/actions/team-score";
import { sportById } from "../../../_shared/src/sport";
import { competitionsFor, EVENT_SPORTS, SPORT_ACCENT, SPORTS, TEAM_SPORTS } from "../sports";

/** Falls back to a neutral slate rather than another sport's colour when nothing is chosen yet. */
function accentFor(sportId: string | undefined): string {
	return (sportId && SPORT_ACCENT[sportId]) || "#2a2f3a";
}

/** Shape the property inspector's sport dropdown is built from. */
type SportOption = { id: string; name: string };

function options(list: typeof SPORTS): SportOption[] {
	return list.map((s) => ({ id: s.id as string, name: s.label ?? (s.id as string) }));
}

/**
 * Answers the two questions every sport-aware property inspector asks.
 *
 * Returns true when it handled the message, so a caller can fall through to its own probes.
 */
async function answerSportProbes(payload: unknown, sports: SportOption[]): Promise<boolean> {
	const p = payload as { probe?: string; sportId?: string };
	if (p?.probe === "sports") {
		await streamDeck.ui.sendToPropertyInspector({ probe: "sports", sports });
		return true;
	}
	if (p?.probe === "competitions") {
		await streamDeck.ui.sendToPropertyInspector({
			probe: "competitions",
			competitions: competitionsFor(p.sportId ?? "")
		});
		return true;
	}
	return false;
}

/** One key, one team, any sport. The team reference carries its own league. */
@action({ UUID: "com.packrat.ultimatesports.score" })
export class TeamScore extends TeamScoreBase {}

/** Seed, record and form, for whichever sport the chosen team plays in. */
@action({ UUID: "com.packrat.ultimatesports.standings" })
export class Standings extends StandingsBase {}

/** Every game in one league today. The only team action that needs telling which sport. */
@action({ UUID: "com.packrat.ultimatesports.scoreboard" })
export class Scoreboard extends ScoreboardBase {
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, BoardSettings>): Promise<void> {
		await answerSportProbes(ev.payload, options(TEAM_SPORTS));
	}
}

/** The next card or race, for UFC, NASCAR or Formula 1. */
@action({ UUID: "com.packrat.ultimatesports.event" })
export class NextEvent extends NextEventBase {
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, EventSettings>): Promise<void> {
		await answerSportProbes(ev.payload, options(EVENT_SPORTS));
	}

	protected kicker(settings: EventSettings): string {
		return sportById(settings.sportId)?.label ?? "Next";
	}

	protected accent(settings: EventSettings): string {
		return accentFor(settings.sportId);
	}
}

/** The card or the field, one entry per press. */
@action({ UUID: "com.packrat.ultimatesports.card" })
export class EventCard extends EventCardBase {
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, EventSettings>): Promise<void> {
		await answerSportProbes(ev.payload, options(EVENT_SPORTS));
	}

	protected kicker(settings: EventSettings): string {
		return sportById(settings.sportId)?.label ?? "Card";
	}

	protected accent(settings: EventSettings): string {
		return accentFor(settings.sportId);
	}

	/** A race publishes its field only at the green flag; a fight card fills in days ahead. */
	protected emptyDetail(settings: EventSettings): string {
		return sportById(settings.sportId)?.model === "race" ? "before green flag" : "not posted yet";
	}
}

/** Championship points, for the two racing series. */
@action({ UUID: "com.packrat.ultimatesports.rankings" })
export class DriverStandings extends RankingsBase {
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, RankingsSettings>): Promise<void> {
		await answerSportProbes(ev.payload, options(EVENT_SPORTS.filter((s) => s.model === "race")));
	}

	protected kicker(settings: RankingsSettings): string {
		return sportById(settings.sportId)?.id === "f1" ? "DRV" : "CUP";
	}

	protected accent(settings: RankingsSettings): string {
		return accentFor(settings.sportId);
	}
}
