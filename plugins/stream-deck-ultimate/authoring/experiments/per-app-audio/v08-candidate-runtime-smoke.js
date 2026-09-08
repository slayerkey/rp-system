"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { createRequire } = require("module");
const { once } = require("events");

const PLUGIN_UUID = "com.packrat.stream-deck-ultimate-bundle";
const APP_AUDIO_UUID = `${PLUGIN_UUID}.app-audio`;
const MEDIA_UUID = `${PLUGIN_UUID}.media`;
const pluginDir = path.resolve(process.argv[2] || path.join(__dirname, "v08-candidate-dist", `${PLUGIN_UUID}.sdPlugin`));
const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));
assert.equal(manifest.UUID, PLUGIN_UUID);
assert.equal(manifest.Version, "0.8.0.0");
assert.equal(manifest.CodePath, "bin/plugin-v08.cjs");
assert.equal(manifest.Actions.filter(x => x.UUID === APP_AUDIO_UUID).length, 1);
const pluginRequire = createRequire(path.join(pluginDir, "package.json"));
const WebSocket = pluginRequire("ws");

(async () => {
  const server = new WebSocket.Server({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const port = server.address().port;
  const received = [];
  const waiters = [];
  let peer = null;
  function deliver(message) {
    received.push(message);
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (!w.predicate(message)) continue;
      waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(message);
    }
  }
  function waitFor(predicate, timeoutMs = 12000) {
    const existing = [...received].reverse().find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, timer: null };
      waiter.timer = setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error(`Timed out waiting for Stream Deck message; received events=${received.map(x => `${x.event}:${x.context || ""}`).join(",")}`));
      }, timeoutMs);
      waiters.push(waiter);
    });
  }
  server.on("connection", ws => {
    peer = ws;
    ws.on("message", raw => { try { deliver(JSON.parse(String(raw))); } catch {} });
  });

  const entry = path.join(pluginDir, ...String(manifest.CodePath).split("/"));
  const child = spawn(process.execPath, [entry, "-port", String(port), "-pluginUUID", PLUGIN_UUID, "-registerEvent", "registerPlugin", "-info", "{}"], {
    cwd: pluginDir,
    env: {
      ...process.env,
      PACKRAT_AUDIO_MOCK: "1",
      PACKRAT_APP_AUDIO_MOCK: "1",
      PACKRAT_CONTEXT_MOCK: "1",
      PACKRAT_CONTEXT_PROCESS: "chrome",
      PACKRAT_DIAGNOSTICS_MOCK: "1",
      PACKRAT_APP_AUDIO_LOG: "1"
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", d => { stdout += d; });
  child.stderr.on("data", d => { stderr += d; });

  try {
    const registration = await waitFor(m => m.event === "registerPlugin");
    assert.equal(registration.uuid, PLUGIN_UUID);
    assert(peer && peer.readyState === WebSocket.OPEN);

    // Existing v0.7.1 core action must still render through the old runtime.
    peer.send(JSON.stringify({ event: "willAppear", action: MEDIA_UUID, context: "legacy-media", payload: { controller: "Keypad", settings: { mode: "mute" } } }));
    const legacyImage = await waitFor(m => m.event === "setImage" && m.context === "legacy-media");
    assert(String(legacyImage.payload?.image || "").startsWith("data:image/png;base64,"));

    // App Volume is routed only to the new lazy adapter.
    peer.send(JSON.stringify({
      event: "willAppear", action: APP_AUDIO_UUID, context: "dial",
      payload: { controller: "Encoder", settings: { mode: "current", step: 2, pressAction: "toggle-mute" } }
    }));
    let feedback = await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "35%");
    assert.equal(feedback.payload.title, "SPOTIFY");
    assert.equal(feedback.payload.indicator.value, 35);
    assert.equal(received.some(m => m.event === "setImage" && m.context === "dial"), false, "Legacy runtime must not render the App Volume action");

    peer.send(JSON.stringify({ event: "dialRotate", action: APP_AUDIO_UUID, context: "dial", payload: { ticks: 2 } }));
    feedback = await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "39%");
    assert.equal(feedback.payload.title, "SPOTIFY");

    peer.send(JSON.stringify({ event: "dialDown", action: APP_AUDIO_UUID, context: "dial", payload: {} }));
    feedback = await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "MUTED");
    assert.equal(feedback.payload.title, "SPOTIFY");

    peer.send(JSON.stringify({ event: "sendToPlugin", action: APP_AUDIO_UUID, context: "pi", payload: { command: "list-apps" } }));
    const pi = await waitFor(m => m.event === "sendToPropertyInspector" && m.context === "pi");
    assert.deepEqual(pi.payload.apps.map(x => x.value), ["discord", "spotify"]);
    assert.equal(pi.payload.unavailable, false);

    peer.send(JSON.stringify({
      event: "willAppear", action: APP_AUDIO_UUID, context: "key",
      payload: { controller: "Keypad", settings: { mode: "process", process: "discord", step: 2, pressAction: "toggle-mute" } }
    }));
    const title = await waitFor(m => m.event === "setTitle" && m.context === "key" && m.payload?.title === "DISCORD\n42%");
    assert.equal(title.payload.target, 0);
    assert.equal(received.some(m => m.event === "setImage" && m.context === "key"), false, "Legacy runtime must not overwrite App Volume keypad rendering");

    // Existing action still renders after App Volume has started its worker.
    peer.send(JSON.stringify({ event: "willAppear", action: MEDIA_UUID, context: "legacy-media-2", payload: { controller: "Keypad", settings: { mode: "play-pause" } } }));
    await waitFor(m => m.event === "setImage" && m.context === "legacy-media-2");

    assert.equal(child.exitCode, null, `v0.8 candidate exited early: ${stderr || stdout}`);
    console.log("v0.8 prepromotion runtime passed: frozen legacy action + isolated lazy App Volume in one plugin process, Current App dial, mute, PI list, keypad title");
  } finally {
    try { if (peer && peer.readyState === WebSocket.OPEN) peer.close(); } catch {}
    if (child.exitCode === null) child.kill();
    await Promise.race([once(child, "exit").catch(() => {}), new Promise(r => setTimeout(r, 1800))]);
    await new Promise(resolve => server.close(resolve));
  }
  if (stderr.trim()) throw new Error(`v0.8 candidate stderr was not empty: ${stderr.trim()}`);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
