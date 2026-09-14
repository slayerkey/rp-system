import streamDeck, {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";

import { applyMode, captureModeSettings, hasConfiguredSettings, modeMatchesSnapshot } from "./modes.js";
import { renderKeyImage, type KeyVisualKind, type KeyVisualTone } from "./key-visuals.js";
import {
  awakeTitle,
  bluetoothTitle,
  currentModeTitle,
  desktopTitle,
  hdrTitle,
  modeTitle,
  powerTitle,
  resultTitle,
  statusTitle,
  themeTitle,
  timeoutTitle,
  topologyTitle,
  wifiTitle
} from "./render.js";
import { runtime } from "./runtime.js";
import type { ModeDefinition, SystemSnapshot, TimeoutState, Topology } from "./types.js";

type ToggleSettings = { operation?: "toggle" | "on" | "off" };
type HdrSettings = ToggleSettings;
type PowerSettings = { operation?: "cycle" | "set"; guid?: string };
type TopologySettings = { operation?: "cycle" | "set"; topology?: Exclude<Topology, "unknown"> };
type TimeoutSettings = {
  operation?: "cycle-screen" | "set";
  monitorAcSeconds?: number;
  monitorDcSeconds?: number;
  sleepAcSeconds?: number;
  sleepDcSeconds?: number;
};
type ThemeSettings = ToggleSettings & { scope?: "both" | "apps" | "system" };
type ConfirmSettings = { confirmation?: "double" | "none" };
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

  protected abstract readonly visual: KeyVisualKind;
  protected readonly tone: KeyVisualTone = "brand";
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
    await key.setImage(renderKeyImage(this.visual, await this.title(settings), this.tone));
  }
}

class StatusBase extends LiveTitleAction<Record<string, never>> {
  protected readonly visual = "status" as const;
  protected title(): string { return statusTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (snapshot) await ev.action.showOk();
    else await ev.action.showAlert();
  }
}

class HdrBase extends LiveTitleAction<HdrSettings> {
  protected readonly visual = "hdr" as const;
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
  protected readonly visual = "power" as const;
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
    const reply = await runtime.state.execute<any>("setPowerPlan", { guid });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class TopologyBase extends LiveTitleAction<TopologySettings> {
  protected readonly visual = "display" as const;
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
  protected readonly visual = "timeout" as const;
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

class AwakeBase extends LiveTitleAction<ToggleSettings> {
  protected readonly visual = "awake" as const;
  protected title(): string { return awakeTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    const operation = ev.payload.settings?.operation ?? "toggle";
    const enabled = operation === "on" ? true : operation === "off" ? false : !snapshot.keepAwake;
    const reply = await runtime.state.execute<any>("setKeepAwake", { enabled });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

abstract class RadioBase extends LiveTitleAction<ToggleSettings> {
  protected abstract readonly radioKind: "wifi" | "bluetooth";
  protected abstract readonly backendKind: "WiFi" | "Bluetooth";
  protected abstract override readonly visual: KeyVisualKind;

  protected title(): string {
    const snapshot = runtime.state.getSnapshot();
    return this.radioKind === "wifi" ? wifiTitle(snapshot) : bluetoothTitle(snapshot);
  }

  override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    const radio = snapshot[this.radioKind];
    if (!radio.available || radio.state === "disabled") return ev.action.showAlert();

    const operation = ev.payload.settings?.operation ?? "toggle";
    let enabled: boolean;
    if (operation === "on") enabled = true;
    else if (operation === "off") enabled = false;
    else if (radio.state === "on") enabled = false;
    else if (radio.state === "off") enabled = true;
    else return ev.action.showAlert();

    const reply = await runtime.state.execute<any>("setRadio", { kind: this.backendKind, enabled });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class WifiBase extends RadioBase {
  protected readonly radioKind = "wifi" as const;
  protected readonly backendKind = "WiFi" as const;
  protected readonly visual = "wifi" as const;
}

class BluetoothBase extends RadioBase {
  protected readonly radioKind = "bluetooth" as const;
  protected readonly backendKind = "Bluetooth" as const;
  protected readonly visual = "bluetooth" as const;
}

class ThemeBase extends LiveTitleAction<ThemeSettings> {
  protected readonly visual = "theme" as const;
  protected title(): string { return themeTitle(runtime.state.getSnapshot()); }

  override async onKeyDown(ev: KeyDownEvent<ThemeSettings>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot?.theme.available) return ev.action.showAlert();

    const settings = ev.payload.settings ?? {};
    const operation = settings.operation ?? "toggle";
    const scope = settings.scope ?? "both";
    const current = scope === "apps"
      ? snapshot.theme.apps
      : scope === "system"
        ? snapshot.theme.system
        : snapshot.theme.combined;

    let theme: "light" | "dark";
    if (operation === "on") theme = "dark";
    else if (operation === "off") theme = "light";
    else if (current === "dark") theme = "light";
    else if (current === "light") theme = "dark";
    else return ev.action.showAlert();

    const reply = await runtime.state.execute<any>("setTheme", { theme, scope });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class LockBase extends SingletonAction<Record<string, never>> {
  override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
    if (ev.action.isKey()) await ev.action.setImage(renderKeyImage("lock", "LOCK\nPC"));
  }
  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const reply = await runtime.state.execute<any>("lock", {});
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
  }
}

abstract class ImmediatePowerBase extends SingletonAction<Record<string, never>> {
  protected abstract readonly command: "sleep" | "hibernate";
  protected abstract readonly visual: KeyVisualKind;
  protected abstract title(snapshot: SystemSnapshot): string;

  override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
    if (ev.action.isKey()) await ev.action.setImage(renderKeyImage(this.visual, this.title(runtime.state.getSnapshot())));
  }

  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot) return ev.action.showAlert();
    if (this.command === "hibernate" && !snapshot.hibernateAvailable) return ev.action.showAlert();
    const reply = await runtime.state.execute<any>("powerTransition", { command: this.command });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
  }
}

class SleepBase extends ImmediatePowerBase {
  protected readonly command = "sleep" as const;
  protected readonly visual = "sleep" as const;
  protected title(): string { return "SLEEP\nPC"; }
}

class HibernateBase extends ImmediatePowerBase {
  protected readonly command = "hibernate" as const;
  protected readonly visual = "hibernate" as const;
  protected title(snapshot: SystemSnapshot): string {
    if (!snapshot.backendOnline) return "HIBER\nOFFLINE";
    return snapshot.hibernateAvailable ? "HIBERNATE" : "HIBER\nN/A";
  }
}

abstract class ConfirmedPowerBase extends SingletonAction<ConfirmSettings> {
  protected abstract readonly command: "restart" | "shutdown";
  protected abstract readonly baseTitle: string;
  protected abstract readonly visual: KeyVisualKind;
  private armed = new WeakMap<object, NodeJS.Timeout>();

