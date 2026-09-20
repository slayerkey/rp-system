import streamDeck, {
	action,
	SingletonAction,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type WillAppearEvent,
	type WillDisappearEvent
} from "@elgato/streamdeck";

import { costBadge, keyImage, messageBadge, money } from "./badge";
import { anyLogsPresent, readTurns, total, type Tool, type Turn } from "./logs";

streamDeck.logger.setLevel("info");

type Period = "today" | "7d" | "30d";

type CostSettings = {
	period?: Period;
	scope?: "all" | Tool;
};

const PERIODS: Period[] = ["today", "7d", "30d"];
const LABEL: Record<Period, string> = { today: "Today", "7d": "7 Days", "30d": "30 Days" };

/** Refresh cadence. Log files only change when the user is actively working, so a slow tick
 *  is plenty and keeps the disk scan off the hot path. */
const TICK_MS = 60_000;

// All Time is the Pro tier's period. Lite stops at 30 days, which is the window that answers
// "what is this costing me"; the longer history is what Pro is for.
function windowStart(p: Period): number {
	if (p === "today") {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}
	return Date.now() - (p === "7d" ? 7 : 30) * 86_400_000;
}

/**
 * One read of the widest window every tick, shared by every visible key. Reading 30 days once
 * and slicing it in memory is far cheaper than each key walking the log directory itself.
 */
let cache: { turns: Turn[]; at: number } = { turns: [], at: 0 };
let reading = false;

async function refresh(): Promise<void> {
	if (reading) return;
	reading = true;
	try {
		cache = { turns: await readTurns(windowStart("30d")), at: Date.now() };
	} catch (e) {
		streamDeck.logger.error("log scan failed", e);
	} finally {
		reading = false;
	}
}

@action({ UUID: "com.packrat.code-cost.cost" })
class Cost extends SingletonAction<CostSettings> {
	override async onWillAppear(ev: WillAppearEvent<CostSettings>): Promise<void> {
		await this.paint(ev.action, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CostSettings>): Promise<void> {
		await this.paint(ev.action, ev.payload.settings);
	}

	override async onWillDisappear(_ev: WillDisappearEvent<CostSettings>): Promise<void> {
		/* nothing to tear down: the ticker is global and cheap */
	}

	/** Press cycles the period, which is the whole interaction model for the free tier. */
	override async onKeyDown(ev: KeyDownEvent<CostSettings>): Promise<void> {
		const settings = ev.payload.settings ?? {};
		const next = PERIODS[(PERIODS.indexOf(settings.period ?? "today") + 1) % PERIODS.length];
		const updated: CostSettings = { ...settings, period: next };
		await ev.action.setSettings(updated);
		await refresh();
		await this.paint(ev.action, updated);
	}

	async paint(target: { setImage(i: string): Promise<void> }, settings: CostSettings): Promise<void> {
		const period = settings.period ?? "today";
		const scope = settings.scope ?? "all";

		if (!anyLogsPresent()) {
			await target.setImage(keyImage(messageBadge("NO LOGS", "FOUND")));
			return;
		}

		const since = windowStart(period);
		const turns = cache.turns.filter((t) => t.at >= since);
		const t = total(turns, scope === "all" ? undefined : scope);

		// An unpriced turn means a model this build has no rate for. Showing the dollar figure
		// anyway would understate it silently, so the face carries a partial marker.
		await target.setImage(
			keyImage(
				costBadge({
					period: LABEL[period],
					value: money(t.cost),
					sub: scope === "all" ? undefined : scope === "claude" ? "Claude Code" : "Codex",
					partial: t.unpriced > 0
				})
			)
		);
	}

	/** Repaint every visible instance of this action. */
	async repaintAll(): Promise<void> {
		for (const a of this.actions) {
			try {
				const settings = await a.getSettings<CostSettings>();
				await this.paint(a, settings ?? {});
			} catch (e) {
				streamDeck.logger.error("repaint failed", e);
			}
		}
	}
}

const cost = new Cost();
streamDeck.actions.registerAction(cost);

// Connect before the first scan: the paint path writes through the SDK, and those calls never
// resolve if the websocket is not up yet. Same ordering constraint the sport trackers hit.
streamDeck.connect().then(async () => {
	await refresh();
	await cost.repaintAll();
	setInterval(() => {
		void refresh().then(() => cost.repaintAll());
	}, TICK_MS);
});
