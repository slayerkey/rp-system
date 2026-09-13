import { MonitorBridge } from "../../_shared/monitor-manager/monitor-client.js";
import { boundedPercent, normalizeMonitorKey, modeSupported, SAFE_VCP, SUPPORT, vcpSupport } from "../../_shared/monitor-manager/monitor-utils.mjs";

export type MonitorSettings = {
  monitorKey?: string;
  mode?: "set" | "up" | "down";
  value?: number;
  step?: number;
  power?: "toggle" | "on" | "off";
  refreshRate?: number;
};

type Snapshot = { monitors: any[]; internalBrightness?: any };

export class MonitorLiteRuntime {
  readonly bridge = new MonitorBridge();
  private cache: { at: number; value: Snapshot } | null = null;
  private configuredMonitorKey: string | null = null;

  constructor(private readonly requireConfiguredMonitor = false) {}

  invalidate(): void { this.cache = null; }

  setConfiguredMonitorKey(monitorKey: string | null | undefined): void {
    this.configuredMonitorKey = monitorKey?.trim() || null;
  }

  getConfiguredMonitorKey(): string | null {
    return this.configuredMonitorKey;
  }

  async scan(force = false): Promise<Snapshot> {
    if (!force && this.cache && Date.now() - this.cache.at < 1500) return this.cache.value;
    const value = await this.bridge.request("scan") as Snapshot;
    for (const monitor of value.monitors ?? []) monitor.monitorKey = normalizeMonitorKey(monitor);
    this.cache = { at: Date.now(), value };
    return value;
  }

  async selected(settings: MonitorSettings): Promise<{ monitor: any; snapshot: Snapshot }> {
    const snapshot = await this.scan();
    const monitors = snapshot.monitors ?? [];
    const requestedKey = this.requireConfiguredMonitor
      ? this.configuredMonitorKey
      : (this.configuredMonitorKey ?? settings.monitorKey);
    const monitor = requestedKey ? monitors.find((m) => m.monitorKey === requestedKey) : monitors[0];
    if (!monitor) throw new Error("No active monitor was found.");
    return { monitor, snapshot };
  }

  capabilitySummary(monitor: any, snapshot?: Snapshot): Record<string, any> {
    const brightnessVcp = vcpSupport(monitor.capabilities, 0x10);
    const contrastVcp = vcpSupport(monitor.capabilities, 0x12);
    const internalBrightness = Boolean(monitor.internalDisplay && snapshot?.internalBrightness?.available);
    return {
      brightness: monitor.ddcBrightness || internalBrightness
        ? SUPPORT.SUPPORTED
        : (brightnessVcp.state === SUPPORT.NOT_SUPPORTED ? SUPPORT.NOT_SUPPORTED : SUPPORT.UNKNOWN),
      contrast: monitor.ddcContrast
        ? SUPPORT.SUPPORTED
        : (contrastVcp.state === SUPPORT.NOT_SUPPORTED ? SUPPORT.NOT_SUPPORTED : SUPPORT.UNKNOWN),
      input: vcpSupport(monitor.capabilities, SAFE_VCP.INPUT_SOURCE),
      volume: vcpSupport(monitor.capabilities, SAFE_VCP.AUDIO_VOLUME),
      power: vcpSupport(monitor.capabilities, SAFE_VCP.POWER_MODE),
      hdr: monitor.hdrState ?? SUPPORT.UNKNOWN
    };
  }

  async setBrightness(settings: MonitorSettings, requested: number): Promise<number> {
    const { monitor, snapshot } = await this.selected(settings);
    const percent = boundedPercent(requested, "Brightness");
    if (monitor.ddcBrightness) {
      const min = Number(monitor.brightnessMin ?? 0);
      const max = Number(monitor.brightnessMax ?? 100);
      const nativeValue = Math.round(min + (percent / 100) * Math.max(1, max - min));
      await this.bridge.request("set-brightness", {
        kind: "ddc", deviceName: monitor.deviceName, physicalIndex: monitor.physicalIndex, value: nativeValue
      });
      this.invalidate();
      return percent;
    }
    if (monitor.internalDisplay && snapshot.internalBrightness?.available) {
      await this.bridge.request("set-brightness", { kind: "internal", value: percent });
      this.invalidate();
      return percent;
    }
    throw new Error("Brightness is not supported by this monitor.");
  }

  async brightnessPercent(settings: MonitorSettings): Promise<number | null> {
    const { monitor, snapshot } = await this.selected(settings);
    if (monitor.ddcBrightness) {
      const min = Number(monitor.brightnessMin ?? 0);
      const max = Number(monitor.brightnessMax ?? 100);
      const current = Number(monitor.brightness ?? min);
      return Math.round(((current - min) / Math.max(1, max - min)) * 100);
    }
    if (monitor.internalDisplay && snapshot.internalBrightness?.available) return Number(snapshot.internalBrightness.current ?? 0);
    return null;
  }

  async adjustBrightness(settings: MonitorSettings, delta: number): Promise<number> {
    const current = await this.brightnessPercent(settings);
    if (current === null) throw new Error("Brightness is not supported by this monitor.");
    return this.setBrightness(settings, current + delta);
  }

  async power(settings: MonitorSettings): Promise<string> {
    const { monitor } = await this.selected(settings);
    const support = vcpSupport(monitor.capabilities, SAFE_VCP.POWER_MODE);
    if (support.state !== SUPPORT.SUPPORTED) throw new Error("Monitor power is not advertised by DDC/CI.");
    const current = await this.bridge.request("get-vcp", {
      deviceName: monitor.deviceName, physicalIndex: monitor.physicalIndex, code: SAFE_VCP.POWER_MODE
    });
    const isOn = Number(current.current) === 1;
    const wanted = settings.power ?? "toggle";
    const turnOn = wanted === "on" || (wanted === "toggle" && !isOn);
    const value = turnOn ? 1 : (support.values.includes(4) ? 4 : support.values.includes(5) ? 5 : -1);
    if (!support.values.includes(value)) throw new Error("The monitor does not advertise a safe requested power value.");
    await this.bridge.request("set-vcp", {
      deviceName: monitor.deviceName, physicalIndex: monitor.physicalIndex, code: SAFE_VCP.POWER_MODE, value
    });
    this.invalidate();
    return turnOn ? "ON" : "OFF";
  }

  async setRefreshRate(settings: MonitorSettings): Promise<number> {
    const { monitor } = await this.selected(settings);
    const rate = Math.round(Number(settings.refreshRate ?? 60));
    const current = monitor.currentMode;
    if (!current) throw new Error("Current Windows display mode is unavailable.");
    const request = { width: current.width, height: current.height, frequency: rate, orientation: current.orientation ?? 0 };
    if (!modeSupported(monitor.modes, request)) throw new Error(rate + " Hz is not available for the current resolution.");
    await this.bridge.request("set-mode", {
      deviceName: monitor.deviceName, width: request.width, height: request.height,
      frequency: request.frequency, orientation: request.orientation, primary: false
    });
    this.invalidate();
    return rate;
  }

  async status(settings: MonitorSettings): Promise<string> {
    const { monitor } = await this.selected(settings);
    const mode = monitor.currentMode;
    const hz = mode?.frequency ? String(mode.frequency) + "HZ" : "HZ ?";
    const res = mode?.width && mode?.height ? String(mode.width) + "x" + String(mode.height) : "RES ?";
    return hz + "\n" + res;
  }

  dispose(): void { this.bridge.dispose(); }
}

export const runtime = new MonitorLiteRuntime(true);
