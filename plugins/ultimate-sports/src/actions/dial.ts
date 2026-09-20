/**
 * The Stream Deck + dial: spin through every game on the board, across every sport at once.
 *
 * Nothing else on the marketplace does this, and it is the one thing a pile of separate trackers
 * structurally cannot: scrolling a single list that spans the NFL, the NHL and the Premier League
 * needs one process holding all three, not three processes each holding one.
 *
 * The touch strip reuses the same SVG badge the keys draw, passed into setFeedback's icon slot,
 * which is the pattern calendar-sync-pro's agenda dial already proved. No second renderer.
 */
import {
	action,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type SendToPluginEvent,
	SingletonAction,
	type TouchTapEvent,
	type WillAppearEvent
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

import { displayColor, keyImage, messageBadge, scoreBadge } from "../../../_shared/src/badge";
import { board, readCache } from "../../../_shared/src/cache";
import type { EspnLeague, Game } from "../../../_shared/src/espn";
import { isStale } from "../../../_shared/src/poller";
import { leagueForRef, type SportConfig, sportById } from "../../../_shared/src/sport";
import { currentTier, justChanged, type TrackerSurface } from "../../../_shared/src/tracker";
import { ageLabel, sortForBoard, startLines } from "../../../_shared/src/view";
import { readFavorites } from "../favorites";
import { TEAM_SPORTS } from "../sports";

/** The day is only worth drawing when it is not today; otherwise the time speaks for itself. */
function kickoff(startIso: string, now: Date): { day?: string; time: string } {
	const lines = startLines(startIso, now);
	return lines.day === "TODAY" ? { time: lines.time } : lines;
}

export type DialSettings = {
	index?: number;
	/** Sports the dial covers. Empty means "wherever my favourites are", which is the default. */
	sports?: string[];
};

/** A game plus the sport it came from, so the touch strip can say which league it is showing. */
type Entry = { game: Game; cfg: SportConfig };

@action({ UUID: "com.packrat.ultimatesports.dial" })
export class ScoreDial extends SingletonAction<DialSettings> implements TrackerSurface {
	private favorites: string[] = [];
	/** Sports each placed dial covers, so wantsBoardFor can answer without reading settings. */
	private readonly placed = new Map<string, string[]>();
	private readonly links = new Map<string, string>();

	override async onWillAppear(ev: WillAppearEvent<DialSettings>): Promise<void> {
		this.favorites = await readFavorites();
		this.placed.set(ev.action.id, ev.payload.settings.sports ?? []);
		if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: { action: { id: string } }): void {
		this.placed.delete(ev.action.id);
		this.links.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DialSettings>): Promise<void> {
		this.placed.set(ev.action.id, ev.payload.settings.sports ?? []);
		if (ev.action.isDial()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onDialRotate(ev: DialRotateEvent<DialSettings>): Promise<void> {
		const next: DialSettings = { ...ev.payload.settings, index: (ev.payload.settings.index ?? 0) + ev.payload.ticks };
		await ev.action.setSettings(next);
		if (ev.action.isDial()) await this.paint(ev.action, next);
	}

	/** Press or tap opens the game currently on the strip. */
	override async onDialDown(ev: DialDownEvent<DialSettings>): Promise<void> {
		await this.open(ev.action.id);
	}

	override async onTouchTap(ev: TouchTapEvent<DialSettings>): Promise<void> {
		await this.open(ev.action.id);
	}

	private async open(id: string): Promise<void> {
		const link = this.links.get(id);
		if (link) await streamDeck.system.openUrl(link);
	}

	/** The dial's settings page offers a tick box per sport, so it needs the list. */
	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, DialSettings>): Promise<void> {
		if ((ev.payload as { probe?: string })?.probe !== "sports") return;
		await streamDeck.ui.sendToPropertyInspector({
			probe: "sports",
			sports: TEAM_SPORTS.map((s) => ({ id: s.id as string, name: s.label ?? (s.id as string) }))
		});
	}

	trackedTeamIds(): string[] {
		return this.favorites;
	}

	wantsStandings(): boolean {
		return false;
	}

	/**
	 * A dial covering a sport nobody follows a team in still needs that sport's board fetched,
	 * so it nominates those leagues itself.
	 */
	wantsBoardFor(): EspnLeague[] {
		const out: EspnLeague[] = [];
		for (const ids of this.placed.values()) {
			for (const id of ids) {
				const cfg = sportById(id);
				if (cfg) out.push(cfg.league);
			}
		}
		return out;
	}

	async repaint(): Promise<void> {
		this.favorites = await readFavorites();
		for (const instance of this.actions) {
			if (!instance.isDial()) continue;
			await this.paint(instance, await instance.getSettings<DialSettings>());
		}
	}

	/** The sports this dial covers: whatever it was told, or wherever the favourites live. */
	private coverage(settings: DialSettings): SportConfig[] {
		const chosen = (settings.sports ?? []).map((id) => sportById(id)).filter((c): c is SportConfig => !!c);
		if (chosen.length > 0) return chosen;

		const keys = new Set<string>();
		for (const ref of this.favorites) {
			const league = leagueForRef(ref);
			if (league) keys.add(`${league.sport}/${league.league}`);
		}
		return TEAM_SPORTS.filter((cfg) => keys.has(`${cfg.league.sport}/${cfg.league.league}`));
	}

	private async paint(dial: DialAction<DialSettings>, settings: DialSettings): Promise<void> {
		const cache = await readCache();
		const now = Date.now();

		const entries: Entry[] = [];
		let oldest = 0;
		for (const cfg of this.coverage(settings)) {
			const snapshot = board(cache, cfg.league);
			if (!snapshot) continue;
			oldest = oldest === 0 ? snapshot.fetchedAt : Math.min(oldest, snapshot.fetchedAt);
			for (const game of sortForBoard(snapshot.games)) entries.push({ game, cfg });
		}

		if (entries.length === 0) {
			this.links.delete(dial.id);
			await dial.setFeedback({
				icon: keyImage(messageBadge({ title: "NO GAMES", detail: "pick teams or sports" })),
				title: "Scores",
				value: "nothing on"
			});
			return;
		}

		// Live games first across every sport, which is the reason to spin the dial at all.
		entries.sort((a, b) => stateRank(a.game) - stateRank(b.game) || start(a.game) - start(b.game));

		const at = (((settings.index ?? 0) % entries.length) + entries.length) % entries.length;
		const { game, cfg } = entries[at];
		this.links.set(dial.id, game.link);

		const stale = isStale(oldest, now, currentTier());
		const upcoming = game.state === "pre";
		const away = cfg.teams.find((t) => t.id === game.away.teamId);

		await dial.setFeedback({
			icon: keyImage(
				scoreBadge({
					// Away side takes the spine, matching how every scoreboard reads: away on top.
					teamColor: displayColor(away?.color ?? "#2a2f3a", away?.altColor),
					teamAbbr: game.away.abbr,
					teamScore: upcoming ? "" : game.away.score,
					oppAbbr: game.home.abbr,
					oppScore: upcoming ? "" : game.home.score,
					// A bare clock time would read as today, and out of season this can be weeks out.
					status: upcoming ? "" : game.statusShort,
					when: upcoming ? kickoff(game.startIso, new Date(now)) : undefined,
					live: game.state === "in",
					flash: justChanged(game.id),
					stale,
					staleAge: ageLabel(oldest, now),
					index: [at + 1, entries.length]
				})
			),
			title: cfg.label ?? cfg.league.league.toUpperCase(),
			value: upcoming ? startLines(game.startIso, new Date(now)).time : game.statusShort
		});
	}
}

function stateRank(game: Game): number {
	return game.state === "in" ? 0 : game.state === "pre" ? 1 : 2;
}

function start(game: Game): number {
	const ms = Date.parse(game.startIso);
	return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}
