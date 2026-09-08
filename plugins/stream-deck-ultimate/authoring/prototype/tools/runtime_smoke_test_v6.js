"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const { spawn, execFileSync } = require("child_process");
const pluginDir = path.resolve(process.argv[2]);
const manifest = JSON.parse(fs.readFileSync(path.join(pluginDir, "manifest.json"), "utf8"));
const codePath = path.join(pluginDir, ...String(manifest.CodePath || "").split("/"));
if (!manifest.CodePath || !fs.existsSync(codePath)) throw new Error(`Manifest CodePath missing: ${manifest.CodePath || "<none>"}`);
const configLib = require(path.join(pluginDir, "bin", "lib-v06-config.js"));
const systemLib = require(path.join(pluginDir, "bin", "lib-v06-system.js"));
if (configLib.DEFAULT_CONFIG.presets.work.micMode !== "keep") throw new Error("Work must preserve mic state by default");
if (configLib.DEFAULT_CONFIG.presets.focus.micMode !== "mute") throw new Error("Focus must default to mute");
const migrated = configLib.sanitizeConfig({ presets: { meeting: { micMuted: false, volume: 200 } }, workspaces: { work: { layout: "grid", apps: ["@browser"] } } });
if (migrated.presets.meeting.micMode !== "live" || migrated.presets.meeting.volume !== 100) throw new Error("Legacy preset migration/clamping failed");
if (migrated.workspaces.work.layout !== "grid" || migrated.workspaces.focus.apps.length === 0) throw new Error("Deep config merge failed");
if (systemLib.planLayout("columns", 3).length !== 3 || systemLib.planLayout("grid", 5).length !== 5 || systemLib.planLayout("work", 1)[0][2] !== 1) throw new Error("Workspace layout planner failed");
const WebSocket = require(path.join(pluginDir, "node_modules", "ws"));
const { WebSocketServer } = WebSocket;
const UUID = "com.packrat.stream-deck-ultimate-bundle";
const messages = []; let child;
const tiny = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5xYkAAAAASUVORK5CYII=", "base64");
const files = [
  "imgs/keys/app.png","imgs/keys/web.png","imgs/keys/discord.png","imgs/keys/spotify.png","imgs/keys/work.png","imgs/keys/left.png","imgs/keys/right.png","imgs/keys/max.png","imgs/keys/restore.png","imgs/keys/center.png","imgs/keys/top-left.png","imgs/keys/top-right.png","imgs/keys/bottom-left.png","imgs/keys/bottom-right.png","imgs/keys/screen.png","imgs/keys/minimize.png","imgs/keys/topmost.png",
  "imgs/keys/clip1.png","imgs/keys/clip2.png","imgs/keys/clip3.png","imgs/keys/clip4.png","imgs/keys/clip-clear.png","imgs/keys/snippet.png","imgs/keys/shot.png","imgs/keys/shot-full.png","imgs/keys/shot-window.png","imgs/keys/shots-folder.png","imgs/keys/mute.png","imgs/keys/vol-down.png","imgs/keys/vol-up.png","imgs/keys/play.png","imgs/keys/previous.png","imgs/keys/next.png","imgs/keys/desktop.png","imgs/keys/task.png","imgs/keys/settings.png","imgs/keys/lock.png","imgs/keys/explorer.png",
  "imgs/keys/windows.png","imgs/keys/utilities.png","imgs/keys/home.png","imgs/keys/audio.png","imgs/keys/output.png","imgs/keys/input.png","imgs/keys/mic-live.png","imgs/keys/mic-muted.png","imgs/keys/mode-work.png","imgs/keys/mode-focus.png","imgs/keys/mode-meeting.png","imgs/keys/mode-gaming.png","imgs/keys/focus.png","imgs/keys/meeting.png","imgs/keys/gaming.png","imgs/keys/setup.png",
  "imgs/status/opened.png","imgs/status/focused.png","imgs/status/cleared.png","imgs/status/empty.png","imgs/status/failed.png","imgs/status/pasted.png","imgs/status/partial.png","imgs/status/ready.png","imgs/status/switched.png","imgs/status/applied.png","imgs/status/started.png"
];
for (const rel of files) { const p = path.join(pluginDir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); if (!fs.existsSync(p)) fs.writeFileSync(p, tiny); }
for (const rel of ["ui/onboarding-v06.html", "bin/audio.ps1"]) { const p = path.join(pluginDir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); if (!fs.existsSync(p)) fs.writeFileSync(p, rel.endsWith(".html") ? "<html>ok</html>" : "param()"); }
function image(rel) { return "data:image/png;base64," + fs.readFileSync(path.join(pluginDir, rel)).toString("base64"); }
function waitFor(pred, timeout = 8000, from = 0, label = "event") {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const found = messages.slice(from).find(pred);
      if (found) {
        clearInterval(timer);
        resolve(found);
        return;
      }
      if (Date.now() - start > timeout) {
        clearInterval(timer);
        const seen = messages.slice(from).map(x => ({ event: x.event, context: x.context, value: x.payload?.value }));
        reject(new Error(`Timed out waiting for ${label}. Seen: ${JSON.stringify(seen)}`));
      }
    }, 35);
  });
}
function cleanup() { try { child?.kill(); } catch {} try { if (process.platform === "win32") execFileSync("taskkill", ["/IM", "notepad.exe", "/F"], { stdio: "ignore", timeout: 2000 }); } catch {} }
(async () => {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "packrat-ultimate-v6-"));
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" }); await new Promise(r => server.once("listening", r)); const port = server.address().port;
  const connection = new Promise(r => server.once("connection", s => { s.on("message", raw => { try { messages.push(JSON.parse(raw.toString())); } catch {} }); r(s); }));
  child = spawn(process.execPath, [codePath, "-port", String(port), "-pluginUUID", UUID, "-registerEvent", "registerPlugin"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, APPDATA: stateDir, PACKRAT_AUDIO_MOCK: "1" } });
  let stderr = ""; child.stderr.on("data", d => stderr += d); const ws = await Promise.race([connection, new Promise((_, rej) => setTimeout(() => rej(new Error("No socket " + stderr)), 5000))]);
  await waitFor(m => m.event === "registerPlugin", 5000, 0, "plugin registration");

  // Run the real Windows workspace proof before any audio keys appear. Audio keys intentionally start a periodic
  // state poller, which should not be allowed to flood/race the workspace assertion in this regression harness.
  if (process.platform === "win32") {
    const notepad = path.join(process.env.WINDIR || "C:\\Windows", "System32", "notepad.exe");
    let mark = messages.length;
    ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".workspace", context: "workspace", device: "d", payload: { controller: "Keypad", settings: { apps: notepad, layout: "none" } } }));
    await waitFor(m => m.event === "setImage" && m.context === "workspace" && m.payload?.image === image("imgs/keys/work.png"), 7000, mark, "workspace initial render");
    mark = messages.length;
    ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".workspace", context: "workspace", device: "d", payload: { controller: "Keypad", settings: { apps: notepad, layout: "none" } } }));
    await waitFor(m => m.event === "setImage" && m.context === "workspace" && m.payload?.image === image("imgs/status/ready.png"), 16000, mark, "Windows workspace READY outcome");
  }

  let mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".audio", context: "mic", device: "d", payload: { controller: "Keypad", settings: { mode: "mic-toggle" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "mic", 5000, mark, "mic initial render");
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".audio", context: "mic", device: "d", payload: { controller: "Keypad", settings: { mode: "mic-toggle" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "mic" && m.payload?.image === image("imgs/status/switched.png"), 5000, mark, "mic switched outcome");

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".audio", context: "dial", device: "d", payload: { controller: "Encoder", settings: { mode: "volume-dial" } } }));
  await waitFor(m => m.event === "setFeedback" && m.context === "dial", 5000, mark, "dial initial feedback");
  mark = messages.length;
  ws.send(JSON.stringify({ event: "dialRotate", action: UUID + ".audio", context: "dial", device: "d", payload: { controller: "Encoder", settings: { mode: "volume-dial" }, ticks: 2 } }));
  await waitFor(m => m.event === "setFeedback" && m.context === "dial" && m.payload?.value === "54%", 5000, mark, "dial +4% feedback");

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".audio-preset", context: "preset", device: "d", payload: { controller: "Keypad", settings: { mode: "focus" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "preset", 5000, mark, "preset initial render");
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".audio-preset", context: "preset", device: "d", payload: { controller: "Keypad", settings: { mode: "focus" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "preset" && m.payload?.image === image("imgs/status/applied.png"), 5000, mark, "preset APPLIED outcome");

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".setup", context: "setup", device: "d", payload: { controller: "Keypad", settings: {} } }));
  await waitFor(m => m.event === "setImage" && m.context === "setup", 5000, mark, "setup initial render");
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".setup", context: "setup", device: "d", payload: { controller: "Keypad", settings: {} } }));
  await waitFor(m => m.event === "setImage" && m.context === "setup" && m.payload?.image === image("imgs/status/opened.png"), 5000, mark, "setup OPENED outcome");

  console.log(`v0.6 core smoke passed through manifest CodePath ${manifest.CodePath}: config safety, layouts${process.platform === "win32" ? ", Windows workspace READY" : ""}, exact audio action outcomes, dial feedback, setup`);
  try { ws.terminate(); } catch {} try { server.close(); } catch {} cleanup(); process.exit(0);
})().catch(e => { console.error(e.stack || e); cleanup(); process.exit(1); });
