"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const cfg = require("./lib-v06-config.js");
const sys = require("./lib-v06-system.js");

const PLUGIN_UUID = "com.packrat.stream-deck-ultimate-bundle";
const ACTION = {
  APP: `${PLUGIN_UUID}.smart-app`, WORKSPACE: `${PLUGIN_UUID}.workspace`, WINDOW: `${PLUGIN_UUID}.window`,
  CLIPBOARD: `${PLUGIN_UUID}.clipboard`, SNIPPET: `${PLUGIN_UUID}.snippet`, CAPTURE: `${PLUGIN_UUID}.capture`,
  MEDIA: `${PLUGIN_UUID}.media`, SYSTEM: `${PLUGIN_UUID}.system`, NAVIGATION: `${PLUGIN_UUID}.navigation`,
  AUDIO: `${PLUGIN_UUID}.audio`, PRESET: `${PLUGIN_UUID}.audio-preset`, ROUTINE: `${PLUGIN_UUID}.routine`,
  SETUP: `${PLUGIN_UUID}.setup`
};
const args = process.argv.slice(2);
const arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : ""; };
const port = arg("-port"), pluginUUID = arg("-pluginUUID") || PLUGIN_UUID, registerEvent = arg("-registerEvent") || "registerPlugin";
const pluginRoot = path.resolve(__dirname, "..");
const stateDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "PackRat", "StreamDeckUltimateBundle");
const historyPath = path.join(stateDir, "clipboard.json"), configPath = path.join(stateDir, "config.json"), logPath = path.join(stateDir, "ultimate-bundle.log");
const audioPs = path.join(__dirname, "audio.ps1");
fs.mkdirSync(stateDir, { recursive: true });
function log(s) { try { fs.appendFileSync(logPath, `${new Date().toISOString()} ${s}\n`); } catch {} }
let config = cfg.loadConfig(configPath, log);
function persistConfig(next = config) { config = cfg.saveConfig(configPath, next, log); return config; }

let mockAudio = { output: "Speakers (PackRat Test)", input: "Microphone (PackRat Test)", volume: 50, inputVolume: 60, micMuted: false };
async function audio(action, opts = {}) {
  if (process.env.PACKRAT_AUDIO_MOCK === "1") {
    if (action === "State") return { ...mockAudio };
    if (action === "List") return opts.flow === "input"
      ? [{ name: "Microphone (PackRat Test)", id: "mock-in", isDefault: true }, { name: "USB Mic", id: "mock-in-2", isDefault: false }]
      : [{ name: "Speakers (PackRat Test)", id: "mock-out", isDefault: true }, { name: "Headphones", id: "mock-out-2", isDefault: false }];
    if (action === "MicToggle") { mockAudio.micMuted = !mockAudio.micMuted; return { micMuted: mockAudio.micMuted }; }
    if (action === "MicSet") { mockAudio.micMuted = !!opts.muted; return { micMuted: mockAudio.micMuted }; }
    if (action === "VolumeSet") { const k = opts.flow === "input" ? "inputVolume" : "volume"; mockAudio[k] = Math.max(0, Math.min(100, Number(opts.value) || 0)); return { volume: mockAudio[k] }; }
    if (action === "VolumeAdjust") { const k = opts.flow === "input" ? "inputVolume" : "volume"; mockAudio[k] = Math.max(0, Math.min(100, mockAudio[k] + Number(opts.value || 0))); return { volume: mockAudio[k] }; }
    if (action === "Cycle" || action === "Switch") {
      if (opts.flow === "input") mockAudio.input = action === "Switch" ? (opts.match || mockAudio.input) : (mockAudio.input.includes("USB") ? "Microphone (PackRat Test)" : "USB Mic");
      else mockAudio.output = action === "Switch" ? (opts.match || mockAudio.output) : (mockAudio.output.includes("Headphones") ? "Speakers (PackRat Test)" : "Headphones");
      return { name: opts.flow === "input" ? mockAudio.input : mockAudio.output };
    }
  }
  const a = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", audioPs, "-Action", action];
  if (opts.flow) a.push("-Flow", opts.flow);
  if (opts.match !== undefined) a.push("-Match", String(opts.match));
  if (opts.value !== undefined) a.push("-Value", String(opts.value));
  if (opts.step !== undefined) a.push("-Step", String(opts.step));
  if (opts.muted !== undefined) a.push("-Muted", String(!!opts.muted));
  const out = await sys.runExe("powershell.exe", a, 20000);
  if (!out) return null;
  try { return JSON.parse(out); } catch { return out; }
}

