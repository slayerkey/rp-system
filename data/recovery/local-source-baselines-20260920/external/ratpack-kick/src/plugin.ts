import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import streamDeck from "@elgato/streamdeck";
import { KickAction } from "./actions/stats";

// The SDK reads manifest.json from process.cwd(), which Stream Deck is
// expected to set to the plugin folder but does not always do reliably.
// Force it explicitly so manifest reads never depend on host behavior.
process.chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

streamDeck.actions.registerAction(new KickAction());
void streamDeck.connect();
