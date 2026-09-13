import streamDeck from "@elgato/streamdeck";

import {
  LiteAwakeAction,
  LiteDisplayAction,
  LiteHdrAction,
  LiteLockAction,
  LitePowerAction,
  LiteStatusAction,
  LiteTimeoutAction,
  ProApplyModeAction,
  ProAwakeAction,
  ProCurrentModeAction,
  ProCycleModeAction,
  ProDisplayAction,
  ProHdrAction,
  ProLockAction,
  ProPowerAction,
  ProProfilePageAction,
  ProSaveModeAction,
  ProStatusAction,
  ProTimeoutAction
} from "./actions.js";
import { modeMatchesSnapshot } from "./modes.js";
import { configureRuntime, runtime } from "./runtime.js";
import type { Flavor } from "./types.js";

export async function startPlugin(flavor: Flavor): Promise<void> {
  configureRuntime(flavor);
  streamDeck.logger.setLevel("info");

  if (flavor === "lite") {
    streamDeck.actions.registerAction(new LiteStatusAction());
    streamDeck.actions.registerAction(new LiteHdrAction());
    streamDeck.actions.registerAction(new LitePowerAction());
    streamDeck.actions.registerAction(new LiteDisplayAction());
    streamDeck.actions.registerAction(new LiteTimeoutAction());
    streamDeck.actions.registerAction(new LiteAwakeAction());
    streamDeck.actions.registerAction(new LiteLockAction());
  } else {
    streamDeck.actions.registerAction(new ProStatusAction());
    streamDeck.actions.registerAction(new ProHdrAction());
    streamDeck.actions.registerAction(new ProPowerAction());
    streamDeck.actions.registerAction(new ProDisplayAction());
    streamDeck.actions.registerAction(new ProTimeoutAction());
    streamDeck.actions.registerAction(new ProAwakeAction());
    streamDeck.actions.registerAction(new ProLockAction());
    streamDeck.actions.registerAction(new ProApplyModeAction());
    streamDeck.actions.registerAction(new ProCycleModeAction());
    streamDeck.actions.registerAction(new ProCurrentModeAction());
    streamDeck.actions.registerAction(new ProSaveModeAction());
    streamDeck.actions.registerAction(new ProProfilePageAction());
  }

  streamDeck.ui.onDidAppear(() => void sendInspectorContext());
  streamDeck.ui.onSendToPlugin((ev) => {
    const payload = ev.payload as any;
    if (payload?.type === "get-context") void sendInspectorContext();
    if (payload?.type === "refresh") void runtime.state.refresh().then(sendInspectorContext);
    if (payload?.type === "save-mode" && flavor === "pro") {
      void runtime.store.updateMode(String(payload.id || "gaming"), {
        name: payload.name,
        settings: payload.settings
      }).then(sendInspectorContext);
    }
    if (payload?.type === "capture-mode" && flavor === "pro") {
      const id = String(payload.id || "gaming");
      void import("./modes.js").then(async ({ captureModeSettings }) => {
        const existing = await runtime.store.getMode(id);
        await runtime.store.updateMode(id, {
          name: existing?.name || id.toUpperCase(),
          settings: captureModeSettings(runtime.state.getSnapshot())
        });
        await sendInspectorContext();
      });
    }
  });
  runtime.state.subscribe(() => void sendInspectorContext());
  streamDeck.system.onSystemDidWakeUp(() => void runtime.state.refresh());

  await streamDeck.connect();
  try {
    await runtime.state.start();
    streamDeck.logger.info(`Windows Settings Manager ${flavor} runtime started`);
    await sendInspectorContext();
  } catch (error) {
    streamDeck.logger.error("Windows Settings Manager runtime failed to start", error);
  }
}

async function sendInspectorContext(): Promise<void> {
  try {
    const global = await runtime.store.load();
    const snapshot = runtime.state.getSnapshot();
    await streamDeck.ui.sendToPropertyInspector({
      type: "context",
      flavor: runtime.flavor,
      snapshot,
      modes: global.modes,
      matchingModeIds: global.modes.filter((mode) => modeMatchesSnapshot(mode, snapshot)).map((mode) => mode.id)
    } as any);
  } catch {
    // No inspector is currently open.
  }
}
