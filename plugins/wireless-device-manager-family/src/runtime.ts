import streamDeck from "@elgato/streamdeck";
import { DeviceCatalog, parseGroupNames, resolveSelectedDeviceId, shouldApplySnapshot, type Device } from "./model.js";
import { control, snapshot } from "./bridge.js";

type GlobalSettings = {
  liteDeviceId?: string;
  favorites?: string[];
  groups?: Record<string, string[]>;
  thresholds?: Record<string, number>;
};

export class WirelessRuntime {
  readonly catalog = new DeviceCatalog();
  private listeners = new Set<() => void>();
  private timer: NodeJS.Timeout | null = null;
  private refreshTask: Promise<void> | null = null;
  adapterAvailable = true;
  lastError: string | null = null;

  constructor(readonly edition: "lite" | "pro") {}

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), 5000);
    this.timer.unref();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
    this.lastError = result.ok ? null : (result.error ?? "Bluetooth unavailable");
    if (shouldApplySnapshot(result.ok, result.adapterAvailable)) {
      this.catalog.ingest(result.devices);
    }
    for (const listener of this.listeners) listener();
    await this.sendInspector();
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

  async globals(): Promise<GlobalSettings> {
    return await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  }

  async selectedDeviceId(localDeviceId?: string | null): Promise<string | null> {
    const global = this.edition === "lite" ? await this.globals() : {};
    return resolveSelectedDeviceId(this.edition, global.liteDeviceId, localDeviceId);
  }

  async setLiteDeviceId(id: string): Promise<void> {
    if (this.edition !== "lite" || !id) return;
    const current = await this.globals();
    if (current.liteDeviceId === id) return;
    await streamDeck.settings.setGlobalSettings({ ...current, liteDeviceId: id });
    for (const listener of this.listeners) listener();
    await this.sendInspector();
  }

  async favorites(): Promise<string[]> {
    return (await this.globals()).favorites ?? [];
  }

  async thresholds(): Promise<Record<string, number>> {
    return (await this.globals()).thresholds ?? {};
  }

  async thresholdFor(id: string, fallback = 20): Promise<number> {
    const value = (await this.globals()).thresholds?.[id] ?? fallback;
    return Math.max(1, Math.min(99, Number(value || 20)));
  }

  async setThreshold(id: string, value: number): Promise<void> {
    if (this.edition !== "pro") return;
    const threshold = Math.max(1, Math.min(99, Number(value || 20)));
    const current = await this.globals();
    await streamDeck.settings.setGlobalSettings({
      ...current,
      thresholds: { ...(current.thresholds ?? {}), [id]: threshold }
    });
  }

  async setFavorite(id: string, value: boolean): Promise<void> {
    if (this.edition !== "pro") return;
    const current = await this.globals();
    const favorites = new Set(current.favorites ?? []);
    if (value) favorites.add(id); else favorites.delete(id);
    await streamDeck.settings.setGlobalSettings({ ...current, favorites: [...favorites] });
    await this.sendInspector();
  }

  async assignGroups(names: string, id: string): Promise<void> {
    if (this.edition !== "pro") return;
    const desired = parseGroupNames(names);
    const current = await this.globals();
    const groups: Record<string, string[]> = {};
    for (const [groupName, members] of Object.entries(current.groups ?? {})) {
      groups[groupName] = members.filter(member => member !== id);
    }
    for (const groupName of desired) {
      groups[groupName] = [...new Set([...(groups[groupName] ?? []), id])];
    }
    await streamDeck.settings.setGlobalSettings({ ...current, groups });
    await this.sendInspector();
  }

  async groupMembers(name?: string | null): Promise<string[]> {
    if (!name) return [];
    const normalized = parseGroupNames(name)[0];
    if (!normalized) return [];
    return (await this.globals()).groups?.[normalized] ?? [];
  }

  async sendInspector(): Promise<void> {
    try {
      const globals = await this.globals();
      await streamDeck.ui.sendToPropertyInspector({
        type: "wireless-snapshot",
        edition: this.edition,
        adapterAvailable: this.adapterAvailable,
        error: this.lastError,
        devices: this.devices(),
        liteDeviceId: globals.liteDeviceId ?? null,
        favorites: globals.favorites ?? [],
        groups: globals.groups ?? {}
      } as any);
    } catch {
      // No Property Inspector is currently open.
    }
  }
}
