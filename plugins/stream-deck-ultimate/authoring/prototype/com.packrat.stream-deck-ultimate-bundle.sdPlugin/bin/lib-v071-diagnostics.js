"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const cfg = require("./lib-v06-config.js");
const sys = require("./lib-v06-system.js");

const UUID = "com.packrat.stream-deck-ultimate-bundle.diagnostics";
const pluginRoot = path.resolve(__dirname, "..");
const stateDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "PackRat", "StreamDeckUltimateBundle");
const configPath = path.join(stateDir, "config.json");
const logPath = path.join(stateDir, "ultimate-bundle.log");
const audioPs = path.join(__dirname, "audio.ps1");
const imageCache = new Map();
const instances = new Map();

function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function imageData(rel) {
  try {
    if (!imageCache.has(rel)) imageCache.set(rel, `data:image/png;base64,${fs.readFileSync(path.join(pluginRoot, rel)).toString("base64")}`);
    return imageCache.get(rel);
  } catch { return ""; }
}
function setImage(ws, ctx, rel) { const image = imageData(rel); if (image) send(ws, { event: "setImage", context: ctx, payload: { image, target: 0 } }); }
function render(ws, ctx) { setImage(ws, ctx, "imgs/keys/diagnostics.png"); }

function replaceAllLiteral(value, needle, replacement) {
  if (!needle) return value;
  return String(value).split(String(needle)).join(replacement);
}
function redactText(value, max = 512) {
  let s = String(value ?? "");
  for (const home of [process.env.USERPROFILE, process.env.HOME, os.homedir()]) s = replaceAllLiteral(s, home, "<home>");
  s = s
    .replace(/[A-Za-z]:\\Users\\[^\\\s"']+/gi, "C:\\Users\\<user>")
    .replace(/\\\\[^\\\s"']+\\[^\\\s"']+/g, "<network-path>")
    .replace(/https?:\/\/[^\s"']+/gi, "<url>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
function safeDeviceName(value) { return redactText(value, 160); }
function safeApp(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (s.startsWith("@")) return s.toLowerCase();
  const normalized = s.replace(/\\/g, "/");
  return path.posix.basename(normalized) || "custom-app";
}
function sanitizeConfigForReport(raw) {
  const c = cfg.sanitizeConfig(raw || {});
  const workspaces = {}, presets = {};
  for (const name of ["work", "focus", "meeting", "gaming"]) {
    const w = c.workspaces[name];
    workspaces[name] = {
      apps: (w.apps || []).map(safeApp).filter(Boolean),
      appCount: (w.apps || []).length,
      layout: w.layout,
      urlConfigured: !!w.url
    };
    const p = c.presets[name];
    presets[name] = {
      output: safeDeviceName(p.output), input: safeDeviceName(p.input),
      volume: p.volume, micMode: p.micMode
    };
  }
  return {
    setupComplete: !!c.setupComplete,
    outputDevice: safeDeviceName(c.outputDevice),
    inputDevice: safeDeviceName(c.inputDevice),
    workspaces, presets,
    clipboard: { enabled: !!c.clipboard.enabled, maxItems: c.clipboard.maxItems }
  };
}
function fileMeta(file) {
  try { const s = fs.statSync(file); return { exists: true, sizeBytes: s.size, modifiedAt: s.mtime.toISOString() }; }
  catch { return { exists: false, sizeBytes: 0, modifiedAt: null }; }
}
function logSummary(file) {
  const meta = fileMeta(file);
  if (!meta.exists) return { ...meta, lineCount: 0, issueLineCount: 0, lastTimestamp: null };
  try {
    const raw = fs.readFileSync(file, "utf8");
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const issueLineCount = lines.filter(x => /failed|failure|error|uncaught|rejection|timeout/i.test(x)).length;
    const m = lines.length ? lines[lines.length - 1].match(/^(\d{4}-\d{2}-\d{2}T\S+)/) : null;
    return { ...meta, lineCount: lines.length, issueLineCount, lastTimestamp: m ? redactText(m[1], 64) : null };
  } catch { return { ...meta, lineCount: null, issueLineCount: null, lastTimestamp: null }; }
}
async function audioCall(action, flow = "") {
  if (process.env.PACKRAT_AUDIO_MOCK === "1") {
    if (action === "State") return { output: "Speakers (PackRat Test)", input: "Microphone (PackRat Test)", volume: 50, inputVolume: 60, micMuted: false };
    if (action === "List") return flow === "input"
      ? [{ name: "Microphone (PackRat Test)", isDefault: true }, { name: "USB Mic", isDefault: false }]
      : [{ name: "Speakers (PackRat Test)", isDefault: true }, { name: "Headphones", isDefault: false }];
  }
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", audioPs, "-Action", action];
  if (flow) args.push("-Flow", flow);
  const out = await sys.runExe("powershell.exe", args, 12000);
  return out ? JSON.parse(out) : null;
}
function sanitizeAudioEntry(v) {
  if (!v || typeof v !== "object") return null;
  return { name: safeDeviceName(v.name), isDefault: !!v.isDefault };
}
async function probeAudio() {
  const result = { state: null, outputs: [], inputs: [], error: null };
  try {
    const [state, outputs, inputs] = await Promise.all([
      audioCall("State"), audioCall("List", "output"), audioCall("List", "input")
    ]);
    if (state && typeof state === "object") result.state = {
      output: safeDeviceName(state.output), input: safeDeviceName(state.input),
      volume: Number(state.volume) || 0, inputVolume: Number(state.inputVolume) || 0,
      micMuted: typeof state.micMuted === "boolean" ? state.micMuted : null
    };
    result.outputs = (Array.isArray(outputs) ? outputs : [outputs]).map(sanitizeAudioEntry).filter(Boolean);
    result.inputs = (Array.isArray(inputs) ? inputs : [inputs]).map(sanitizeAudioEntry).filter(Boolean);
  } catch (e) { result.error = redactText(e?.message || e, 240); }
  return result;
}
async function probeApps() {
  try {
    const apps = await sys.detectApps();
    return (Array.isArray(apps) ? apps : []).map(a => ({ token: String(a.token || ""), label: redactText(a.label || "", 80), installed: !!a.installed }));
  } catch (e) { return [{ token: "<probe-error>", label: redactText(e?.message || e, 160), installed: false }]; }
}
function loadManifest() {
  try { return JSON.parse(fs.readFileSync(path.join(pluginRoot, "manifest.json"), "utf8")); }
  catch { return {}; }
}
function loadConfig() { return cfg.loadConfig(configPath); }
function reportOutputDir() {
  const forced = process.env.PACKRAT_DIAGNOSTICS_DIR;
  const home = process.env.USERPROFILE || os.homedir();
  const candidates = [forced, path.join(home, "Desktop"), path.join(home, "Downloads"), stateDir].filter(Boolean);
  for (const p of candidates) {
    try { fs.mkdirSync(p, { recursive: true }); fs.accessSync(p, fs.constants.W_OK); return p; } catch {}
  }
  return stateDir;
}
function reportName(now = new Date()) { return `PackRat-Ultimate-Diagnostics-${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.json`; }
async function buildReport() {
  const manifest = loadManifest();
  const [apps, audio] = await Promise.all([probeApps(), probeAudio()]);
  const config = sanitizeConfigForReport(loadConfig());
  return {
    schema: 1,
    privacy: {
      clipboardContentsIncluded: false,
      snippetContentsIncluded: false,
      workspaceUrlsIncluded: false,
      rawLogsIncluded: false,
      fullCustomPathsIncluded: false
    },
    generatedAt: new Date().toISOString(),
    product: {
      name: String(manifest.Name || "Stream Deck Ultimate Bundle"),
      version: String(manifest.Version || "unknown"),
      uuid: String(manifest.UUID || ""),
      codePath: String(manifest.CodePath || "")
    },
    host: {
      platform: process.platform, arch: process.arch, node: process.version,
      osType: os.type(), osRelease: os.release(), osVersion: typeof os.version === "function" ? os.version() : ""
    },
    state: {
      config: fileMeta(configPath), log: logSummary(logPath),
      clipboardHistory: { exists: fileMeta(path.join(stateDir, "clipboard.json")).exists, contentsIncluded: false }
    },
    config, apps, audio
  };
}
async function generateReport() {
  const report = await buildReport();
  const dir = reportOutputDir();
  const file = path.join(dir, reportName());
  fs.writeFileSync(file, JSON.stringify(report, null, 2), "utf8");
  if (process.platform === "win32" && process.env.PACKRAT_DIAGNOSTICS_MOCK !== "1") {
    try { await sys.runExe("explorer.exe", [`/select,${file}`], 5000); } catch {}
  }
  return { file, report };
}

function attach(ws) {
  ws.addEventListener("message", ev => {
    let m; try { m = JSON.parse(String(ev.data)); } catch { return; }
    if (m.action !== UUID) return;
    const ctx = m.context;
    if (m.event === "willAppear" || m.event === "didReceiveSettings") {
      instances.set(ctx, { settings: m.payload?.settings || {} });
      setTimeout(() => { if (instances.has(ctx)) render(ws, ctx); }, 35);
    } else if (m.event === "willDisappear") instances.delete(ctx);
    else if (m.event === "keyUp") {
      generateReport().then(() => {
        setImage(ws, ctx, "imgs/status/ready.png");
        setTimeout(() => { if (instances.has(ctx)) render(ws, ctx); }, 1100);
      }).catch(() => {
        setImage(ws, ctx, "imgs/status/failed.png");
        setTimeout(() => { if (instances.has(ctx)) render(ws, ctx); }, 1400);
      });
    }
  });
  ws.addEventListener("close", () => instances.clear());
}

module.exports = { attach, redactText, safeApp, sanitizeConfigForReport, logSummary, buildReport, generateReport, reportName };
