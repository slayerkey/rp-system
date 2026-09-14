import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";

import { applyMode, captureModeSettings, hasConfiguredSettings, modeMatchesSnapshot } from "./modes.js";
import {
  awakeTitle,
  currentModeTitle,
  hdrTitle,
  modeTitle,
  powerTitle,
  resultTitle,
  statusTitle,
  timeoutTitle,
  topologyTitle
} from "./render.js";
import { runtime } from "./runtime.js";
import type { ModeDefinition, SystemSnapshot, TimeoutState, Topology } from "./types.js";

type HdrSettings = { operation?: "toggle" | "on" | "off" };
type PowerSettings = { operation?: "cycle" | "set"; guid?: string };
type TopologySettings = { operation?: "cycle" | "set"; topology?: Exclude<Topology, "unknown"> };
type TimeoutSettings = {
  operation?: "cycle-screen" | "set";
  monitorAcSeconds?: number;
  monitorDcSeconds?: number;
  sleepAcSeconds?: number;
  sleepDcSeconds?: number;
};
type ModeActionSettings = { modeId?: string };
type PageSettings = { profileName?: string; page?: number };

async function freshSnapshot(): Promise<SystemSnapshot | null> {
  await runtime.state.refresh();
  const snapshot = runtime.state.getSnapshot();
  return snapshot.backendOnline ? snapshot : null;
}

abstract class LiveTitleAction<S extends Record<string, any>> extends SingletonAction<S> {
  constructor() {
    super();
    runtime.state.subscribe(() => void this.paintAll());
  }

  protected abstract title(settings: S): Promise<string> | string;

  override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {} as S);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {} as S);
  }

  protected async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      try {
        await this.paint(instance, await instance.getSettings<S>());
      } catch {
        // The key/profile may disappear while an async repaint is in flight.
      }
    }
  }

  protected async paint(key: KeyAction<S>, settings: S): Promise<void> {
    await key.setTitle(await this.title(settings));
  }
}

class StatusBase extends LiveTitleAction<Record<string, never>> {
  protected title(): string { return statusTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (snapshot) await ev.action.showOk();
    else await ev.action.showAlert();
  }
}

class HdrBase extends LiveTitleAction<HdrSettings> {
  protected title(): string { return hdrTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<HdrSettings>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot || !snapshot.hdr.available || snapshot.hdr.supportedCount === 0) return ev.action.showAlert();
    const operation = ev.payload.settings?.operation ?? "toggle";
    if (operation === "toggle" && snapshot.hdr.errors.length > 0) return ev.action.showAlert();

