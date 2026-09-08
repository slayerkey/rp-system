"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { spawn } = require("child_process");
const pluginDir = path.resolve(process.argv[2]);
const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));
if (!["bin/plugin-v071.cjs", "bin/plugin-v08.cjs"].includes(manifest.CodePath)) throw new Error(`Expected a supported diagnostics multiplexed CodePath, saw ${manifest.CodePath}`);
const WebSocket = require(path.join(pluginDir, "node_modules", "ws"));
const { WebSocketServer } = WebSocket;
const UUID = "com.packrat.stream-deck-ultimate-bundle";
const messages = []; let child;
const tiny = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5xYkAAAAASUVORK5CYII=", "base64");
for (const rel of ["imgs/keys/diagnostics.png", "imgs/status/ready.png", "imgs/status/failed.png", "imgs/keys/app.png"]) {
  const p = path.join(pluginDir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); if (!fs.existsSync(p)) fs.writeFileSync(p, tiny);
}
function data(rel) { return "data:image/png;base64," + fs.readFileSync(path.join(pluginDir, rel)).toString("base64"); }
function waitFor(pred, timeout = 10000, from = 0) { return new Promise((resolve, reject) => { const start = Date.now(); const t = setInterval(() => { const v = messages.slice(from).find(pred); if (v) { clearInterval(t); resolve(v); } else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error("Timed out. Seen: " + JSON.stringify(messages.slice(from).map(x => ({ event: x.event, context: x.context })) ))); } }, 35); }); }
function waitForFile(dir, timeout = 12000) { return new Promise((resolve, reject) => { const start = Date.now(); const t = setInterval(() => { const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /^PackRat-Ultimate-Diagnostics-.*\.json$/.test(x)) : []; if (files.length) { clearInterval(t); resolve(path.join(dir, files.sort().pop())); } else if (Date.now() - start > timeout) { clearInterval(t); reject(new Error("Diagnostics file not created")); } }, 50); }); }
function cleanup() { try { child?.kill(); } catch {} }
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "packrat-ultimate-v071-"));
  const state = path.join(root, "PackRat", "StreamDeckUltimateBundle"); const out = path.join(root, "reports"); fs.mkdirSync(state, { recursive: true }); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(state, "config.json"), JSON.stringify({
    version: 2, setupComplete: true, outputDevice: "Headphones", inputDevice: "Microphone",
    workspaces: { work: { apps: ["@browser", "C:\\Users\\SecretPerson\\Apps\\MyTool.exe"], layout: "columns", url: "https://private.example/project?token=SUPER_SECRET_URL" } },
    presets: { work: { output: "Headphones", input: "Microphone", volume: 42, micMode: "keep" } },
    clipboard: { enabled: true, maxItems: 8 }
  }, null, 2));
  fs.writeFileSync(path.join(state, "clipboard.json"), JSON.stringify(["SUPER_SECRET_CLIPBOARD"]));
  fs.writeFileSync(path.join(state, "ultimate-bundle.log"), "2026-08-30T19:00:00.000Z action failure SUPER_SECRET_LOG_DETAIL C:\\Users\\SecretPerson\\x\n");

  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" }); await new Promise(r => server.once("listening", r)); const port = server.address().port;
  const connection = new Promise(r => server.once("connection", s => { s.on("message", raw => { try { messages.push(JSON.parse(raw.toString())); } catch {} }); r(s); }));
  child = spawn(process.execPath, [path.join(pluginDir, manifest.CodePath), "-port", String(port), "-pluginUUID", UUID, "-registerEvent", "registerPlugin"], {
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, APPDATA: root, PACKRAT_AUDIO_MOCK: "1", PACKRAT_APP_AUDIO_MOCK: "1", PACKRAT_CONTEXT_MOCK: "1", PACKRAT_DIAGNOSTICS_MOCK: "1", PACKRAT_DIAGNOSTICS_DIR: out }
  });
  let stderr = ""; child.stderr.on("data", d => stderr += d); const ws = await Promise.race([connection, new Promise((_, rej) => setTimeout(() => rej(new Error("No socket " + stderr)), 5000))]);
  await waitFor(m => m.event === "registerPlugin");
  let mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".diagnostics", context: "diag", device: "d", payload: { controller: "Keypad", settings: {} } }));
  const diag = data("imgs/keys/diagnostics.png");
  await waitFor(m => m.event === "setImage" && m.context === "diag" && m.payload?.image === diag, 5000, mark);
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".diagnostics", context: "diag", device: "d", payload: { controller: "Keypad", settings: {} } }));
  await waitFor(m => m.event === "setImage" && m.context === "diag" && m.payload?.image === data("imgs/status/ready.png"), 12000, mark);
  const reportFile = await waitForFile(out);
  const raw = fs.readFileSync(reportFile, "utf8"); const report = JSON.parse(raw);
  for (const secret of ["SUPER_SECRET_CLIPBOARD", "SUPER_SECRET_LOG_DETAIL", "SUPER_SECRET_URL", "private.example", "SecretPerson"]) if (raw.includes(secret)) throw new Error(`Diagnostics leaked secret: ${secret}`);
  if (report.privacy.clipboardContentsIncluded !== false || report.privacy.rawLogsIncluded !== false || report.privacy.workspaceUrlsIncluded !== false) throw new Error("Privacy declarations incorrect");
  if (!report.state.clipboardHistory.exists || report.state.clipboardHistory.contentsIncluded !== false) throw new Error("Clipboard metadata contract failed");
  if (report.config.workspaces.work.apps[1] !== "MyTool.exe" || report.config.workspaces.work.urlConfigured !== true) throw new Error("Sanitized workspace contract failed");
  if (report.audio.outputs.length < 1 || report.audio.inputs.length < 1) throw new Error("Mock audio diagnostics missing");
  console.log(`v0.7.1 diagnostics smoke passed through ${manifest.CodePath}: actual manifest runtime generated secret-free support report through multiplexed action`);
  try { ws.terminate(); } catch {} try { server.close(); } catch {} cleanup(); process.exit(0);
})().catch(e => { console.error(e.stack || e); cleanup(); process.exit(1); });
