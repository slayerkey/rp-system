import {
  action,
  type DialRotateEvent,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  SingletonAction,
  type WillAppearEvent
} from "@elgato/streamdeck";
import { runtime, type MonitorSettings } from "./runtime.js";

async function showFailure(target: any): Promise<void> {
  if (target.isKey?.()) await target.showAlert();
  if (target.isDial?.()) await target.setFeedback({ title: "UNSUPPORTED", value: "0%", indicator: 0 });
}

@action({ UUID: "com.packrat.monitormanagerlite.brightness" })
export class BrightnessAction extends SingletonAction<MonitorSettings> {
  override async onWillAppear(ev: WillAppearEvent<MonitorSettings>): Promise<void> {
    await this.paint(ev.action, ev.payload.settings ?? {});
  }
  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MonitorSettings>): Promise<void> {
    await this.paint(ev.action, ev.payload.settings ?? {});
  }
  override async onKeyDown(ev: KeyDownEvent<MonitorSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    try {
      const mode = settings.mode ?? "set";
      const step = Math.max(1, Number(settings.step ?? 5));
      const value = mode === "up"
        ? await runtime.adjustBrightness(settings, step)
        : mode === "down"
          ? await runtime.adjustBrightness(settings, -step)
          : await runtime.setBrightness(settings, Number(settings.value ?? 65));
      await ev.action.setTitle(String(value) + "%\nBRIGHTNESS");
      await ev.action.showOk();
    } catch {
      await showFailure(ev.action);
    }
  }
  override async onDialRotate(ev: DialRotateEvent<MonitorSettings>): Promise<void> {
    const settings = ev.payload.settings ?? {};
    try {
      const step = Math.max(1, Number(settings.step ?? 2));
      const value = await runtime.adjustBrightness(settings, ev.payload.ticks * step);
      await ev.action.setFeedback({ title: "BRIGHTNESS", value: String(value) + "%", indicator: value });
    } catch {
      await showFailure(ev.action);
    }
  }
  private async paint(target: any, settings: MonitorSettings): Promise<void> {
    try {
      const value = await runtime.brightnessPercent(settings);
      if (target.isKey()) await target.setTitle(value === null ? "UNKNOWN\nBRIGHTNESS" : String(value) + "%\nBRIGHTNESS");
      if (target.isDial()) await target.setFeedback({ title: "BRIGHTNESS", value: String(value ?? 0) + "%", indicator: value ?? 0 });
    } catch {
      if (target.isKey()) await target.setTitle("NO MONITOR");
    }
  }
}

@action({ UUID: "com.packrat.monitormanagerlite.power" })
export class PowerAction extends SingletonAction<MonitorSettings> {
  override async onKeyDown(ev: KeyDownEvent<MonitorSettings>): Promise<void> {
    try {
      const state = await runtime.power(ev.payload.settings ?? {});
      await ev.action.setTitle(state + "\nPOWER");
      await ev.action.showOk();
    } catch {
      await showFailure(ev.action);
    }
  }
}

@action({ UUID: "com.packrat.monitormanagerlite.refresh-rate" })
export class RefreshRateAction extends SingletonAction<MonitorSettings> {
  override async onWillAppear(ev: WillAppearEvent<MonitorSettings>): Promise<void> {
    await ev.action.setTitle(String(Math.round(Number(ev.payload.settings?.refreshRate ?? 60))) + " HZ");
  }
  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MonitorSettings>): Promise<void> {
    await ev.action.setTitle(String(Math.round(Number(ev.payload.settings?.refreshRate ?? 60))) + " HZ");
  }
  override async onKeyDown(ev: KeyDownEvent<MonitorSettings>): Promise<void> {
    try {
      const rate = await runtime.setRefreshRate(ev.payload.settings ?? {});
      await ev.action.setTitle(String(rate) + " HZ");
      await ev.action.showOk();
    } catch {
      await showFailure(ev.action);
    }
  }
}

@action({ UUID: "com.packrat.monitormanagerlite.status" })
export class DisplayStatusAction extends SingletonAction<MonitorSettings> {
  override async onWillAppear(ev: WillAppearEvent<MonitorSettings>): Promise<void> {
    await this.paint(ev.action, ev.payload.settings ?? {});
  }
  override async onKeyDown(ev: KeyDownEvent<MonitorSettings>): Promise<void> {
    runtime.invalidate();
    await this.paint(ev.action, ev.payload.settings ?? {});
  }
  private async paint(target: any, settings: MonitorSettings): Promise<void> {
    try { await target.setTitle(await runtime.status(settings)); }
    catch { await target.setTitle("NO DISPLAY"); }
  }
}
