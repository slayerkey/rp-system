"use strict";
const model = require("./session-model.js");
const { DEFAULT_SETTINGS } = require("./action-spec.js");

const STEP_PRESETS = Object.freeze([
  { value: 1, label: "Fine · 1% per tick" },
  { value: 2, label: "Standard · 2% per tick" },
  { value: 5, label: "Fast · 5% per tick" }
]);

function normalizeSettings(raw = {}) {
  const mode = String(raw.mode || DEFAULT_SETTINGS.mode).toLowerCase() === "process" ? "process" : "current";
  const process = model.normalizeProcessName(raw.process || raw.app || "");
  const stepValue = Math.round(model.clamp(raw.step, 1, 10, DEFAULT_SETTINGS.step));
  const step = [1, 2, 5].includes(stepValue) ? stepValue : DEFAULT_SETTINGS.step;
  const pressAction = String(raw.pressAction || DEFAULT_SETTINGS.pressAction).toLowerCase() === "none" ? "none" : "toggle-mute";
  return { mode, process, step, pressAction };
}

function activeAppOptions(rows = []) {
  const map = new Map();
  for (const session of model.usableSessions(rows)) {
    const key = session.processKey;
    if (!key || map.has(key)) continue;
    map.set(key, {
      value: key,
      label: session.process || key,
      pidCount: 0,
      sessionCount: 0,
      active: false
    });
  }
  for (const option of map.values()) {
    const matches = model.usableSessions(rows).filter(s => s.processKey === option.value);
    option.sessionCount = matches.length;
    option.pidCount = new Set(matches.map(s => s.pid).filter(Boolean)).size;
    option.active = matches.some(s => s.state === "active");
  }
  return [...map.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.label.localeCompare(b.label));
}

function settingsView(raw = {}, rows = []) {
  const settings = normalizeSettings(raw);
  const apps = activeAppOptions(rows);
  const configured = settings.mode === "current" || !!settings.process;
  return {
    settings,
    modeOptions: [
      { value: "current", label: "Current App · Recommended" },
      { value: "process", label: "Specific App" }
    ],
    appOptions: apps,
    showAppPicker: settings.mode === "process",
    stepOptions: STEP_PRESETS,
    pressOptions: [
      { value: "toggle-mute", label: "Mute / unmute" },
      { value: "none", label: "Do nothing" }
    ],
    configured,
    summary: settings.mode === "current"
      ? `Current App · ${settings.step}% per tick${settings.pressAction === "toggle-mute" ? " · press mutes" : ""}`
      : settings.process
        ? `${settings.process} · ${settings.step}% per tick${settings.pressAction === "toggle-mute" ? " · press mutes" : ""}`
        : "Choose an app"
  };
}

module.exports = { STEP_PRESETS, normalizeSettings, activeAppOptions, settingsView };
