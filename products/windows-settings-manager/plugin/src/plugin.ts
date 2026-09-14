import streamDeck from "@elgato/streamdeck";

import {
  LiteAwakeAction,
  LiteDesktopNextAction,
  LiteDesktopPreviousAction,
  LiteLockAction,
  LitePowerAction,
  LiteSleepAction,
  ProApplyModeAction,
  ProAwakeAction,
  ProBluetoothAction,
  ProCurrentModeAction,
  ProCycleModeAction,
  ProDesktopCloseAction,
  ProDesktopCurrentAction,
  ProDesktopNewAction,
  ProDesktopNextAction,
  ProDesktopPreviousAction,
  ProDisplayAction,
  ProHdrAction,
  ProHibernateAction,
  ProLockAction,
  ProPowerAction,
  ProProfilePageAction,
  ProRestartAction,
  ProSaveModeAction,
  ProShutdownAction,
  ProSleepAction,
  ProStatusAction,
  ProThemeAction,
  ProTimeoutAction,
  ProWifiAction
} from "./actions.js";
import { modeMatchesSnapshot } from "./modes.js";
import { configureRuntime, runtime } from "./runtime.js";
import type { Flavor } from "./types.js";

export async function startPlugin(flavor: Flavor): Promise<void> {
  configureRuntime(flavor);
  streamDeck.logger.setLevel("info");

  if (flavor === "lite") {
    streamDeck.actions.registerAction(new LiteLockAction());
    streamDeck.actions.registerAction(new LiteSleepAction());
    streamDeck.actions.registerAction(new LitePowerAction());
    streamDeck.actions.registerAction(new LiteAwakeAction());
    streamDeck.actions.registerAction(new LiteDesktopPreviousAction());
    streamDeck.actions.registerAction(new LiteDesktopNextAction());
  } else {
    streamDeck.actions.registerAction(new ProLockAction());
    streamDeck.actions.registerAction(new ProSleepAction());
    streamDeck.actions.registerAction(new ProHibernateAction());
    streamDeck.actions.registerAction(new ProRestartAction());
    streamDeck.actions.registerAction(new ProShutdownAction());

    streamDeck.actions.registerAction(new ProWifiAction());
    streamDeck.actions.registerAction(new ProBluetoothAction());
    streamDeck.actions.registerAction(new ProPowerAction());
    streamDeck.actions.registerAction(new ProAwakeAction());
    streamDeck.actions.registerAction(new ProThemeAction());

    streamDeck.actions.registerAction(new ProDesktopPreviousAction());
    streamDeck.actions.registerAction(new ProDesktopNextAction());
    streamDeck.actions.registerAction(new ProDesktopNewAction());
    streamDeck.actions.registerAction(new ProDesktopCloseAction());
    streamDeck.actions.registerAction(new ProDesktopCurrentAction());

    // Advanced controls remain available but do not own the default profile.
    streamDeck.actions.registerAction(new ProStatusAction());
    streamDeck.actions.registerAction(new ProHdrAction());
    streamDeck.actions.registerAction(new ProDisplayAction());
    streamDeck.actions.registerAction(new ProTimeoutAction());
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
        await runtime.state.refresh();
        const snapshot = runtime.state.getSnapshot();
        if (!snapshot.backendOnline) {
          await sendInspectorContext();
          return;
        }
        const existing = await runtime.store.getMode(id);
        await runtime.store.updateMode(id, {
          name: existing?.name || id.toUpperCase(),
          settings: captureModeSettings(snapshot)
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
