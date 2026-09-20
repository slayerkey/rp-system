import {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";

import { entryBadge, eventBadge, keyImage, messageBadge } from "../badge";
import { events as cachedEvents, readCache } from "../cache";
import type { EspnLeague } from "../espn";
import { currentEvent } from "../event";
import { isStale } from "../poller";
import { markDown, wasHeld } from "../press";
import { isMultiSport, sport, sportById } from "../sport";
import { currentTier, pokeTracker, type TrackerSurface } from "../tracker";
import { countdown, startLines } from "../view";

/**
 * The league this key is pointed at, or null when it has not been told yet.
 *
 * A standalone tracker serves one sport, so an absent setting means "the only one there is". A
 * plugin serving eleven cannot guess: falling back to the first registered sport made an unset
 * key quietly read a league that will never hold its data, which showed up as a key stuck on
 * "loading" forever rather than as a key asking to be configured.
 */
function leagueOfSetting(sportId: string | undefined): EspnLeague | null {
	const chosen = sportById(sportId);
	if (chosen) return chosen.league;
	return isMultiSport() ? null : sport().league;
}

export type EventSettings = {
	onPress?: "refresh" | "open";
	index?: number;
	/** Which sport's card, in the combined plugin. Absent means the plugin's only sport. */
	sportId?: string;
};

/**
 * The next thing happening: a fight card, a race weekend. Shows what it is, when it starts, and
 * counts down once it is close. This is the key someone puts on the deck to stop checking.
 */
export abstract class NextEventBase extends SingletonAction<EventSettings> implements TrackerSurface {
	private link = "";

	override async onWillAppear(ev: WillAppearEvent<EventSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<EventSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
	}

	override onKeyDown(ev: KeyDownEvent<EventSettings>): void {
		markDown(ev.action.id);
	}

	/** Tap opens the event page by default; a hold does the opposite and forces a refresh. */
	override async onKeyUp(ev: KeyUpEvent<EventSettings>): Promise<void> {
		const tapOpens = (ev.payload.settings.onPress ?? "open") === "open";
		if (wasHeld(ev.action.id) ? !tapOpens : tapOpens) {
			if (this.link) await streamDeck.system.openUrl(this.link);
			else await ev.action.showAlert();
			return;
		}
		pokeTracker();
		await ev.action.showOk();
	}

	trackedTeamIds(): string[] {
		return [];
	}

	wantsStandings(): boolean {
		return false;
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, await instance.getSettings<EventSettings>());
		}
	}

	/**
	 * Label and accent take the key's settings so a plugin serving several sports can answer per
	 * key. A single-sport tracker implements them with no parameters at all, which still satisfies
	 * this, so none of the shipped trackers change.
	 */
	protected abstract kicker(settings: EventSettings): string;
	protected abstract accent(settings: EventSettings): string;

	protected async paint(key: KeyAction<EventSettings>, settings: EventSettings): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));
		const league = leagueOfSetting(settings.sportId);
		if (!league) {
			await show(messageBadge({ title: "PICK SPORT", detail: "in settings" }));
			return;
		}

		const cache = await readCache();
		const snapshot = cachedEvents(cache, league);
		const now = Date.now();
		const stale = isStale(snapshot?.fetchedAt ?? 0, now, currentTier());
		const event = currentEvent(snapshot?.events ?? [], now);

		if (!event) {
			this.link = "";
			await show(
				snapshot === undefined
					? messageBadge({ title: "EVENTS", detail: "loading" })
					: messageBadge({ title: "NOTHING", detail: "scheduled", stale })
			);
			return;
		}

		this.link = event.link;
		const soon = countdown(event.startIso, now);
		const when = startLines(event.startIso, new Date(now));
		await show(
			eventBadge({
				accent: this.accent(settings),
				kicker: this.kicker(settings),
				title: event.entries[0]?.primary ?? event.shortName,
				subtitle: event.name,
				when: event.state === "in" ? event.statusShort : (soon ?? `${when.day} ${when.time}`),
				imminent: soon !== null,
				live: event.state === "in",
				stale
			})
		);
	}
}

/**
 * The card itself, one entry at a time: every bout on the fight card, or the whole field in
 * finishing order. Press for the next one.
 */
export abstract class EventCardBase extends SingletonAction<EventSettings> implements TrackerSurface {
	override async onWillAppear(ev: WillAppearEvent<EventSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override onWillDisappear(): void {
		// Nothing per instance to forget: the index lives in the key's own settings.
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<EventSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<EventSettings>): Promise<void> {
		const next: EventSettings = { ...ev.payload.settings, index: (ev.payload.settings.index ?? 0) + 1 };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	trackedTeamIds(): string[] {
		return [];
	}

	wantsStandings(): boolean {
		return false;
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, await instance.getSettings<EventSettings>());
		}
	}

	/**
	 * Label and accent take the key's settings so a plugin serving several sports can answer per
	 * key. A single-sport tracker implements them with no parameters at all, which still satisfies
	 * this, so none of the shipped trackers change.
	 */
	protected abstract kicker(settings: EventSettings): string;
	protected abstract accent(settings: EventSettings): string;
	/** What to say when the event exists but has no field yet, which is normal before a race. */
	protected abstract emptyDetail(settings: EventSettings): string;

	protected async paint(key: KeyAction<EventSettings>, settings: EventSettings): Promise<void> {
		const show = (markup: string): Promise<void> => key.setImage(keyImage(markup));
		const league = leagueOfSetting(settings.sportId);
		if (!league) {
			await show(messageBadge({ title: "PICK SPORT", detail: "in settings" }));
			return;
		}

		const cache = await readCache();
		const snapshot = cachedEvents(cache, league);
		const now = Date.now();
		const stale = isStale(snapshot?.fetchedAt ?? 0, now, currentTier());
		const event = currentEvent(snapshot?.events ?? [], now);

		if (!event || event.entries.length === 0) {
			await show(
				snapshot === undefined
					? messageBadge({ title: "CARD", detail: "loading" })
					: messageBadge({ title: "NO CARD", detail: this.emptyDetail(settings), stale })
			);
			return;
		}

		const at = (((settings.index ?? 0) % event.entries.length) + event.entries.length) % event.entries.length;
		const entry = event.entries[at];
		await show(
			entryBadge({
				accent: this.accent(settings),
				kicker: this.kicker(settings),
				primary: entry.primary,
				secondary: entry.secondary,
				settled: entry.settled,
				index: [at + 1, event.entries.length],
				stale
			})
		);
	}
}
