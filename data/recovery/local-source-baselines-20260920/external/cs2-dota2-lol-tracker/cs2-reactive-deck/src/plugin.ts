import streamDeck from "@elgato/streamdeck";

import { gsi } from "./lib/gsi-server";
import { findGameDir, ensureCfg } from "./lib/gsi-config";
import { HealthMonitor } from "./actions/health";
import { AmmoCounter } from "./actions/ammo";
import { KillFeed } from "./actions/killfeed";
import { RoundPhase } from "./actions/phase";
import { Economy } from "./actions/economy";
import { MatchKda } from "./actions/kda";
import { RoundScoreAction } from "./actions/score";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new HealthMonitor());
streamDeck.actions.registerAction(new AmmoCounter());
streamDeck.actions.registerAction(new KillFeed());
streamDeck.actions.registerAction(new RoundPhase());
streamDeck.actions.registerAction(new Economy());
streamDeck.actions.registerAction(new MatchKda());
streamDeck.actions.registerAction(new RoundScoreAction());

/** The GSI config CS2 reads at launch. Auto-installed into csgo/cfg so users do nothing by hand. */
const CS2_CFG = `"Ratpack CS2 Reactive Deck"
{
	"uri"		"http://127.0.0.1:3000"
	"timeout"	"5.0"
	"buffer"	"0.1"
	"throttle"	"0.1"
	"heartbeat"	"10.0"
	"data"
	{
		"provider"				"1"
		"map"					"1"
		"round"					"1"
		"player_id"				"1"
		"player_state"			"1"
		"player_weapons"		"1"
		"player_match_stats"	"1"
	}
}
`;

type Global = { port?: number };

async function boot(): Promise<void> {
	const g = await streamDeck.settings.getGlobalSettings<Global>();
	gsi.start(Number(g.port) || 3000);

	// Auto-install the GSI config into CS2's cfg folder (best effort).
	const dir = findGameDir("Counter-Strike Global Offensive", "game", "csgo", "cfg");
	const result = ensureCfg(dir, "gamestate_integration_ratpack_cs2.cfg", CS2_CFG);
	streamDeck.logger.info(`CS2 GSI config: ${result}`);
}

streamDeck.settings.onDidReceiveGlobalSettings<Global>((ev) => {
	gsi.start(Number(ev.settings.port) || 3000);
});

await streamDeck.connect();
await boot();
