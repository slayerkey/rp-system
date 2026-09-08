"use strict";
const assert = require("assert");
const surface = require("./streamdeck-surface-model.js");

assert.deepEqual(surface.sanitizeSettings({}), { mode: "current", process: "", step: 2, pressAction: "toggle-mute" });
assert.deepEqual(surface.sanitizeSettings({ mode: "process", process: "Discord.exe", step: 99, pressAction: "none" }), { mode: "process", process: "discord", step: 10, pressAction: "none" });
assert.deepEqual(surface.targetFromSettings({ mode: "current" }), { kind: "current" });
assert.deepEqual(surface.targetFromSettings({ mode: "process", process: "Spotify.exe" }), { kind: "process", process: "spotify" });

const active = { status: "active", process: "discord", volume: 42, muted: false, mixedVolume: false, mixedMute: false };
const mixed = { status: "active", process: "chrome", volume: 60, muted: null, mixedVolume: true, mixedMute: true };
const muted = { status: "idle", process: "spotify", volume: 35, muted: true, mixedVolume: false, mixedMute: false };
const waiting = { status: "waiting", process: "vlc", volume: null, muted: null };
const unavailable = { status: "unavailable", process: "discord", volume: null, muted: null };
const unconfigured = { status: "unconfigured", process: "", volume: null, muted: null };

assert.deepEqual(surface.semanticVisual(active), { title: "DISCORD", value: "42%", icon: "app-audio", status: "active" });
assert.deepEqual(surface.semanticVisual(mixed), { title: "CHROME", value: "60% MIXED", icon: "app-mixed", status: "active" });
assert.deepEqual(surface.semanticVisual(muted), { title: "SPOTIFY", value: "MUTED", icon: "app-muted", status: "idle" });
assert.deepEqual(surface.semanticVisual(waiting), { title: "VLC", value: "WAITING", icon: "app-waiting", status: "waiting" });
assert.deepEqual(surface.semanticVisual(unavailable), { title: "DISCORD", value: "AUDIO OFF", icon: "audio-off", status: "unavailable" });
assert.deepEqual(surface.semanticVisual(unconfigured, { mode: "process" }), { title: "APP AUDIO", value: "SET APP", icon: "app-setup", status: "unconfigured" });

assert.deepEqual(surface.dialFeedback(active), { title: "DISCORD", value: "42%", indicator: { value: 42 } });
assert.deepEqual(surface.dialFeedback(waiting), { title: "VLC", value: "WAITING", indicator: { value: 0 } });
assert.deepEqual(surface.dialFeedback(unavailable), { title: "DISCORD", value: "AUDIO OFF", indicator: { value: 0 } });

assert.deepEqual(surface.rotateCommand(3, { step: 2 }), { type: "adjust-volume", delta: 6 });
assert.deepEqual(surface.rotateCommand(-4, { step: 3 }), { type: "adjust-volume", delta: -12 });
assert.equal(surface.rotateCommand(0, { step: 2 }), null);
assert.deepEqual(surface.rotateCommand(100, { step: 10 }), { type: "adjust-volume", delta: 100 });

assert.deepEqual(surface.pressCommand(active), { type: "toggle-mute" });
assert.deepEqual(surface.pressCommand(muted), { type: "toggle-mute" });
assert.equal(surface.pressCommand(waiting), null);
assert.equal(surface.pressCommand(unavailable), null);
assert.equal(surface.pressCommand(active, { pressAction: "none" }), null);

assert.deepEqual(surface.eventIntent({ type: "dialRotate", ticks: 2 }, active, { step: 2 }), { type: "adjust-volume", delta: 4 });
assert.deepEqual(surface.eventIntent({ type: "dialPress" }, active, {}), { type: "toggle-mute" });
assert.deepEqual(surface.eventIntent({ type: "keyPress" }, active, {}), { type: "toggle-mute" });
assert.equal(surface.eventIntent({ type: "dialPress" }, waiting, {}), null);

const long = surface.semanticVisual({ ...active, process: "an-extremely-long-application-name" });
assert(long.title.endsWith("…"));
assert(long.title.length <= 14);

console.log("Stream Deck app-audio surface model passed: Current App/named target semantics, WAITING/AUDIO OFF/SET APP states, dial feedback, tick step, safe press behavior");
