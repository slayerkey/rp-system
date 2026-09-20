import streamDeck, { action } from "@elgato/streamdeck";

import { ClosestFrontAction, MajorOrderAction, WarSummaryAction } from "./actions";
import { startTracking } from "./tracker";

streamDeck.logger.setLevel("info");

@action({ UUID: "com.packrat.helldivers-stats.major-order" })
class MajorOrder extends MajorOrderAction {}

@action({ UUID: "com.packrat.helldivers-stats.closest-front" })
class ClosestFront extends ClosestFrontAction {}

@action({ UUID: "com.packrat.helldivers-stats.war-summary" })
class WarSummary extends WarSummaryAction {}

const majorOrder = new MajorOrder();
const closestFront = new ClosestFront();
const warSummary = new WarSummary();

streamDeck.actions.registerAction(majorOrder);
streamDeck.actions.registerAction(closestFront);
streamDeck.actions.registerAction(warSummary);

// Polling starts only after the SDK connection, because the first successful poll persists cache.
streamDeck.connect().then(() => startTracking([majorOrder, closestFront, warSummary]));

