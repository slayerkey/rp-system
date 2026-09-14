import streamDeck from "@elgato/streamdeck";
import { LiteDeviceAction } from "./actions.js";
import { WirelessRuntime } from "./runtime.js";

streamDeck.logger.setLevel("info");
const runtime = new WirelessRuntime("lite");
streamDeck.actions.registerAction(new LiteDeviceAction(runtime));

async function sendInspectorData(): Promise<void> {
  try {
    await streamDeck.ui.sendToPropertyInspector(runtime.inspectorPayload());
  } catch (error) {
    streamDeck.logger.error("Wireless Device Manager Lite inspector update failed", error);
  }
}
streamDeck.ui.onDidAppear(() => void sendInspectorData());
streamDeck.ui.onSendToPlugin((ev) => {
  void (async () => {
    try {
      await runtime.handleInspectorCommand((ev as any)?.payload ?? {});
      await sendInspectorData();
    } catch (error) {
      streamDeck.logger.error("Wireless Device Manager Lite inspector command failed", error);
      try { await streamDeck.ui.sendToPropertyInspector({type:"wireless-error",message:error instanceof Error?error.message:String(error)}); } catch {}
    }
  })();
});

streamDeck.connect().then(async () => {
  try {
    await runtime.start();
    await sendInspectorData();
    streamDeck.logger.info("Wireless Device Manager Lite started");
  } catch (error) {
    streamDeck.logger.error("Wireless Device Manager Lite failed to start", error);
  }
});