let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
const imageCache = new Map();
function imageData(rel) {
  try {
    if (!imageCache.has(rel)) imageCache.set(rel, `data:image/png;base64,${fs.readFileSync(path.join(pluginRoot, rel)).toString("base64")}`);
    return imageCache.get(rel);
  } catch (e) { log(`image missing ${rel}: ${e.message}`); return ""; }
}
function setImage(ctx, rel) { const image = imageData(rel); if (image) send({ event: "setImage", context: ctx, payload: { image, target: 0 } }); }
function setFeedback(ctx, payload) { send({ event: "setFeedback", context: ctx, payload }); }
const instances = new Map();
let audioState = { output: "", input: "", volume: 0, inputVolume: 0, micMuted: false }, audioTimer = null, audioBusy = false, previousAudioState = null;

function keyImage(inst) {
  const s = inst.settings || {};
  if (inst.action === ACTION.APP) {
    const r = String(s.role || "browser").toLowerCase();
    if (r === "browser") return "imgs/keys/web.png";
    if (["discord", "chat"].includes(r)) return "imgs/keys/discord.png";
    if (["spotify", "music"].includes(r)) return "imgs/keys/spotify.png";
    return "imgs/keys/app.png";
  }
  if (inst.action === ACTION.WORKSPACE) return "imgs/keys/work.png";
  if (inst.action === ACTION.WINDOW) return `imgs/keys/${({ left: "left", right: "right", maximize: "max", restore: "restore", center: "center", "top-left": "top-left", "top-right": "top-right", "bottom-left": "bottom-left", "bottom-right": "bottom-right", "next-monitor": "screen", minimize: "minimize", topmost: "topmost" })[s.mode || "left"] || "left"}.png`;
  if (inst.action === ACTION.CLIPBOARD) return s.mode === "clear" ? "imgs/keys/clip-clear.png" : `imgs/keys/clip${Math.max(1, Math.min(4, Number(s.slot || 1)))}.png`;
  if (inst.action === ACTION.SNIPPET) return "imgs/keys/snippet.png";
  if (inst.action === ACTION.CAPTURE) return `imgs/keys/${({ region: "shot", full: "shot-full", window: "shot-window", folder: "shots-folder" })[s.mode || "region"] || "shot"}.png`;
  if (inst.action === ACTION.MEDIA) return `imgs/keys/${({ mute: "mute", "volume-down": "vol-down", "volume-up": "vol-up", "play-pause": "play", previous: "previous", next: "next" })[s.mode || "play-pause"] || "play"}.png`;
  if (inst.action === ACTION.SYSTEM) return `imgs/keys/${({ desktop: "desktop", task: "task", settings: "settings", lock: "lock", explorer: "explorer" })[s.mode || "desktop"] || "desktop"}.png`;
  if (inst.action === ACTION.NAVIGATION) { const p = String(s.profile || ""); return p.includes("Audio") ? "imgs/keys/audio.png" : p.includes("Utilities") ? "imgs/keys/utilities.png" : p.includes("Windows") ? "imgs/keys/windows.png" : "imgs/keys/home.png"; }
  if (inst.action === ACTION.AUDIO) {
    const m = s.mode || "mic-toggle";
    if (m === "mic-toggle") return audioState.micMuted ? "imgs/keys/mic-muted.png" : "imgs/keys/mic-live.png";
    if (m.includes("output")) return "imgs/keys/output.png";
    if (m.includes("input") || m === "mic-volume-dial") return "imgs/keys/input.png";
    return "imgs/keys/audio.png";
  }
  if (inst.action === ACTION.PRESET) return `imgs/keys/mode-${s.mode || "work"}.png`;
  if (inst.action === ACTION.ROUTINE) return `imgs/keys/${s.mode === "meeting" ? "meeting" : s.mode === "focus" ? "focus" : s.mode === "gaming" ? "gaming" : "work"}.png`;
  if (inst.action === ACTION.SETUP) return "imgs/keys/setup.png";
  return "imgs/keys/app.png";
}
function render(ctx, inst) { if ((inst.controller || "Keypad") === "Encoder") updateDial(ctx, inst); else setImage(ctx, keyImage(inst)); }
function flash(ctx, inst, status, ms = 900) { setImage(ctx, `imgs/status/${status}.png`); setTimeout(() => { if (instances.has(ctx)) render(ctx, instances.get(ctx) || inst); }, ms); }
function fail(ctx, inst, e) { log(`action failure ${inst.action}: ${e?.stack || e}`); flash(ctx, inst, "failed", 1300); }

