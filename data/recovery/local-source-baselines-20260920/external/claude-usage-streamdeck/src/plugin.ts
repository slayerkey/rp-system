import streamDeck from "@elgato/streamdeck";
import { UsageAction } from "./actions/usage";
import { initTokenStore } from "./usage/token";
import { startBridge } from "./usage/bridge";
import { startWarmPolling } from "./usage/warm";
import { IS_COMBINED } from "./providers/active";

streamDeck.actions.registerAction(new UsageAction());
streamDeck.connect();
void initTokenStore();

// Only the combined tracker has providers to keep warm; a single-provider build polls
// solely for the keys the user has placed, exactly as it always has.
if (IS_COMBINED) startWarmPolling();

// Serves GET /usage for the Packrat AI Usage iCUE widget. Harmless if a sibling
// Packrat plugin already holds the port.
startBridge();
