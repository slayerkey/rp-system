export type Capabilities = {
  STATUS: boolean;
  CONNECT: boolean;
  DISCONNECT: boolean;
  BATTERY: boolean;
  CHARGING: boolean;
};

export type RawDevice = {
  id: string;
  name?: string;
  address?: string | null;
  containerId?: string | null;
  kind?: string | null;
  paired?: boolean;
  connected?: boolean;
  present?: boolean | null;
  batteryPercent?: number | null;
  charging?: boolean | null;
  control?: { connect?: boolean; disconnect?: boolean } | null;
};

export type Device = RawDevice & {
  stableId: string;
  name: string;
  capabilities: Capabilities;
  lastObservedAt: number;
};

export function stableId(raw: RawDevice): string {
  const address = raw.address?.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  if (address) return `bt:${address}`;
  const container = raw.containerId?.trim().toLowerCase();
  if (container) return `container:${container}`;
  return `id:${raw.id.toLowerCase()}`;
}

export function capabilities(raw: RawDevice): Capabilities {
  return {
    STATUS: true,
    CONNECT: raw.control?.connect === true,
    DISCONNECT: raw.control?.disconnect === true,
    BATTERY: Number.isFinite(raw.batteryPercent),
    CHARGING: typeof raw.charging === "boolean"
  };
}

export function normalizeDevice(raw: RawDevice, now = Date.now()): Device {
  const battery = Number.isFinite(raw.batteryPercent)
    ? Math.max(0, Math.min(100, Number(raw.batteryPercent)))
    : null;
  const normalized: RawDevice = {
    ...raw,
    batteryPercent: battery,
    paired: raw.paired !== false,
    connected: raw.connected === true
  };
  return {
    ...normalized,
    stableId: stableId(normalized),
    name: raw.name?.trim() || "Bluetooth device",
    capabilities: capabilities(normalized),
    lastObservedAt: now
  };
}

export class DeviceCatalog {
  private devices = new Map<string, Device>();
  private aliases = new Map<string, string>();

  ingest(rawDevices: RawDevice[], now = Date.now()): Device[] {
    const seen = new Set<string>();
    for (const raw of rawDevices) {
      if (!raw?.id) continue;
      const next = normalizeDevice(raw, now);
      seen.add(next.stableId);
      const previous = this.devices.get(next.stableId);
      this.devices.set(next.stableId, { ...previous, ...next, lastObservedAt: now });
      this.aliases.set(raw.id, next.stableId);
    }
    for (const [id, device] of this.devices) {
      if (!seen.has(id)) {
        this.devices.set(id, {
          ...device,
          present: false,
          connected: false,
          capabilities: { ...device.capabilities, CONNECT: false, DISCONNECT: false }
        });
      }
    }
    return this.list();
  }

  list(): Device[] {
    return [...this.devices.values()].sort((a, b) =>
      Number(b.connected) - Number(a.connected) ||
      Number(b.present) - Number(a.present) ||
      a.name.localeCompare(b.name)
    );
  }

  get(id?: string | null): Device | null {
    if (!id) return null;
    return this.devices.get(id) ?? this.devices.get(this.aliases.get(id) ?? "") ?? null;
  }
}

export function batteryLabel(device: Device | null): string {
  if (!device) return "SELECT\nDEVICE";
  if (!device.capabilities.BATTERY) return "BATTERY\nN/A";
  return `${device.batteryPercent}%\n${device.charging === true ? "CHARGING" : "BATTERY"}`;
}

export function statusLabel(device: Device | null): string {
  if (!device) return "SELECT\nDEVICE";
  if (device.connected) return `${shortName(device.name)}\nCONNECTED`;
  if (device.present === false) return `${shortName(device.name)}\nSLEEP/OFF`;
  return `${shortName(device.name)}\nDISCONNECTED`;
}

export function controlLabel(device: Device | null): string {
  if (!device) return "SELECT\nDEVICE";
  if (device.connected && device.capabilities.DISCONNECT) return "DISCONNECT";
  if (!device.connected && device.capabilities.CONNECT) return "CONNECT";
  return "CONTROL\nN/A";
}

export function shortName(name: string, max = 12): string {
  const clean = name.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean.toUpperCase() : `${clean.slice(0, max - 1).toUpperCase()}…`;
}

export function groupSummary(devices: Device[], ids: string[]): { connected: number; total: number; low: number } {
  const selected = ids.map(id => devices.find(d => d.stableId === id)).filter(Boolean) as Device[];
  return {
    connected: selected.filter(d => d.connected).length,
    total: selected.length,
    low: selected.filter(d => d.capabilities.BATTERY && Number(d.batteryPercent) <= 20).length
  };
}

export function nextFavorite(devices: Device[], favorites: string[], current?: string | null): Device | null {
  const ordered = favorites.map(id => devices.find(d => d.stableId === id)).filter(Boolean) as Device[];
  if (!ordered.length) return null;
  const index = current ? ordered.findIndex(d => d.stableId === current) : -1;
  return ordered[(index + 1) % ordered.length] ?? ordered[0];
}

export function shouldLowBatteryAlert(
  device: Device,
  threshold: number,
  previouslyLow = false
): { low: boolean; fire: boolean } {
  const low = device.capabilities.BATTERY && Number(device.batteryPercent) <= threshold;
  return { low, fire: low && !previouslyLow };
}
