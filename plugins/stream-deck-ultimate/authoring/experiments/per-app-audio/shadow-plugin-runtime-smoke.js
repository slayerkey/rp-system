"use strict";
const assert = require("assert");
const path = require("path");
const { spawn } = require("child_process");
const { createRequire } = require("module");
const { once } = require("events");

const LAB_PLUGIN_UUID = "com.packrat.stream-deck-ultimate-app-volume-lab";
const LAB_ACTION_UUID = `${LAB_PLUGIN_UUID}.app-audio`;
const pluginDir = path.resolve(process.argv[2] || path.join(__dirname, "shadow-plugin-dist", `${LAB_PLUGIN_UUID}.sdPlugin`));
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
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const i = waiters.indexOf(waiter);
        if (i >= 0) waiters.splice(i, 1);
        reject(new Error(`Timed out waiting for Stream Deck message; received=${JSON.stringify(received)}`));
      }, timeoutMs);
      waiters.push(waiter);
    });
  }
  server.on("connection", ws => {
    peer = ws;
    ws.on("message", raw => {
      try { deliver(JSON.parse(String(raw))); } catch {}
    });
  });

  const entry = path.join(pluginDir, "bin", "plugin.cjs");
  const child = spawn(process.execPath, [entry, "-port", String(port), "-pluginUUID", LAB_PLUGIN_UUID, "-registerEvent", "registerPlugin", "-info", "{}"], {
    cwd: pluginDir,
    env: { ...process.env, PACKRAT_APP_AUDIO_MOCK: "1", PACKRAT_LAB_LOG: "1" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "", stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", d => { stdout += d; });
  child.stderr.on("data", d => { stderr += d; });

  try {
    const registration = await waitFor(m => m.event === "registerPlugin");
    assert.equal(registration.uuid, LAB_PLUGIN_UUID);
    assert(peer && peer.readyState === WebSocket.OPEN);

    peer.send(JSON.stringify({
      event: "willAppear", action: LAB_ACTION_UUID, context: "dial",
      payload: { controller: "Encoder", settings: { mode: "current", step: 2, pressAction: "toggle-mute" } }
    }));
    let feedback = await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "35%");
    assert.equal(feedback.payload.title, "SPOTIFY");
    assert.equal(feedback.payload.indicator.value, 35);

    peer.send(JSON.stringify({ event: "dialRotate", action: LAB_ACTION_UUID, context: "dial", payload: { ticks: 2 } }));
    feedback = await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "39%");
    assert.equal(feedback.payload.title, "SPOTIFY");

    peer.send(JSON.stringify({ event: "dialDown", action: LAB_ACTION_UUID, context: "dial", payload: {} }));
    feedback = await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "MUTED");
    assert.equal(feedback.payload.title, "SPOTIFY");

    peer.send(JSON.stringify({ event: "sendToPlugin", action: LAB_ACTION_UUID, context: "pi", payload: { command: "list-apps" } }));
    const pi = await waitFor(m => m.event === "sendToPropertyInspector" && m.context === "pi");
    assert.deepEqual(pi.payload.apps.map(x => x.value), ["discord", "spotify"]);
    assert.equal(pi.payload.unavailable, false);

    peer.send(JSON.stringify({
      event: "willAppear", action: LAB_ACTION_UUID, context: "key",
      payload: { controller: "Keypad", settings: { mode: "process", process: "discord", step: 2, pressAction: "toggle-mute" } }
    }));
    const title = await waitFor(m => m.event === "setTitle" && m.context === "key" && m.payload?.title === "DISCORD\n42%");
    assert.equal(title.payload.target, 0);

    assert.equal(child.exitCode, null, `Lab plugin exited early: ${stderr || stdout}`);
    console.log("shadow App Volume plugin runtime passed: real websocket registration, packaged mock worker, Current App dial, mute press, PI app list, keypad title");
  } finally {
    try { if (peer && peer.readyState === WebSocket.OPEN) peer.close(); } catch {}
    if (child.exitCode === null) child.kill();
    await Promise.race([once(child, "exit").catch(() => {}), new Promise(r => setTimeout(r, 1800))]);
    await new Promise(resolve => server.close(resolve));
  }
  if (stderr.trim()) throw new Error(`Shadow plugin stderr was not empty: ${stderr.trim()}`);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
