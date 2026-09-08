"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const pluginDir = path.resolve(process.argv[2]);
const WebSocket = require(path.join(pluginDir, "node_modules", "ws"));
const { WebSocketServer } = WebSocket;
const UUID = "com.packrat.stream-deck-ultimate-bundle";
const messages = [];
let child;

const tiny = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5xYkAAAAASUVORK5CYII=",
  "base64"
);
const needed = [
  "ctx-back", "ctx-new-tab", "ctx-refresh", "ctx-close", "ctx-command", "ctx-terminal", "ctx-save",
  "ctx-up", "ctx-address", "ctx-new-window", "ctx-search", "ctx-switch", "ctx-discord-mute", "ctx-deafen",
  "web-active", "discord-active", "spotify-active", "smart"
];
for (const n of needed) {
  const p = path.join(pluginDir, "imgs", "keys", n + ".png");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, tiny);
}
const actionDir = path.join(pluginDir, "imgs", "actions", "context");
fs.mkdirSync(actionDir, { recursive: true });
for (const n of ["icon.png", "key.png"]) {
  const p = path.join(actionDir, n);
  if (!fs.existsSync(p)) fs.writeFileSync(p, tiny);
}

function data(rel) {
  return "data:image/png;base64," + fs.readFileSync(path.join(pluginDir, rel)).toString("base64");
}
function waitFor(pred, timeout = 7000, from = 0) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const t = setInterval(() => {
      const v = messages.slice(from).find(pred);
      if (v) {
        clearInterval(t);
        resolve(v);
      } else if (Date.now() - start > timeout) {
        clearInterval(t);
        reject(new Error(
          "Timed out. Seen: " + JSON.stringify(messages.slice(from).map(x => ({ event: x.event, context: x.context })))
        ));
      }
    }, 30);
  });
}
function cleanup() {
  try { child?.kill(); } catch {}
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));
  if (!["bin/plugin-v07.cjs", "bin/plugin-v071.cjs", "bin/plugin-v08.cjs"].includes(manifest.CodePath)) {
    throw new Error("Smoke must launch a supported Context multiplexed manifest CodePath, saw " + manifest.CodePath);
  }

  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise(r => server.once("listening", r));
  const port = server.address().port;
  const connection = new Promise(r => server.once("connection", s => {
    s.on("message", raw => {
      try { messages.push(JSON.parse(raw.toString())); } catch {}
    });
    r(s);
  }));

  child = spawn(
    process.execPath,
    [path.join(pluginDir, manifest.CodePath), "-port", String(port), "-pluginUUID", UUID, "-registerEvent", "registerPlugin"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        APPDATA: path.join(pluginDir, ".context-smoke-state"),
        PACKRAT_AUDIO_MOCK: "1",
        PACKRAT_APP_AUDIO_MOCK: "1",
        PACKRAT_CONTEXT_MOCK: "1",
        PACKRAT_CONTEXT_PROCESS: "chrome"
      }
    }
  );
  let stderr = "";
  child.stderr.on("data", d => stderr += d);
  const ws = await Promise.race([
    connection,
    new Promise((_, rej) => setTimeout(() => rej(new Error("No socket " + stderr)), 5000))
  ]);
  await waitFor(m => m.event === "registerPlugin");

  let mark = messages.length;
  ws.send(JSON.stringify({
    event: "willAppear", action: UUID + ".context", context: "ctx1", device: "d",
    payload: { controller: "Keypad", settings: { slot: 1, context: "smart" } }
  }));
  const back = data("imgs/keys/ctx-back.png");
  await waitFor(m => m.event === "setImage" && m.context === "ctx1" && m.payload?.image === back, 5000, mark);

  mark = messages.length;
  ws.send(JSON.stringify({
    event: "keyUp", action: UUID + ".context", context: "ctx1", device: "d",
    payload: { controller: "Keypad", settings: { slot: 1, context: "smart" } }
  }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx1" && m.payload?.image === back, 5000, mark);

  mark = messages.length;
  ws.send(JSON.stringify({
    event: "willAppear", action: UUID + ".smart-app", context: "web", device: "d",
    payload: { controller: "Keypad", settings: { role: "browser", behavior: "focus" } }
  }));
  const active = data("imgs/keys/web-active.png");
  await waitFor(m => m.event === "setImage" && m.context === "web" && m.payload?.image === active, 5000, mark);

  console.log(`v0.7 context smoke passed through ${manifest.CodePath}: multiplex registration, adaptive slot, active app feedback`);
  try { ws.terminate(); } catch {}
  try { server.close(); } catch {}
  cleanup();
  process.exit(0);
})().catch(e => {
  console.error(e.stack || e);
  cleanup();
  process.exit(1);
});
