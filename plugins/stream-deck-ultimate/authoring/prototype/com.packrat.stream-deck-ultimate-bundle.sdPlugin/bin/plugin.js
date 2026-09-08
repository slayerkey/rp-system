"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");

const PLUGIN_UUID = "com.packrat.stream-deck-ultimate-bundle";
const ACTION = {
  APP: `${PLUGIN_UUID}.smart-app`,
  WORKSPACE: `${PLUGIN_UUID}.workspace`,
  WINDOW: `${PLUGIN_UUID}.window`,
  CLIPBOARD: `${PLUGIN_UUID}.clipboard`,
  SNIPPET: `${PLUGIN_UUID}.snippet`,
  CAPTURE: `${PLUGIN_UUID}.capture`,
  MEDIA: `${PLUGIN_UUID}.media`,
  SYSTEM: `${PLUGIN_UUID}.system`,
  NAVIGATION: `${PLUGIN_UUID}.navigation`
};

const args = process.argv.slice(2);
function arg(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : ""; }
const port = arg("-port");
const pluginUUID = arg("-pluginUUID") || PLUGIN_UUID;
const registerEvent = arg("-registerEvent") || "registerPlugin";
const pluginRoot = path.resolve(__dirname, "..");

const stateDir = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "PackRat",
  "StreamDeckUltimateBundle"
);
const historyPath = path.join(stateDir, "clipboard.json");
const logPath = path.join(stateDir, "ultimate-bundle.log");
fs.mkdirSync(stateDir, { recursive: true });

function log(msg) {
  try { fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`); } catch {}
}
function psQuote(s) { return `'${String(s ?? "").replace(/'/g, "''")}'`; }
function psArray(values) { return `@(${(values || []).map(psQuote).join(",")})`; }
function runPS(script, timeout = 12000) {
  return new Promise((resolve, reject) => execFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, timeout, maxBuffer: 2 * 1024 * 1024 },
    (e, out, err) => e
      ? reject(new Error((err || e.message || "PowerShell failed").trim()))
      : resolve(String(out || "").trim())
  ));
}

let ws;
function send(obj) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
const imageCache = new Map();
function imageData(rel) {
  try {
    if (!imageCache.has(rel)) {
      const b = fs.readFileSync(path.join(pluginRoot, rel));
      imageCache.set(rel, `data:image/png;base64,${b.toString("base64")}`);
    }
    return imageCache.get(rel);
  } catch (e) {
    log(`image missing ${rel}: ${e.message}`);
    return "";
  }
}
function setImage(ctx, rel) {
  const image = imageData(rel);
  if (image) send({ event: "setImage", context: ctx, payload: { image, target: 0 } });
}

