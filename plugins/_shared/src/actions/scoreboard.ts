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

import { displayColor, keyImage, messageBadge, scoreBadge } from "../badge";
import { board, readCache } from "../cache";
import type { EspnLeague, Game } from "../espn";
import { isStale } from "../poller";
import { forgetPress, markDown, wasHeld } from "../press";
import { isMultiSport, leagueFor, type SportConfig, sport, sportById } from "../sport";
import { currentTier, justChanged, pokeTracker, type TrackerSurface } from "../tracker";
import { ageLabel, sortForBoard, startLines } from "../view";

/** The day is only worth drawing when it is not today; otherwise the time speaks for itself. */
function kickoff(startIso: string, now: Date): { day?: string; time: string } {
	const lines = startLines(startIso, now);
	return lines.day === "TODAY" ? { time: lines.time } : lines;
}

export type BoardSettings = {
	/** Which game of the day the key is parked on. Advances on press. */
	index?: number;
	onPress?: "cycle" | "open";
	/** Competition to show, for sports whose teams span leagues. Defaults to the plugin's own. */
	leagueId?: string;
	/** Which sport's board, in the combined plugin. Absent means the plugin's only sport. */
	sportId?: string;
};

/**
 * The whole league on one key. Every game playing today, one at a time, live games first.
 * Press to move to the next one, or set the key to open that game's page instead.
 *
 * This is the key for someone who follows the sport rather than a single team, and it costs
 * nothing extra: it paints from the same scoreboard poll the team keys already run.
 */
export abstract class ScoreboardBase extends SingletonAction<BoardSettings> implements TrackerSurface {
	private readonly placed = new Map<string, BoardSettings>();
	private readonly links = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<BoardSettings>): Promise<void> {
		this.placed.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onWillDisappear(ev: WillDisappearEvent<BoardSettings>): void {
		this.placed.delete(ev.action.id);
		this.links.delete(ev.action.id);
		forgetPress(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BoardSettings>): Promise<void> {
		this.placed.set(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onKeyDown(ev: KeyDownEvent<BoardSettings>): void {
		markDown(ev.action.id);
	}

	/** Tap moves to the next game, because walking the day is this key's job; hold opens it. */
	override async onKeyUp(ev: KeyUpEvent<BoardSettings>): Promise<void> {
		const tapOpens = ev.payload.settings.onPress === "open";
		if (wasHeld(ev.action.id) ? !tapOpens : tapOpens) {
			const link = this.links.get(ev.action.id);
			if (link) await streamDeck.system.openUrl(link);
			else await ev.action.showAlert();
			return;
		}
		const next: BoardSettings = { ...ev.payload.settings, index: (ev.payload.settings.index ?? 0) + 1 };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	trackedTeamIds(): string[] {
		return [];
	}

	wantsStandings(): boolean {
		return false;
	}

	/**
	 * Competitions this key can show. Empty for the single league sports, which is why their
	 * property inspector has no competition row at all.
	 */
	competitions(): { id: string; name: string }[] {
		return [];
	}

	override onSendToPlugin(ev: SendToPluginEvent<JsonValue, BoardSettings>): Promise<void> {
		if ((ev.payload as { probe?: string })?.probe !== "competitions") return Promise.resolve();
		return streamDeck.ui.sendToPropertyInspector({ probe: "competitions", competitions: this.competitions() });
	}

	wantsBoardFor(): EspnLeague[] {
		return [...this.placed.values()].filter((s) => this.configured(s)).map((s) => this.leagueOf(s));
	}

	/** The league one key is pointed at: its sport's, narrowed to a competition when it has one. */
	private leagueOf(settings: BoardSettings): EspnLeague {
		return leagueFor({ leagueId: settings.leagueId }, this.sportOf(settings));
	}

	private sportOf(settings: BoardSettings): SportConfig {
		return sportById(settings.sportId) ?? sport();
	}

	/** False when this plugin serves several sports and this key has not been told which. */
	private configured(settings: BoardSettings): boolean {
		return !isMultiSport() || sportById(settings.sportId) !== undefined;
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (!instance.isKey()) continue;
			await this.paint(instance, await instance.getSettings<BoardSettings>());
		}
	}

	protected async paint(key: KeyAction<BoardSettings>, settings: BoardSettings): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));

		if (!this.configured(settings)) {
			this.links.delete(key.id);
			await show(messageBadge({ title: "PICK SPORT", detail: "in settings" }));
			return;
		}

		const cache = await readCache();
		const now = Date.now();
		const snapshot = board(cache, this.leagueOf(settings));
		const fetchedAt = snapshot?.fetchedAt ?? 0;
		const stale = isStale(fetchedAt, now, currentTier());
		const games = sortForBoard(snapshot?.games ?? []);

		if (games.length === 0) {
			this.links.delete(key.id);
			// Nothing cached at all is a different state from a league with no fixtures today, and
			// showing "no games" for the second before the first poll lands reads as a bug.
			const loading = snapshot === undefined;
			await show(
				loading
					? messageBadge({ title: "SCORES", detail: "loading" })
					: messageBadge({ title: "NO GAMES", detail: "today", stale })
			);
			return;
		}

		// The index only ever grows, so wrap it here rather than writing settings on every poll.
		const at = ((settings.index ?? 0) % games.length + games.length) % games.length;
		const game = games[at];
		this.links.set(key.id, game.link);
		await show(this.faceFor(game, at, games.length, now, stale, ageLabel(fetchedAt, now), settings));
	}

	private faceFor(
		game: Game,
		at: number,
		count: number,
		now: number,
		stale: boolean,
		staleAge: string,
		settings: BoardSettings
	): string {
		const away = this.sportOf(settings).teams.find((t) => t.id === game.away.teamId);
		const upcoming = game.state === "pre";
		// ESPN's default scoreboard returns the next slate when nothing is on today, so a fixture
		// here can be weeks out. It gets a day as well as a time; a bare clock would read as today.
		const when = upcoming ? kickoff(game.startIso, new Date(now)) : undefined;
		return scoreBadge({
			// The away side takes the colour band, matching how every scoreboard reads: away on top.
			teamColor: displayColor(away?.color ?? "#2a2f3a", away?.altColor),
			teamAbbr: game.away.abbr,
			teamScore: upcoming ? "" : game.away.score,
			oppAbbr: game.home.abbr,
			oppScore: upcoming ? "" : game.home.score,
			status: upcoming ? "" : game.statusShort,
			when,
			live: game.state === "in",
			flash: justChanged(game.id),
			stale,
			staleAge,
			index: [at + 1, count]
		});
	}
}
