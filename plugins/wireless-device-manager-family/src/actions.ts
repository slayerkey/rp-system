import {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { batteryLabel, controlLabel, groupSummary, nextFavorite, shouldLowBatteryAlert, statusLabel } from "./model.js";
import type { WirelessRuntime } from "./runtime.js";

export type DeviceSettings = {
  deviceId?: string;
  view?: "status" | "battery" | "control";
  label?: string;
  lowBatteryThreshold?: number;
  favorite?: boolean;
  groupName?: string;
};

export type DashboardSettings = {
  groupName?: string;
};

export type CycleSettings = {
  currentId?: string;
};

async function paintDevice(key: KeyAction<DeviceSettings>, runtime: WirelessRuntime, settings: DeviceSettings) {
  const device = runtime.device(settings.deviceId);
  if (!runtime.adapterAvailable) {
    await key.setTitle("BLUETOOTH\nOFF");
    return;
  }
  const view = settings.view ?? "status";
  const base = view === "battery" ? batteryLabel(device) : view === "control" ? controlLabel(device) : statusLabel(device);
  const label = settings.label?.trim();
  await key.setTitle(label ? `${label.toUpperCase()}\n${base.split("\n").slice(-1)[0]}` : base);
}

abstract class DeviceActionBase extends SingletonAction<DeviceSettings> {
  private lowState = new WeakMap<object, boolean>();
  constructor(protected readonly runtime: WirelessRuntime, private readonly alerts: boolean) {
    super();
    runtime.subscribe(() => void this.paintAll());
  }

  override async onWillAppear(ev: WillAppearEvent<DeviceSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DeviceSettings>): Promise<void> {
    if (!ev.action.isKey()) return;
    const settings = ev.payload.settings ?? {};
    if (this.runtime.edition === "pro" && settings.deviceId) {
      await this.runtime.setFavorite(settings.deviceId, settings.favorite === true);
      await this.runtime.assignGroup(settings.groupName ?? "", settings.deviceId);
    }
    await this.paint(ev.action, settings);
  }

  override async onKeyDown(ev: KeyDownEvent<DeviceSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    const device = this.runtime.device(settings.deviceId);
    if (!device || (settings.view ?? "status") !== "control") {
      await this.runtime.refresh();
      return;
    }
    const operation = device.connected ? "disconnect" : "connect";
    const result = await this.runtime.perform(device.stableId, operation);
    if (result.ok) await ev.action.showOk();
    else await ev.action.showAlert();
  }

  private async paint(key: KeyAction<DeviceSettings>, settings: DeviceSettings): Promise<void> {
    await paintDevice(key, this.runtime, settings);
    if (!this.alerts) return;
    const device = this.runtime.device(settings.deviceId);
    if (!device) return;
    const threshold = Math.max(1, Math.min(99, Number(settings.lowBatteryThreshold ?? 20)));
    const before = this.lowState.get(key as object) ?? false;
    const state = shouldLowBatteryAlert(device, threshold, before);
    this.lowState.set(key as object, state.low);
    if (state.fire) await key.showAlert();
  }

  private async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      await this.paint(instance, await instance.getSettings<DeviceSettings>());
    }
  }
}

@action({ UUID: "com.packrat.wireless-device-manager.device" })
export class LiteDeviceAction extends DeviceActionBase {
  constructor(runtime: WirelessRuntime) { super(runtime, false); }
}

@action({ UUID: "com.packrat.wireless-device-manager-pro.device" })
export class ProDeviceAction extends DeviceActionBase {
  constructor(runtime: WirelessRuntime) { super(runtime, true); }
}

@action({ UUID: "com.packrat.wireless-device-manager-pro.dashboard" })
export class DashboardAction extends SingletonAction<DashboardSettings> {
  constructor(private readonly runtime: WirelessRuntime) {
    super();
    runtime.subscribe(() => void this.paintAll());
  }

  override async onWillAppear(ev: WillAppearEvent<DashboardSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DashboardSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  override async onKeyDown(): Promise<void> { await this.runtime.refresh(); }

  private async paint(key: KeyAction<DashboardSettings>, settings: DashboardSettings): Promise<void> {
    if (!this.runtime.adapterAvailable) {
      await key.setTitle("ALL DEVICES\nBT OFF");
      return;
    }
    const devices = this.runtime.devices();
    const members = settings.groupName ? await this.runtime.groupMembers(settings.groupName) : devices.map(d => d.stableId);
    const summary = groupSummary(devices, members);
    const prefix = settings.groupName?.trim().toUpperCase() || "ALL DEVICES";
    await key.setTitle(`${prefix}\n${summary.connected}/${summary.total} ON${summary.low ? ` • ${summary.low} LOW` : ""}`);
  }

  private async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      await this.paint(instance, await instance.getSettings<DashboardSettings>());
    }
  }
}

@action({ UUID: "com.packrat.wireless-device-manager-pro.cycle" })
export class CycleDeviceAction extends SingletonAction<CycleSettings> {
  constructor(private readonly runtime: WirelessRuntime) {
    super();
    runtime.subscribe(() => void this.paintAll());
  }

  override async onWillAppear(ev: WillAppearEvent<CycleSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  override async onKeyDown(ev: KeyDownEvent<CycleSettings>): Promise<void> {
    const favorites = await this.runtime.favorites();
    const next = nextFavorite(this.runtime.devices(), favorites, ev.payload.settings?.currentId);
    if (!next) {
      await ev.action.setTitle("CYCLE\nNO FAVORITES");
      await ev.action.showAlert();
      return;
    }
    const settings = { ...(ev.payload.settings ?? {}), currentId: next.stableId };
    await ev.action.setSettings(settings);
    await this.paint(ev.action, settings);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CycleSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  private async paint(key: KeyAction<CycleSettings>, settings: CycleSettings): Promise<void> {
    const device = this.runtime.device(settings.currentId);
    await key.setTitle(device ? `CYCLE\n${device.name.toUpperCase().slice(0, 12)}` : "CYCLE\nFAVORITES");
  }

  private async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      await this.paint(instance, await instance.getSettings<CycleSettings>());
    }
  }
}
