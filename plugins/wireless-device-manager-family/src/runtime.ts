import streamDeck from "@elgato/streamdeck";
import { DeviceCatalog, parseGroupNames, resolveSelectedDeviceId, shouldApplySnapshot, type Device } from "./model.js";
import { control, snapshot } from "./bridge.js";

type GlobalSettings = {
  liteDeviceId?: string;
  favorites?: string[];
  groups?: Record<string, string[]>;
  thresholds?: Record<string, number>;
  slots?: Record<string, string>;
};

export class WirelessRuntime {
  readonly catalog = new DeviceCatalog();
  private listeners = new Set<() => void>();
  private timer: NodeJS.Timeout | null = null;
  private refreshTask: Promise<void> | null = null;
  private globalCache: GlobalSettings | null = null;
  private globalLoad: Promise<GlobalSettings> | null = null;
  private globalWrite: Promise<void> = Promise.resolve();
  adapterAvailable = true;
  hidAvailable = true;
  lastError: string | null = null;

  constructor(readonly edition: "lite" | "pro") {}

  async warmGlobals(): Promise<void> {
    try {
      await this.loadGlobals();
      this.notify();
    } catch (error) {
      streamDeck.logger.error("Wireless global settings load failed", error);
    }
  }

  private cachedGlobals(): GlobalSettings {
    if (!this.globalCache && !this.globalLoad) void this.warmGlobals();
    return this.globalCache ?? {};
  }

  async handleInspectorCommand(payload: any): Promise<void> {
    if (payload?.type === "refresh-wireless" || payload?.type === "get-wireless-snapshot") {
      await this.refresh();
      return;
    }
    const deviceId = typeof payload?.deviceId === "string" ? payload.deviceId : "";
    let changed = false;
    if (payload?.type === "select-device" && deviceId) {
      if (this.edition === "lite") {
        await this.setLiteDeviceId(deviceId);
      } else {
        if (typeof payload.slot === "string" && payload.slot) await this.setSlotDevice(payload.slot, deviceId);
        await this.setFavorite(deviceId, payload.favorite === true);
        await this.assignGroups(typeof payload.groupName === "string" ? payload.groupName : "", deviceId);
        await this.setThreshold(deviceId, Number(payload.lowBatteryThreshold ?? 20));
        changed = true;
      }
    } else if (this.edition === "pro" && deviceId) {
      if (payload?.type === "set-favorite") {
        await this.setFavorite(deviceId, payload.value === true); changed = true;
      } else if (payload?.type === "set-groups") {
        await this.assignGroups(typeof payload.value === "string" ? payload.value : "", deviceId); changed = true;
      } else if (payload?.type === "set-threshold") {
        await this.setThreshold(deviceId, Number(payload.value ?? 20)); changed = true;
      }
    }
    if (changed) this.notify();
  }

