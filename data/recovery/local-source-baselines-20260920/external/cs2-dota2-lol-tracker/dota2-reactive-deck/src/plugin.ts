import streamDeck from "@elgato/streamdeck";

import { gsi } from "./lib/gsi-server";
import { findGameDir, ensureCfg } from "./lib/gsi-config";
import { HeroVitalsAction } from "./actions/hpmana";
import { GoldCounter } from "./actions/gold";
import { RoshanTimer } from "./actions/roshan";
import { KdaAction } from "./actions/kda";
import { RespawnTimer } from "./actions/respawn";
import { MatchTimer } from "./actions/matchtimer";
import { NetWorthAction } from "./actions/networth";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new HeroVitalsAction());
streamDeck.actions.registerAction(new GoldCounter());
streamDeck.actions.registerAction(new RoshanTimer());
streamDeck.actions.registerAction(new KdaAction());
streamDeck.actions.registerAction(new RespawnTimer());
streamDeck.actions.registerAction(new MatchTimer());
streamDeck.actions.registerAction(new NetWorthAction());

/** GSI config Dota reads at launch. Auto-installed into the gamestate_integration cfg folder. */
const DOTA_CFG = `"Ratpack Dota 2 Reactive Deck"
{
	"uri"		"http://127.0.0.1:3001/"
	"timeout"	"5.0"
	"buffer"	"0.1"
	"throttle"	"0.1"
	"heartbeat"	"10.0"
	"data"
	{
		"provider"	"1"
		"map"		"1"
		"player"	"1"
		"hero"		"1"
		"abilities"	"1"
		"items"		"1"
	}
}
`;

type Global = { port?: number };

async function boot(): Promise<void> {
	const g = await streamDeck.settings.getGlobalSettings<Global>();
	gsi.start(Number(g.port) || 3001);

	// Auto-install the GSI config into Dota's gamestate_integration folder (best effort).
	const dir = findGameDir("dota 2 beta", "game", "dota", "cfg", "gamestate_integration");
	const result = ensureCfg(dir, "gamestate_integration_ratpack_dota2.cfg", DOTA_CFG);
	streamDeck.logger.info(`Dota GSI config: ${result}`);
}

streamDeck.settings.onDidReceiveGlobalSettings<Global>((ev) => {
	gsi.start(Number(ev.settings.port) || 3001);
});

await streamDeck.connect();
await boot();
