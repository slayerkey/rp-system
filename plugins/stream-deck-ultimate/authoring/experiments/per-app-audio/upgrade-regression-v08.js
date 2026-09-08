"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { createRequire } = require("module");
const { once } = require("events");

const UUID = "com.packrat.stream-deck-ultimate-bundle";
const APP_AUDIO = `${UUID}.app-audio`;
const pluginDir = path.resolve(process.argv[2] || "");
if (!pluginDir || !fs.existsSync(pluginDir)) throw new Error(`Candidate plugin directory missing: ${pluginDir}`);
const acceptedDir = path.resolve(__dirname, "../../prototype/com.packrat.stream-deck-ultimate-bundle.sdPlugin");
const fixturePath = path.resolve(__dirname, "accepted-v071-manifest-contract.json");
const currentCanonicalManifest = JSON.parse(fs.readFileSync(path.join(acceptedDir, "manifest.json"), "utf8"));
const acceptedManifest = currentCanonicalManifest.Version === "0.7.1.0"
  ? currentCanonicalManifest
  : JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const candidateManifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));

assert.equal(acceptedManifest.UUID, UUID);
assert.equal(acceptedManifest.Version, "0.7.1.0");
assert.equal(acceptedManifest.CodePath, "bin/plugin-v071.cjs");
assert.equal(candidateManifest.UUID, UUID);
assert.equal(candidateManifest.Version, "0.8.0.0");
assert.equal(candidateManifest.CodePath, "bin/plugin-v08.cjs");
assert.equal(candidateManifest.Actions.filter(a => a.UUID === APP_AUDIO).length, 1, "v0.8 must add App Volume exactly once");

// Existing Stream Deck action UUIDs are the durable identity for user key settings.
// Every accepted action must remain byte-for-byte equivalent in manifest semantics.
const candidateByUuid = new Map(candidateManifest.Actions.map(a => [a.UUID, a]));
for (const accepted of acceptedManifest.Actions) {
  assert(candidateByUuid.has(accepted.UUID), `Existing action disappeared during upgrade: ${accepted.UUID}`);
  assert.deepStrictEqual(candidateByUuid.get(accepted.UUID), accepted, `Existing action contract changed during upgrade: ${accepted.UUID}`);
}
assert.deepStrictEqual(candidateManifest.Profiles, acceptedManifest.Profiles, "Bundled profile declarations changed during v0.8 upgrade");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "packrat-v08-upgrade-"));
const stateDir = path.join(root, "PackRat", "StreamDeckUltimateBundle");
fs.mkdirSync(stateDir, { recursive: true });
const configPath = path.join(stateDir, "config.json");
const historyPath = path.join(stateDir, "clipboard.json");
const seededConfig = {
  version: 2,
  setupComplete: true,
  outputDevice: "Headphones Upgrade Test",
  inputDevice: "Microphone Upgrade Test",
  workspaces: {
    work: { apps: ["@browser", "C:\\Tools\\My Legacy App.exe"], layout: "columns", url: "https://example.com/work" },
    focus: { apps: ["@browser"], layout: "work", url: "https://example.com/focus" },
    meeting: { apps: ["@browser"], layout: "none", url: "" },
    gaming: { apps: ["@discord", "@spotify"], layout: "none", url: "" }
  },
  presets: {
    work: { output: "Headphones Upgrade Test", input: "Microphone Upgrade Test", volume: 47, micMode: "keep" },
    focus: { output: "Headphones Upgrade Test", input: "Microphone Upgrade Test", volume: 33, micMode: "mute" },
    meeting: { output: "Headphones Upgrade Test", input: "Microphone Upgrade Test", volume: 58, micMode: "keep" },
    gaming: { output: "Headphones Upgrade Test", input: "Microphone Upgrade Test", volume: 69, micMode: "live" }
  },
  clipboard: { enabled: true, maxItems: 7 }
};
const seededHistory = ["legacy clipboard one", "legacy clipboard two"];
const configBytes = JSON.stringify(seededConfig, null, 2);
const historyBytes = JSON.stringify(seededHistory, null, 2);
fs.writeFileSync(configPath, configBytes, "utf8");
fs.writeFileSync(historyPath, historyBytes, "utf8");

