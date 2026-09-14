export type Capabilities = {
  STATUS: boolean;
  CONNECT: boolean;
  DISCONNECT: boolean;
  BATTERY: boolean;
  CHARGING: boolean;
};

export type RawDevice = {
  id: string;
  controlId?: string | null;
  name?: string;
  address?: string | null;
  containerId?: string | null;
  kind?: string | null;
  transport?: "bluetooth" | "usb-hid" | "unknown" | null;
  paired?: boolean;
  connected?: boolean;
  present?: boolean | null;
  batteryPercent?: number | null;
  charging?: boolean | null;
  batteryObservedAt?: number | null;
  batterySource?: string | null;
  control?: { connect?: boolean; disconnect?: boolean } | null;
};

export type Device = RawDevice & {
  stableId: string;
  name: string;
  capabilities: Capabilities;
  lastObservedAt: number;
};

export function stableId(raw: RawDevice): string {
  const container = raw.containerId?.trim().toLowerCase();
  if (container) return `container:${container}`;
  const address = raw.address?.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  if (address) return `bt:${address}`;
  return `id:${raw.id.toLowerCase()}`;
}

export function resolveSelectedDeviceId(
  edition: "lite" | "pro",
  liteDeviceId?: string | null,
  localDeviceId?: string | null,
  slotDeviceId?: string | null
): string | null {
  return edition === "lite"
    ? (liteDeviceId ?? localDeviceId ?? null)
    : (slotDeviceId ?? localDeviceId ?? null);
}

export function soleVisibleDeviceId(devices: Device[]): string | null {
  const visible = devices.filter(device =>
    device.paired !== false &&
    device.present !== false
  );
  return visible.length === 1 ? visible[0].stableId : null;
}

export function parseGroupNames(value: string): string[] {
  return [...new Set(
    value
      .split(",")
      .map(name => name.trim().toUpperCase())
      .filter(Boolean)
  )];
}

export function shouldApplySnapshot(ok: boolean, bluetoothAvailable: boolean, hidAvailable = false): boolean {
  return ok && (bluetoothAvailable || hidAvailable);
}

export type ObservedSources = {
  bluetooth: boolean;
  hid: boolean;
};