const instances = new Map();
function keyImage(inst) {
  const s = inst.settings || {};
  if (inst.action === ACTION.APP) {
    const r = s.role || "browser";
    if (r === "browser") return "imgs/keys/web.png";
    if (r === "discord" || r === "chat") return "imgs/keys/discord.png";
    if (r === "spotify" || r === "music") return "imgs/keys/spotify.png";
    return "imgs/actions/smart-app/key@2x.png";
  }
  if (inst.action === ACTION.WORKSPACE) return "imgs/keys/work.png";
  if (inst.action === ACTION.WINDOW) return `imgs/keys/${({
    left: "left", right: "right", maximize: "max", restore: "restore", center: "center",
    "top-left": "top-left", "top-right": "top-right", "bottom-left": "bottom-left", "bottom-right": "bottom-right",
    "next-monitor": "screen", minimize: "minimize", topmost: "topmost"
  })[s.mode || "left"] || "left"}.png`;
  if (inst.action === ACTION.CLIPBOARD) {
    if (s.mode === "clear") return "imgs/keys/clip-clear.png";
    const slot = Math.max(1, Math.min(4, Number(s.slot || 1)));
    return `imgs/keys/clip${slot}.png`;
  }
  if (inst.action === ACTION.SNIPPET) return "imgs/keys/snippet.png";
  if (inst.action === ACTION.CAPTURE) return `imgs/keys/${({ region: "shot", full: "shot-full", window: "shot-window", folder: "shots-folder" })[s.mode || "region"] || "shot"}.png`;
  if (inst.action === ACTION.MEDIA) return `imgs/keys/${({ mute: "mute", "volume-down": "vol-down", "volume-up": "vol-up", "play-pause": "play", previous: "previous", next: "next" })[s.mode || "play-pause"] || "play"}.png`;
  if (inst.action === ACTION.SYSTEM) return `imgs/keys/${({ desktop: "desktop", task: "task", settings: "settings", lock: "lock", explorer: "explorer" })[s.mode || "desktop"] || "desktop"}.png`;
  if (inst.action === ACTION.NAVIGATION) {
    const p = String(s.profile || "");
    if (p.includes("Utilities")) return "imgs/keys/utilities.png";
    if (p.includes("Windows")) return "imgs/keys/windows.png";
    return "imgs/keys/home.png";
  }
  return "imgs/actions/smart-app/key@2x.png";
}
function render(ctx, inst) { setImage(ctx, keyImage(inst)); }
function flash(ctx, inst, status, ms = 900) {
  setImage(ctx, `imgs/status/${status}.png`);
  setTimeout(() => { if (instances.has(ctx)) render(ctx, instances.get(ctx) || inst); }, ms);
}
function fail(ctx, inst, error) {
  log(`action failure ${inst.action}: ${error && error.stack ? error.stack : error}`);
  flash(ctx, inst, "failed", 1300);
}

function browserTarget() {
  return {
    processNames: ["chrome", "msedge", "firefox", "brave", "opera"],
    uri: "https://www.google.com",
    label: "WEB"
  };
}
function discordTarget() {
  const local = process.env.LOCALAPPDATA || "";
  const update = path.join(local, "Discord", "Update.exe");
  return {
    processNames: ["Discord"],
    path: fs.existsSync(update) ? update : "",
    args: ["--processStart", "Discord.exe"],
    uri: "discord://",
    label: "DISCORD"
  };
}
function spotifyTarget() {
  const roaming = process.env.APPDATA || "";
  const local = process.env.LOCALAPPDATA || "";
  const candidates = [
    path.join(roaming, "Spotify", "Spotify.exe"),
    path.join(local, "Microsoft", "WindowsApps", "Spotify.exe")
  ];
  return {
    processNames: ["Spotify"],
    path: candidates.find(p => p && fs.existsSync(p)) || "",
    uri: "spotify:",
    label: "SPOTIFY"
  };
}
function resolveTarget(tokenOrPath, role) {
  const token = String(tokenOrPath || "").trim();
  const effective = token.startsWith("@") ? token.slice(1) : String(role || "").replace(/^@/, "");
  if (effective === "browser") return browserTarget();
  if (effective === "discord" || effective === "chat") return discordTarget();
  if (effective === "spotify" || effective === "music") return spotifyTarget();
  if (token && fs.existsSync(token)) {
    return { processNames: [path.basename(token, path.extname(token))], path: token, args: [], uri: "", label: path.basename(token, path.extname(token)).toUpperCase() };
  }
  return null;
}
function processLookup(target) {
  return `$names=${psArray(target && target.processNames || [])}; $p=$null; foreach($n in $names){ $p=Get-Process -Name $n -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1; if($p){break} }`;
}
function launchScript(target) {
  if (target.path) {
    const a = target.args && target.args.length ? ` -ArgumentList ${psArray(target.args)}` : "";
    return `Start-Process -FilePath ${psQuote(target.path)}${a}`;
  }
  if (target.uri) return `Start-Process ${psQuote(target.uri)}`;
  return `throw 'No launch target available'`;
}
async function focusOrLaunch(target, behavior = "focus") {
  if (!target) throw new Error("No application target configured");
  if (behavior === "new") {
    await runPS(`${launchScript(target)}; 'OPENED'`);
    return "OPENED";
  }
  const script = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class PRActivate {
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
}
'@;
${processLookup(target)}
if($p){
 $fg=[PRActivate]::GetForegroundWindow(); $fgPid=0; [PRActivate]::GetWindowThreadProcessId($fg,[ref]$fgPid)|Out-Null;
 if($fgPid -eq $p.Id){ 'ACTIVE'; exit 0 }
 [PRActivate]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null;
 $shell=New-Object -ComObject WScript.Shell;
 $null=$shell.AppActivate($p.Id);
 'FOCUSED'
}else{
 ${launchScript(target)};
 'OPENED'
}`;
  return await runPS(script);
}
async function waitForWindow(target, timeoutMs = 8000) {
  if (!target || !target.processNames || !target.processNames.length) return false;
  const script = `$deadline=(Get-Date).AddMilliseconds(${timeoutMs}); do { ${processLookup(target)}; if($p){'READY';exit 0}; Start-Sleep -Milliseconds 160 } while((Get-Date) -lt $deadline); 'TIMEOUT'`;
  return (await runPS(script, timeoutMs + 2500)) === "READY";
}

async function moveTarget(target, mode) {
  if (!target || !target.processNames || !target.processNames.length) return false;
  const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type @'
using System; using System.Runtime.InteropServices;
public static class PRMove {
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n);
}
'@; ${processLookup(target)}; if(!$p){'MISSING';exit 0}; $h=$p.MainWindowHandle; [PRMove]::ShowWindowAsync($h,9)|Out-Null; $a=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea; $m=${psQuote(mode)};
if($m -eq 'left'){[PRMove]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}
elseif($m -eq 'right'){[PRMove]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}
elseif($m -eq 'top-left'){[PRMove]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'top-right'){[PRMove]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'bottom-left'){[PRMove]::MoveWindow($h,$a.X,$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'bottom-right'){[PRMove]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
'OK'`;
  return (await runPS(script)) === "OK";
}

