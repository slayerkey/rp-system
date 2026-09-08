"use strict";
const fs = require("fs");

const DEFAULT_CONFIG = {
  version: 2,
  setupComplete: false,
  outputDevice: "",
  inputDevice: "",
  workspaces: {
    work: { apps: ["@browser", "@discord", "@spotify"], layout: "work", url: "" },
    focus: { apps: ["@browser"], layout: "work", url: "" },
    meeting: { apps: ["@browser"], layout: "none", url: "" },
    gaming: { apps: ["@discord", "@spotify"], layout: "none", url: "" }
  },
  presets: {
    work: { output: "", input: "", volume: 45, micMode: "keep" },
    focus: { output: "", input: "", volume: 35, micMode: "mute" },
    meeting: { output: "", input: "", volume: 55, micMode: "keep" },
    gaming: { output: "", input: "", volume: 65, micMode: "keep" }
  },
  clipboard: { enabled: true, maxItems: 8 }
};

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function isObject(v) { return v && typeof v === "object" && !Array.isArray(v); }
function deepMerge(base, extra) {
  const out = clone(base);
  if (!isObject(extra)) return out;
  for (const [k, v] of Object.entries(extra)) {
    if (isObject(v) && isObject(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = v;
  }
  return out;
}
function clamp(v, min, max, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function normalizeMicMode(preset, fallback = "keep") {
  if (["keep", "mute", "live"].includes(preset?.micMode)) return preset.micMode;
  if (typeof preset?.micMuted === "boolean") return preset.micMuted ? "mute" : "live";
  return fallback;
}
function cleanApps(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return items.map(x => String(x).trim()).filter(Boolean).slice(0, 6);
}
function cleanUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return ["http:", "https:"].includes(u.protocol) ? u.toString() : "";
  } catch { return ""; }
}
function sanitizeWorkspace(raw, fallback) {
  const src = isObject(raw) ? raw : {};
  const layout = ["work", "columns", "grid", "none"].includes(src.layout) ? src.layout : fallback.layout;
  const hasApps = Object.prototype.hasOwnProperty.call(src, "apps");
  return {
    apps: cleanApps(hasApps ? src.apps : fallback.apps),
    layout,
    url: cleanUrl(src.url)
  };
}
function sanitizePreset(raw, fallback) {
  const src = isObject(raw) ? raw : {};
  return {
    output: String(src.output ?? fallback.output ?? "").slice(0, 512),
    input: String(src.input ?? fallback.input ?? "").slice(0, 512),
    volume: clamp(src.volume, 0, 100, fallback.volume),
    micMode: normalizeMicMode(src, fallback.micMode)
  };
}
function sanitizeConfig(raw) {
  const source = isObject(raw) ? raw : {};
  const merged = deepMerge(DEFAULT_CONFIG, source);
  const out = clone(DEFAULT_CONFIG);
  out.version = 2;
  out.setupComplete = !!merged.setupComplete;
  out.outputDevice = String(merged.outputDevice || "").slice(0, 512);
  out.inputDevice = String(merged.inputDevice || "").slice(0, 512);
  for (const name of ["work", "focus", "meeting", "gaming"]) {
    out.workspaces[name] = sanitizeWorkspace(source.workspaces?.[name], DEFAULT_CONFIG.workspaces[name]);
    out.presets[name] = sanitizePreset(source.presets?.[name], DEFAULT_CONFIG.presets[name]);
  }
  out.clipboard.enabled = merged.clipboard?.enabled !== false;
  out.clipboard.maxItems = Math.round(clamp(merged.clipboard?.maxItems, 1, 20, 8));
  return out;
}
function loadConfig(file, log = () => {}) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return sanitizeConfig(raw);
  } catch (e) {
    if (e?.code !== "ENOENT") log(`config load: ${e.message}`);
    return clone(DEFAULT_CONFIG);
  }
}
function saveConfig(file, value, log = () => {}) {
  const clean = sanitizeConfig(value);
  try {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch (e) { log(`config save: ${e.message}`); }
  return clean;
}

module.exports = { DEFAULT_CONFIG, deepMerge, sanitizeConfig, loadConfig, saveConfig, normalizeMicMode, cleanApps };
