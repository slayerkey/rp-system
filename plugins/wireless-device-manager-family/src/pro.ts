import streamDeck from "@elgato/streamdeck";
import { CycleDeviceAction, DashboardAction, ProDeviceAction } from "./actions.js";
import { WirelessRuntime } from "./runtime.js";

streamDeck.logger.setLevel("info");
const runtime = new WirelessRuntime("pro");
streamDeck.actions.registerAction(new ProDeviceAction(runtime));
streamDeck.actions.registerAction(new DashboardAction(runtime));
streamDeck.actions.registerAction(new CycleDeviceAction(runtime));

async function sendInspectorData(): Promise<void> {
  try {
    await streamDeck.ui.sendToPropertyInspector(runtime.inspectorPayload());
  } catch (error) {
    streamDeck.logger.error("Wireless Device Manager Pro inspector update failed", error);
  }
}
streamDeck.ui.onDidAppear(() => void sendInspectorData());
streamDeck.ui.onSendToPlugin((ev) => {
  void (async () => {
    try {
      await runtime.handleInspectorCommand((ev as any)?.payload ?? {});
      await sendInspectorData();
    } catch (error) {
      streamDeck.logger.error("Wireless Device Manager Pro inspector command failed", error);
      try { await streamDeck.ui.sendToPropertyInspector({type:"wireless-error",message:error instanceof Error?error.message:String(error)}); } catch {}
    }
  })();
});

streamDeck.connect().then(async () => {
  try {
    await runtime.start();
    await sendInspectorData();
    streamDeck.logger.info("Wireless Device Manager Pro started");
  } catch (error) {
    streamDeck.logger.error("Wireless Device Manager Pro failed to start", error);
  }
});
