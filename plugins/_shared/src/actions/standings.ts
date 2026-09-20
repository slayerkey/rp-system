import {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { displayColor, keyImage, messageBadge, standingsBadge } from "../badge";
import { readCache, standings as standingsFor } from "../cache";
import { handleTeamsProbe } from "../pi-protocol";
import { isStale } from "../poller";
import { leagueForRef, pickerOptions, sportOf, teamById } from "../sport";
import { currentTier, pokeTracker, type TrackerSurface } from "../tracker";
import { placeIn, type StandingsView } from "../view";

export type StandingsSettings = { teamId?: string; view?: StandingsView };

/**
 * Where a team sits, in its conference or its division. Pressing the key swaps the two, which is
 * the whole interaction. The conference view uses the league's own published seed; the division
 * view is worked out from the same rows, because ESPN does not publish a division rank.
 */
export abstract class StandingsBase extends SingletonAction<StandingsSettings> implements TrackerSurface {
	private readonly teams = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<StandingsSettings>): Promise<void> {
		this.remember(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onWillDisappear(ev: WillDisappearEvent<StandingsSettings>): void {
		this.teams.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<StandingsSettings>): Promise<void> {
		this.remember(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override async onKeyDown(ev: KeyDownEvent<StandingsSettings>): Promise<void> {
		const settings = ev.payload.settings;
		const next: StandingsSettings = { ...settings, view: settings.view === "division" ? "conference" : "division" };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, StandingsSettings>): Promise<void> {
		return handleTeamsProbe(ev.payload, pickerOptions());
	}

	trackedTeamIds(): string[] {
		return [...this.teams.values()];
	}

	wantsStandings(): boolean {
		return this.teams.size > 0;
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (!instance.isKey()) continue;
			await this.paint(instance, await instance.getSettings<StandingsSettings>());
		}
	}

	private remember(id: string, settings: StandingsSettings): void {
		if (settings.teamId) this.teams.set(id, settings.teamId);
		else this.teams.delete(id);
	}

	protected async paint(key: KeyAction<StandingsSettings>, settings: StandingsSettings): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));

		const team = teamById(settings.teamId);
		if (!team) {
			await show(messageBadge({ title: "PICK TEAM", detail: "in settings" }));
			return;
		}

		// Both the league and the table style come from the team's own sport, not a process
		// default: soccer ranks on points while every other sport ranks on a playoff seed.
		const league = leagueForRef(settings.teamId as string);
		if (!league) {
			await show(messageBadge({ title: "PICK TEAM", detail: "in settings" }));
			return;
		}
		const flatTable = sportOf(settings.teamId)?.flatTable === true;

		const cache = await readCache();
		const snapshot = standingsFor(cache, league);
		const stale = isStale(snapshot?.fetchedAt ?? 0, Date.now(), currentTier());
		const rows = snapshot?.rows ?? [];
		const row = rows.find((r) => r.teamId === team.id);
		if (!row) {
			await show(
				snapshot === undefined
					? messageBadge({ title: "STANDINGS", detail: "loading" })
					: messageBadge({ title: team.abbr, detail: "not in the table", stale })
			);
			return;
		}

		const view: StandingsView = settings.view === "division" ? "division" : "conference";
		const place = placeIn(rows, row, view);
		await show(
			standingsBadge({
				teamColor: displayColor(team.color, team.altColor),
				teamAbbr: row.abbr,
				groupLabel: place.label,
				seed: place.rank,
				wins: row.wins,
				losses: row.losses,
				gamesBehind: place.gamesBehind,
				note: flatTable ? `${row.points} PTS` : undefined,
				streak: row.streak,
				stale
			})
		);
	}
}