async function refreshAudioState() {
  if (audioBusy) return audioState;
  audioBusy = true;
  try { const s = await audio("State"); if (s && typeof s === "object") audioState = s; }
  catch (e) { log(`audio state: ${e.message}`); }
  finally { audioBusy = false; }
  for (const [ctx, inst] of instances) if ([ACTION.AUDIO, ACTION.PRESET, ACTION.ROUTINE].includes(inst.action)) render(ctx, inst);
  return audioState;
}
function ensureAudioPolling() { if (!audioTimer) { refreshAudioState(); audioTimer = setInterval(refreshAudioState, 1500); } }
function shortDevice(s) { s = String(s || "Unknown"); return s.length > 18 ? s.slice(0, 17) + "…" : s; }
function updateDial(ctx, inst) {
  const m = inst.settings?.mode || "volume-dial";
  if (m === "volume-dial") setFeedback(ctx, { title: "Master Volume", value: `${audioState.volume || 0}%`, indicator: { value: Number(audioState.volume || 0) } });
  else if (m === "mic-volume-dial") setFeedback(ctx, { title: "Mic Level", value: `${audioState.inputVolume || 0}%`, indicator: { value: Number(audioState.inputVolume || 0) } });
  else if (m === "output-cycle") setFeedback(ctx, { title: "Output", value: shortDevice(audioState.output) });
  else if (m === "input-cycle") setFeedback(ctx, { title: "Input", value: shortDevice(audioState.input) });
}

