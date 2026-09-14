import streamDeck from "@elgato/streamdeck";
import { CycleDeviceAction, DashboardAction, ProDeviceAction } from "./actions.js";
import { WirelessRuntime } from "./runtime.js";

streamDeck.logger.setLevel("info");
const runtime = new WirelessRuntime("pro");
runtime.attachInspector();
streamDeck.actions.registerAction(new ProDeviceAction(runtime));
streamDeck.actions.registerAction(new DashboardAction(runtime));
streamDeck.actions.registerAction(new CycleDeviceAction(runtime));

streamDeck.connect().then(async () => {
  try {
    await runtime.start();
    streamDeck.logger.info("Wireless Device Manager Pro started");
  } catch (error) {
    streamDeck.logger.error("Wireless Device Manager Pro failed to start", error);
  }
});
