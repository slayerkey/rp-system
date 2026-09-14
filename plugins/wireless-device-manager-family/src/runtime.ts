import streamDeck from "@elgato/streamdeck";
import { DeviceCatalog, parseGroupNames, resolveSelectedDeviceId, shouldApplySnapshot, type Device } from "./model.js";
import { control, snapshot } from "./bridge.js";
import { diag, diagError } from "./diagnostics.js";

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
  private started = false;
  private refreshCount = 0;
  private lastRefreshAt: string | null = null;
  private lastRefreshDurationMs = 0;
  private lastSnapshotDeviceCount = 0;
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
    diag("runtime-inspector-command", {
      edition: this.edition,
      type: String(payload?.type ?? ""),
      actionContext: String(payload?.actionContext ?? "")
    });
    if (payload?.type === "refresh-wireless" || payload?.type === "get-wireless-snapshot") {
      await this.refresh("property-inspector");
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
    diag("runtime-start", { edition: this.edition });
    await this.refresh("startup");
    this.started = true;
    void this.warmGlobals();
    this.timer = setInterval(() => void this.refresh("timer"), 5000);
    this.timer.unref();
    diag("runtime-ready", { edition: this.edition, ...this.diagnostics() });
  }

  diagnostics(): Record<string, unknown> {
    return {
      runtimeStarted: this.started,
      refreshCount: this.refreshCount,
      lastRefreshAt: this.lastRefreshAt,
      lastRefreshDurationMs: this.lastRefreshDurationMs,
      lastSnapshotDeviceCount: this.lastSnapshotDeviceCount,
      adapterAvailable: this.adapterAvailable,
      hidAvailable: this.hidAvailable,
      lastError: this.lastError
    };
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

  async refresh(reason = "runtime"): Promise<void> {
    if (this.refreshTask) {
      diag("refresh-coalesced", { edition: this.edition, reason });
      return this.refreshTask;
    }
    this.refreshTask = this.refreshOnce(reason);
    try {
      await this.refreshTask;
    } finally {
      this.refreshTask = null;
    }
  }

  private async refreshOnce(reason: string): Promise<void> {
    const startedAt = Date.now();
    diag("bridge-snapshot-start", { edition: this.edition, reason });
    try {
      const result = await snapshot();
      this.adapterAvailable = result.adapterAvailable;
      this.hidAvailable = result.hidAvailable;
      this.lastError = result.ok ? null : (result.error ?? "Wireless device scan unavailable");
      this.lastSnapshotDeviceCount = Array.isArray(result.devices) ? result.devices.length : 0;
      if (shouldApplySnapshot(result.ok, result.adapterAvailable, result.hidAvailable)) {
        this.catalog.ingest(result.devices, Date.now(), {
          bluetooth: result.adapterAvailable,
          hid: result.hidAvailable
        });
      }
      this.refreshCount += 1;
      this.lastRefreshAt = new Date().toISOString();
      diag("bridge-snapshot-result", {
        edition: this.edition,
        reason,
        ok: result.ok,
        adapterAvailable: result.adapterAvailable,
        hidAvailable: result.hidAvailable,
        devices: this.lastSnapshotDeviceCount,
        error: result.error ?? null
      });
      this.notify();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.refreshCount += 1;
      this.lastRefreshAt = new Date().toISOString();
      diagError("bridge-snapshot-exception", error, { edition: this.edition, reason });
      this.notify();
      throw error;
    } finally {
      this.lastRefreshDurationMs = Date.now() - startedAt;
    }
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
    const configured = resolveSelectedDeviceId(this.edition, globals.liteDeviceId, localDeviceId, slotDeviceId);
    if (configured) return configured;

    const visible = this.devices().filter(device =>
      device.paired !== false &&
      device.present !== false
    );
    return visible.length === 1 ? visible[0].stableId : null;
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
      slots: globals.slots ?? {},
      diagnostics: {
        ...this.diagnostics(),
        pid: process.pid,
        node: process.version,
        arch: process.arch
      }
    };
  }
}