function sourceObserved(device: Device, observed: ObservedSources): boolean {
  if (device.transport === "bluetooth" || (!device.transport && Boolean(device.address))) {
    return observed.bluetooth;
  }
  if (device.transport === "usb-hid") {
    return observed.hid;
  }
  return true;
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

function mergeCurrentEndpoints(previous: Device | undefined, next: Device, now: number): Device {
  if (!previous) return { ...next, lastObservedAt: now };

  const mergedRaw: RawDevice = {
    id: next.id || previous.id,
    controlId:
      next.control?.connect === true || next.control?.disconnect === true
        ? (next.controlId ?? next.id)
        : previous.control?.connect === true || previous.control?.disconnect === true
          ? (previous.controlId ?? previous.id)
          : (next.controlId ?? previous.controlId ?? null),
    name: next.name !== "Bluetooth device" ? next.name : previous.name,
    address: next.address ?? previous.address ?? null,
    containerId: next.containerId ?? previous.containerId ?? null,
    kind: previous.kind && next.kind && previous.kind !== next.kind ? "dual" : (next.kind ?? previous.kind ?? null),
    transport: next.transport ?? previous.transport ?? null,
    paired: previous.paired !== false || next.paired !== false,
    connected: previous.connected === true || next.connected === true,
    present:
      previous.present === true || next.present === true
        ? true
        : previous.present === false || next.present === false
          ? false
          : null,
    batteryPercent: Number.isFinite(next.batteryPercent)
      ? Number(next.batteryPercent)
      : Number.isFinite(previous.batteryPercent)
        ? Number(previous.batteryPercent)
        : null,
    charging: typeof next.charging === "boolean"
      ? next.charging
      : typeof previous.charging === "boolean"
        ? previous.charging
        : null,
    batteryObservedAt: Number.isFinite(next.batteryObservedAt)
      ? Number(next.batteryObservedAt)
      : Number.isFinite(previous.batteryObservedAt)
        ? Number(previous.batteryObservedAt)
        : null,
    batterySource: next.batterySource ?? previous.batterySource ?? null,
    control: {
      connect: previous.control?.connect === true || next.control?.connect === true,
      disconnect: previous.control?.disconnect === true || next.control?.disconnect === true
    }
  };

  return {
    ...normalizeDevice(mergedRaw, now),
    stableId: previous.stableId,
    lastObservedAt: now
  };
}

export class DeviceCatalog {
  private devices = new Map<string, Device>();
  private aliases = new Map<string, string>();

  ingest(
    rawDevices: RawDevice[],
    now = Date.now(),
    observed: ObservedSources = { bluetooth: true, hid: true }
  ): Device[] {
    const current = new Map<string, Device>();

    for (const raw of rawDevices) {
      if (!raw?.id) continue;
      const normalized = normalizeDevice(raw, now);
      const resolvedId = normalized.stableId;
      const next = { ...normalized, stableId: resolvedId };
      current.set(resolvedId, mergeCurrentEndpoints(current.get(resolvedId), next, now));
      this.aliases.set(raw.id, resolvedId);
      this.aliases.set(normalized.stableId, resolvedId);
    }

    const nextCatalog = new Map<string, Device>();
    for (const [id, device] of current) {
      nextCatalog.set(id, device);
    }

    for (const [id, device] of this.devices) {
      if (current.has(id)) continue;
      if (!sourceObserved(device, observed)) {
        nextCatalog.set(id, device);
        continue;
      }
      nextCatalog.set(id, {
        ...device,
        paired: false,
        present: false,
        connected: false,
        controlId: null,
        batteryPercent: null,
        charging: null,
        control: { connect: false, disconnect: false },
        capabilities: {
          STATUS: true,
          CONNECT: false,
          DISCONNECT: false,
          BATTERY: false,
          CHARGING: false
        }
      });
    }

    this.devices = nextCatalog;
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
  if (device.paired === false) return `${shortName(device.name)}\nUNPAIRED`;
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

export function deviceViewTitle(
  device: Device | null,
  view: "status" | "battery" | "control",
  label?: string
): string {
  const cleanLabel = label?.trim().toUpperCase();
  if (!cleanLabel) {
    return view === "battery"
      ? batteryLabel(device)
      : view === "control"
        ? controlLabel(device)
        : statusLabel(device);
  }

  if (view === "control") {
    return controlLabel(device);
  }

  if (!device) return `${cleanLabel}\nSELECT`;
  if (view === "battery") {
    if (!device.capabilities.BATTERY) return `${cleanLabel}\nN/A`;
    return `${cleanLabel}\n${device.batteryPercent}%${device.charging === true ? " CHG" : ""}`;
  }

  const status = statusLabel(device).split("\n").slice(-1)[0] ?? "UNKNOWN";
  return `${cleanLabel}\n${status}`;
}

export function shortName(name: string, max = 12): string {
  const clean = name.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean.toUpperCase() : `${clean.slice(0, max - 1).toUpperCase()}…`;
}

export function groupSummary(
  devices: Device[],
  ids: string[],
  thresholds: Record<string, number> = {}
): { connected: number; total: number; low: number } {
  const selected = ids.map(id => devices.find(d => d.stableId === id)).filter(Boolean) as Device[];
  return {
    connected: selected.filter(d => d.connected).length,
    total: selected.length,
    low: selected.filter(d => {
      if (!d.capabilities.BATTERY) return false;
      const threshold = Math.max(1, Math.min(99, Number(thresholds[d.stableId] ?? 20)));
      return Number(d.batteryPercent) <= threshold;
    }).length
  };
}

export function nextFavorite(devices: Device[], favorites: string[], current?: string | null): Device | null {
  const ordered = favorites
    .map(id => devices.find(d => d.stableId === id))
    .filter((device): device is Device => Boolean(device) && device!.paired !== false);
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
