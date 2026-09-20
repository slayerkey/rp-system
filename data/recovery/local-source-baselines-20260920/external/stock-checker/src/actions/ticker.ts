import { action } from "@elgato/streamdeck";

import { ACTIONS, DEFAULTS } from "../config";
import type { Poller } from "../data/poller";
import { equityPoller } from "../data/pollers";
import type { QuoteSettings } from "../settings";
import { BaseQuoteAction } from "./base-quote";

/** Live stock, ETF or index price. Indices are tracked via their symbol/ETF proxy. */
@action({ UUID: ACTIONS.ticker })
export class TickerAction extends BaseQuoteAction<QuoteSettings> {
	protected readonly crypto = false;
	protected readonly defaultSymbol = DEFAULTS.stockSymbol;

	protected getPoller(): Poller {
		return equityPoller;
	}

	protected normalizeSymbol(raw: string): string {
		return raw.trim().toUpperCase();
	}
}
