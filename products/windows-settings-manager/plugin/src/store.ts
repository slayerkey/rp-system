import streamDeck from "@elgato/streamdeck";

import { DEFAULT_MODES } from "./modes.js";
import type { GlobalSettings, ModeDefinition, ModeSettings } from "./types.js";

const DEFAULTS: GlobalSettings = {
  schemaVersion: 1,
  modes: DEFAULT_MODES.map((mode) => ({ ...mode, settings: {} }))
};

export class ModeStore {
  private cache: GlobalSettings | null = null;

  async load(): Promise<GlobalSettings> {
    if (this.cache) return sanitizeSettings(this.cache);

    const raw = await (streamDeck.settings as any).getGlobalSettings();
    const parsed = sanitizeSettings(raw);
    if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.modes)) {
      await this.save(parsed);
      return sanitizeSettings(parsed);
    }

    this.cache = parsed;
    return sanitizeSettings(parsed);
  }

  async save(settings: GlobalSettings): Promise<void> {
    const clean = sanitizeSettings(settings);
    await (streamDeck.settings as any).setGlobalSettings(clean);
    this.cache = clean;
  }

  async getMode(id: string): Promise<ModeDefinition | undefined> {
    const state = await this.load();
    return state.modes.find((mode) => mode.id === id);
  }

  async updateMode(id: string, patch: Partial<Pick<ModeDefinition, "name" | "settings">>): Promise<ModeDefinition> {
    const state = await this.load();
    const existing = state.modes.find((mode) => mode.id === id);
    const next: ModeDefinition = {
      id,
      name: cleanName(patch.name ?? existing?.name ?? id.toUpperCase()),
      settings: sanitizeModeSettings(patch.settings ?? existing?.settings ?? {})
    };
    const index = state.modes.findIndex((mode) => mode.id === id);
    if (index >= 0) state.modes[index] = next;
    else state.modes.push(next);
    await this.save(state);
    return next;
  }

  async replaceModes(modes: ModeDefinition[]): Promise<void> {
    const clean = modes.map((mode) => ({
      id: String(mode.id || "").trim() || "mode",
      name: cleanName(mode.name),
      settings: sanitizeModeSettings(mode.settings)
    }));
    await this.save({ schemaVersion: 1, modes: clean.length ? clean : DEFAULTS.modes });
  }
}

function sanitizeSettings(raw: any): GlobalSettings {
  const supplied = Array.isArray(raw?.modes) ? raw.modes : [];
  const byId = new Map<string, ModeDefinition>();
  for (const mode of supplied) {
    const id = String(mode?.id ?? "").trim();
    if (!id) continue;
    byId.set(id, {
      id,
      name: cleanName(mode?.name || id.toUpperCase()),
      settings: sanitizeModeSettings(mode?.settings)
    });
  }

  const modes = DEFAULT_MODES.map((fallback) => byId.get(fallback.id) ?? {
    ...fallback,
    settings: {}
  });
  for (const mode of byId.values()) {
    if (!modes.some((item) => item.id === mode.id)) modes.push(mode);
  }
  return { schemaVersion: 1, modes };
}

function sanitizeModeSettings(raw: any): ModeSettings {
  const result: ModeSettings = {};
  if (typeof raw?.hdr === "boolean") result.hdr = raw.hdr;
  if (["internal", "clone", "extend", "external"].includes(raw?.topology)) {
    result.topology = raw.topology;
  }
  const guid = String(raw?.powerPlanGuid ?? "").trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guid)) {
    result.powerPlanGuid = guid;
  }
  if (raw?.timeout && ["monitorAcSeconds", "monitorDcSeconds", "sleepAcSeconds", "sleepDcSeconds"]
    .every((key) => {
      const value = raw.timeout[key];
      return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0
        && value <= 0xffffffff;
    })) {
    result.timeout = {
      monitorAcSeconds: Number(raw.timeout.monitorAcSeconds),
      monitorDcSeconds: Number(raw.timeout.monitorDcSeconds),
      sleepAcSeconds: Number(raw.timeout.sleepAcSeconds),
      sleepDcSeconds: Number(raw.timeout.sleepDcSeconds)
    };
  }
  if (typeof raw?.keepAwake === "boolean") result.keepAwake = raw.keepAwake;
  return result;
}

function cleanName(value: unknown): string {
  const name = String(value ?? "").trim().slice(0, 18);
  return name || "MODE";
}
