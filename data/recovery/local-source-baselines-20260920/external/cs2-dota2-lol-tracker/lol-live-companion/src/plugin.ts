import streamDeck from "@elgato/streamdeck";

import { lol } from "./lib/lol-client";
import { GoldTracker } from "./actions/gold";
import { HealthDisplay } from "./actions/health";
import { AffordAlert } from "./actions/afford";
import { KdaDisplay } from "./actions/kda";
import { LevelDisplay } from "./actions/level";
import { CsDisplay } from "./actions/cs";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new GoldTracker());
streamDeck.actions.registerAction(new HealthDisplay());
streamDeck.actions.registerAction(new AffordAlert());
streamDeck.actions.registerAction(new KdaDisplay());
streamDeck.actions.registerAction(new LevelDisplay());
streamDeck.actions.registerAction(new CsDisplay());

await streamDeck.connect();

// Begin polling the local Live Client Data API every 2 seconds.
lol.start(2000);
