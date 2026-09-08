"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const sys = require("./lib-v06-system.js");

const UUID = "com.packrat.stream-deck-ultimate-bundle.context";
const pluginRoot = path.resolve(__dirname, "..");
const imageCache = new Map();
const contexts = new Map();
const smartApps = new Map();
let watcher = null;
let watcherBuffer = "";
let watcherRestart = null;
let activeProcess = "";
let activeKind = "generic";
let boundSocket = null;

function imageData(rel) {
  try {
    if (!imageCache.has(rel)) imageCache.set(rel, `data:image/png;base64,${fs.readFileSync(path.join(pluginRoot, rel)).toString("base64")}`);
    return imageCache.get(rel);
  } catch { return ""; }
}
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function setImage(ws, ctx, rel) {
  const image = imageData(rel);
  if (image) send(ws, { event: "setImage", context: ctx, payload: { image, target: 0 } });
}

function classifyProcess(name) {
  const p = String(name || "").toLowerCase().replace(/\.exe$/, "");
  if (["chrome", "msedge", "firefox", "brave", "opera", "vivaldi"].includes(p)) return "browser";
  if (["code", "code-insiders", "vscodium"].includes(p)) return "vscode";
  if (p === "explorer") return "explorer";
  if (p === "spotify") return "spotify";
  if (["discord", "discordcanary", "discordptb"].includes(p)) return "discord";
  return "generic";
}
function roleMatchesProcess(role, processName, customPath = "") {
  const p = String(processName || "").toLowerCase().replace(/\.exe$/, "");
  const r = String(role || "").toLowerCase();
  if (r === "browser") return classifyProcess(p) === "browser";
  if (["discord", "chat"].includes(r)) return classifyProcess(p) === "discord";
  if (["spotify", "music"].includes(r)) return p === "spotify";
  if (r === "vscode") return classifyProcess(p) === "vscode";
  if (r === "explorer") return p === "explorer";
  if (r === "slack") return p === "slack";
  if (r === "teams") return ["teams", "ms-teams"].includes(p);
  if (r === "zoom") return ["zoom", "zoomworkplace"].includes(p);
  if (r === "steam") return p === "steam";
  if (r === "notion") return p === "notion";
  if (r === "todoist") return p === "todoist";
  if (r === "obs") return ["obs64", "obs32"].includes(p);
  if (r === "custom" && customPath) return path.basename(customPath, path.extname(customPath)).toLowerCase() === p;
  return false;
}

function key(v) { return typeof v === "string" ? v.toUpperCase().charCodeAt(0) : v; }
function combo(mods, k) {
  const codes = { ctrl: 17, alt: 18, shift: 16, win: 91 };
  const down = mods.map(m => [codes[m], 1]);
  const up = [...mods].reverse().map(m => [codes[m], 0]);
  return [...down, [key(k), 1], [key(k), 0], ...up];
}

const MAPS = {
  generic: [
    { label: "WEB", image: "web", type: "app", role: "browser" },
    { label: "DISCORD", image: "discord", type: "app", role: "discord" },
    { label: "SPOTIFY", image: "spotify", type: "app", role: "spotify" },
    { label: "SHOT", image: "shot", type: "capture", mode: "region" }
  ],
  browser: [
    { label: "BACK", image: "ctx-back", type: "keys", seq: combo(["alt"], 37) },
    { label: "NEW TAB", image: "ctx-new-tab", type: "keys", seq: combo(["ctrl"], "T") },
    { label: "REFRESH", image: "ctx-refresh", type: "keys", seq: combo(["ctrl"], "R") },
    { label: "CLOSE", image: "ctx-close", type: "keys", seq: combo(["ctrl"], "W") }
  ],
  vscode: [
    { label: "COMMAND", image: "ctx-command", type: "keys", seq: combo(["ctrl", "shift"], "P") },
    { label: "TERMINAL", image: "ctx-terminal", type: "keys", seq: combo(["ctrl"], 192) },
    { label: "SAVE", image: "ctx-save", type: "keys", seq: combo(["ctrl"], "S") },
    { label: "CLOSE", image: "ctx-close", type: "keys", seq: combo(["ctrl"], "W") }
  ],
  explorer: [
    { label: "BACK", image: "ctx-back", type: "keys", seq: combo(["alt"], 37) },
    { label: "UP", image: "ctx-up", type: "keys", seq: combo(["alt"], 38) },
    { label: "ADDRESS", image: "ctx-address", type: "keys", seq: combo(["ctrl"], "L") },
    { label: "NEW", image: "ctx-new-window", type: "keys", seq: combo(["ctrl"], "N") }
  ],
  spotify: [
    { label: "PREV", image: "previous", type: "media", mode: "previous" },
    { label: "PLAY", image: "play", type: "media", mode: "play-pause" },
    { label: "NEXT", image: "next", type: "media", mode: "next" },
    { label: "VOL +", image: "vol-up", type: "media", mode: "volume-up" }
  ],
  discord: [
    { label: "SEARCH", image: "ctx-search", type: "keys", seq: combo(["ctrl"], "F") },
    { label: "SWITCH", image: "ctx-switch", type: "keys", seq: combo(["ctrl"], "K") },
    { label: "MUTE", image: "ctx-discord-mute", type: "keys", seq: combo(["ctrl", "shift"], "M") },
    { label: "DEAFEN", image: "ctx-deafen", type: "keys", seq: combo(["ctrl", "shift"], "D") }
  ]
};

