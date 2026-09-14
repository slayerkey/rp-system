import streamDeck from "@elgato/streamdeck";
import { CycleDeviceAction, DashboardAction, ProDeviceAction } from "./actions.js";
import { diag, diagError, inspectorEventDetails, processDetails } from "./diagnostics.js";
import { WirelessRuntime } from "./runtime.js";

streamDeck.logger.setLevel("info");
const runtime = new WirelessRuntime("pro");
streamDeck.actions.registerAction(new ProDeviceAction(runtime));
streamDeck.actions.registerAction(new DashboardAction(runtime));
streamDeck.actions.registerAction(new CycleDeviceAction(runtime));

diag("module-loaded", { edition: "pro", ...processDetails });
process.on("uncaughtExceptionMonitor", (error) => diagError("uncaught-exception", error, { edition: "pro" }));
process.on("exit", (code) => diag("process-exit", { edition: "pro", code }));

async function sendInspectorData(reason: string): Promise<void> {
  const payload = runtime.inspectorPayload();
  diag("pi-send-attempt", {
    edition: "pro",
    reason,
    devices: Array.isArray(payload.devices) ? payload.devices.length : 0,
    error: payload.error ?? null,
    refreshCount: payload.diagnostics?.refreshCount ?? 0
  });
  try {
    await streamDeck.ui.sendToPropertyInspector(payload);
    diag("pi-send-complete", { edition: "pro", reason });
  } catch (error) {
    diagError("pi-send-failed", error, { edition: "pro", reason });
  }
}

streamDeck.ui.onDidAppear((ev) => {
  diag("pi-did-appear", { edition: "pro", ...inspectorEventDetails(ev) });
  void sendInspectorData("did-appear");
});

streamDeck.ui.onSendToPlugin((ev) => {
  diag("pi-command-received", { edition: "pro", ...inspectorEventDetails(ev) });
  void (async () => {
    try {
      await runtime.handleInspectorCommand((ev as any)?.payload ?? {});
      await sendInspectorData("command");
    } catch (error) {
      diagError("pi-command-failed", error, { edition: "pro", ...inspectorEventDetails(ev) });
      try {
        await streamDeck.ui.sendToPropertyInspector({
          type: "wireless-error",
          message: error instanceof Error ? error.message : String(error)
        });
      } catch (sendError) {
        diagError("pi-error-send-failed", sendError, { edition: "pro" });
      }
    }
  })();
});

streamDeck.connect().then(async () => {
  diag("streamdeck-connected", { edition: "pro" });
  try {
    await runtime.start();
    await sendInspectorData("startup");
    diag("runtime-started", { edition: "pro", ...runtime.diagnostics() });
  } catch (error) {
    diagError("runtime-start-failed", error, { edition: "pro" });
  }
}).catch((error) => {
  diagError("streamdeck-connect-failed", error, { edition: "pro" });
});
