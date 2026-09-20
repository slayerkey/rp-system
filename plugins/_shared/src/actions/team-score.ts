import {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { displayColor, keyImage, messageBadge, nextGameBadge, scoreBadge } from "../badge";
import { board, readCache, upcoming } from "../cache";
import { gameForTeam, sidesFor } from "../espn";
import { handleTeamsProbe } from "../pi-protocol";
import { isStale } from "../poller";
import { forgetPress, markDown, wasHeld } from "../press";
import { leagueForRef, pickerOptions, teamById } from "../sport";
import { currentTier, justChanged, pokeTracker, type TrackerSurface } from "../tracker";
import { ageLabel, countdown, nextGameFor, startLines } from "../view";

export type ScoreSettings = {
	teamId?: string;
	/**
	 * What a tap does. Opening the game is the default: the key refreshes itself anyway, so a
	 * manual refresh is the rarer of the two. A hold always does the other one.
	 */
	onPress?: "refresh" | "open";
};

/**
 * One key, one team. Live score while the game is on, the next matchup and a countdown when it
 * is not, and the last thing it knew plus a stale marker when the feed cannot be reached.
 *
 * Sport agnostic: everything specific comes from the sport config, so each tracker subclasses
 * this with nothing but its own action UUID.
 */
export abstract class TeamScoreBase extends SingletonAction<ScoreSettings> implements TrackerSurface {
	/** Action instance id to team id. Kept here because settings are only readable async. */
	private readonly teams = new Map<string, string>();
	/** Game page per key, so a press can open it without another lookup. */
	private readonly links = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<ScoreSettings>): Promise<void> {
		this.remember(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onWillDisappear(ev: WillDisappearEvent<ScoreSettings>): void {
		this.teams.delete(ev.action.id);
		this.links.delete(ev.action.id);
		forgetPress(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ScoreSettings>): Promise<void> {
		this.remember(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onKeyDown(ev: KeyDownEvent<ScoreSettings>): void {
		markDown(ev.action.id);
	}

	/**
	 * One rule across every key in the product: a hold does the opposite of a tap.
	 *
	 * The default differs by what the key is for. A key showing one thing has nothing to walk
	 * through, so its tap opens the game and a hold forces a refresh. A key that cycles a list
	 * keeps tap for the list, because navigation is its job, and opens on hold instead.
	 */
	override async onKeyUp(ev: KeyUpEvent<ScoreSettings>): Promise<void> {
		const tapOpens = (ev.payload.settings.onPress ?? "open") === "open";
		if (wasHeld(ev.action.id) ? !tapOpens : tapOpens) {
			await this.openGame(ev.action);
			return;
		}
		pokeTracker();
		await ev.action.showOk();
	}

	/** ESPN publishes no page for some fixtures, so failing silently would read as a dead key. */
	private async openGame(action: { id: string; showAlert(): Promise<void> }): Promise<void> {
		const link = this.links.get(action.id);
		if (link) await streamDeck.system.openUrl(link);
		else await action.showAlert();
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, ScoreSettings>): Promise<void> {
		return handleTeamsProbe(ev.payload, pickerOptions());
	}

	trackedTeamIds(): string[] {
		return [...this.teams.values()];
	}

	wantsStandings(): boolean {
		return false;
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (!instance.isKey()) continue;
			await this.paint(instance, await instance.getSettings<ScoreSettings>());
		}
	}

	private remember(id: string, settings: ScoreSettings): void {
		if (settings.teamId) this.teams.set(id, settings.teamId);
		else this.teams.delete(id);
	}

	protected async paint(key: KeyAction<ScoreSettings>, settings: ScoreSettings): Promise<void> {
		// Every badge goes out as a base64 data URI; raw SVG markup does not render on the key.
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));

		const team = teamById(settings.teamId);
		if (!team) {
			this.links.delete(key.id);
			await show(messageBadge({ title: "PICK TEAM", detail: "in settings" }));
			return;
		}

		const cache = await readCache();
		const now = Date.now();
		// Resolved from the reference rather than a process-wide default: in the combined plugin
		// the team's own sport decides its league, and two sports can share an ESPN team id.
		const league = leagueForRef(settings.teamId as string);
		if (!league) {
			this.links.delete(key.id);
			await show(messageBadge({ title: "PICK TEAM", detail: "in settings" }));
			return;
		}
		const today_ = board(cache, league);
		const fetchedAt = today_?.fetchedAt ?? 0;
		const stale = isStale(fetchedAt, now, currentTier());
		const staleAge = ageLabel(fetchedAt, now);
		const teamColor = displayColor(team.color, team.altColor);

		const today = gameForTeam(today_?.games ?? [], team.id);
		const started = today && today.state !== "pre" ? sidesFor(today, team.id) : null;
		if (today && started) {
			this.links.set(key.id, today.link);
			await show(
				scoreBadge({
					teamColor,
					teamAbbr: started.own.abbr,
					teamScore: started.own.score,
					oppAbbr: started.opp.abbr,
					oppScore: started.opp.score,
					status: today.statusShort,
					live: today.state === "in",
					flash: justChanged(today.id),
					stale,
					staleAge
				})
			);
			return;
		}

		const ahead = upcoming(cache, league);
		const next = today ?? nextGameFor(ahead?.games ?? [], team.id, now);
		const sides = next ? sidesFor(next, team.id) : null;
		if (!next || !sides) {
			this.links.delete(key.id);
			// Before the first fetch there is no schedule to be absent from, so say so honestly
			// rather than claiming the team has nothing on.
			const loading = today_ === undefined && ahead === undefined;
			await show(
				loading
					? messageBadge({ title: team.abbr, detail: "loading" })
					: messageBadge({ title: "NO GAME", detail: "next 30 days", stale })
			);
			return;
		}

		this.links.set(key.id, next.link);
		const soon = countdown(next.startIso, now);
		const when = startLines(next.startIso);
		await show(
			nextGameBadge({
				teamColor,
				teamAbbr: sides.own.abbr,
				oppAbbr: sides.opp.abbr,
				homeAway: sides.own.homeAway,
				when: soon ?? when.day,
				whenDetail: soon ? `${when.day} ${when.time}` : when.time,
				imminent: soon !== null,
				stale
			})
		);
	}
}
