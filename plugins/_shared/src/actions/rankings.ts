import {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { entryBadge, keyImage, messageBadge } from "../badge";
import { rankings as cachedRankings, readCache } from "../cache";
import { isStale } from "../poller";
import { isMultiSport, sport, sportById } from "../sport";
import { currentTier, pokeTracker, type TrackerSurface } from "../tracker";

export type RankingsSettings = {
	index?: number;
	/** Which sport's table, in the combined plugin. Absent means the plugin's only sport. */
	sportId?: string;
};

/**
 * The championship table, one place at a time. Press to walk down the order.
 *
 * Deliberately not a picker: a driver's championship position only means anything next to the
 * drivers around them, and walking the table is one press per position with nothing to configure.
 */
export abstract class RankingsBase extends SingletonAction<RankingsSettings> implements TrackerSurface {
	private placed = 0;

	override async onWillAppear(ev: WillAppearEvent<RankingsSettings>): Promise<void> {
		this.placed += 1;
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onWillDisappear(): void {
		this.placed = Math.max(0, this.placed - 1);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<RankingsSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<RankingsSettings>): Promise<void> {
		const next: RankingsSettings = { ...ev.payload.settings, index: (ev.payload.settings.index ?? 0) + 1 };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	trackedTeamIds(): string[] {
		return [];
	}

	wantsStandings(): boolean {
		return this.placed > 0;
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, await instance.getSettings<RankingsSettings>());
		}
	}

	/**
	 * Label and accent take the key's settings so a plugin serving several sports can answer per
	 * key. A single-sport tracker implements them with no parameters at all, which still satisfies
	 * this, so none of the shipped trackers change.
	 */
	protected abstract kicker(settings: RankingsSettings): string;
	protected abstract accent(settings: RankingsSettings): string;
	/** What the points column is called on this key: "PTS". */
	protected pointsLabel(): string {
		return "PTS";
	}

	protected async paint(key: KeyAction<RankingsSettings>, settings: RankingsSettings): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));
		const chosen = sportById(settings.sportId);
		const league = chosen ? chosen.league : isMultiSport() ? null : sport().league;
		if (!league) {
			await show(messageBadge({ title: "PICK SPORT", detail: "in settings" }));
			return;
		}

		const cache = await readCache();
		const snapshot = cachedRankings(cache, league);
		const stale = isStale(snapshot?.fetchedAt ?? 0, Date.now(), currentTier());
		const rows = snapshot?.rows ?? [];

		if (rows.length === 0) {
			// Never fetched is "loading"; fetched and empty is the offseason, and saying "loading"
			// forever in that case is what made this key look broken.
			await show(
				snapshot === undefined
					? messageBadge({ title: "STANDINGS", detail: "loading" })
					: messageBadge({ title: "STANDINGS", detail: "none published", stale })
			);
			return;
		}

		const at = (((settings.index ?? 0) % rows.length) + rows.length) % rows.length;
		const row = rows[at];
		await show(
			entryBadge({
				accent: this.accent(settings),
				kicker: `${this.kicker(settings)} #${row.rank || at + 1}`,
				primary: row.shortName,
				secondary: `${row.points} ${this.pointsLabel()}`,
				settled: (row.rank || at + 1) === 1,
				index: [at + 1, rows.length],
				stale
			})
		);
	}
}