function commandFor(settings = {}) {
  const slot = Math.max(1, Math.min(4, Number(settings.slot || 1)));
  const mode = String(settings.context || "smart");
  const kind = mode === "smart" ? activeKind : (MAPS[mode] ? mode : "generic");
  return (MAPS[kind] || MAPS.generic)[slot - 1];
}
function renderContext(ws, ctx, inst) {
  const cmd = commandFor(inst.settings);
  if (cmd) setImage(ws, ctx, `imgs/keys/${cmd.image}.png`);
}
function renderSmartApp(ws, ctx, inst) {
  const s = inst.settings || {};
  const role = s.role || "browser";
  const base = role === "browser" ? "web" : ["discord", "chat"].includes(role) ? "discord" : ["spotify", "music"].includes(role) ? "spotify" : "app";
  const active = roleMatchesProcess(role, activeProcess, s.path || "");
  const rel = active && ["web", "discord", "spotify"].includes(base) ? `imgs/keys/${base}-active.png` : `imgs/keys/${base}.png`;
  setImage(ws, ctx, rel);
}
function renderAll(ws) {
  for (const [ctx, inst] of contexts) renderContext(ws, ctx, inst);
  for (const [ctx, inst] of smartApps) renderSmartApp(ws, ctx, inst);
}
function applyForeground(ws, processName, force = false) {
  const p = String(processName || "").trim();
  const k = classifyProcess(p);
  const changed = p.toLowerCase() !== activeProcess.toLowerCase() || k !== activeKind;
  activeProcess = p; activeKind = k;
  if (changed || force) renderAll(ws);
}

function watcherScript() {
  return `Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class PRCtx{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);}\n'@;$last='__packrat__';while($true){try{$h=[PRCtx]::GetForegroundWindow();$name='';if($h-ne[IntPtr]::Zero){[uint32]$procId=0;[PRCtx]::GetWindowThreadProcessId($h,[ref]$procId)|Out-Null;if($procId){$name=(Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName}};if($name-ne$last){[Console]::Out.WriteLine($name);[Console]::Out.Flush();$last=$name}}catch{};Start-Sleep -Milliseconds 350}`;
}
function startWatcher(ws) {
  boundSocket = ws;
  if (watcher || (!contexts.size && !smartApps.size)) return;
  if (process.env.PACKRAT_CONTEXT_MOCK === "1" || process.env.PACKRAT_CONTEXT_PROCESS) {
    applyForeground(ws, process.env.PACKRAT_CONTEXT_PROCESS || "chrome", true);
    return;
  }
  if (process.platform !== "win32") { applyForeground(ws, "", true); return; }
  watcherBuffer = "";
  watcher = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", watcherScript()], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  watcher.stdout.on("data", chunk => {
    watcherBuffer += String(chunk).replace(/\r/g, "");
    const lines = watcherBuffer.split("\n"); watcherBuffer = lines.pop() || "";
    for (const line of lines) applyForeground(ws, line);
  });
  watcher.on("exit", () => {
    watcher = null;
    if ((contexts.size || smartApps.size) && !watcherRestart) watcherRestart = setTimeout(() => { watcherRestart = null; startWatcher(boundSocket); }, 1200);
  });
}
function stopWatcher() {
  if (contexts.size || smartApps.size) return;
  if (watcherRestart) { clearTimeout(watcherRestart); watcherRestart = null; }
  if (watcher) { try { watcher.kill(); } catch {} watcher = null; }
}

async function executeCommand(cmd) {
  if (!cmd) return;
  if (process.env.PACKRAT_CONTEXT_MOCK === "1") return;
  if (cmd.type === "keys") return sys.sendVirtualKeys(cmd.seq);
  if (cmd.type === "media") return sys.mediaControl(cmd.mode);
  if (cmd.type === "capture") return sys.capture(cmd.mode);
  if (cmd.type === "app") {
    const target = sys.resolveTarget("", cmd.role);
    if (!target) throw new Error(`Context app unavailable: ${cmd.role}`);
    return sys.focusOrLaunch(target, "focus");
  }
}

function attach(ws) {
  ws.addEventListener("message", ev => {
    let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
    const ctx = m.context;
    const action = m.action;
    if (action === UUID) {
      if (m.event === "willAppear" || m.event === "didReceiveSettings") {
        contexts.set(ctx, { settings: m.payload?.settings || {} });
        startWatcher(ws);
        setTimeout(() => { const inst = contexts.get(ctx); if (inst) renderContext(ws, ctx, inst); }, 25);
      } else if (m.event === "willDisappear") { contexts.delete(ctx); stopWatcher(); }
      else if (m.event === "keyUp") {
        const inst = contexts.get(ctx) || { settings: m.payload?.settings || {} };
        executeCommand(commandFor(inst.settings)).then(() => setTimeout(() => renderContext(ws, ctx, inst), 35)).catch(() => setImage(ws, ctx, "imgs/status/failed.png"));
      }
      return;
    }
    if (action === "com.packrat.stream-deck-ultimate-bundle.smart-app") {
      if (m.event === "willAppear" || m.event === "didReceiveSettings") {
        smartApps.set(ctx, { settings: m.payload?.settings || {} });
        startWatcher(ws);
        setTimeout(() => { const inst = smartApps.get(ctx); if (inst) renderSmartApp(ws, ctx, inst); }, 35);
      } else if (m.event === "willDisappear") { smartApps.delete(ctx); stopWatcher(); }
      else if (m.event === "keyUp") {
        setTimeout(() => renderSmartApp(ws, ctx, smartApps.get(ctx) || { settings: m.payload?.settings || {} }), 300);
        setTimeout(() => renderSmartApp(ws, ctx, smartApps.get(ctx) || { settings: m.payload?.settings || {} }), 1150);
      }
    }
  });
  ws.addEventListener("close", () => { contexts.clear(); smartApps.clear(); stopWatcher(); });
}

module.exports = { attach, classifyProcess, roleMatchesProcess, commandFor, MAPS, combo, applyForeground };
