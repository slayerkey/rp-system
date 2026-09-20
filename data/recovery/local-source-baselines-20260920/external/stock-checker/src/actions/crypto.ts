import { action } from "@elgato/streamdeck";

import { ACTIONS, DEFAULTS } from "../config";
import { coinDisplay, tickerToCoinId } from "../data/crypto-map";
import type { Poller } from "../data/poller";
import { cryptoPoller } from "../data/pollers";
import type { QuoteSettings } from "../settings";
import { BaseQuoteAction } from "./base-quote";

/** Live cryptocurrency price via CoinGecko (no API key needed). */
@action({ UUID: ACTIONS.crypto })
export class CryptoAction extends BaseQuoteAction<QuoteSettings> {
	protected readonly crypto = true;
	protected readonly defaultSymbol = DEFAULTS.cryptoSymbol;

	protected getPoller(): Poller {
		return cryptoPoller;
	}

	protected normalizeSymbol(raw: string): string {
		return tickerToCoinId(raw);
	}

	protected override displaySymbol(raw: string): string {
		return coinDisplay(raw);
	}
}