  override async onWillAppear(ev: WillAppearEvent<ConfirmSettings>): Promise<void> {
    if (ev.action.isKey()) await ev.action.setImage(renderKeyImage(this.visual, this.baseTitle, "danger"));
  }

  override async onKeyDown(ev: KeyDownEvent<ConfirmSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    const actionKey = ev.action as unknown as object;
    if ((settings.confirmation ?? "double") !== "none") {
      const existing = this.armed.get(actionKey);
      if (!existing) {
        await ev.action.setImage(renderKeyImage(this.visual, "PRESS\nAGAIN", "danger"));
        const timer = setTimeout(() => {
          this.armed.delete(actionKey);
          void ev.action.setImage(renderKeyImage(this.visual, this.baseTitle, "danger")).catch(() => {});
        }, 3000);
        timer.unref();
        this.armed.set(actionKey, timer);
        return;
      }
      clearTimeout(existing);
      this.armed.delete(actionKey);
    }

    const reply = await runtime.state.execute<any>("powerTransition", { command: this.command });
    if (!reply.ok || reply.result?.status !== "COMPLETE") {
      await ev.action.setImage(renderKeyImage(this.visual, this.baseTitle, "danger"));
      await ev.action.showAlert();
    }
  }
}

class RestartBase extends ConfirmedPowerBase {
  protected readonly command = "restart" as const;
  protected readonly baseTitle = "RESTART";
  protected readonly visual = "restart" as const;
}

class ShutdownBase extends ConfirmedPowerBase {
  protected readonly command = "shutdown" as const;
  protected readonly baseTitle = "SHUTDOWN";
  protected readonly visual = "shutdown" as const;
}

abstract class DesktopCommandBase extends SingletonAction<Record<string, never>> {
  protected abstract readonly command: "previous" | "next" | "new" | "close";
  protected abstract readonly baseTitle: string;
  protected abstract readonly visual: KeyVisualKind;
  protected readonly tone: KeyVisualTone = "brand";

  override async onWillAppear(ev: WillAppearEvent<Record<string, never>>): Promise<void> {
    if (ev.action.isKey()) await ev.action.setImage(renderKeyImage(this.visual, this.baseTitle, this.tone));
  }

