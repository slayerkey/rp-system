"use strict";
const path = require("path");
const WebSocket = require("ws");
const { createAppAudioRuntime } = require("./runtime-factory.js");
const { createProtocolRenderer, AppAudioActionBridge } = require("./streamdeck-bridge.js");

const LAB_PLUGIN_UUID = "com.packrat.stream-deck-ultimate-app-volume-lab";
const LAB_ACTION_UUID = `${LAB_PLUGIN_UUID}.app-audio`;
const args = process.argv.slice(2);
const arg = name => {
  const i = args.indexOf(name);
  return i >= 0 ? String(args[i + 1] || "") : "";
};
const port = arg("-port");
const pluginUUID = arg("-pluginUUID") || LAB_PLUGIN_UUID;
const registerEvent = arg("-registerEvent") || "registerPlugin";
if (!port) throw new Error("Stream Deck did not provide -port");

let socket;
let refreshTimer = null;
let closing = false;
function send(message) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

const runtime = createAppAudioRuntime({
  workerScript: path.join(__dirname, "app-audio-worker.ps1"),
  assemblyPath: path.join(__dirname, "PackRatAppAudio.dll"),
  mock: process.env.PACKRAT_APP_AUDIO_MOCK === "1",
  cacheMs: 650,
  coalesceMs: 55,
  timeoutMs: 7000,
  render: createProtocolRenderer(send)
});
const bridge = new AppAudioActionBridge({ runtime, send, actionUUID: LAB_ACTION_UUID });
let readyPromise = null;

async function close(exitCode = 0) {
  if (closing) return;
  closing = true;
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  try { await runtime.dispose(); } catch {}
  try { if (socket && socket.readyState < WebSocket.CLOSING) socket.close(); } catch {}
  setTimeout(() => process.exit(exitCode), 20).unref();
}

socket = new WebSocket(`ws://127.0.0.1:${port}`);
socket.on("open", () => {
  send({ event: registerEvent, uuid: pluginUUID });
  readyPromise = runtime.start().then(result => {
    refreshTimer = setInterval(() => {
      runtime.controller.refreshVisible(false).catch(() => {});
    }, 900);
    if (typeof refreshTimer.unref === "function") refreshTimer.unref();
    return result;
  });
});

socket.on("message", async raw => {
  let message;
  try { message = JSON.parse(String(raw)); } catch { return; }
  if (!bridge.accepts(message)) return;
  try {
    if (readyPromise) await readyPromise;
    else throw new Error("App Volume runtime is not ready");
    await bridge.handle(message);
  } catch (error) {
    if (message.context) send({ event: "showAlert", context: String(message.context) });
    if (process.env.PACKRAT_LAB_LOG === "1") console.error(error?.stack || error);
  }
});

socket.on("close", () => close(0));
socket.on("error", error => {
  if (process.env.PACKRAT_LAB_LOG === "1") console.error(error?.stack || error);
  close(1);
});
process.on("SIGTERM", () => close(0));
process.on("SIGINT", () => close(0));
process.on("uncaughtException", error => {
  console.error(error?.stack || error);
  close(1);
});
process.on("unhandledRejection", error => {
  console.error(error?.stack || error);
  close(1);
});
