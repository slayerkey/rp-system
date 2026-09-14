import {
  action,
  type DidReceiveSettingsEvent,
  type KeyAction,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { deviceViewTitle, groupSummary, nextFavorite, shortName, shouldLowBatteryAlert } from "./model.js";
import { setWirelessKey, type WirelessKeyKind } from "./key-visuals.js";
import type { WirelessRuntime } from "./runtime.js";

export type DeviceSettings = {
  deviceId?: string;
  view?: "status" | "battery" | "control";
  label?: string;
  lowBatteryThreshold?: number;
  favorite?: boolean;
  groupName?: string;
  slot?: string;
};

export type DashboardSettings = {
  groupName?: string;
};

export type CycleSettings = {
  currentId?: string;
};

async function paintDevice(key: KeyAction<DeviceSettings>, runtime: WirelessRuntime, settings: DeviceSettings) {
  const deviceId = await runtime.selectedDeviceId(settings.deviceId, settings.slot);
  const device = runtime.device(deviceId);
  const view = settings.view ?? "status";
  const kind: WirelessKeyKind = view === "battery" ? "battery" : view === "control" ? "control" : "device";
  const label = settings.label?.trim().toUpperCase() || (view === "battery" ? "BATTERY" : view === "control" ? "CONTROL" : "WIRELESS");
  if (runtime.lastError) {
    await setWirelessKey(key, kind, [label, "SCAN ERROR"]);
    return;
  }
  await setWirelessKey(key, kind, deviceViewTitle(device, view, settings.label).split("\n"));
}

abstract class DeviceActionBase extends SingletonAction<DeviceSettings> {
  private lowState = new Map<string, boolean>();
  constructor(protected readonly runtime: WirelessRuntime, private readonly alerts: boolean) {
    super();
    runtime.subscribe(() => void this.paintAll());
  }

  override async onWillAppear(ev: WillAppearEvent<DeviceSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DeviceSettings>): Promise<void> {
    if (ev.action.isKey()) await this.paint(ev.action, ev.payload.settings ?? {});
  }


  override async onKeyDown(ev: KeyDownEvent<DeviceSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    const deviceId = await this.runtime.selectedDeviceId(settings.deviceId, settings.slot);
    const device = this.runtime.device(deviceId);
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
    const deviceId = await this.runtime.selectedDeviceId(settings.deviceId, settings.slot);
    const device = this.runtime.device(deviceId);
    if (!device) return;
    const threshold = this.runtime.edition === "pro"
      ? await this.runtime.thresholdFor(device.stableId, Number(settings.lowBatteryThreshold ?? 20))
      : Math.max(1, Math.min(99, Number(settings.lowBatteryThreshold ?? 20)));
    const stateKey = `${device.stableId}:${threshold}`;
    const before = this.lowState.get(stateKey) ?? false;
    const state = shouldLowBatteryAlert(device, threshold, before);
    this.lowState.set(stateKey, state.low);
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
    if (this.runtime.lastError) {
      await setWirelessKey(key, "dashboard", [settings.groupName?.trim().toUpperCase() || "ALL DEVICES", "SCAN ERROR"]);
      return;
    }
    const devices = this.runtime.devices();
    if (!devices.length) {
      await setWirelessKey(key, "dashboard", [settings.groupName?.trim().toUpperCase() || "ALL DEVICES", "NONE FOUND"]);
      return;
    }
    const members = settings.groupName ? await this.runtime.groupMembers(settings.groupName) : devices.map(d => d.stableId);
    const summary = groupSummary(devices, members, await this.runtime.thresholds());
    const prefix = settings.groupName?.trim().toUpperCase() || "ALL DEVICES";
    await setWirelessKey(key, "dashboard", [prefix, `${summary.connected}/${summary.total} ON${summary.low ? ` • ${summary.low} LOW` : ""}`]);
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
      await setWirelessKey(ev.action, "cycle", ["CYCLE", "NO FAVORITES"]);
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
    if (!device) {
      await setWirelessKey(key, "cycle", ["CYCLE", "FAVORITES"]);
      return;
    }
    const state = device.paired === false ? "UNPAIRED" : device.connected ? "ON" : device.present === false ? "SLEEP" : "OFF";
    const battery = device.capabilities.BATTERY ? ` ${device.batteryPercent}%` : "";
    await setWirelessKey(key, "cycle", [shortName(device.name), `${state}${battery}`]);
  }

  private async paintAll(): Promise<void> {
    for (const instance of this.actions) {
      if (!instance.isKey()) continue;
      await this.paint(instance, await instance.getSettings<CycleSettings>());
    }
  }
}
