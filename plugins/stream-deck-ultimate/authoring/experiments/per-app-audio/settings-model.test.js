"use strict";
const assert = require("assert");
const { ACTION_UUID, DEFAULT_SETTINGS, MANIFEST_ACTION } = require("./action-spec.js");
const { normalizeSettings, activeAppOptions, settingsView } = require("./settings-model.js");

function row(pid, process, volume = 50, muted = false, state = "Active") {
  return { pid, process, volume, muted, state, displayName: "", sessionIdentifier: `${process}-${pid}` };
}

(() => {
  assert.equal(ACTION_UUID, "com.packrat.stream-deck-ultimate-bundle.app-audio");
  assert.deepEqual(MANIFEST_ACTION.Controllers, ["Keypad", "Encoder"]);
  assert.equal(MANIFEST_ACTION.Encoder.layout, "$B1");
  assert.equal(MANIFEST_ACTION.Encoder.TriggerDescription.Rotate, "Adjust app volume");
  assert.equal(DEFAULT_SETTINGS.mode, "current");
  assert.equal(DEFAULT_SETTINGS.step, 2);

  assert.deepEqual(normalizeSettings({}), { mode: "current", process: "", step: 2, pressAction: "toggle-mute" });
  assert.deepEqual(
    normalizeSettings({ mode: "process", process: "C:\\Apps\\Discord.exe", step: 5, pressAction: "none" }),
    { mode: "process", process: "discord", step: 5, pressAction: "none" }
  );
  assert.equal(normalizeSettings({ step: 7 }).step, 2);
  assert.equal(normalizeSettings({ step: 0 }).step, 1);
  assert.equal(normalizeSettings({ step: 100 }).step, 2);

  const rows = [
    row(101, "Discord", 40, false, "Inactive"),
    row(101, "Discord", 40, false, "Active"),
    row(202, "Spotify", 35, false, "Active"),
    row(303, "VLC", 50, false, "Expired"),
    row(0, "System Sounds", 50, false, "Active")
  ];
  const options = activeAppOptions(rows);
  assert.deepEqual(options.map(x => x.value), ["discord", "spotify"]);
  assert.equal(options[0].sessionCount, 2);
  assert.equal(options[0].pidCount, 1);
  assert.equal(options[0].active, true);
  assert.equal(options[1].sessionCount, 1);

  const current = settingsView({}, rows);
  assert.equal(current.showAppPicker, false);
  assert.equal(current.configured, true);
  assert.match(current.summary, /^Current App/);
  assert.deepEqual(current.stepOptions.map(x => x.value), [1, 2, 5]);

  const missing = settingsView({ mode: "process", process: "" }, rows);
  assert.equal(missing.showAppPicker, true);
  assert.equal(missing.configured, false);
  assert.equal(missing.summary, "Choose an app");
  assert.equal(missing.appOptions.length, 2);

  const named = settingsView({ mode: "process", process: "Spotify.exe", step: 1 }, rows);
  assert.equal(named.configured, true);
  assert.equal(named.settings.process, "spotify");
  assert.equal(named.summary, "spotify · 1% per tick · press mutes");

  console.log("App Volume v0.8 shadow contract passed: dual-controller manifest spec, Current App default, simple named-app picker, 1/2/5% sensitivity, optional mute press");
})();
