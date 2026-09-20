import streamDeck, {
	action,
	SingletonAction,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type KeyDownEvent,
	type WillAppearEvent
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";

import { anyLogsPresent, readTurns, total, type Tool, type Turn } from "../../code-cost/src/logs";
import { rateFor } from "../../code-cost/src/pricing";
import {
	breakdownBadge,
	cacheBadge,
	costBadge,
	keyImage,
	messageBadge,
	money,
	prettyModel,
	sparkBadge,
	valueBadge
} from "./faces";

streamDeck.logger.setLevel("info");

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: Period[] = ["today", "7d", "30d", "all"];
const LABEL: Record<Period, string> = { today: "Today", "7d": "7 Days", "30d": "30 Days", all: "All Time" };
const DAY = 86_400_000;
const TICK_MS = 60_000;

function windowStart(p: Period): number {
	if (p === "all") return 0;
	if (p === "today") {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}
	return Date.now() - (p === "7d" ? 7 : 30) * DAY;
}

/** One 30 day read per tick, shared by every key. Same reasoning as the Lite build. */
let cache: Turn[] = [];
let reading = false;

/**
 * How far back the scan has to go. Defaults to 30 days and widens to everything on disk only
 * when some key actually asks for All Time, so the common setup never pays to read history it
 * will not display.
 */
async function requiredSince(): Promise<number> {
	for (const a of all) {
		for (const inst of a.actions) {
			try {
				const s = (await inst.getSettings()) as { period?: Period } | undefined;
				if (s?.period === "all") return 0;
			} catch {
				/* an action that will not answer is not a reason to widen the scan */
			}
		}
	}
	return Date.now() - 30 * DAY;
}

async function refresh(): Promise<void> {
	if (reading) return;
	reading = true;
	try {
		cache = await readTurns(await requiredSince());
	} catch (e) {
		streamDeck.logger.error("log scan failed", e);
	} finally {
		reading = false;
	}
}

function slice(period: Period, scope: "all" | Tool): Turn[] {
	const since = windowStart(period);
	return cache.filter((t) => t.at >= since && (scope === "all" || t.tool === scope));
}

type Painter = { setImage(i: string): Promise<void> };

/** Shared plumbing: every Pro action repaints on the same tick and on settings changes. */
abstract class ProAction<S extends JsonObject> extends SingletonAction<S> {
	abstract paint(target: Painter, settings: S): Promise<void>;

	override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
		await this.paint(ev.action as Painter, ev.payload.settings);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
		await this.paint(ev.action as Painter, ev.payload.settings);
	}

	async repaintAll(): Promise<void> {
		for (const a of this.actions) {
			try {
				await this.paint(a as Painter, ((await a.getSettings()) ?? {}) as S);
			} catch (e) {
				streamDeck.logger.error("repaint failed", e);
			}
		}
	}

	protected async guard(target: Painter): Promise<boolean> {
		if (anyLogsPresent()) return true;
		await target.setImage(keyImage(messageBadge("NO LOGS", "FOUND")));
		return false;
	}
}

// ---------------------------------------------------------------------------
// Cost: the Lite key plus a monthly budget bar, and a dial for scrubbing period.
// ---------------------------------------------------------------------------

type CostSettings = { period?: Period; scope?: "all" | Tool; budget?: number };

@action({ UUID: "com.packrat.code-cost-pro.cost" })
class Cost extends ProAction<CostSettings> {
	override async onKeyDown(ev: KeyDownEvent<CostSettings>): Promise<void> {
		const s = ev.payload.settings ?? {};
		const next = PERIODS[(PERIODS.indexOf(s.period ?? "today") + 1) % PERIODS.length];
		const updated = { ...s, period: next };
		await ev.action.setSettings(updated);
		await this.paint(ev.action as Painter, updated);
	}

	/** One detent moves one period. Cheap to repeat, which is the constraint dials impose. */
	override async onDialRotate(ev: DialRotateEvent<CostSettings>): Promise<void> {
		const s = ev.payload.settings ?? {};
		const i = PERIODS.indexOf(s.period ?? "today");
		const next = PERIODS[Math.max(0, Math.min(PERIODS.length - 1, i + (ev.payload.ticks > 0 ? 1 : -1)))];
		const updated = { ...s, period: next };
		await ev.action.setSettings(updated);
		await this.paint(ev.action as Painter, updated);
	}

	async paint(target: Painter, s: CostSettings): Promise<void> {
		if (!(await this.guard(target))) return;
		const period = s.period ?? "today";
		const t = total(slice(period, s.scope ?? "all"));
		// The budget is expressed per month, so it only frames the 30 day view. Showing a
		// monthly cap against a single day would read as "you are fine" every morning.
		const budget = s.budget && s.budget > 0 && period === "30d" ? { used: t.cost, cap: s.budget } : undefined;
		await target.setImage(keyImage(costBadge(LABEL[period], money(t.cost), budget)));
	}
}

