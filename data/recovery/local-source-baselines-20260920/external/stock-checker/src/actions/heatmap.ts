import {
	SingletonAction,
	action,
	type DidReceiveSettingsEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { ACTIONS } from "../config";
import { coinDisplay, tickerToCoinId } from "../data/crypto-map";
import type { QuoteResult } from "../data/poller";
import { cryptoPoller, equityPoller } from "../data/pollers";
import { buildHeatmapImage, type HeatmapTile } from "../render/renderer";
import { THEMES } from "../render/themes";
import type { HeatmapSettings } from "../settings";

const MAX_TILES = 9;
const DEFAULT_SYMBOLS = "AAPL, MSFT, NVDA, AMZN, GOOGL, TSLA";

interface Renderable {
	id: string;
	setImage(image: string): Promise<void>;
}

type HeatState = {
	market: "stocks" | "crypto";
	tickers: string[];
	symbols: string[];
	pct: Map<string, number>;
	unsubs: Array<() => void>;
	settings: HeatmapSettings;
};

/** A grid of watchlist symbols shaded red-to-green by daily move, all in one key. */
@action({ UUID: ACTIONS.heatmap })
export class HeatmapAction extends SingletonAction<HeatmapSettings> {
	private readonly state = new Map<string, HeatState>();

	override async onWillAppear(ev: WillAppearEvent<HeatmapSettings>): Promise<void> {
		this.sync(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<HeatmapSettings>): void {
		this.teardown(ev.action.id);
	}

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<HeatmapSettings>): void {
		this.sync(ev.action, ev.payload.settings);
	}

	private sync(action: Renderable, settings: HeatmapSettings): void {
		const market = settings.market === "crypto" ? "crypto" : "stocks";
		const raw = (settings.symbols?.trim() || DEFAULT_SYMBOLS)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, MAX_TILES);
		const tickers = raw.map((r) => (market === "crypto" ? coinDisplay(r) : r.toUpperCase()));
		const symbols = raw.map((r) => (market === "crypto" ? tickerToCoinId(r) : r.toUpperCase()));
		const key = `${market}:${symbols.join("|")}`;

		const existing = this.state.get(action.id);
		if (existing && `${existing.market}:${existing.symbols.join("|")}` === key) {
			existing.settings = settings;
			this.render(action, existing);
			return;
		}

		this.teardown(action.id);
		const st: HeatState = { market, tickers, symbols, pct: new Map(), unsubs: [], settings };
		this.state.set(action.id, st);

		const poller = market === "crypto" ? cryptoPoller : equityPoller;
		symbols.forEach((symbol) => {
			const unsub = poller.subscribe(symbol, (result) => this.onResult(action, symbol, result));
			st.unsubs.push(unsub);
		});
		this.render(action, st);
	}

	private teardown(id: string): void {
		this.state.get(id)?.unsubs.forEach((u) => u());
		this.state.delete(id);
	}

	private onResult(action: Renderable, symbol: string, result: QuoteResult): void {
		const st = this.state.get(action.id);
		if (!st || "error" in result) {
			return;
		}
		st.pct.set(symbol, result.changePercent);
		this.render(action, st);
	}

	private render(action: Renderable, st: HeatState): void {
		const theme = THEMES[st.settings.theme ?? "dark"] ?? THEMES.dark;
		// Symbols without data yet render as a neutral (0%) placeholder so the grid layout is
		// stable from the first frame, rather than tiles popping in one at a time.
		const tiles: HeatmapTile[] = st.tickers.map((ticker, i) => ({
			ticker,
			pct: st.pct.get(st.symbols[i]) ?? 0,
		}));
		void action.setImage(buildHeatmapImage(tiles, theme));
	}
}
