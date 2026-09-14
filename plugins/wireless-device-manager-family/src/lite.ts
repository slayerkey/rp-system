import streamDeck from "@elgato/streamdeck";
import { LiteDeviceAction } from "./actions.js";
import { diag, diagError, inspectorEventDetails, processDetails } from "./diagnostics.js";
import { WirelessRuntime } from "./runtime.js";

streamDeck.logger.setLevel("info");
const runtime = new WirelessRuntime("lite");
streamDeck.actions.registerAction(new LiteDeviceAction(runtime));

diag("module-loaded", { edition: "lite", ...processDetails });
process.on("uncaughtExceptionMonitor", (error) => diagError("uncaught-exception", error, { edition: "lite" }));
process.on("exit", (code) => diag("process-exit", { edition: "lite", code }));

async function sendInspectorData(reason: string, requestId = ""): Promise<void> {
  const payload = { ...runtime.inspectorPayload(), requestId: requestId || null };
  diag("pi-send-attempt", {
    edition: "lite",
    reason,
    devices: Array.isArray(payload.devices) ? payload.devices.length : 0,
    error: payload.error ?? null,
    refreshCount: payload.diagnostics?.refreshCount ?? 0,
    requestId: requestId || null
  });
  try {
    await streamDeck.ui.sendToPropertyInspector(payload);
    diag("pi-send-complete", { edition: "lite", reason, requestId: requestId || null });
  } catch (error) {
    diagError("pi-send-failed", error, { edition: "lite", reason });
  }
}

streamDeck.ui.onDidAppear((ev) => {
  diag("pi-did-appear", { edition: "lite", ...inspectorEventDetails(ev) });
  void sendInspectorData("did-appear");
});

streamDeck.ui.onSendToPlugin((ev) => {
  diag("pi-command-received", { edition: "lite", ...inspectorEventDetails(ev) });
  void (async () => {
    try {
      const commandPayload = (ev as any)?.payload ?? {};
      await runtime.handleInspectorCommand(commandPayload);
      await sendInspectorData("command", String(commandPayload?.requestId ?? ""));
    } catch (error) {
      diagError("pi-command-failed", error, { edition: "lite", ...inspectorEventDetails(ev) });
      try {
        await streamDeck.ui.sendToPropertyInspector({
          type: "wireless-error",
          message: error instanceof Error ? error.message : String(error)
        });
      } catch (sendError) {
        diagError("pi-error-send-failed", sendError, { edition: "lite" });
      }
    }
  })();
});

streamDeck.connect().then(async () => {
  diag("streamdeck-connected", { edition: "lite" });
  try {
    await runtime.start();
    await sendInspectorData("startup");
    diag("runtime-started", { edition: "lite", ...runtime.diagnostics() });
  } catch (error) {
    diagError("runtime-start-failed", error, { edition: "lite" });
  }
}).catch((error) => {
  diagError("streamdeck-connect-failed", error, { edition: "lite" });
});
