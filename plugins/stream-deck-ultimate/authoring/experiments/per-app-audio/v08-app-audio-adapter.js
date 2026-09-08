"use strict";
const path = require("path");
const { createAppAudioRuntime } = require("./app-audio/runtime-factory.js");
const { createProtocolRenderer, AppAudioActionBridge } = require("./app-audio/streamdeck-bridge.js");

const ACTION_UUID = "com.packrat.stream-deck-ultimate-bundle.app-audio";

function attach(ws) {
  let runtime = null;
  let bridge = null;
  let readyPromise = null;
  let refreshTimer = null;
  let disposed = false;

  function send(message) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
  }

  function ensureRuntime() {
    if (disposed) return Promise.reject(new Error("App Volume adapter is disposed"));
    if (!runtime) {
      const audioRoot = path.join(__dirname, "app-audio");
      runtime = createAppAudioRuntime({
        workerScript: path.join(audioRoot, "app-audio-worker.ps1"),
        assemblyPath: path.join(audioRoot, "PackRatAppAudio.dll"),
        mock: process.env.PACKRAT_APP_AUDIO_MOCK === "1",
        cacheMs: 650,
        coalesceMs: 55,
        timeoutMs: 7000,
        render: createProtocolRenderer(send)
      });
      bridge = new AppAudioActionBridge({ runtime, send, actionUUID: ACTION_UUID });
    }
    if (!readyPromise) {
      readyPromise = runtime.start().then(result => {
        refreshTimer = setInterval(() => {
          runtime.controller.refreshVisible(false).catch(() => {});
        }, 900);
        if (typeof refreshTimer.unref === "function") refreshTimer.unref();
        return result;
      });
    }
    return readyPromise;
  }

  ws.addEventListener("message", async ev => {
    let message;
    try { message = JSON.parse(String(ev.data)); } catch { return; }
    if (String(message.action || "") !== ACTION_UUID) return;
    try {
      await ensureRuntime();
      await bridge.handle(message);
    } catch (error) {
      if (message.context) send({ event: "showAlert", context: String(message.context) });
      if (process.env.PACKRAT_APP_AUDIO_LOG === "1") console.error(error?.stack || error);
    }
  });

  ws.addEventListener("close", () => {
    disposed = true;
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    if (runtime) runtime.dispose().catch(() => {});
  });

  return {
    actionUUID: ACTION_UUID,
    isAppAudioMessage(message = {}) { return String(message.action || "") === ACTION_UUID; },
    isStarted() { return !!readyPromise; }
  };
}

module.exports = { ACTION_UUID, attach };
