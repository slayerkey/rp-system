import streamDeck from "@elgato/streamdeck";
import { DeviceCatalog, type Device } from "./model.js";
import { control, snapshot } from "./bridge.js";

type GlobalSettings = {
  favorites?: string[];
  groups?: Record<string, string[]>;
  thresholds?: Record<string, number>;
};

export class WirelessRuntime {
  readonly catalog = new DeviceCatalog();
  private listeners = new Set<() => void>();
  private timer: NodeJS.Timeout | null = null;
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
    const result = await snapshot();
    this.adapterAvailable = result.adapterAvailable;
    this.lastError = result.ok ? null : (result.error ?? "Bluetooth unavailable");
    this.catalog.ingest(result.devices);
    for (const listener of this.listeners) listener();
    await this.sendInspector();
  }

  async perform(id: string, operation: "connect" | "disconnect"): Promise<{ ok: boolean; error?: string }> {
    const device = this.device(id);
    if (!device) return { ok: false, error: "Device not found" };
    const capability = operation === "connect" ? device.capabilities.CONNECT : device.capabilities.DISCONNECT;
    if (!capability) return { ok: false, error: `${operation} is not available for this device` };
    const result = await control(device.id, operation);
    await this.refresh();
    return result;
  }

  async globals(): Promise<GlobalSettings> {
    return await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  }

  async favorites(): Promise<string[]> {
    return (await this.globals()).favorites ?? [];
  }

  async setFavorite(id: string, value: boolean): Promise<void> {
    if (this.edition !== "pro") return;
    const current = await this.globals();
    const favorites = new Set(current.favorites ?? []);
    if (value) favorites.add(id); else favorites.delete(id);
    await streamDeck.settings.setGlobalSettings({ ...current, favorites: [...favorites] });
    await this.sendInspector();
  }

  async setGroup(name: string, id: string, value: boolean): Promise<void> {
    if (this.edition !== "pro") return;
    const clean = name.trim();
    if (!clean) return;
    const current = await this.globals();
    const groups = { ...(current.groups ?? {}) };
    const members = new Set(groups[clean] ?? []);
    if (value) members.add(id); else members.delete(id);
    groups[clean] = [...members];
    await streamDeck.settings.setGlobalSettings({ ...current, groups });
    await this.sendInspector();
  }

  async groupMembers(name?: string | null): Promise<string[]> {
    if (!name) return [];
    return (await this.globals()).groups?.[name] ?? [];
  }

  async sendInspector(): Promise<void> {
    try {
      const globals = this.edition === "pro" ? await this.globals() : {};
      await streamDeck.ui.sendToPropertyInspector({
        type: "wireless-snapshot",
        edition: this.edition,
        adapterAvailable: this.adapterAvailable,
        error: this.lastError,
        devices: this.devices(),
        favorites: globals.favorites ?? [],
        groups: globals.groups ?? {}
      });
    } catch {
      // No Property Inspector is currently open.
    }
  }
}
