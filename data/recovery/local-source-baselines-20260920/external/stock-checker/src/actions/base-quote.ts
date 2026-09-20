import type { JsonObject } from "@elgato/utils";
import {
	SingletonAction,
	type DialAction,
	type DialDownEvent,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { getHistory } from "../data/history";
import { getFiftyTwoWeek, type FiftyTwoWeek } from "../data/metrics";
import { FRIENDLY_NAMES } from "../data/names";
import type { Poller, QuoteResult } from "../data/poller";
import { getFinnhubKey } from "../data/pollers";
import type { Quote } from "../data/provider";
import type { QuoteSettings, Timeframe } from "../settings";
import { formatMoney, formatPct, formatPrice, toNumber } from "../render/format";
import { buildHeatmapImage, buildInfoImage, buildQuoteImage, type HeatmapTile, type QuoteView } from "../render/renderer";
import { THEMES } from "../render/themes";

const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "1Y"];
const MAX_SYMBOLS = 10;
const DEFAULT_ROTATE_SECONDS = 6;

type AnyAction<S extends JsonObject> = KeyAction<S> | DialAction<S>;

/** Per-symbol data, kept for every symbol in a rotating key so all stay live. */
type SymbolData = {
	quote?: Quote;
	observed: number[];
	histPoints?: number[];
	histTf?: Timeframe;
};

type KeyState<S> = {
	/** Identity of the symbol set, to detect real changes vs display-only changes. */
	key: string;
	raws: string[];
	symbols: string[];
	data: Map<string, SymbolData>;
	range: Map<string, FiftyTwoWeek>;
	unsubs: Array<() => void>;
	active: number;
	rotateTimer?: ReturnType<typeof setInterval>;
	settings: S;
};

/**
 * Shared behaviour for the stock/index and crypto keys — usable on a Keypad button
 * or a Stream Deck+ dial. A key can watch one symbol or several (comma-separated)
 * that rotate on a timer; all stay subscribed so data is always fresh. Pulls real
 * historical data for the sparkline and weekly/monthly change, cycles timeframe on
 * press (key) or rotate (dial), and shows position P/L and price alerts.
 *
 * On a dial, rotating scrubs the timeframe and pressing jumps to the next symbol
 * in the rotation list (when more than one is configured).
 */
export abstract class BaseQuoteAction<S extends QuoteSettings & JsonObject> extends SingletonAction<S> {
	protected abstract getPoller(): Poller;
	protected abstract readonly crypto: boolean;
	protected abstract readonly defaultSymbol: string;
	protected abstract normalizeSymbol(raw: string): string;

	protected displaySymbol(raw: string): string {
		return raw.trim().toUpperCase();
	}

	private readonly state = new Map<string, KeyState<S>>();