async function activeWindow(mode) {
  const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type @'
using System; using System.Runtime.InteropServices;
public static class PRW {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r);
 [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h,int n);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")] static extern IntPtr GetWindowLongPtr64(IntPtr h,int n);
 [DllImport("user32.dll", EntryPoint="GetWindowLong")] static extern IntPtr GetWindowLongPtr32(IntPtr h,int n);
 public static IntPtr GetWindowLongPtr(IntPtr h,int n){ return IntPtr.Size==8 ? GetWindowLongPtr64(h,n) : GetWindowLongPtr32(h,n); }
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int cx,int cy,uint flags);
 public struct RECT { public int L,T,R,B; }
}
'@;
$h=[PRW]::GetForegroundWindow(); if($h -eq [IntPtr]::Zero){throw 'No active window'}; $screen=[System.Windows.Forms.Screen]::FromHandle($h); $a=$screen.WorkingArea; $m=${psQuote(mode)}; $r=New-Object PRW+RECT; [PRW]::GetWindowRect($h,[ref]$r)|Out-Null;
if($m -eq 'maximize'){[PRW]::ShowWindowAsync($h,3)|Out-Null}
elseif($m -eq 'restore'){[PRW]::ShowWindowAsync($h,9)|Out-Null}
elseif($m -eq 'minimize'){[PRW]::ShowWindowAsync($h,6)|Out-Null}
elseif($m -eq 'left'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}
elseif($m -eq 'right'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}
elseif($m -eq 'top-left'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'top-right'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'bottom-left'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X,$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'bottom-right'){[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m -eq 'center'){[PRW]::ShowWindowAsync($h,9)|Out-Null;$w=[Math]::Min($r.R-$r.L,[int]($a.Width*.82));$he=[Math]::Min($r.B-$r.T,[int]($a.Height*.82));$x=$a.X+[int](($a.Width-$w)/2);$y=$a.Y+[int](($a.Height-$he)/2);[PRW]::MoveWindow($h,$x,$y,$w,$he,$true)|Out-Null}
elseif($m -eq 'next-monitor'){ $screens=[System.Windows.Forms.Screen]::AllScreens; if($screens.Count -gt 1){$idx=0;for($i=0;$i -lt $screens.Count;$i++){if($screens[$i].DeviceName -eq $screen.DeviceName){$idx=$i}};$t=$screens[($idx+1)%$screens.Count].WorkingArea;$ww=[Math]::Min($r.R-$r.L,$t.Width);$hh=[Math]::Min($r.B-$r.T,$t.Height);$rx=($r.L-$a.X)/[Math]::Max(1,$a.Width);$ry=($r.T-$a.Y)/[Math]::Max(1,$a.Height);$x=$t.X+[int]($rx*$t.Width);$y=$t.Y+[int]($ry*$t.Height);[PRW]::ShowWindowAsync($h,9)|Out-Null;[PRW]::MoveWindow($h,$x,$y,$ww,$hh,$true)|Out-Null}}
elseif($m -eq 'topmost'){ $ex=[PRW]::GetWindowLongPtr($h,-20).ToInt64();$isTop=($ex -band 8) -ne 0;$after=if($isTop){[IntPtr](-2)}else{[IntPtr](-1)};[PRW]::SetWindowPos($h,$after,0,0,0,0,0x0013)|Out-Null }
'OK'`;
  await runPS(script);
}

async function mediaControl(mode) {
  const vk = { mute: 173, "volume-down": 174, "volume-up": 175, next: 176, previous: 177, "play-pause": 179 }[mode] || 179;
  await runPS(`Add-Type @'\nusing System; using System.Runtime.InteropServices; public static class PRKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e); }\n'@; [PRKeys]::keybd_event(${vk},0,0,[UIntPtr]::Zero); [PRKeys]::keybd_event(${vk},0,2,[UIntPtr]::Zero)`);
}
async function sendVirtualKeys(sequence) {
  const body = sequence.map(([vk, down]) => `[PRKeys]::keybd_event(${vk},0,${down ? 0 : 2},[UIntPtr]::Zero)`).join(";");
  await runPS(`Add-Type @'\nusing System; using System.Runtime.InteropServices; public static class PRKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e); }\n'@; ${body}`);
}
async function capture(mode) {
  if (mode === "region") return runPS(`Start-Process 'ms-screenclip:'`);
  if (mode === "full") return sendVirtualKeys([[44,true],[44,false]]);
  if (mode === "window") return sendVirtualKeys([[18,true],[44,true],[44,false],[18,false]]);
  if (mode === "folder") return runPS(`$p=[Environment]::GetFolderPath('MyPictures');$s=Join-Path $p 'Screenshots';if(Test-Path $s){Start-Process $s}else{Start-Process $p}`);
}
async function systemControl(mode) {
  if (mode === "desktop") return sendVirtualKeys([[91,true],[68,true],[68,false],[91,false]]);
  if (mode === "task") return runPS(`Start-Process taskmgr.exe`);
  if (mode === "settings") return runPS(`Start-Process 'ms-settings:'`);
  if (mode === "explorer") return runPS(`Start-Process explorer.exe`);
  if (mode === "lock") return runPS(`rundll32.exe user32.dll,LockWorkStation`);
}

let clipboardHistory = [];
try {
  const v = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  if (Array.isArray(v)) clipboardHistory = v.filter(x => typeof x === "string").slice(0, 8);
} catch {}
let clipboardTimer = null;
let lastClipboard = "";
let suppressClipboardUntil = 0;
function saveHistory() { try { fs.writeFileSync(historyPath, JSON.stringify(clipboardHistory, null, 2)); } catch {} }
function visibleClipboard() { return [...instances.values()].some(x => x.action === ACTION.CLIPBOARD); }
async function readClipboardText() {
  return (await runPS(`$v=Get-Clipboard -Raw -ErrorAction SilentlyContinue; if($v -is [string]){$v}`, 5000)).replace(/\r\n/g, "\n").trimEnd();
}
async function pollClipboard() {
  if (!visibleClipboard() || Date.now() < suppressClipboardUntil) return;
  try {
    const txt = await readClipboardText();
    if (txt && txt !== lastClipboard) {
      lastClipboard = txt;
      clipboardHistory = [txt.slice(0, 12000), ...clipboardHistory.filter(x => x !== txt)].slice(0, 8);
      saveHistory();
    }
  } catch (e) { log(`clipboard poll: ${e.message}`); }
}
function startClipboard() {
  if (!clipboardTimer) {
    clipboardTimer = setInterval(pollClipboard, 850);
    setTimeout(pollClipboard, 100);
  }
}
async function pasteText(text, restoreClipboard = false) {
  if (!text) throw new Error("Nothing to paste");
  let previous = "";
  if (restoreClipboard) { try { previous = await readClipboardText(); } catch {} }
  suppressClipboardUntil = Date.now() + 1200;
  const p = path.join(stateDir, `paste-${process.pid}.txt`);
  fs.writeFileSync(p, text, "utf8");
  await runPS(`$v=Get-Content -LiteralPath ${psQuote(p)} -Raw; Set-Clipboard -Value $v; Add-Type @'\nusing System; using System.Runtime.InteropServices; public static class PRPaste { [DllImport("user32.dll")] public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e); }\n'@; [PRPaste]::keybd_event(0x11,0,0,[UIntPtr]::Zero);[PRPaste]::keybd_event(0x56,0,0,[UIntPtr]::Zero);[PRPaste]::keybd_event(0x56,0,2,[UIntPtr]::Zero);[PRPaste]::keybd_event(0x11,0,2,[UIntPtr]::Zero)`);
  if (restoreClipboard && previous) {
    await new Promise(r => setTimeout(r, 260));
    const r = path.join(stateDir, `restore-${process.pid}.txt`);
    fs.writeFileSync(r, previous, "utf8");
    await runPS(`$v=Get-Content -LiteralPath ${psQuote(r)} -Raw; Set-Clipboard -Value $v`);
    lastClipboard = previous;
  } else {
    lastClipboard = text;
  }
}
async function pasteClipboard(slot) {
  if (!clipboardHistory[slot - 1]) await pollClipboard();
  const text = clipboardHistory[slot - 1];
  if (!text) return false;
  await pasteText(text, false);
  return true;
}
function clearClipboardHistory() {
  clipboardHistory = [];
  lastClipboard = "";
  saveHistory();
}
async function expandSnippet(text) {
  const now = new Date();
  const date = now.toLocaleDateString();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let clipboard = "";
  if (String(text).includes("{{clipboard}}")) { try { clipboard = await readClipboardText(); } catch {} }
  return String(text || "")
    .replaceAll("{{date}}", date)
    .replaceAll("{{time}}", time)
    .replaceAll("{{datetime}}", `${date} ${time}`)
    .replaceAll("{{clipboard}}", clipboard);
}

async function runWorkspace(settings) {
  const raw = String(settings.apps || "@browser\n@discord\n@spotify").split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 5);
  const targets = raw.map(x => resolveTarget(x, x.startsWith("@") ? x.slice(1) : "")).filter(Boolean);
  if (!targets.length) throw new Error("Workspace has no valid apps");
  let failures = 0;
  for (const target of targets) {
    try { await focusOrLaunch(target, "focus"); } catch (e) { failures++; log(`workspace launch ${target.label}: ${e.message}`); }
  }
  const ready = [];
  for (const target of targets) {
    try { ready.push(await waitForWindow(target, 8000)); } catch { ready.push(false); }
  }
  if (settings.arrange !== false && settings.layout !== "none") {
    const layout = settings.layout || "work";
    let modes = [];
    if (layout === "work") modes = targets.length === 1 ? ["left"] : targets.length === 2 ? ["left", "right"] : targets.length === 3 ? ["left", "top-right", "bottom-right"] : ["top-left", "top-right", "bottom-left", "bottom-right"];
    else if (layout === "columns") modes = targets.length <= 2 ? ["left", "right"] : ["left", "top-right", "bottom-right"];
    else if (layout === "grid") modes = ["top-left", "top-right", "bottom-left", "bottom-right"];
    for (let i = 0; i < Math.min(targets.length, modes.length); i++) {
      if (!ready[i]) { failures++; continue; }
      try { await moveTarget(targets[i], modes[i]); } catch (e) { failures++; log(`workspace move ${targets[i].label}: ${e.message}`); }
    }
  }
  return failures;
}

async function execute(ctx, inst) {
  const s = inst.settings || {};
  try {
    if (inst.action === ACTION.APP) {
      const target = s.role === "custom" ? resolveTarget(s.path, "custom") : resolveTarget("", s.role || "browser");
      const result = await focusOrLaunch(target, s.behavior || "focus");
      flash(ctx, inst, result === "OPENED" ? "opened" : "focused");
    } else if (inst.action === ACTION.WORKSPACE) {
      const failures = await runWorkspace(s);
      flash(ctx, inst, failures ? "partial" : "ready", failures ? 1300 : 900);
    } else if (inst.action === ACTION.WINDOW) {
      await activeWindow(s.mode || "left");
    } else if (inst.action === ACTION.CLIPBOARD) {
      if (s.mode === "clear") { clearClipboardHistory(); flash(ctx, inst, "cleared"); }
      else {
        const ok = await pasteClipboard(Math.max(1, Math.min(4, Number(s.slot || 1))));
        flash(ctx, inst, ok ? "pasted" : "empty", ok ? 800 : 1200);
      }
    } else if (inst.action === ACTION.SNIPPET) {
      const text = await expandSnippet(s.text || "");
      if (!text) flash(ctx, inst, "empty", 1200);
      else { await pasteText(text, s.restoreClipboard !== false); flash(ctx, inst, "pasted"); }
    } else if (inst.action === ACTION.CAPTURE) {
      await capture(s.mode || "region");
    } else if (inst.action === ACTION.MEDIA) {
      await mediaControl(s.mode || "play-pause");
    } else if (inst.action === ACTION.SYSTEM) {
      await systemControl(s.mode || "desktop");
    } else if (inst.action === ACTION.NAVIGATION) {
      if (!inst.device) throw new Error("No Stream Deck device id");
      send({ event: "switchToProfile", context: ctx, device: inst.device, payload: { profile: s.profile } });
    }
  } catch (e) { fail(ctx, inst, e); }
}

if (!port) { log("missing -port argument"); process.exit(1); }
try { ws = new WebSocket(`ws://127.0.0.1:${port}`); } catch (e) { log(`websocket create failed: ${e.message}`); process.exit(1); }
ws.addEventListener("open", () => { send({ event: registerEvent, uuid: pluginUUID }); log("connected"); });
ws.addEventListener("message", ev => {
  let m;
  try { m = JSON.parse(String(ev.data)); } catch { return; }
  const ctx = m.context;
  if (m.event === "willAppear" || m.event === "didReceiveSettings") {
    const inst = { action: m.action, settings: (m.payload && m.payload.settings) || {}, device: m.device };
    instances.set(ctx, inst);
    render(ctx, inst);
    if (inst.action === ACTION.CLIPBOARD) startClipboard();
  } else if (m.event === "willDisappear") {
    instances.delete(ctx);
  } else if (m.event === "keyUp") {
    const inst = instances.get(ctx) || { action: m.action, settings: (m.payload && m.payload.settings) || {}, device: m.device };
    execute(ctx, inst);
  }
});
ws.addEventListener("error", e => log(`websocket error ${e && e.message || ""}`));
ws.addEventListener("close", () => { log("websocket closed"); setTimeout(() => process.exit(0), 250); });
process.on("uncaughtException", e => log(`uncaught ${e.stack || e.message}`));
process.on("unhandledRejection", e => log(`rejection ${e && e.stack || e}`));
