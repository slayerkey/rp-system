"use strict";
const assert = require("assert");
const m = require("./session-model.js");

function s(pid, process, volume, muted = false, state = "Active", extra = {}) {
  return { pid, process, volume, muted, state, displayName: extra.displayName || "", sessionIdentifier: extra.sessionIdentifier || "" };
}

// Exact, path-safe normalization. Product logic must never depend on substring matching.
assert.equal(m.normalizeProcessName("Discord.exe"), "discord");
assert.equal(m.normalizeProcessName("C:\\Apps\\Spotify.EXE"), "spotify");
assert.equal(m.normalizeProcessName("  chrome  "), "chrome");
assert.equal(m.normalizeProcessName(""), "");

const sessions = [
  s(101, "Discord", 42, false, "Active", { displayName: "Voice" }),
  s(101, "Discord", 46, true, "Active", { displayName: "Notifications" }),
  s(202, "Spotify", 35, false, "Inactive"),
  s(303, "DiscordHelper", 90, false, "Active"),
  s(404, "chrome", 60, false, "Expired"),
  s(505, "chrome", 55, false, "Active"),
  s(506, "chrome", 65, false, "Active"),
  s(0, "System Sounds", 100, false, "Active")
];

// Exact process target aggregates only the real app, not similarly named helpers.
let st = m.buildChannelState(sessions, { kind: "process", process: "Discord.exe" });
assert.equal(st.status, "active");
assert.equal(st.process, "discord");
assert.equal(st.sessionCount, 2);
assert.equal(st.pidCount, 1);
assert.deepEqual(st.pids, [101]);
assert.equal(st.volume, 44);
assert.equal(st.volumeMin, 42);
assert.equal(st.volumeMax, 46);
assert.equal(st.mixedVolume, true);
assert.equal(st.muted, null);
assert.equal(st.mixedMute, true);
assert.equal(st.writable, true);

// Process selection must not pull DiscordHelper via substring semantics.
assert.equal(m.buildChannelState(sessions, { kind: "process", process: "DiscordHelper" }).volume, 90);
assert.equal(m.buildChannelState(sessions, { kind: "process", process: "Discord" }).sessionCount, 2);

// A session can exist but be idle. It remains writable and visible rather than "failed".
st = m.buildChannelState(sessions, { kind: "process", process: "spotify" });
assert.equal(st.status, "idle");
assert.equal(st.volume, 35);
assert.equal(st.writable, true);

// Expired sessions do not make an app look available.
st = m.buildChannelState([s(404, "chrome", 60, false, "Expired")], { kind: "process", process: "chrome" });
assert.equal(st.status, "waiting");
assert.equal(st.writable, false);

// Missing app/session is a deliberate WAITING state, never an exception plan.
st = m.buildChannelState(sessions, { kind: "process", process: "vlc" });
assert.equal(st.status, "waiting");
assert.equal(st.label, "WAITING");
assert.equal(m.planCommand(st, { type: "adjust-volume", delta: 4 }).execute, false);
assert.equal(m.planCommand(st, { type: "toggle-mute" }).reason, "waiting");

// Unconfigured surfaces tell the user to configure the app.
st = m.buildChannelState(sessions, { kind: "process", process: "" });
assert.equal(st.status, "unconfigured");
assert.equal(m.displayState(st).value, "SET APP");

// PID targets are exact and safe.
st = m.buildChannelState(sessions, { kind: "pid", pid: 505 });
assert.equal(st.status, "active");
assert.equal(st.process, "chrome");
assert.deepEqual(st.pids, [505]);
assert.equal(st.volume, 55);
assert.deepEqual(m.planCommand(st, { type: "set-volume", value: 200 }), { execute: true, action: "SetVolume", match: "505", value: 100 });
assert.deepEqual(m.planCommand(st, { type: "adjust-volume", delta: -7 }), { execute: true, action: "AdjustVolume", match: "505", value: -7 });

// Current app prefers foreground PID when available, protecting against another same-process session.
st = m.buildChannelState(sessions, { kind: "current" }, { pid: 506, process: "chrome.exe" });
assert.equal(st.status, "active");
assert.deepEqual(st.pids, [506]);
assert.equal(st.volume, 65);
assert.equal(m.planCommand(st, { type: "mute" }).match, "506");

// Without PID, Current App deliberately controls the exact application identity as a group.
st = m.buildChannelState(sessions, { kind: "current" }, { process: "chrome.exe" });
assert.equal(st.sessionCount, 2);
assert.equal(st.pidCount, 2);
assert.equal(st.volume, 60);
assert.equal(st.mixedVolume, true);
assert.equal(m.planCommand(st, { type: "adjust-volume", delta: 2 }).match, "chrome");

// A mismatched foreground PID + process does not accidentally control a session from another process.
st = m.buildChannelState(sessions, { kind: "current" }, { pid: 101, process: "chrome" });
assert.equal(st.status, "waiting");
assert.equal(st.writable, false);

// Toggle behavior converges mixed state to mute, then all-muted state to unmute.
st = m.buildChannelState(sessions, { kind: "process", process: "discord" });
assert.equal(m.planCommand(st, { type: "toggle-mute" }).action, "Mute");
const allMuted = m.buildChannelState([s(101, "Discord", 42, true), s(101, "Discord", 42, true)], { kind: "process", process: "discord" });
assert.equal(allMuted.muted, true);
assert.equal(m.planCommand(allMuted, { type: "toggle-mute" }).action, "Unmute");

// Zero-delta turns into a no-op instead of spawning a native write.
assert.equal(m.planCommand(allMuted, { type: "adjust-volume", delta: 0 }).execute, false);
assert.equal(m.planCommand(allMuted, { type: "adjust-volume", delta: 0 }).reason, "zero-delta");

// Display state is useful at Stream Deck+ scale and reflects mixed/muted/waiting conditions.
let display = m.displayState(m.buildChannelState(sessions, { kind: "process", process: "discord" }));
assert.equal(display.title, "DISCORD");
assert.equal(display.value, "44% · MIXED");
assert.equal(display.indicator.value, 44);
display = m.displayState(allMuted);
assert.equal(display.value, "MUTED");
display = m.displayState(m.buildChannelState([], { kind: "process", process: "very-long-application-name" }), 10);
assert.equal(display.value, "WAITING");
assert(display.title.endsWith("…"));
assert(display.title.length <= 10);

// System Sounds is intentionally not exposed as an app channel.
st = m.buildChannelState([s(0, "System Sounds", 100, false)], { kind: "process", process: "System Sounds" });
assert.equal(st.status, "waiting");

console.log("per-app audio session model passed: exact targeting, duplicate aggregation, current-app PID safety, WAITING semantics, mixed state, safe command plans");