  async start(): Promise<void> {
    await this.refresh();
    void this.warmGlobals();
    this.timer = setInterval(() => void this.refresh(), 5000);
    this.timer.unref();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(): void {
    for (const listener of this.listeners) listener();
  }

  devices(): Device[] {
    return this.catalog.list();
  }

  device(id?: string | null): Device | null {
    return this.catalog.get(id);
  }

  async refresh(): Promise<void> {
    if (this.refreshTask) return this.refreshTask;
    this.refreshTask = this.refreshOnce();
    try {
      await this.refreshTask;
    } finally {
      this.refreshTask = null;
    }
  }

  private async refreshOnce(): Promise<void> {
    const result = await snapshot();
    this.adapterAvailable = result.adapterAvailable;
    this.hidAvailable = result.hidAvailable;
    this.lastError = result.ok ? null : (result.error ?? "Wireless device scan unavailable");
    if (shouldApplySnapshot(result.ok, result.adapterAvailable, result.hidAvailable)) {
      this.catalog.ingest(result.devices, Date.now(), {
        bluetooth: result.adapterAvailable,
        hid: result.hidAvailable
      });
    }
    this.notify();
  }

  async perform(id: string, operation: "connect" | "disconnect"): Promise<{ ok: boolean; error?: string }> {
    const device = this.device(id);
    if (!device) return { ok: false, error: "Device not found" };
    const capability = operation === "connect" ? device.capabilities.CONNECT : device.capabilities.DISCONNECT;
    if (!capability) return { ok: false, error: `${operation} is not available for this device` };
    const controlId = device.controlId ?? device.id;
    const result = await control(controlId, operation);
    await this.refresh();
    return result;
  }

  private async loadGlobals(): Promise<GlobalSettings> {
    if (this.globalCache) return this.globalCache;
    if (this.globalLoad) return this.globalLoad;

    this.globalLoad = streamDeck.settings.getGlobalSettings<GlobalSettings>();
    try {
      this.globalCache = await this.globalLoad;
      return this.globalCache;
    } finally {
      this.globalLoad = null;
    }
  }

  private async mutateGlobals(mutator: (current: GlobalSettings) => GlobalSettings): Promise<void> {
    const operation = this.globalWrite.then(async () => {
      const current = await this.loadGlobals();
      const next = mutator(current);
      await streamDeck.settings.setGlobalSettings(next);
      this.globalCache = next;
    });
    this.globalWrite = operation.catch(() => {});
    await operation;
  }

  async globals(): Promise<GlobalSettings> {
    await this.globalWrite;
    return await this.loadGlobals();
  }

  async selectedDeviceId(localDeviceId?: string | null, slot?: string | null): Promise<string | null> {
    const globals = (this.edition === "lite" || slot) ? this.cachedGlobals() : {};
    const slotDeviceId = slot ? globals.slots?.[slot] ?? null : null;
    return resolveSelectedDeviceId(this.edition, globals.liteDeviceId, localDeviceId, slotDeviceId);
  }

  async setSlotDevice(slot: string, id: string): Promise<void> {
    if (this.edition !== "pro" || !slot || !id) return;
    await this.mutateGlobals(current => ({
      ...current,
      slots: { ...(current.slots ?? {}), [slot]: id }
    }));
  }

  async setLiteDeviceId(id: string): Promise<void> {
    if (this.edition !== "lite" || !id) return;
    const current = await this.globals();
    if (current.liteDeviceId === id) return;
    await this.mutateGlobals(value => ({ ...value, liteDeviceId: id }));
    this.notify();
  }

  async favorites(): Promise<string[]> {
    return this.cachedGlobals().favorites ?? [];
  }

  async thresholds(): Promise<Record<string, number>> {
    return this.cachedGlobals().thresholds ?? {};
  }

  async thresholdFor(id: string, fallback = 20): Promise<number> {
    const value = this.cachedGlobals().thresholds?.[id] ?? fallback;
    return Math.max(1, Math.min(99, Number(value || 20)));
  }

  async setThreshold(id: string, value: number): Promise<void> {
    if (this.edition !== "pro") return;
    const threshold = Math.max(1, Math.min(99, Number(value || 20)));
    await this.mutateGlobals(current => ({
      ...current,
      thresholds: { ...(current.thresholds ?? {}), [id]: threshold }
    }));
  }

  async setFavorite(id: string, value: boolean): Promise<void> {
    if (this.edition !== "pro") return;
    await this.mutateGlobals(current => {
      const favorites = new Set(current.favorites ?? []);
      if (value) favorites.add(id); else favorites.delete(id);
      return { ...current, favorites: [...favorites] };
    });
  }

  async assignGroups(names: string, id: string): Promise<void> {
    if (this.edition !== "pro") return;
    const desired = parseGroupNames(names);
    await this.mutateGlobals(current => {
      const groups: Record<string, string[]> = {};
      for (const [groupName, members] of Object.entries(current.groups ?? {})) {
        groups[groupName] = members.filter(member => member !== id);
      }
      for (const groupName of desired) {
        groups[groupName] = [...new Set([...(groups[groupName] ?? []), id])];
      }
      return { ...current, groups };
    });
  }

  async groupMembers(name?: string | null): Promise<string[]> {
    if (!name) return [];
    const normalized = parseGroupNames(name)[0];
    if (!normalized) return [];
    return this.cachedGlobals().groups?.[normalized] ?? [];
  }

  inspectorPayload(): any {
    const globals = this.cachedGlobals();
    return {
      type: "wireless-snapshot",
      edition: this.edition,
      adapterAvailable: this.adapterAvailable,
      hidAvailable: this.hidAvailable,
      error: this.lastError,
      devices: this.devices(),
      liteDeviceId: globals.liteDeviceId ?? null,
      favorites: globals.favorites ?? [],
      groups: globals.groups ?? {},
      thresholds: globals.thresholds ?? {},
      slots: globals.slots ?? {}
    };
  }
}
