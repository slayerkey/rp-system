import streamDeck from "@elgato/streamdeck";
import { LiteDeviceAction } from "./actions.js";
import { WirelessRuntime } from "./runtime.js";

streamDeck.logger.setLevel("info");
const runtime = new WirelessRuntime("lite");
runtime.attachInspector();
streamDeck.actions.registerAction(new LiteDeviceAction(runtime));

streamDeck.connect().then(async () => {
  try {
    await runtime.start();
    streamDeck.logger.info("Wireless Device Manager Lite started");
  } catch (error) {
    streamDeck.logger.error("Wireless Device Manager Lite failed to start", error);
  }
});
