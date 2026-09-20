import streamDeck from "@elgato/streamdeck";

import { startWatcher } from "../../clipboard-manager/src/clipboard/watcher";
import { assertLayout, inputSize } from "../../clipboard-manager/src/paste/input";
import { ClipboardEntry } from "./actions/entry";
import { HistoryPicker } from "./actions/picker";
import { PRO_HISTORY_LIMIT } from "./history-pro";

streamDeck.logger.setLevel("info");

assertLayout();
streamDeck.logger.info(`Native input layer ready (node ${process.version}, ${process.platform}, diag size ${inputSize()} bytes).`);

streamDeck.actions.registerAction(new ClipboardEntry());
streamDeck.actions.registerAction(new HistoryPicker());

streamDeck.connect().then(() => startWatcher({ historyLimit: PRO_HISTORY_LIMIT }));