  override async onKeyDown(ev: KeyDownEvent<Record<string, never>>): Promise<void> {
    const snapshot = await freshSnapshot();
    if (!snapshot?.virtualDesktop.available) return ev.action.showAlert();
    const reply = await runtime.state.execute<any>("virtualDesktop", { command: this.command });
    if (!reply.ok || reply.result?.status !== "COMPLETE") await ev.action.showAlert();
    else await ev.action.showOk();
  }
}

class DesktopPreviousBase extends DesktopCommandBase {
  protected readonly command = "previous" as const;
  protected readonly baseTitle = "DESK\nPREV";
  protected readonly visual = "desktop-previous" as const;
}
class DesktopNextBase extends DesktopCommandBase {
  protected readonly command = "next" as const;
  protected readonly baseTitle = "DESK\nNEXT";
  protected readonly visual = "desktop-next" as const;
}
class DesktopNewBase extends DesktopCommandBase {
  protected readonly command = "new" as const;
  protected readonly baseTitle = "DESK\nNEW";
  protected readonly visual = "desktop-new" as const;
}
class DesktopCloseBase extends DesktopCommandBase {
  protected readonly command = "close" as const;
  protected readonly baseTitle = "DESK\nCLOSE";
  protected readonly visual = "desktop-close" as const;
  protected override readonly tone = "danger" as const;
}
class DesktopCurrentBase extends LiveTitleAction<Record<string, never>> {
  protected readonly visual = "desktop-current" as const;
  protected title(): string { return desktopTitle(runtime.state.getSnapshot()); }
}

class ApplyModeBase extends LiveTitleAction<ModeActionSettings> {
  protected readonly visual = "mode" as const;
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
    await ev.action.setImage(renderKeyImage("mode", resultTitle(result), result.status === "FAILED" ? "danger" : "brand"));
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
  protected readonly visual = "mode" as const;
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
  protected readonly visual = "mode" as const;
  protected async title(): Promise<string> {
    const all = await runtime.store.load();
    return currentModeTitle(all.modes, runtime.state.getSnapshot(), modeMatchesSnapshot);
  }
}

class SaveModeBase extends LiveTitleAction<ModeActionSettings> {
  protected readonly visual = "save" as const;
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
      await ev.action.setImage(renderKeyImage("profile", page === 0 ? "CONTROL" : "ADVANCED"));
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

// Lite: a useful free slice of the same Windows Control Center.
@action({ UUID: "com.packrat.windows-settings-manager-lite2.lock" })
export class LiteLockAction extends LockBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite2.sleep" })
export class LiteSleepAction extends SleepBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite2.power" })
export class LitePowerAction extends PowerBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite2.awake" })
export class LiteAwakeAction extends AwakeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite2.desktop-previous" })
export class LiteDesktopPreviousAction extends DesktopPreviousBase {}
@action({ UUID: "com.packrat.windows-settings-manager-lite2.desktop-next" })
export class LiteDesktopNextAction extends DesktopNextBase {}

// Pro core 15-key control center.
@action({ UUID: "com.packrat.windows-settings-manager-pro2.lock" })
export class ProLockAction extends LockBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.sleep" })
export class ProSleepAction extends SleepBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.hibernate" })
export class ProHibernateAction extends HibernateBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.restart" })
export class ProRestartAction extends RestartBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.shutdown" })
export class ProShutdownAction extends ShutdownBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.wifi" })
export class ProWifiAction extends WifiBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.bluetooth" })
export class ProBluetoothAction extends BluetoothBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.power" })
export class ProPowerAction extends PowerBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.awake" })
export class ProAwakeAction extends AwakeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.theme" })
export class ProThemeAction extends ThemeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.desktop-previous" })
export class ProDesktopPreviousAction extends DesktopPreviousBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.desktop-next" })
export class ProDesktopNextAction extends DesktopNextBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.desktop-new" })
export class ProDesktopNewAction extends DesktopNewBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.desktop-close" })
export class ProDesktopCloseAction extends DesktopCloseBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.desktop-current" })
export class ProDesktopCurrentAction extends DesktopCurrentBase {}

// Existing advanced controls remain available without owning the default profile.
@action({ UUID: "com.packrat.windows-settings-manager-pro2.status" })
export class ProStatusAction extends StatusBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.hdr" })
export class ProHdrAction extends HdrBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.display" })
export class ProDisplayAction extends TopologyBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.timeout" })
export class ProTimeoutAction extends TimeoutBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.apply-mode" })
export class ProApplyModeAction extends ApplyModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.cycle-mode" })
export class ProCycleModeAction extends CycleModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.current-mode" })
export class ProCurrentModeAction extends CurrentModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.save-mode" })
export class ProSaveModeAction extends SaveModeBase {}
@action({ UUID: "com.packrat.windows-settings-manager-pro2.profile-page" })
export class ProProfilePageAction extends ProfilePageBase {}
