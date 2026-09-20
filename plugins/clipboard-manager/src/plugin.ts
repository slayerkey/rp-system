import streamDeck from "@elgato/streamdeck";

import { ClipboardSlot } from "./actions/slot";
import { startWatcher } from "./clipboard/watcher";
import { assertLayout, inputSize } from "./paste/input";

streamDeck.logger.setLevel("info");

assertLayout();
streamDeck.logger.info(`Native input layer ready (node ${process.version}, ${process.platform}, diag size ${inputSize()} bytes).`);

streamDeck.actions.registerAction(new ClipboardSlot());

// Watching has to wait for the connection: the first change it finds writes the history to
// global settings, and that call simply never resolves if the websocket is not up yet.
streamDeck.connect().then(() => startWatcher());
