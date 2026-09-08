"use strict";

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function normalizeProcessName(value) {
  return String(value || "")
    .trim()
    .replace(/^.*[\\/]/, "")
    .replace(/\.exe$/i, "")
    .toLowerCase();
}

function normalizeState(value) {
  const s = String(value || "").toLowerCase();
  if (s === "active") return "active";
  if (s === "expired") return "expired";
  return "inactive";
}

function normalizeSession(raw, index = 0) {
  const pid = Number(raw?.pid);
  const process = String(raw?.process || "").trim();
  return {
    index,
    pid: Number.isInteger(pid) && pid >= 0 ? pid : 0,
    process,
    processKey: normalizeProcessName(process),
    displayName: String(raw?.displayName || ""),
    sessionIdentifier: String(raw?.sessionIdentifier || ""),
    volume: Math.round(clamp(raw?.volume, 0, 100, 0)),
    muted: !!raw?.muted,
    state: normalizeState(raw?.state)
  };
}

function usableSessions(input) {
  return (Array.isArray(input) ? input : [])
    .map(normalizeSession)
    .filter(s => s.state !== "expired" && s.processKey && s.processKey !== "system sounds");
}

function resolveSelector(target = {}, foreground = {}) {
  const kind = String(target.kind || "process").toLowerCase();
  if (kind === "pid") {
    const pid = Number(target.pid);
    return Number.isInteger(pid) && pid > 0 ? { kind: "pid", pid } : null;
  }
  if (kind === "current") {
    const pid = Number(foreground.pid);
    const processKey = normalizeProcessName(foreground.process);
    if (Number.isInteger(pid) && pid > 0) return { kind: "pid", pid, processKey };
    return processKey ? { kind: "process", processKey, current: true } : null;
  }
  const processKey = normalizeProcessName(target.process || target.match);
  return processKey ? { kind: "process", processKey } : null;
}

function matchesSelector(session, selector) {
  if (!selector) return false;
  if (selector.kind === "pid") {
    if (session.pid !== selector.pid) return false;
    if (selector.processKey && session.processKey !== selector.processKey) return false;
    return true;
  }
  return session.processKey === selector.processKey;
}

function average(values) {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
}

function buildChannelState(input, target = {}, foreground = {}) {
  const sessions = usableSessions(input);
  const selector = resolveSelector(target, foreground);
  if (!selector) {
    return {
      status: "unconfigured", label: "SET APP", process: "", selector: null,
      sessionCount: 0, pidCount: 0, pids: [], volume: null, volumeMin: null, volumeMax: null,
      mixedVolume: false, muted: null, mixedMute: false, writable: false
    };
  }

  const matched = sessions.filter(s => matchesSelector(s, selector));
  const processKey = selector.processKey || matched[0]?.processKey || "";
  if (!matched.length) {
    return {
      status: "waiting", label: "WAITING", process: processKey, selector,
      sessionCount: 0, pidCount: selector.kind === "pid" ? 1 : 0,
      pids: selector.kind === "pid" ? [selector.pid] : [],
      volume: null, volumeMin: null, volumeMax: null,
      mixedVolume: false, muted: null, mixedMute: false, writable: false
    };
  }

  const pids = [...new Set(matched.map(s => s.pid).filter(Boolean))].sort((a, b) => a - b);
  const volumes = matched.map(s => s.volume);
  const mutedValues = matched.map(s => s.muted);
  const volumeMin = Math.min(...volumes), volumeMax = Math.max(...volumes);
  const allMuted = mutedValues.every(Boolean), noneMuted = mutedValues.every(v => !v);
  const anyActive = matched.some(s => s.state === "active");
  return {
    status: anyActive ? "active" : "idle",
    label: anyActive ? "ACTIVE" : "IDLE",
    process: processKey,
    selector,
    sessionCount: matched.length,
    pidCount: pids.length,
    pids,
    volume: average(volumes),
    volumeMin,
    volumeMax,
    mixedVolume: volumeMin !== volumeMax,
    muted: allMuted ? true : noneMuted ? false : null,
    mixedMute: !(allMuted || noneMuted),
    writable: true
  };
}

function commandMatch(state) {
  if (!state?.writable || !state.selector) return "";
  if (state.selector.kind === "pid") return String(state.selector.pid);
  return state.selector.processKey;
}

function planCommand(state, command = {}) {
  if (!state || ["waiting", "unconfigured"].includes(state.status) || !state.writable) {
    return { execute: false, reason: state?.status || "unavailable", status: state?.status || "unavailable" };
  }
  const match = commandMatch(state);
  if (!match) return { execute: false, reason: "no-safe-selector", status: state.status };
  const type = String(command.type || "").toLowerCase();
  if (type === "set-volume") {
    return { execute: true, action: "SetVolume", match, value: Math.round(clamp(command.value, 0, 100, state.volume ?? 0)) };
  }
  if (type === "adjust-volume") {
    const delta = Math.round(clamp(command.delta, -100, 100, 0));
    if (!delta) return { execute: false, reason: "zero-delta", status: state.status };
    return { execute: true, action: "AdjustVolume", match, value: delta };
  }
  if (type === "mute") return { execute: true, action: "Mute", match };
  if (type === "unmute") return { execute: true, action: "Unmute", match };
  if (type === "toggle-mute") {
    // Mixed state deliberately converges to muted on the first press.
    return { execute: true, action: state.muted === true ? "Unmute" : "Mute", match };
  }
  return { execute: false, reason: "unknown-command", status: state.status };
}

function displayState(state, maxLabel = 14) {
  if (!state) return { title: "APP AUDIO", value: "WAITING", indicator: null };
  const process = String(state.process || "APP").toUpperCase();
  const title = process.length > maxLabel ? `${process.slice(0, maxLabel - 1)}…` : process;
  if (state.status === "waiting") return { title, value: "WAITING", indicator: null };
  if (state.status === "unconfigured") return { title: "APP AUDIO", value: "SET APP", indicator: null };
  const mute = state.muted === true ? "MUTED" : state.mixedMute ? "MIXED" : `${state.volume}%`;
  return {
    title,
    value: state.mixedVolume && state.muted !== true ? `${state.volume}% · MIXED` : mute,
    indicator: { value: Number(state.volume || 0) }
  };
}

module.exports = {
  clamp, normalizeProcessName, normalizeSession, usableSessions, resolveSelector,
  matchesSelector, buildChannelState, commandMatch, planCommand, displayState
};
