"use strict";
const model = require("./session-model.js");

function sanitizeSettings(settings = {}) {
  const mode = String(settings.mode || "current").toLowerCase() === "process" ? "process" : "current";
  const process = model.normalizeProcessName(settings.process || settings.app || "");
  const step = Math.round(model.clamp(settings.step, 1, 10, 2));
  const pressAction = String(settings.pressAction || "toggle-mute").toLowerCase() === "none" ? "none" : "toggle-mute";
  return { mode, process, step, pressAction };
}

function targetFromSettings(settings = {}) {
  const s = sanitizeSettings(settings);
  return s.mode === "current" ? { kind: "current" } : { kind: "process", process: s.process };
}

function titleForState(state, settings = {}, max = 14) {
  const s = sanitizeSettings(settings);
  let raw = state?.process || (s.mode === "current" ? "CURRENT APP" : s.process || "APP AUDIO");
  raw = String(raw).toUpperCase();
  return raw.length > max ? `${raw.slice(0, Math.max(1, max - 1))}…` : raw;
}

function semanticVisual(state, settings = {}) {
  const status = state?.status || "unconfigured";
  const title = titleForState(state, settings);
  if (status === "unavailable") return { title, value: "AUDIO OFF", icon: "audio-off", status };
  if (status === "waiting") return { title, value: "WAITING", icon: "app-waiting", status };
  if (status === "unconfigured") return { title: "APP AUDIO", value: "SET APP", icon: "app-setup", status };
  if (state?.muted === true) return { title, value: "MUTED", icon: "app-muted", status };
  const value = state?.mixedVolume ? `${Number(state.volume || 0)}% MIXED` : `${Number(state?.volume || 0)}%`;
  return { title, value, icon: state?.mixedMute ? "app-mixed" : "app-audio", status };
}

function dialFeedback(state, settings = {}) {
  const visual = semanticVisual(state, settings);
  const live = ["active", "idle"].includes(visual.status);
  return {
    title: visual.title,
    value: visual.value,
    indicator: live ? { value: Math.round(model.clamp(state?.volume, 0, 100, 0)) } : { value: 0 }
  };
}

function rotateCommand(ticks, settings = {}) {
  const s = sanitizeSettings(settings);
  const t = Math.round(model.clamp(ticks, -100, 100, 0));
  const delta = Math.round(model.clamp(t * s.step, -100, 100, 0));
  return delta ? { type: "adjust-volume", delta } : null;
}

function pressCommand(state, settings = {}) {
  const s = sanitizeSettings(settings);
  if (s.pressAction === "none") return null;
  if (!["active", "idle"].includes(state?.status)) return null;
  return { type: "toggle-mute" };
}

function eventIntent(event, state, settings = {}) {
  const type = String(event?.type || "");
  if (type === "dialRotate") return rotateCommand(event.ticks, settings);
  if (type === "dialPress" || type === "keyPress") return pressCommand(state, settings);
  return null;
}

module.exports = { sanitizeSettings, targetFromSettings, titleForState, semanticVisual, dialFeedback, rotateCommand, pressCommand, eventIntent };
