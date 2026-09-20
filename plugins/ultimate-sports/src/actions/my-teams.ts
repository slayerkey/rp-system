/**
 * One key, every team you follow, across every sport.
 *
 * This is the key the combined plugin exists for. A deck of standalone trackers needs one key per
 * team and a spare page to put them on; this is a single key that walks the whole list and puts
 * whatever is actually happening first. Press to move to the next one.
 *
 * Ordering is the whole feature: live games, then games about to start, then the rest of today,
 * then finals. Glancing at this key answers "is anything of mine on right now" without pressing it.
 */
import {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { displayColor, keyImage, messageBadge, nextGameBadge, scoreBadge } from "../../../_shared/src/badge";
import { board, readCache, upcoming } from "../../../_shared/src/cache";
import { type EspnLeague, type Game, gameForTeam, sidesFor } from "../../../_shared/src/espn";
import { isStale } from "../../../_shared/src/poller";
import { markDown, wasHeld } from "../../../_shared/src/press";
import { leagueForRef, pickerOptions, type SportTeam, teamById } from "../../../_shared/src/sport";
import { currentTier, justChanged, pokeTracker, type TrackerSurface } from "../../../_shared/src/tracker";
import { ageLabel, countdown, nextGameFor, startLines } from "../../../_shared/src/view";
import { readFavorites, writeFavorites } from "../favorites";

export type MyTeamsSettings = {
	/** Which favourite the key is parked on. Advances on press, wraps at the end. */
	index?: number;
	onPress?: "cycle" | "open";
};

/** One favourite resolved against the cache: its team, its league, and its game if it has one. */
type Slot = {
	team: SportTeam;
	league: EspnLeague;
	game: Game | null;
	/** Sort bucket. Lower is more urgent, and the whole point of the key. */
	rank: number;
};

@action({ UUID: "com.packrat.ultimatesports.myteams" })
export class MyTeams extends SingletonAction<MyTeamsSettings> implements TrackerSurface {
	private favorites: string[] = [];
	private readonly links = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<MyTeamsSettings>): Promise<void> {
		this.favorites = await readFavorites();
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MyTeamsSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
	}

	override onKeyDown(ev: KeyDownEvent<MyTeamsSettings>): void {
		markDown(ev.action.id);
	}

	/** Tap moves to the next team, because walking the list is this key's job; hold opens it. */
	override async onKeyUp(ev: KeyUpEvent<MyTeamsSettings>): Promise<void> {
		const tapOpens = ev.payload.settings.onPress === "open";
		if (wasHeld(ev.action.id) ? !tapOpens : tapOpens) {
			const link = this.links.get(ev.action.id);
			// ESPN does not publish a page for every fixture, particularly ones still weeks out.
			// Silently doing nothing reads as a broken key, so say so.
			if (link) await streamDeck.system.openUrl(link);
			else await ev.action.showAlert();
			return;
		}
		const next: MyTeamsSettings = { ...ev.payload.settings, index: (ev.payload.settings.index ?? 0) + 1 };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	/**
	 * The property inspector owns the favourites list, so it needs three things: the full team
	 * catalogue to choose from, whatever is already saved, and a way to save a new list.
	 */
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, MyTeamsSettings>): Promise<void> {
		const payload = ev.payload as { probe?: string; favorites?: string[] };
		if (payload?.probe === "teams") {
			await streamDeck.ui.sendToPropertyInspector({ probe: "teams", teams: pickerOptions() });
			return;
		}
		if (payload?.probe === "favorites") {
			await streamDeck.ui.sendToPropertyInspector({ probe: "favorites", favorites: await readFavorites() });
			return;
		}
		if (Array.isArray(payload?.favorites)) {
			await writeFavorites(payload.favorites);
			this.favorites = await readFavorites();
			await this.repaint();
			// The new team's league may not be in the poll set yet, so ask for data now rather
			// than leaving the key on "no game" until the next tick.
			pokeTracker();
		}
	}

	trackedTeamIds(): string[] {
		return this.favorites;
	}

	wantsStandings(): boolean {
		return false;
	}

	async repaint(): Promise<void> {
		this.favorites = await readFavorites();
		for (const instance of this.actions) {
			if (!instance.isKey()) continue;
			await this.paint(instance, await instance.getSettings<MyTeamsSettings>());
		}
	}

	/** Resolves every favourite against the cache and puts the urgent ones first. */
	private slots(cache: Awaited<ReturnType<typeof readCache>>, now: number): Slot[] {
		const out: Slot[] = [];
		for (const ref of this.favorites) {
			const team = teamById(ref);
			const league = leagueForRef(ref);
			if (!team || !league) continue;

			const today = gameForTeam(board(cache, league)?.games ?? [], team.id);
			const game = today ?? nextGameFor(upcoming(cache, league)?.games ?? [], team.id, now) ?? null;
			out.push({ team, league, game, rank: rankOf(game, now) });
		}
		out.sort((a, b) => a.rank - b.rank || startOf(a.game) - startOf(b.game));
		return out;
	}

	private async paint(key: KeyAction<MyTeamsSettings>, settings: MyTeamsSettings): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));

		if (this.favorites.length === 0) {
			this.links.delete(key.id);
			await show(messageBadge({ title: "NO TEAMS", detail: "pick them in settings" }));
			return;
		}

		const cache = await readCache();
		const now = Date.now();
		const slots = this.slots(cache, now);
		if (slots.length === 0) {
			this.links.delete(key.id);
			await show(messageBadge({ title: "MY TEAMS", detail: "loading" }));
			return;
		}

		// The index only ever grows, so wrap here rather than writing settings on every poll.
		const at = (((settings.index ?? 0) % slots.length) + slots.length) % slots.length;
		const slot = slots[at];
		const count: [number, number] = [at + 1, slots.length];

		const fetchedAt = board(cache, slot.league)?.fetchedAt ?? 0;
		const stale = isStale(fetchedAt, now, currentTier());
		const teamColor = displayColor(slot.team.color, slot.team.altColor);

		if (!slot.game) {
			this.links.delete(key.id);
			await show(messageBadge({ title: slot.team.abbr, detail: "nothing scheduled", stale }));
			return;
		}

		this.links.set(key.id, slot.game.link);
		const sides = sidesFor(slot.game, slot.team.id);
		if (!sides) {
			await show(messageBadge({ title: slot.team.abbr, detail: "nothing scheduled", stale }));
			return;
		}

		if (slot.game.state !== "pre") {
			await show(
				scoreBadge({
					teamColor,
					teamAbbr: sides.own.abbr,
					teamScore: sides.own.score,
					oppAbbr: sides.opp.abbr,
					oppScore: sides.opp.score,
					status: slot.game.statusShort,
					live: slot.game.state === "in",
					flash: justChanged(slot.game.id),
					stale,
					staleAge: ageLabel(fetchedAt, now),
					index: count
				})
			);
			return;
		}

		const soon = countdown(slot.game.startIso, now);
		const when = startLines(slot.game.startIso);
		await show(
			nextGameBadge({
				teamColor,
				teamAbbr: sides.own.abbr,
				oppAbbr: sides.opp.abbr,
				homeAway: sides.own.homeAway,
				when: soon ?? when.day,
				whenDetail: soon ? `${when.day} ${when.time}` : when.time,
				imminent: soon !== null,
				stale,
				index: count
			})
		);
	}
}

/** Live first, then whatever starts soonest, then finals, then teams with nothing on. */
function rankOf(game: Game | null, now: number): number {
	if (!game) return 4;
	if (game.state === "in") return 0;
	if (game.state === "post") return 3;
	const startMs = Date.parse(game.startIso);
	if (!Number.isFinite(startMs)) return 2;
	// Inside an hour of the first pitch is worth putting ahead of the rest of the day's fixtures.
	return startMs - now <= 60 * 60_000 ? 1 : 2;
}

function startOf(game: Game | null): number {
	const ms = game ? Date.parse(game.startIso) : NaN;
	return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}
