"use strict";
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

function psQuote(v) { return `'${String(v ?? "").replace(/'/g, "''")}'`; }
function psArray(values) { return `@(${(values || []).map(psQuote).join(",")})`; }
function runExe(file, args = [], timeout = 15000) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
    if (e) reject(new Error((err || e.message || "command failed").trim()));
    else resolve(String(out || "").trim());
  }));
}
function runPS(script, timeout = 15000) {
  return runExe("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], timeout);
}
function firstExisting(items) { return items.find(p => p && fs.existsSync(p)) || ""; }
function envPath(name, ...parts) { return process.env[name] ? path.join(process.env[name], ...parts) : ""; }

function catalog() {
  return {
    browser: { token: "@browser", label: "Browser", keywords: ["chrome", "edge", "firefox", "brave", "opera"], processNames: ["chrome", "msedge", "firefox", "brave", "opera"], uri: "https://www.google.com", always: true },
    discord: { token: "@discord", label: "Discord", keywords: ["discord"], processNames: ["Discord"], candidates: [envPath("LOCALAPPDATA", "Discord", "Update.exe")], args: ["--processStart", "Discord.exe"], uri: "discord://" },
    spotify: { token: "@spotify", label: "Spotify", keywords: ["spotify"], processNames: ["Spotify"], candidates: [envPath("APPDATA", "Spotify", "Spotify.exe"), envPath("LOCALAPPDATA", "Microsoft", "WindowsApps", "Spotify.exe")], uri: "spotify:" },
    slack: { token: "@slack", label: "Slack", keywords: ["slack"], processNames: ["slack"], candidates: [envPath("LOCALAPPDATA", "slack", "slack.exe")], uri: "slack://open" },
    teams: { token: "@teams", label: "Microsoft Teams", keywords: ["microsoft teams", "teams"], processNames: ["ms-teams", "Teams"], candidates: [envPath("LOCALAPPDATA", "Microsoft", "WindowsApps", "ms-teams.exe"), envPath("LOCALAPPDATA", "Microsoft", "Teams", "current", "Teams.exe")], uri: "msteams:" },
    zoom: { token: "@zoom", label: "Zoom", keywords: ["zoom"], processNames: ["Zoom"], candidates: [envPath("APPDATA", "Zoom", "bin", "Zoom.exe"), envPath("APPDATA", "Zoom", "bin_00", "Zoom.exe")], uri: "zoommtg:" },
    steam: { token: "@steam", label: "Steam", keywords: ["steam"], processNames: ["steam"], candidates: [envPath("ProgramFiles(x86)", "Steam", "steam.exe"), envPath("ProgramFiles", "Steam", "steam.exe")], uri: "steam://open/main" },
    vscode: { token: "@vscode", label: "Visual Studio Code", keywords: ["visual studio code", "vs code"], processNames: ["Code"], candidates: [envPath("LOCALAPPDATA", "Programs", "Microsoft VS Code", "Code.exe"), envPath("ProgramFiles", "Microsoft VS Code", "Code.exe")], uri: "vscode:" },
    notion: { token: "@notion", label: "Notion", keywords: ["notion"], processNames: ["Notion"], candidates: [envPath("LOCALAPPDATA", "Programs", "Notion", "Notion.exe")], uri: "notion://" },
    todoist: { token: "@todoist", label: "Todoist", keywords: ["todoist"], processNames: ["Todoist"], candidates: [envPath("LOCALAPPDATA", "Programs", "Todoist", "Todoist.exe"), envPath("LOCALAPPDATA", "Microsoft", "WindowsApps", "Todoist.exe")], uri: "todoist://" },
    obs: { token: "@obs", label: "OBS Studio", keywords: ["obs studio", "obs"], processNames: ["obs64", "obs32"], candidates: [envPath("ProgramFiles", "obs-studio", "bin", "64bit", "obs64.exe"), envPath("ProgramFiles(x86)", "obs-studio", "bin", "32bit", "obs32.exe")] },
    explorer: { token: "@explorer", label: "File Explorer", keywords: ["file explorer"], processNames: ["explorer"], candidates: [envPath("WINDIR", "explorer.exe")], always: true }
  };
}
function targetFromEntry(entry) {
  if (!entry) return null;
  return { ...entry, path: firstExisting(entry.candidates || []), args: entry.args || [] };
}
function resolveTarget(tokenOrPath, role) {
  const token = String(tokenOrPath || "").trim();
  const effective = (token.startsWith("@") ? token.slice(1) : String(role || "").replace(/^@/, "")).toLowerCase();
  const aliases = { chat: "discord", music: "spotify", code: "vscode", files: "explorer" };
  const key = aliases[effective] || effective;
  const cat = catalog();
  if (cat[key]) return targetFromEntry(cat[key]);
  if (token && fs.existsSync(token)) return { token, label: path.basename(token, path.extname(token)), processNames: [path.basename(token, path.extname(token))], path: token, args: [], uri: "" };
  return null;
}
function processLookup(t) {
  return `$names=${psArray(t?.processNames || [])};$p=$null;foreach($n in $names){$p=Get-Process -Name $n -ErrorAction SilentlyContinue|Where-Object {$_.MainWindowHandle -ne 0}|Select-Object -First 1;if($p){break}}`;
}
function launchScript(t) {
  if (t?.path) return `Start-Process -FilePath ${psQuote(t.path)}${t.args?.length ? ` -ArgumentList ${psArray(t.args)}` : ""}`;
  if (t?.uri) return `Start-Process ${psQuote(t.uri)}`;
  return "throw 'No launch target available'";
}
async function focusOrLaunch(t, behavior = "focus") {
  if (!t) throw new Error("No application target configured");
  if (behavior === "new") { await runPS(`${launchScript(t)};'OPENED'`); return "OPENED"; }
  return runPS(`Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class PRActivate{[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);}\n'@;${processLookup(t)};if($p){[PRActivate]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null;$s=New-Object -ComObject WScript.Shell;$null=$s.AppActivate($p.Id);'FOCUSED'}else{${launchScript(t)};'OPENED'}`);
}
async function waitForWindow(t, timeoutMs = 8000) {
  if (!t?.processNames?.length) return false;
  return (await runPS(`$d=(Get-Date).AddMilliseconds(${timeoutMs});do{${processLookup(t)};if($p){'READY';exit};Start-Sleep -Milliseconds 160}while((Get-Date)-lt$d);'TIMEOUT'`, timeoutMs + 2500)) === "READY";
}
function planLayout(layout, count) {
  if (!count || layout === "none") return [];
  if (layout === "columns") return Array.from({ length: count }, (_, i) => [i / count, 0, 1 / count, 1]);
  if (layout === "grid") {
    const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
    return Array.from({ length: count }, (_, i) => [(i % cols) / cols, Math.floor(i / cols) / rows, 1 / cols, 1 / rows]);
  }
  if (count === 1) return [[0, 0, 1, 1]];
  if (count === 2) return [[0, 0, .5, 1], [.5, 0, .5, 1]];
  const rightCount = count - 1;
  if (rightCount <= 3) return [[0, 0, .55, 1], ...Array.from({ length: rightCount }, (_, i) => [.55, i / rightCount, .45, 1 / rightCount])];
  const cols = 2, rows = Math.ceil(rightCount / cols);
  return [[0, 0, .5, 1], ...Array.from({ length: rightCount }, (_, i) => [.5 + (i % cols) * .25, Math.floor(i / cols) / rows, .25, 1 / rows])];
}
async function moveTargetRect(t, rect) {
  if (!t?.processNames?.length || !rect) return false;
  const [x, y, w, h] = rect.map(Number);
  return (await runPS(`Add-Type -AssemblyName System.Windows.Forms;Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class PRMove{[DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r);[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);}\n'@;${processLookup(t)};if(!$p){'MISSING';exit};$h=$p.MainWindowHandle;[PRMove]::ShowWindowAsync($h,9)|Out-Null;$a=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea;$x=$a.X+[int]($a.Width*${x});$y=$a.Y+[int]($a.Height*${y});$w=[Math]::Max(160,[int]($a.Width*${w}));$he=[Math]::Max(120,[int]($a.Height*${h}));[PRMove]::MoveWindow($h,$x,$y,$w,$he,$true)|Out-Null;'OK'`)) === "OK";
}
async function runWorkspace(def, log = () => {}) {
  const tokens = (def?.apps || []).slice(0, 6);
  const targets = tokens.map(x => resolveTarget(x, String(x).startsWith("@") ? String(x).slice(1) : "")).filter(Boolean);
  if (!targets.length) throw new Error("Workspace has no valid apps");
  let failures = tokens.length - targets.length;
  await Promise.all(targets.map(async t => { try { await focusOrLaunch(t, "focus"); } catch (e) { failures++; log(`workspace launch ${t.label}: ${e.message}`); } }));
  const ready = await Promise.all(targets.map(async t => { try { return await waitForWindow(t, 8000); } catch { return false; } }));
  if (def?.layout !== "none") {
    const rects = planLayout(def?.layout || "work", targets.length);
    for (let i = 0; i < targets.length; i++) {
      if (!ready[i]) { failures++; continue; }
      try { if (!await moveTargetRect(targets[i], rects[i])) failures++; } catch { failures++; }
    }
  }
  if (def?.url) { try { await runPS(`Start-Process ${psQuote(def.url)}`); } catch (e) { failures++; log(`workspace url: ${e.message}`); } }
  return { failures, total: targets.length, ready: ready.filter(Boolean).length };
}

async function activeWindow(mode) {
  const m = psQuote(mode);
  await runPS(`Add-Type -AssemblyName System.Windows.Forms;Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r);[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);[DllImport("user32.dll",EntryPoint="GetWindowLongPtr")]public static extern IntPtr GetWindowLongPtr(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int cx,int cy,uint f);public struct RECT{public int L,T,R,B;}}\n'@;$h=[W]::GetForegroundWindow();if($h-eq[IntPtr]::Zero){throw'No active window'};$a=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea;$m=${m};$r=New-Object W+RECT;[W]::GetWindowRect($h,[ref]$r)|Out-Null;if($m-eq'maximize'){[W]::ShowWindowAsync($h,3)|Out-Null}elseif($m-eq'restore'){[W]::ShowWindowAsync($h,9)|Out-Null}elseif($m-eq'minimize'){[W]::ShowWindowAsync($h,6)|Out-Null}elseif($m-eq'left'){[W]::ShowWindowAsync($h,9)|Out-Null;[W]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}elseif($m-eq'right'){[W]::ShowWindowAsync($h,9)|Out-Null;[W]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}elseif($m-eq'top-left'){[W]::ShowWindowAsync($h,9)|Out-Null;[W]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}elseif($m-eq'top-right'){[W]::ShowWindowAsync($h,9)|Out-Null;[W]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}elseif($m-eq'bottom-left'){[W]::ShowWindowAsync($h,9)|Out-Null;[W]::MoveWindow($h,$a.X,$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}elseif($m-eq'bottom-right'){[W]::ShowWindowAsync($h,9)|Out-Null;[W]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}elseif($m-eq'center'){$w=[Math]::Min(1100,$a.Width);$he=[Math]::Min(760,$a.Height);[W]::MoveWindow($h,$a.X+[int](($a.Width-$w)/2),$a.Y+[int](($a.Height-$he)/2),$w,$he,$true)|Out-Null}elseif($m-eq'topmost'){$style=[W]::GetWindowLongPtr($h,-20).ToInt64();$isTop=($style-band 8)-ne 0;$after=if($isTop){[IntPtr](-2)}else{[IntPtr](-1)};[W]::SetWindowPos($h,$after,0,0,0,0,3)|Out-Null}elseif($m-eq'next-monitor'){$screens=[System.Windows.Forms.Screen]::AllScreens;$cur=[System.Windows.Forms.Screen]::FromHandle($h);$idx=[Array]::IndexOf($screens,$cur);$n=$screens[($idx+1)%$screens.Count].WorkingArea;$w=$r.R-$r.L;$he=$r.B-$r.T;[W]::MoveWindow($h,$n.X+30,$n.Y+30,[Math]::Min($w,$n.Width),[Math]::Min($he,$n.Height),$true)|Out-Null}`);
}
async function sendVirtualKeys(seq) {
  const body = seq.map(([v, d]) => `[K]::keybd_event(${v},0,${d ? 0 : 2},[UIntPtr]::Zero)`).join(";");
  return runPS(`Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class K{[DllImport("user32.dll")]public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e);}\n'@;${body}`);
}
async function capture(mode) {
  if (mode === "region") return runPS("Start-Process 'ms-screenclip:'");
  if (mode === "full") return sendVirtualKeys([[44, 1], [44, 0]]);
  if (mode === "window") return sendVirtualKeys([[18, 1], [44, 1], [44, 0], [18, 0]]);
  if (mode === "folder") return runPS("$p=[Environment]::GetFolderPath('MyPictures');$s=Join-Path $p 'Screenshots';Start-Process $(if(Test-Path $s){$s}else{$p})");
}
async function mediaControl(mode) {
  const keys = { mute: 173, "volume-down": 174, "volume-up": 175, "play-pause": 179, previous: 177, next: 176 };
  if (keys[mode]) return sendVirtualKeys([[keys[mode], 1], [keys[mode], 0]]);
}
async function systemControl(mode) {
  if (mode === "desktop") return sendVirtualKeys([[91, 1], [68, 1], [68, 0], [91, 0]]);
  if (mode === "task") return runPS("Start-Process taskmgr.exe");
  if (mode === "settings") return runPS("Start-Process 'ms-settings:'");
  if (mode === "explorer") return runPS("Start-Process explorer.exe");
  if (mode === "lock") return runPS("rundll32.exe user32.dll,LockWorkStation");
}
async function detectApps() {
  let startNames = "";
  try { startNames = (await runPS("Get-StartApps|Select-Object -ExpandProperty Name", 8000)).toLowerCase(); } catch {}
  const out = [];
  for (const entry of Object.values(catalog())) {
    const pathHit = firstExisting(entry.candidates || []);
    const startHit = (entry.keywords || []).some(k => startNames.includes(String(k).toLowerCase()));
    out.push({ token: entry.token, label: entry.label, installed: !!entry.always || !!pathHit || startHit });
  }
  return out;
}

module.exports = { psQuote, psArray, runExe, runPS, catalog, resolveTarget, focusOrLaunch, waitForWindow, planLayout, moveTargetRect, runWorkspace, activeWindow, sendVirtualKeys, capture, mediaControl, systemControl, detectApps };
