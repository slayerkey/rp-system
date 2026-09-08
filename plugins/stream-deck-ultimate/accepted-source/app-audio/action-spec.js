"use strict";

const ACTION_UUID = "com.packrat.stream-deck-ultimate-bundle.app-audio";
const DEFAULT_SETTINGS = Object.freeze({ mode: "current", process: "", step: 2, pressAction: "toggle-mute" });

const MANIFEST_ACTION = Object.freeze({
  Controllers: ["Keypad", "Encoder"],
  Icon: "imgs/actions/app-audio/icon",
  Name: "App Volume",
  States: [{ Image: "imgs/actions/app-audio/key" }],
  Tooltip: "Control the foreground app or a specific app's Windows audio-session volume, with live volume and mute feedback.",
  Encoder: {
    Icon: "imgs/actions/app-audio/key",
    layout: "$B1",
    TriggerDescription: {
      Push: "Mute or unmute app",
      Rotate: "Adjust app volume",
      Touch: "App volume"
    }
  },
  UUID: ACTION_UUID
});

module.exports = { ACTION_UUID, DEFAULT_SETTINGS, MANIFEST_ACTION };