// First prove the inherited config loader reads the v0.7.1 state without migration loss.
const cfg = require(path.join(pluginDir, "bin", "lib-v06-config.js"));
const loaded = cfg.loadConfig(configPath);
assert.equal(loaded.setupComplete, true);
assert.equal(loaded.outputDevice, seededConfig.outputDevice);
assert.equal(loaded.inputDevice, seededConfig.inputDevice);
assert.deepStrictEqual(loaded.workspaces, seededConfig.workspaces);
assert.deepStrictEqual(loaded.presets, seededConfig.presets);
assert.deepStrictEqual(loaded.clipboard, seededConfig.clipboard);
assert.equal(fs.readFileSync(configPath, "utf8"), configBytes, "Loading v0.7.1 config rewrote the file");
assert.equal(fs.readFileSync(historyPath, "utf8"), historyBytes, "Loading config altered clipboard history");

async function runtimeProof() {
  if (process.platform !== "win32") return { skipped: true, reason: "Windows runtime proof only" };
  const pluginRequire = createRequire(path.join(pluginDir, "package.json"));
  const WebSocket = pluginRequire("ws");
  const server = new WebSocket.Server({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const port = server.address().port;
  const received = [];
  let peer = null;
  server.on("connection", socket => {
    peer = socket;
    socket.on("message", raw => {
      try { received.push(JSON.parse(String(raw))); } catch {}
    });
  });
  function waitFor(predicate, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const timer = setInterval(() => {
        const found = received.find(predicate);
        if (found) { clearInterval(timer); resolve(found); }
        else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          reject(new Error(`Upgrade runtime timeout; received=${JSON.stringify(received.map(x => ({ event: x.event, context: x.context })))}`));
        }
      }, 30);
    });
  }

  const child = spawn(process.execPath, [
    path.join(pluginDir, candidateManifest.CodePath),
    "-port", String(port),
    "-pluginUUID", UUID,
    "-registerEvent", "registerPlugin",
    "-info", "{}"
  ], {
    cwd: pluginDir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      APPDATA: root,
      PACKRAT_AUDIO_MOCK: "1",
      PACKRAT_APP_AUDIO_MOCK: "1",
      PACKRAT_CONTEXT_MOCK: "1",
      PACKRAT_CONTEXT_PROCESS: "chrome"
    }
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", d => { stderr += d; });

  try {
    const registration = await waitFor(m => m.event === "registerPlugin");
    assert.equal(registration.uuid, UUID);
    assert(peer && peer.readyState === WebSocket.OPEN, "Candidate did not keep Stream Deck socket open");

    // Old action and new action coexist in the same upgraded process.
    peer.send(JSON.stringify({
      event: "willAppear", action: `${UUID}.smart-app`, context: "legacy-app", device: "upgrade-device",
      payload: { controller: "Keypad", settings: { role: "browser", behavior: "focus" } }
    }));
    peer.send(JSON.stringify({
      event: "willAppear", action: APP_AUDIO, context: "new-app-audio", device: "upgrade-device",
      payload: { controller: "Keypad", settings: { mode: "process", process: "spotify", step: 2, pressAction: "toggle-mute" } }
    }));
    await waitFor(m => m.context === "new-app-audio" && (m.event === "setTitle" || m.event === "setImage" || m.event === "setFeedback"));
    assert.equal(child.exitCode, null, `Upgraded runtime exited early: ${stderr}`);

    // Neither startup nor simply displaying an App Volume control may mutate old user state.
    assert.equal(fs.readFileSync(configPath, "utf8"), configBytes, "v0.8 runtime mutated existing v0.7.1 config during startup/display");
    assert.equal(fs.readFileSync(historyPath, "utf8"), historyBytes, "v0.8 runtime mutated existing clipboard history during startup/display");
    return { skipped: false };
  } finally {
    try { if (peer && peer.readyState === WebSocket.OPEN) peer.close(); } catch {}
    if (child.exitCode === null) child.kill();
    await Promise.race([once(child, "exit").catch(() => {}), new Promise(r => setTimeout(r, 1600))]);
    await new Promise(resolve => server.close(resolve));
  }
}

runtimeProof().then(result => {
  const baseline = currentCanonicalManifest.Version === "0.7.1.0" ? "canonical v0.7.1" : "frozen v0.7.1 manifest fixture";
  console.log(`v0.7.1 -> v0.8 upgrade regression passed against ${baseline}: production UUID stable, ${acceptedManifest.Actions.length} existing action contracts unchanged, profile declarations unchanged, seeded config/history preserved${result.skipped ? `; runtime skipped (${result.reason})` : "; Windows multiplexed runtime preserved seeded state"}`);
}).catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