let clipboardHistory = [];
try { const v = JSON.parse(fs.readFileSync(historyPath, "utf8")); if (Array.isArray(v)) clipboardHistory = v.filter(x => typeof x === "string").slice(0, config.clipboard.maxItems); } catch {}
let clipboardTimer = null, lastClipboard = "", suppressClipboardUntil = 0;
function saveHistory() { try { fs.writeFileSync(historyPath, JSON.stringify(clipboardHistory.slice(0, config.clipboard.maxItems), null, 2)); } catch {} }
function visibleClipboard() { return config.clipboard.enabled && [...instances.values()].some(x => x.action === ACTION.CLIPBOARD); }
async function readClipboardText() { return (await sys.runPS("$v=Get-Clipboard -Raw -ErrorAction SilentlyContinue;if($v-is[string]){$v}", 5000)).replace(/\r\n/g, "\n").trimEnd(); }
async function pollClipboard() {
  if (!visibleClipboard() || Date.now() < suppressClipboardUntil) return;
  try {
    const t = await readClipboardText();
    if (t && t !== lastClipboard) { lastClipboard = t; clipboardHistory = [t.slice(0, 12000), ...clipboardHistory.filter(x => x !== t)].slice(0, config.clipboard.maxItems); saveHistory(); }
  } catch (e) { log(`clipboard: ${e.message}`); }
}
function startClipboard() { if (!clipboardTimer) { clipboardTimer = setInterval(pollClipboard, 850); setTimeout(pollClipboard, 100); } }
async function pasteText(text, restore = false) {
  if (!text) throw new Error("Nothing to paste");
  let previous = "";
  if (restore) try { previous = await readClipboardText(); } catch {}
  suppressClipboardUntil = Date.now() + 1200;
  const p = path.join(stateDir, `paste-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(p, text, "utf8");
  try {
    await sys.runPS(`$v=Get-Content -LiteralPath ${sys.psQuote(p)} -Raw;Set-Clipboard -Value $v`);
    await sys.sendVirtualKeys([[17, 1], [86, 1], [86, 0], [17, 0]]);
    if (restore && previous) {
      await new Promise(r => setTimeout(r, 260));
      const q = path.join(stateDir, `restore-${process.pid}-${Date.now()}.txt`);
      fs.writeFileSync(q, previous, "utf8");
      try { await sys.runPS(`Set-Clipboard -Value (Get-Content -LiteralPath ${sys.psQuote(q)} -Raw)`); } finally { try { fs.unlinkSync(q); } catch {} }
      lastClipboard = previous;
    } else lastClipboard = text;
  } finally { try { fs.unlinkSync(p); } catch {} }
}
async function pasteClipboard(slot) { if (!clipboardHistory[slot - 1]) await pollClipboard(); const t = clipboardHistory[slot - 1]; if (!t) return false; await pasteText(t, false); return true; }
function clearClipboardHistory() { clipboardHistory = []; lastClipboard = ""; saveHistory(); }
async function expandSnippet(text) {
  const n = new Date(), d = n.toLocaleDateString(), t = n.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let c = ""; if (String(text).includes("{{clipboard}}")) try { c = await readClipboardText(); } catch {}
  return String(text || "").replaceAll("{{date}}", d).replaceAll("{{time}}", t).replaceAll("{{datetime}}", `${d} ${t}`).replaceAll("{{clipboard}}", c);
}

function workspaceDefinition(name, settings = {}) {
  if (settings.apps) return { apps: cfg.cleanApps(settings.apps), layout: settings.layout || "work", url: "" };
  return config.workspaces?.[name] || cfg.DEFAULT_CONFIG.workspaces[name] || cfg.DEFAULT_CONFIG.workspaces.work;
}
async function runWorkspace(settings = {}, name = "work") { return sys.runWorkspace(workspaceDefinition(name, settings), log); }
function presetDefinition(name, overrides = {}) {
  const base = config.presets?.[name] || cfg.DEFAULT_CONFIG.presets[name] || cfg.DEFAULT_CONFIG.presets.work;
  const merged = { ...base, ...overrides };
  if (typeof overrides.micMuted === "boolean" && !overrides.micMode) merged.micMode = overrides.micMuted ? "mute" : "live";
  return merged;
}
async function applyPreset(name, overrides = {}) {
  await refreshAudioState();
  previousAudioState = { ...audioState };
  const p = presetDefinition(name, overrides), out = p.output || config.outputDevice, input = p.input || config.inputDevice;
  if (out) await audio("Switch", { flow: "output", match: out });
  if (input) await audio("Switch", { flow: "input", match: input });
  if (Number.isFinite(Number(p.volume))) await audio("VolumeSet", { flow: "output", value: Number(p.volume) });
  const micMode = cfg.normalizeMicMode(p, "keep");
  if (micMode === "mute") await audio("MicSet", { muted: true });
  else if (micMode === "live") await audio("MicSet", { muted: false });
  await refreshAudioState();
  return p;
}
async function restorePreviousAudio() {
  if (!previousAudioState) throw new Error("No previous audio state saved");
  if (previousAudioState.output) await audio("Switch", { flow: "output", match: previousAudioState.output });
  if (previousAudioState.input) await audio("Switch", { flow: "input", match: previousAudioState.input });
  if (Number.isFinite(Number(previousAudioState.volume))) await audio("VolumeSet", { flow: "output", value: previousAudioState.volume });
  if (typeof previousAudioState.micMuted === "boolean") await audio("MicSet", { muted: previousAudioState.micMuted });
  await refreshAudioState();
}
const routineBusy = new Set();
async function runRoutine(name) {
  if (routineBusy.has(name)) return { failures: 0, busy: true };
  routineBusy.add(name);
  try { await applyPreset(name); return await runWorkspace({}, name); }
  finally { routineBusy.delete(name); }
}

let setupServer = null, setupPort = 0, setupStarting = null;
async function ensureSetupServer() {
  if (setupServer && setupPort) return setupPort;
  if (setupStarting) return setupStarting;
  setupStarting = new Promise((resolve, reject) => {
    setupServer = http.createServer(async (req, res) => {
      const sendJson = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(obj)); };
      try {
        if (req.method === "GET" && req.url === "/") {
          const html = fs.readFileSync(path.join(pluginRoot, "ui", "onboarding-v06.html"));
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'" });
          return res.end(html);
        }
        if (req.method === "GET" && req.url === "/api/state") return sendJson(200, { config, audio: audioState });
        if (req.method === "GET" && req.url === "/api/audio") {
          const [outputs, inputs] = await Promise.all([audio("List", { flow: "output" }), audio("List", { flow: "input" })]);
          return sendJson(200, { outputs: Array.isArray(outputs) ? outputs : [outputs].filter(Boolean), inputs: Array.isArray(inputs) ? inputs : [inputs].filter(Boolean) });
        }
        if (req.method === "GET" && req.url === "/api/apps") return sendJson(200, { apps: await sys.detectApps() });
        if (req.method === "POST" && req.url === "/api/save") {
          let body = "";
          req.on("data", d => { body += d; if (body.length > 128 * 1024) req.destroy(); });
          req.on("end", () => {
            try { const next = JSON.parse(body || "{}"); config = persistConfig({ ...config, ...next, setupComplete: true, workspaces: { ...config.workspaces, ...(next.workspaces || {}) }, presets: { ...config.presets, ...(next.presets || {}) } }); sendJson(200, { ok: true, config }); }
            catch (e) { sendJson(400, { ok: false, error: e.message }); }
          });
          return;
        }
        if (req.method === "POST" && req.url === "/api/reset") { config = persistConfig(cfg.DEFAULT_CONFIG); return sendJson(200, { ok: true, config }); }
        res.writeHead(404); res.end("Not found");
      } catch (e) { sendJson(500, { error: e.message }); }
    });
    setupServer.once("error", e => { setupStarting = null; reject(e); });
    setupServer.listen(0, "127.0.0.1", () => { setupPort = setupServer.address().port; resolve(setupPort); });
  });
  return setupStarting;
}
async function openSetup() {
  const p = await ensureSetupServer();
  await refreshAudioState();
  if (process.env.PACKRAT_AUDIO_MOCK !== "1") await sys.runPS(`Start-Process ${sys.psQuote(`http://127.0.0.1:${p}/`)}`);
  return p;
}

async function execute(ctx, inst) {
  const s = inst.settings || {};
  try {
    if (inst.action === ACTION.APP) {
      const t = s.role === "custom" ? sys.resolveTarget(s.path, "custom") : sys.resolveTarget("", s.role || "browser");
      const r = await sys.focusOrLaunch(t, s.behavior || "focus");
      flash(ctx, inst, r === "OPENED" ? "opened" : "focused");
    } else if (inst.action === ACTION.WORKSPACE) {
      const r = await runWorkspace(s, s.preset || "work"); flash(ctx, inst, r.failures ? "partial" : "ready", r.failures ? 1300 : 900);
    } else if (inst.action === ACTION.WINDOW) await sys.activeWindow(s.mode || "left");
    else if (inst.action === ACTION.CLIPBOARD) {
      if (s.mode === "clear") { clearClipboardHistory(); flash(ctx, inst, "cleared"); }
      else flash(ctx, inst, (await pasteClipboard(Math.max(1, Math.min(4, Number(s.slot || 1))))) ? "pasted" : "empty", 900);
    } else if (inst.action === ACTION.SNIPPET) {
      const t = await expandSnippet(s.text || ""); if (!t) flash(ctx, inst, "empty", 1200); else { await pasteText(t, s.restoreClipboard !== false); flash(ctx, inst, "pasted"); }
    } else if (inst.action === ACTION.CAPTURE) await sys.capture(s.mode || "region");
    else if (inst.action === ACTION.MEDIA) await sys.mediaControl(s.mode || "play-pause");
    else if (inst.action === ACTION.SYSTEM) await sys.systemControl(s.mode || "desktop");
    else if (inst.action === ACTION.NAVIGATION) {
      if (!inst.device) throw new Error("No Stream Deck device id"); send({ event: "switchToProfile", context: ctx, device: inst.device, payload: { profile: s.profile } });
    } else if (inst.action === ACTION.AUDIO) {
      const m = s.mode || "mic-toggle";
      if (m === "mic-toggle") await audio("MicToggle");
      else if (m === "output-cycle") await audio("Cycle", { flow: "output", step: 1 });
      else if (m === "input-cycle") await audio("Cycle", { flow: "input", step: 1 });
      else if (m === "output-device") await audio("Switch", { flow: "output", match: s.device || config.outputDevice });
      else if (m === "input-device") await audio("Switch", { flow: "input", match: s.device || config.inputDevice });
      else if (m === "restore") await restorePreviousAudio();
      await refreshAudioState(); flash(ctx, inst, "switched", 700);
    } else if (inst.action === ACTION.PRESET) { await applyPreset(s.mode || "work", s); flash(ctx, inst, "applied", 850); }
    else if (inst.action === ACTION.ROUTINE) {
      const r = await runRoutine(s.mode || "work"); flash(ctx, inst, r.busy ? "partial" : r.failures ? "partial" : "started", r.failures || r.busy ? 1300 : 900);
    } else if (inst.action === ACTION.SETUP) { await openSetup(); flash(ctx, inst, "opened", 700); }
  } catch (e) { fail(ctx, inst, e); }
}
async function handleDialRotate(ctx, inst, ticks) {
  if (inst.action !== ACTION.AUDIO) return;
  const m = inst.settings?.mode || "volume-dial", step = Math.max(-10, Math.min(10, Number(ticks || 0)));
  try {
    if (m === "volume-dial") await audio("VolumeAdjust", { flow: "output", value: step * 2 });
    else if (m === "mic-volume-dial") await audio("VolumeAdjust", { flow: "input", value: step * 2 });
    else if (m === "output-cycle" && step) await audio("Cycle", { flow: "output", step: step > 0 ? 1 : -1 });
    else if (m === "input-cycle" && step) await audio("Cycle", { flow: "input", step: step > 0 ? 1 : -1 });
    await refreshAudioState(); updateDial(ctx, inst);
  } catch (e) { log(`dial: ${e.message}`); }
}
async function handleDialPress(ctx, inst) {
  if (inst.action === ACTION.AUDIO) try { await audio("MicToggle"); await refreshAudioState(); updateDial(ctx, inst); } catch (e) { log(`dial press: ${e.message}`); }
}

if (!port) { log("missing -port"); process.exit(1); }
try { ws = new WebSocket(`ws://127.0.0.1:${port}`); } catch (e) { log(`websocket create: ${e.message}`); process.exit(1); }
ws.addEventListener("open", () => { send({ event: registerEvent, uuid: pluginUUID }); log("connected v0.6"); });
ws.addEventListener("message", ev => {
  let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
  const ctx = m.context;
  if (m.event === "willAppear" || m.event === "didReceiveSettings") {
    const inst = { action: m.action, settings: m.payload?.settings || {}, device: m.device, controller: m.payload?.controller || "Keypad" };
    instances.set(ctx, inst); render(ctx, inst);
    if (inst.action === ACTION.CLIPBOARD) startClipboard();
    if ([ACTION.AUDIO, ACTION.PRESET, ACTION.ROUTINE].includes(inst.action)) ensureAudioPolling();
  } else if (m.event === "willDisappear") instances.delete(ctx);
  else if (m.event === "keyUp") execute(ctx, instances.get(ctx) || { action: m.action, settings: m.payload?.settings || {}, device: m.device, controller: m.payload?.controller || "Keypad" });
  else if (m.event === "dialRotate") handleDialRotate(ctx, instances.get(ctx) || { action: m.action, settings: m.payload?.settings || {}, device: m.device, controller: "Encoder" }, m.payload?.ticks || 0);
  else if (m.event === "dialUp") handleDialPress(ctx, instances.get(ctx) || { action: m.action, settings: m.payload?.settings || {}, device: m.device, controller: "Encoder" });
});
ws.addEventListener("error", e => log(`websocket error ${e?.message || ""}`));
ws.addEventListener("close", () => { log("websocket closed"); try { setupServer?.close(); } catch {} setTimeout(() => process.exit(0), 250); });
process.on("uncaughtException", e => log(`uncaught ${e.stack || e.message}`));
process.on("unhandledRejection", e => log(`rejection ${e?.stack || e}`));
