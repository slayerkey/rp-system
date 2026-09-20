import streamDeck from "@elgato/streamdeck";

import { CryptoAction } from "./actions/crypto";
import { EarningsAction } from "./actions/earnings";
import { FearGreedAction } from "./actions/feargreed";
import { HeatmapAction } from "./actions/heatmap";
import { MarketClockAction } from "./actions/market-clock";
import { TickerAction } from "./actions/ticker";
import { initGlobalSettings } from "./data/pollers";

streamDeck.actions.registerAction(new TickerAction());
streamDeck.actions.registerAction(new CryptoAction());
streamDeck.actions.registerAction(new MarketClockAction());
streamDeck.actions.registerAction(new HeatmapAction());
streamDeck.actions.registerAction(new FearGreedAction());
streamDeck.actions.registerAction(new EarningsAction());

await streamDeck.connect();
await initGlobalSettings();