	override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
		await this.sync(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.teardown(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
		await this.sync(ev.action, ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<S>): Promise<void> {
		if (this.isHeatmap(ev.payload.settings)) {
			return;
		}
		await this.stepTimeframe(ev.action, 1);
	}

	override async onDialRotate(ev: DialRotateEvent<S>): Promise<void> {
		if (this.isHeatmap(ev.payload.settings)) {
			return;
		}
		await this.stepTimeframe(ev.action, ev.payload.ticks > 0 ? 1 : -1);
	}

	override onDialDown(ev: DialDownEvent<S>): void {
		const st = this.state.get(ev.action.id);
		if (!st || this.isHeatmap(st.settings) || st.symbols.length < 2) {
			return;
		}
		st.active = (st.active + 1) % st.symbols.length;
		this.requestHistory(ev.action, st, st.symbols[st.active]);
		this.render(ev.action, st);
	}

	private isHeatmap(s: S): boolean {
		return s.displayStyle === "heatmap";
	}

	override onTouchTap(ev: TouchTapEvent<S>): void {
		const st = this.state.get(ev.action.id);
		if (st) {
			this.render(ev.action, st);
		}
	}

	private async stepTimeframe(action: AnyAction<S>, direction: 1 | -1): Promise<void> {
		const st = this.state.get(action.id);
		if (!st) {
			return;
		}
		const current = st.settings.timeframe ?? "1D";
		const idx = (TIMEFRAMES.indexOf(current) + direction + TIMEFRAMES.length) % TIMEFRAMES.length;
		st.settings.timeframe = TIMEFRAMES[idx];
		await action.setSettings(st.settings);
		this.requestHistory(action, st, st.symbols[st.active]);
		this.render(action, st);
	}

	private resolveList(s: S): string[] {
		const source = s.symbol?.toString().trim() || s.preset?.toString().trim() || this.defaultSymbol;
		const seen = new Set<string>();
		const raws: string[] = [];
		for (const raw of source.split(",").map((x) => x.trim()).filter(Boolean)) {
			const key = this.normalizeSymbol(raw);
			if (!seen.has(key)) {
				seen.add(key);
				raws.push(raw);
			}
			if (raws.length >= MAX_SYMBOLS) {
				break;
			}
		}
		return raws.length ? raws : [this.defaultSymbol];
	}

	private async sync(action: AnyAction<S>, settings: S): Promise<void> {
		const raws = this.resolveList(settings);
		const symbols = raws.map((r) => this.normalizeSymbol(r));
		const key = symbols.join("|");
		const existing = this.state.get(action.id);

		// Same symbol set => display-only change. Update settings and re-render from cache.
		if (existing && existing.key === key) {
			existing.settings = settings;
			existing.raws = raws;
			if (this.isHeatmap(settings)) {
				this.stopRotation(existing);
			} else {
				this.startRotation(action, existing);
				this.requestHistory(action, existing, existing.symbols[existing.active]);
				this.requestRange(action, existing, existing.symbols[existing.active]);
			}
			this.render(action, existing);
			return;
		}

		this.teardown(action.id);
		const st: KeyState<S> = {
			key,
			raws,
			symbols,
			data: new Map(symbols.map((s) => [s, { observed: [] }])),
			range: new Map(),
			unsubs: [],
			active: 0,
			settings,
		};
		this.state.set(action.id, st);

		this.showInfo(action, this.displaySymbol(raws[0]), "Loading…");

		symbols.forEach((symbol) => {
			const unsub = this.getPoller().subscribe(symbol, (result) => this.onResult(action, symbol, result));
			st.unsubs.push(unsub);
		});
		if (!this.isHeatmap(settings)) {
			this.requestHistory(action, st, symbols[0]);
			this.requestRange(action, st, symbols[0]);
			this.startRotation(action, st);
		}
	}

	private teardown(id: string): void {
		const st = this.state.get(id);
		if (st) {
			st.unsubs.forEach((u) => u());
			if (st.rotateTimer) {
				clearInterval(st.rotateTimer);
			}
		}
		this.state.delete(id);
	}

	private stopRotation(st: KeyState<S>): void {
		if (st.rotateTimer) {
			clearInterval(st.rotateTimer);
			st.rotateTimer = undefined;
		}
	}

	private startRotation(action: AnyAction<S>, st: KeyState<S>): void {
		this.stopRotation(st);
		if (st.symbols.length < 2) {
			return;
		}
		const seconds = Math.max(3, toNumber(st.settings.rotateSeconds) ?? DEFAULT_ROTATE_SECONDS);
		st.rotateTimer = setInterval(() => {
			st.active = (st.active + 1) % st.symbols.length;
			const symbol = st.symbols[st.active];
			this.requestHistory(action, st, symbol);
			this.requestRange(action, st, symbol);
			this.render(action, st);
		}, seconds * 1000);
	}

	/** Opt-in 52-week high/low, stocks only. Cached for 30 minutes at the fetch layer. */
	private requestRange(action: AnyAction<S>, st: KeyState<S>, symbol: string): void {
		if (this.crypto || !st.settings.showRange || st.range.has(symbol)) {
			return;
		}
		const key = getFinnhubKey();
		if (!key) {
			return;
		}
		void getFiftyTwoWeek(symbol, key).then((range) => {
			const current = this.state.get(action.id);
			if (!current || current.symbols[current.active] !== symbol) {
				if (current && range) {
					current.range.set(symbol, range);
				}
				return;
			}
			if (range) {
				current.range.set(symbol, range);
				this.render(action, current);
			}
		});
	}

	private requestHistory(action: AnyAction<S>, st: KeyState<S>, symbol: string): void {
		if (st.settings.showSparkline === false) {
			return;
		}
		const tf = st.settings.timeframe ?? "1D";
		void getHistory(symbol, tf, this.crypto).then((points) => {
			const current = this.state.get(action.id);
			const data = current?.data.get(symbol);
			if (!current || !data || !points || points.length < 2) {
				return;
			}
			data.histPoints = points;
			data.histTf = tf;
			if (current.symbols[current.active] === symbol) {
				this.render(action, current);
			}
		});
	}

	private onResult(action: AnyAction<S>, symbol: string, result: QuoteResult): void {
		const st = this.state.get(action.id);
		const data = st?.data.get(symbol);
		if (!st || !data) {
			return;
		}
		const heatmap = this.isHeatmap(st.settings);
		const isActive = heatmap || st.symbols[st.active] === symbol;

		if ("error" in result) {
			if (isActive && !heatmap && !data.quote) {
				this.showInfo(action, this.displaySymbol(st.raws[st.active]), result.error, true);
			}
			return;
		}

		data.quote = result;
		data.observed.push(result.price);
		if (data.observed.length > 48) {
			data.observed.shift();
		}
		if (isActive) {
			if (!heatmap) {
				this.requestHistory(action, st, symbol);
			}
			this.render(action, st);
		}
	}

	/** Loading / error / prompt state, rendered appropriately for the controller type. */
	private showInfo(action: AnyAction<S>, title: string, sub: string, isError = false): void {
		if (action.isDial()) {
			void action.setFeedback({ title, value: sub });
			return;
		}
		const themeName = this.state.get(action.id)?.settings.theme ?? "dark";
		const theme = THEMES[themeName] ?? THEMES.dark;
		void action.setImage(buildInfoImage(title, sub, theme, isError ? theme.down : undefined));
	}

	private buildView(st: KeyState<S>, stale: boolean): (QuoteView & { pct: number }) | undefined {
		const s = st.settings;
		const symbol = st.symbols[st.active];
		const raw = st.raws[st.active];
		const data = st.data.get(symbol);
		const q = data?.quote;
		if (!data || !q) {
			return undefined;
		}
		const theme = THEMES[s.theme ?? "dark"] ?? THEMES.dark;
		const ticker = this.displaySymbol(raw);
		const tf = s.timeframe ?? "1D";

		const name = s.showName !== false ? q.name || FRIENDLY_NAMES[ticker] : undefined;
		const topLabel = name || ticker;

		const useHistory = tf !== "1D" && data.histTf === tf && data.histPoints && data.histPoints.length > 1;
		const pct = useHistory
			? ((data.histPoints![data.histPoints!.length - 1] - data.histPoints![0]) / data.histPoints![0]) * 100
			: q.changePercent;
		const tag = tf === "1D" ? (this.crypto ? "24H" : "1D") : tf;
		const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
		const changeColor = dir === "up" ? theme.up : dir === "down" ? theme.down : theme.flat;

		const shares = toNumber(s.shares) ?? 0;
		const cost = toNumber(s.avgCost) ?? 0;
		let plText: string | undefined;
		let plColor: string | undefined;
		if (shares > 0 && cost > 0) {
			const plValue = (q.price - cost) * shares;
			plText = `P/L ${formatMoney(plValue)}`;
			plColor = plValue > 0 ? theme.up : plValue < 0 ? theme.down : theme.flat;
		}

		const above = toNumber(s.alertAbove);
		const below = toNumber(s.alertBelow);
		const alert = (above !== undefined && q.price >= above) || (below !== undefined && q.price <= below);

		const range = s.showRange && !this.crypto ? st.range.get(symbol) : undefined;
		const rangePct = range && range.high > range.low ? (q.price - range.low) / (range.high - range.low) : undefined;

		const sparkline =
			s.showSparkline === false
				? undefined
				: data.histPoints && data.histPoints.length > 1
					? data.histPoints
					: data.observed.length > 1
						? data.observed
						: undefined;

		return {
			topLabel,
			priceText: formatPrice(q.price, this.crypto),
			changeText: formatPct(pct),
			changeColor,
			tag,
			sparkline,
			sparkColor: changeColor,
			plText,
			plColor,
			rangePct,
			alert,
			alertColor: theme.extended,
			stale,
			theme,
			pct,
		};
	}

	private render(action: AnyAction<S>, st: KeyState<S>, stale = false): void {
		if (this.isHeatmap(st.settings)) {
			this.renderHeatmap(action, st, stale);
			return;
		}
		const view = this.buildView(st, stale);
		if (!view) {
			return;
		}
		if (action.isDial()) {
			// $B1 layout: title on top, icon on the left, value on the right with a progress bar.
			// The bar has no native "zero" point, so we center it: 0% change -> 50, +/-10% -> the ends.
			const indicator = Math.round(50 + Math.max(-10, Math.min(10, view.pct)) * 5);
			void action.setFeedback({
				title: view.topLabel,
				value: `${view.priceText}  ${view.changeText}`,
				indicator,
			});
		} else {
			void action.setImage(buildQuoteImage(view));
		}
	}

	/** Every symbol in the list as one color-coded grid, instead of rotating through them. */
	private renderHeatmap(action: AnyAction<S>, st: KeyState<S>, stale: boolean): void {
		const theme = THEMES[st.settings.theme ?? "dark"] ?? THEMES.dark;
		const tiles: HeatmapTile[] = st.symbols.map((symbol, i) => ({
			ticker: this.displaySymbol(st.raws[i]),
			pct: st.data.get(symbol)?.quote?.changePercent ?? 0,
		}));
		if (action.isDial()) {
			void action.setFeedback({ title: "Heatmap", value: `${tiles.length} symbols` });
			return;
		}
		void action.setImage(buildHeatmapImage(tiles, theme, stale));
	}
}
