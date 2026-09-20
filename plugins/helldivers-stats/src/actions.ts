import {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	SingletonAction,
	type WillAppearEvent
} from "@elgato/streamdeck";

import { entryBadge, eventBadge, keyImage, messageBadge } from "../../_shared/src/badge";
import { isStale } from "../../_shared/src/poller";
import { factionAccent, compactCount, type HelldiversSnapshot } from "./model";
import { readSnapshot } from "./store";
import { pokeTracker, staleTier, type HelldiversSurface } from "./tracker";

type MajorOrderSettings = { view?: "progress" | "time" };
type FrontSettings = { index?: number };

function percentage(value: number): string {
	return `${value.toFixed(value >= 99.95 ? 0 : 1)}%`;
}

function timeRemaining(expiresAt: string, nowMs: number): string {
	const remaining = Date.parse(expiresAt) - nowMs;
	if (!Number.isFinite(remaining)) return "TIME TBD";
	if (remaining <= 0) return "EXPIRED";
	const minutes = Math.max(1, Math.ceil(remaining / 60_000));
	const days = Math.floor(minutes / (24 * 60));
	const hours = Math.floor((minutes % (24 * 60)) / 60);
	if (days > 0) return `${days}D ${hours}H`;
	return `${hours}H ${minutes % 60}M`;
}

function stale(snapshot: HelldiversSnapshot | null): boolean {
	return isStale(snapshot?.fetchedAt ?? 0, Date.now(), staleTier());
}

export class MajorOrderAction extends SingletonAction<MajorOrderSettings> implements HelldiversSurface {
	override async onWillAppear(ev: WillAppearEvent<MajorOrderSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MajorOrderSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<MajorOrderSettings>): Promise<void> {
		const next: MajorOrderSettings = { view: ev.payload.settings.view === "time" ? "progress" : "time" };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, await instance.getSettings<MajorOrderSettings>());
		}
	}

	private async paint(key: KeyAction<MajorOrderSettings>, settings: MajorOrderSettings): Promise<void> {
		const snapshot = await readSnapshot();
		const order = snapshot?.majorOrder;
		if (!order) {
			await key.setImage(keyImage(messageBadge({ title: "NO ORDER", detail: snapshot ? "stand by" : "loading", stale: stale(snapshot) })));
			return;
		}

		const timeView = settings.view === "time";
		const progress = order.progressPercent === null ? "PROGRESS TBD" : percentage(order.progressPercent);
		await key.setImage(
			keyImage(
				eventBadge({
					accent: "#2be86a",
					kicker: timeView ? "ORDER TIME" : "MAJOR ORDER",
					title: order.title,
					subtitle: timeView ? progress : timeRemaining(order.expiresAt, Date.now()),
					when: timeView ? timeRemaining(order.expiresAt, Date.now()) : progress,
					imminent: timeView,
					stale: stale(snapshot)
				})
			)
		);
	}
}

export class ClosestFrontAction extends SingletonAction<FrontSettings> implements HelldiversSurface {
	override async onWillAppear(ev: WillAppearEvent<FrontSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
		pokeTracker();
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<FrontSettings>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<FrontSettings>): Promise<void> {
		const next = { index: (ev.payload.settings.index ?? 0) + 1 };
		await ev.action.setSettings(next);
		if (ev.action.isKey()) await this.paint(ev.action, next);
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) {
			if (instance.isKey()) await this.paint(instance, await instance.getSettings<FrontSettings>());
		}
	}

	private async paint(key: KeyAction<FrontSettings>, settings: FrontSettings): Promise<void> {
		const snapshot = await readSnapshot();
		const fronts = snapshot?.campaigns ?? [];
		if (fronts.length === 0) {
			await key.setImage(keyImage(messageBadge({ title: "NO FRONTS", detail: snapshot ? "quiet" : "loading", stale: stale(snapshot) })));
			return;
		}

		const at = (((settings.index ?? 0) % fronts.length) + fronts.length) % fronts.length;
		const front = fronts[at];
		await key.setImage(
			keyImage(
				entryBadge({
					accent: factionAccent(front.faction),
					kicker: "CLOSEST FRONT",
					primary: front.planet,
					secondary: `${front.faction.toUpperCase()} ${percentage(front.liberationPercent)}`,
					index: [at + 1, fronts.length],
					stale: stale(snapshot)
				})
			)
		);
	}
}

export class WarSummaryAction extends SingletonAction<Record<string, never>> implements HelldiversSurface {
	override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
		if (ev.action.isKey()) await this.paint(ev.action);
		pokeTracker();
	}

	override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
		pokeTracker();
		await ev.action.showOk();
	}

	async repaint(): Promise<void> {
		for (const instance of this.actions) if (instance.isKey()) await this.paint(instance);
	}

	private async paint(key: KeyAction<Record<string, never>>): Promise<void> {
		const snapshot = await readSnapshot();
		if (!snapshot) {
			await key.setImage(keyImage(messageBadge({ title: "WAR", detail: "loading", stale: true })));
			return;
		}
		const summary = snapshot.war;
		await key.setImage(
			keyImage(
				eventBadge({
					accent: "#2be86a",
					kicker: "WAR SUMMARY",
					title: `${summary.activeCampaigns} ACTIVE FRONTS`,
					subtitle: `${compactCount(summary.playerCount)} DIVERS`,
					when: `${percentage(summary.overallLiberation)} HELD`,
					stale: stale(snapshot)
				})
			)
		);
	}
}

