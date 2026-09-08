"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

const pluginDir = path.resolve(process.argv[2]);
const pluginSource = fs.readFileSync(path.join(pluginDir, "bin", "plugin.js"), "utf8");
if (!pluginSource.includes('event: registerEvent') || !pluginSource.includes('uuid: pluginUUID')) throw new Error("Plugin registration path missing");
const WebSocket = require(path.join(pluginDir, "node_modules", "ws"));
const { WebSocketServer } = WebSocket;
const UUID = "com.packrat.stream-deck-ultimate-bundle";
const messages = [];
let child;
let childStdout = "";
let childStderr = "";
const smokeAppData = path.join(pluginDir, ".smoke-state");

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5xYkAAAAASUVORK5CYII=", "base64");
const smokeImages = [
  "imgs/actions/smart-app/key@2x.png",
  ...["web","discord","spotify","work","left","right","max","restore","center","top-left","top-right","bottom-left","bottom-right","screen","minimize","topmost","clip-clear","clip1","clip2","clip3","clip4","snippet","shot","shot-full","shot-window","shots-folder","mute","vol-down","vol-up","play","previous","next","desktop","task","settings","lock","explorer","utilities","windows","home"].map(name => `imgs/keys/${name}.png`),
  ...["opened","focused","partial","ready","cleared","empty","failed","pasted"].map(name => `imgs/status/${name}.png`)
];
for (const rel of smokeImages) {
  const p = path.join(pluginDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, tinyPng);
}

function waitFor(pred, timeout = 8000, from = 0) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const value = messages.slice(from).find(pred);
      if (value) { clearInterval(timer); resolve(value); }
      else if (Date.now() - start > timeout) { clearInterval(timer); reject(new Error("Timed out waiting for Stream Deck message. Seen since mark: " + JSON.stringify(messages.slice(from)) + " | all: " + JSON.stringify(messages))); }
    }, 40);
  });
}

function cleanup() {
  try { if (child) child.kill(); } catch {}
  try { if (process.platform === "win32") execFileSync("taskkill", ["/IM", "notepad.exe", "/F"], { stdio: "ignore", timeout: 3000 }); } catch {}
}
function dumpDiagnostics() {
  console.error("child stdout:", childStdout || "<empty>");
  console.error("child stderr:", childStderr || "<empty>");
  const runtimeLog = path.join(smokeAppData, "PackRat", "StreamDeckUltimateBundle", "ultimate-bundle.log");
  try { console.error("plugin runtime log:\n" + fs.readFileSync(runtimeLog, "utf8")); }
  catch (e) { console.error("plugin runtime log unavailable:", e.message); }
}

(async () => {
  fs.rmSync(smokeAppData, { recursive: true, force: true });
  const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise(resolve => server.once("listening", resolve));
  const port = server.address().port;
  const connection = new Promise(resolve => server.once("connection", socket => {
    console.log("fake Stream Deck host accepted socket");
    socket.on("message", raw => {
      const text = raw.toString();
      console.log("host received:", text.slice(0, 240));
      try { messages.push(JSON.parse(text)); } catch (e) { console.error("host JSON parse failed", e.message); }
    });
    resolve(socket);
  }));

  child = spawn(process.execPath, [path.join(pluginDir, "bin", "plugin.cjs"), "-port", String(port), "-pluginUUID", UUID, "-registerEvent", "registerPlugin"], {
    stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, APPDATA: smokeAppData }
  });
  child.stdout.on("data", d => { childStdout += d.toString(); });
  child.stderr.on("data", d => { childStderr += d.toString(); });
  child.on("exit", (code, signal) => console.log(`plugin child exit code=${code} signal=${signal}`));

  const ws = await Promise.race([connection, new Promise((_, reject) => setTimeout(() => reject(new Error("Plugin never opened its WebSocket. " + childStderr)), 5000))]);
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log("messages after settle:", JSON.stringify(messages));

  let mark = messages.length;
  console.log("sending media willAppear");
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".media", context: "ctx-media", device: "dev-1", payload: { settings: { mode: "mute" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-media", 5000, mark);

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".window", context: "ctx-window", device: "dev-1", payload: { settings: { mode: "right" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-window", 5000, mark);

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".navigation", context: "ctx-nav", device: "dev-1", payload: { settings: { profile: "profiles/Stream Deck Ultimate - Home" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-nav", 5000, mark);
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".navigation", context: "ctx-nav", device: "dev-1", payload: { settings: { profile: "profiles/Stream Deck Ultimate - Home" } } }));
  await waitFor(m => m.event === "switchToProfile" && m.device === "dev-1" && m.payload?.profile === "profiles/Stream Deck Ultimate - Home", 5000, mark);

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".clipboard", context: "ctx-clear", device: "dev-1", payload: { settings: { mode: "clear" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-clear", 5000, mark);
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".clipboard", context: "ctx-clear", device: "dev-1", payload: { settings: { mode: "clear" } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-clear", 5000, mark);

  mark = messages.length;
  ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".snippet", context: "ctx-snip", device: "dev-1", payload: { settings: { text: "", restoreClipboard: true } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-snip", 5000, mark);
  mark = messages.length;
  ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".snippet", context: "ctx-snip", device: "dev-1", payload: { settings: { text: "", restoreClipboard: true } } }));
  await waitFor(m => m.event === "setImage" && m.context === "ctx-snip", 5000, mark);

  if (process.platform === "win32") {
    mark = messages.length;
    ws.send(JSON.stringify({ event: "willAppear", action: UUID + ".smart-app", context: "ctx-app", device: "dev-1", payload: { settings: { role: "custom", path: "C:\\Windows\\System32\\notepad.exe", behavior: "new" } } }));
    await waitFor(m => m.event === "setImage" && m.context === "ctx-app", 5000, mark);
    mark = messages.length;
    ws.send(JSON.stringify({ event: "keyUp", action: UUID + ".smart-app", context: "ctx-app", device: "dev-1", payload: { settings: { role: "custom", path: "C:\\Windows\\System32\\notepad.exe", behavior: "new" } } }));
    await waitFor(m => m.event === "setImage" && m.context === "ctx-app", 10000, mark);
  }

  console.log("runtime smoke passed: socket, setImage, navigation, clipboard clear, snippet empty, registration source, and Windows app execution");
  try { ws.terminate(); } catch {}
  try { server.close(); } catch {}
  cleanup();
  process.exit(0);
})().catch(err => {
  console.error(err.stack || err);
  dumpDiagnostics();
  cleanup();
  process.exit(1);
});