// ---------------------------------------------------------------------------
// Value: the hero. What 30 days of usage was worth against the plan price.
// ---------------------------------------------------------------------------

type ValueSettings = { plan?: number; scope?: "all" | Tool };

@action({ UUID: "com.packrat.code-cost-pro.value" })
class Value extends ProAction<ValueSettings> {
	async paint(target: Painter, s: ValueSettings): Promise<void> {
		if (!(await this.guard(target))) return;
		const plan = s.plan && s.plan > 0 ? s.plan : 20;
		const t = total(slice("30d", s.scope ?? "all"));
		await target.setImage(keyImage(valueBadge(t.cost / plan, t.cost, plan)));
	}
}

// ---------------------------------------------------------------------------
// Breakdown: where the money went, by model or by project.
// ---------------------------------------------------------------------------

type BreakdownSettings = { by?: "model" | "project"; period?: Period };

@action({ UUID: "com.packrat.code-cost-pro.breakdown" })
class Breakdown extends ProAction<BreakdownSettings> {
	override async onKeyDown(ev: KeyDownEvent<BreakdownSettings>): Promise<void> {
		const s = ev.payload.settings ?? {};
		const updated = { ...s, by: (s.by ?? "model") === "model" ? ("project" as const) : ("model" as const) };
		await ev.action.setSettings(updated);
		await this.paint(ev.action as Painter, updated);
	}

	async paint(target: Painter, s: BreakdownSettings): Promise<void> {
		if (!(await this.guard(target))) return;
		const by = s.by ?? "model";
		const t = total(slice(s.period ?? "30d", "all"));
		const src = by === "model" ? t.byModel : t.byProject;
		const rows: [string, number][] = [...src.entries()]
			.map(([n, v]): [string, number] => [by === "model" ? prettyModel(n) : n, v])
			.sort((a, b) => b[1] - a[1]);
		await target.setImage(keyImage(breakdownBadge(by === "model" ? "By model" : "By project", rows)));
	}
}

// ---------------------------------------------------------------------------
// Cache: hit rate, and what the discount was worth.
// ---------------------------------------------------------------------------

type CacheSettings = { period?: Period };

@action({ UUID: "com.packrat.code-cost-pro.cache" })
class Cache extends ProAction<CacheSettings> {
	async paint(target: Painter, s: CacheSettings): Promise<void> {
		if (!(await this.guard(target))) return;
		const turns = slice(s.period ?? "30d", "all");
		let read = 0;
		let prompt = 0;
		let saved = 0;
		for (const t of turns) {
			read += t.tokens.cacheRead;
			// Cache writes belong in the denominator: they are prompt tokens that were NOT served
			// from cache. Leaving them out pins the rate at 100% on any long session and makes the
			// key useless.
			prompt += t.tokens.input + t.tokens.cacheRead + t.tokens.cacheWrite;
			// A cache read bills at a fraction of the input rate, so the difference between the
			// two is what caching saved. Only counted on turns with a known rate, so this stays
			// consistent with the cost figure on the other keys.
			const r = rateFor(t.model);
			if (r) saved += (t.tokens.cacheRead / 1e6) * (r.input - r.cacheRead);
		}
		const pct = prompt > 0 ? (read / prompt) * 100 : 0;
		await target.setImage(keyImage(cacheBadge(pct, saved)));
	}
}

// ---------------------------------------------------------------------------
// Trend: daily spend as a sparkline.
// ---------------------------------------------------------------------------

type TrendSettings = { days?: number };

@action({ UUID: "com.packrat.code-cost-pro.trend" })
class Trend extends ProAction<TrendSettings> {
	async paint(target: Painter, s: TrendSettings): Promise<void> {
		if (!(await this.guard(target))) return;
		const days = s.days && s.days > 0 ? Math.min(30, s.days) : 14;
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const buckets = new Array<number>(days).fill(0);
		for (const t of cache) {
			const age = Math.floor((start.getTime() - t.at) / DAY);
			const idx = days - 1 - age;
			if (idx >= 0 && idx < days && t.cost !== null) buckets[idx] += t.cost;
		}
		const sum = buckets.reduce((a, b) => a + b, 0);
		await target.setImage(keyImage(sparkBadge(`${days} day trend`, money(sum), buckets)));
	}
}

const cost = new Cost();
const value = new Value();
const breakdown = new Breakdown();
const cacheHit = new Cache();
const trend = new Trend();
const all = [cost, value, breakdown, cacheHit, trend];

for (const a of all) streamDeck.actions.registerAction(a);

streamDeck.connect().then(async () => {
	await refresh();
	for (const a of all) await a.repaintAll();
	setInterval(() => {
		void refresh().then(async () => {
			for (const a of all) await a.repaintAll();
		});
	}, TICK_MS);
});
