import streamDeck from "@elgato/streamdeck";
import { BrightnessAction, DisplayStatusAction, PowerAction, RefreshRateAction } from "./actions.js";
import { runtime } from "./runtime.js";
import { verifiedProMarketplaceUrl } from "./product.js";

streamDeck.logger.setLevel("info");
streamDeck.actions.registerAction(new BrightnessAction());
streamDeck.actions.registerAction(new PowerAction());
streamDeck.actions.registerAction(new RefreshRateAction());
streamDeck.actions.registerAction(new DisplayStatusAction());

async function sendInspectorData(): Promise<void> {
  try {
    const snapshot = await runtime.scan(true);
    await streamDeck.ui.sendToPropertyInspector({
      type: "monitor-data",
      monitors: (snapshot.monitors ?? []).map((m: any) => ({
        monitorKey: m.monitorKey,
        deviceName: m.deviceName,
        description: m.description,
        currentMode: m.currentMode,
        modes: m.modes,
        capabilities: runtime.capabilitySummary(m)
      })),
      proMarketplaceUrl: verifiedProMarketplaceUrl()
    });
  } catch (error) {
    try {
      await streamDeck.ui.sendToPropertyInspector({ type: "monitor-error", message: String(error) });
    } catch {}
  }
}

streamDeck.ui.onDidAppear(() => void sendInspectorData());
streamDeck.ui.onSendToPlugin((ev) => {
  const payload = ev.payload as { type?: string } | undefined;
  if (payload?.type === "refresh-monitors") void sendInspectorData();
});

streamDeck.connect().then(() => void sendInspectorData());