    const currentOn = !snapshot.hdr.mixed && snapshot.hdr.enabledCount === snapshot.hdr.supportedCount;
    const enabled = operation === "on" ? true : operation === "off" ? false : !currentOn;
    const reply = await runtime.state.execute<any>("setHdr", { enabled });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class PowerBase extends LiveTitleAction<PowerSettings> {
  protected title(): string { return powerTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<PowerSettings>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    const settings = ev.payload.settings ?? {};
    let guid = settings.guid;
    if ((settings.operation ?? "cycle") === "cycle") {
      const plans = snapshot.powerPlans;
      if (!plans.length) return ev.action.showAlert();
      const activeGuid = snapshot.powerPlanGuid?.toLowerCase();
      const index = plans.findIndex((plan) =>
        plan.active || (activeGuid && plan.guid.toLowerCase() === activeGuid)
      );
      if (index < 0) return ev.action.showAlert();
      guid = plans[(index + 1) % plans.length]?.guid;
    } else if (!guid) {
      guid = snapshot.powerPlanGuid;
    }
    if (!guid) return ev.action.showAlert();
    const reply = await runtime.state.execute("setPowerPlan", { guid });
    reply.ok ? await ev.action.showOk() : await ev.action.showAlert();
  }
}

class TopologyBase extends LiveTitleAction<TopologySettings> {
  protected title(): string { return topologyTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<TopologySettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    let topology = settings.topology;
    const current = snapshot.topology;
    const values: Array<Exclude<Topology, "unknown">> = ["internal", "clone", "extend", "external"];
    if ((settings.operation ?? "cycle") === "cycle") {
      const index = values.indexOf(current as Exclude<Topology, "unknown">);
      if (index < 0) return ev.action.showAlert();
      topology = values[(index + 1) % values.length];
    } else if (!topology && values.includes(current as Exclude<Topology, "unknown">)) {
      topology = current as Exclude<Topology, "unknown">;
    }
    if (!topology) return ev.action.showAlert();
    const reply = await runtime.state.execute<any>("setTopology", { topology });
    if (!reply.ok || reply.result?.status === "FAILED") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class TimeoutBase extends LiveTitleAction<TimeoutSettings> {
  protected title(): string { return timeoutTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<TimeoutSettings>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot?.timeout) return ev.action.showAlert();
    const settings = ev.payload.settings ?? {};
    let target: TimeoutState;

    if ((settings.operation ?? "cycle-screen") === "cycle-screen") {
      const sequence = [300, 900, 1800, 3600, 0];
      const current = snapshot.timeout.monitorAcSeconds;
      const index = sequence.indexOf(current);
      const next = sequence[(index + 1 + sequence.length) % sequence.length];
      target = { ...snapshot.timeout, monitorAcSeconds: next, monitorDcSeconds: next };
    } else {
      target = {
        monitorAcSeconds: safeSeconds(settings.monitorAcSeconds, snapshot.timeout.monitorAcSeconds),
        monitorDcSeconds: safeSeconds(settings.monitorDcSeconds, snapshot.timeout.monitorDcSeconds),
        sleepAcSeconds: safeSeconds(settings.sleepAcSeconds, snapshot.timeout.sleepAcSeconds),
        sleepDcSeconds: safeSeconds(settings.sleepDcSeconds, snapshot.timeout.sleepDcSeconds)
      };
    }

    const reply = await runtime.state.execute<any>("setTimeout", target as any);
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class AwakeBase extends LiveTitleAction<Record<string, never>> {
  protected title(): string { return awakeTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    const enabled = !snapshot.keepAwake;
    const reply = await runtime.state.execute<any>("setKeepAwake", { enabled });
    if (!reply.ok || reply.result?.status === "FAILED") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class LockBase extends SingletonAction<Record<string, never>> {
  override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
    if (ev.action.isKey()) await ev.action.setTitle("LOCK\nPC");
  }
  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const reply = await runtime.state.execute("lock", {});
    if (!reply.ok) await ev.action.showAlert();
  }
}

class ApplyModeBase extends LiveTitleAction<ModeActionSettings> {
  protected async title(settings: ModeActionSettings): Promise<string> {
    const mode = await runtime.store.getMode(settings.modeId || "gaming");
    return !mode || !hasConfiguredSettings(mode)
      ? `SETUP\n${modeTitle(mode)}`
      : modeTitle(mode);
  }

  override async onKeyDown(ev: KeyDownEvent<ModeActionSettings>): Promise<void> {
    const mode = await runtime.store.getMode(ev.payload.settings?.modeId || "gaming");
    if (!mode || !hasConfiguredSettings(mode)) {
      await ev.action.showAlert();
      return;
    }

    const result = await applyMode(mode, (op, args) => runtime.state.execute(op, args));
    await ev.action.setTitle(resultTitle(result));
    if (result.status === "COMPLETE") await ev.action.showOk();
    else await ev.action.showAlert();
    setTimeout(() => {
      void this.paint(ev.action, ev.payload.settings ?? {}).catch(() => {
        // The key/profile may have disappeared before the delayed repaint.
      });
    }, 1400).unref();
  }
}

class CycleModeBase extends LiveTitleAction<Record<string, never>> {
  private cursorId = "";
  private advancePastFailedAttempt = false;

  protected async title(): Promise<string> {
    const all = await runtime.store.load();
    return currentModeTitle(all.modes, runtime.state.getSnapshot(), modeMatchesSnapshot);
  }

  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const all = await runtime.store.load();
    const available = all.modes.filter(hasConfiguredSettings);
    if (!available.length) return ev.action.showAlert();

    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    const matching = available.find((mode) => modeMatchesSnapshot(mode, snapshot));
    const baseId = this.advancePastFailedAttempt && this.cursorId
      ? this.cursorId
      : (matching?.id || this.cursorId);
    const index = Math.max(-1, available.findIndex((mode) => mode.id === baseId));
    const mode = available[(index + 1) % available.length];
    const result = await applyMode(mode, (op, args) => runtime.state.execute(op, args));

    this.cursorId = mode.id;
    this.advancePastFailedAttempt = result.status !== "COMPLETE";
    if (result.status === "COMPLETE") await ev.action.showOk();
    else await ev.action.showAlert();
  }
}

class CurrentModeBase extends LiveTitleAction<Record<string, never>> {
  protected async title(): Promise<string> {
    const all = await runtime.store.load();
    return currentModeTitle(all.modes, runtime.state.getSnapshot(), modeMatchesSnapshot);
  }
}

class SaveModeBase extends LiveTitleAction<ModeActionSettings> {
  protected async title(settings: ModeActionSettings): Promise<string> {
    const mode = await runtime.store.getMode(settings.modeId || "gaming");
    return `SAVE\n${modeTitle(mode)}`;
  }

  override async onKeyDown(ev: KeyDownEvent<ModeActionSettings>): Promise<void> {
    const id = ev.payload.settings?.modeId || "gaming";
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    const mode = await runtime.store.getMode(id);
    await runtime.store.updateMode(id, {
      name: mode?.name || id.toUpperCase(),
      settings: captureModeSettings(snapshot)
    });
    await ev.action.showOk();
  }
}

class ProfilePageBase extends SingletonAction<PageSettings> {
  override async onWillAppear(ev: WillAppearEvent<PageSettings>): Promise<void> {
    if (ev.action.isKey()) {
      const page = Number(ev.payload.settings?.page ?? 0);
      await ev.action.setTitle(page === 0 ? "MODES" : "SETTINGS");
    }
  }

  override async onKeyDown(ev: KeyDownEvent<PageSettings>): Promise<void> {
    const profileName = String(ev.payload.settings?.profileName || "");
    const page = Number(ev.payload.settings?.page ?? 0);
    if (!profileName || !ev.action.device?.id) return ev.action.showAlert();
    try {
      await (streamDeck.profiles as any).switchToProfile(ev.action.device.id, profileName, page);
    } catch {
      await ev.action.showAlert();
    }
  }
}

function safeSeconds(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 0xffffffff ? number : fallback;
}

// Lite action UUIDs.
@action({ UUID: "com.packrat.windows-settings-manager-lite.status" })
export class LiteStatusAction extends StatusBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite.hdr" })
export class LiteHdrAction extends HdrBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite.power" })
export class LitePowerAction extends PowerBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite.display" })
export class LiteDisplayAction extends TopologyBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite.timeout" })
export class LiteTimeoutAction extends TimeoutBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite.awake" })
export class LiteAwakeAction extends AwakeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite.lock" })
export class LiteLockAction extends LockBase {}

// Pro individual controls.
@action({ UUID: "com.packrat.windows-settings-manager-pro.status" })
export class ProStatusAction extends StatusBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.hdr" })
export class ProHdrAction extends HdrBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.power" })
export class ProPowerAction extends PowerBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.display" })
export class ProDisplayAction extends TopologyBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.timeout" })
export class ProTimeoutAction extends TimeoutBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.awake" })
export class ProAwakeAction extends AwakeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.lock" })
export class ProLockAction extends LockBase {}

// Pro mode layer.
@action({ UUID: "com.packrat.windows-settings-manager-pro.apply-mode" })
export class ProApplyModeAction extends ApplyModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.cycle-mode" })
export class ProCycleModeAction extends CycleModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.current-mode" })
export class ProCurrentModeAction extends CurrentModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.save-mode" })
export class ProSaveModeAction extends SaveModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro.profile-page" })
export class ProProfilePageAction extends ProfilePageBase {}
