"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { execFile } = require("child_process");

const PLUGIN_UUID = "com.packrat.stream-deck-ultimate-bundle";
const ACTION = {
  APP:`${PLUGIN_UUID}.smart-app`, WORKSPACE:`${PLUGIN_UUID}.workspace`, WINDOW:`${PLUGIN_UUID}.window`,
  CLIPBOARD:`${PLUGIN_UUID}.clipboard`, SNIPPET:`${PLUGIN_UUID}.snippet`, CAPTURE:`${PLUGIN_UUID}.capture`,
  MEDIA:`${PLUGIN_UUID}.media`, SYSTEM:`${PLUGIN_UUID}.system`, NAVIGATION:`${PLUGIN_UUID}.navigation`,
  AUDIO:`${PLUGIN_UUID}.audio`, PRESET:`${PLUGIN_UUID}.audio-preset`, ROUTINE:`${PLUGIN_UUID}.routine`,
  SETUP:`${PLUGIN_UUID}.setup`
};
const args = process.argv.slice(2);
const arg = n => { const i=args.indexOf(n); return i>=0 ? args[i+1] : ""; };
const port=arg("-port"), pluginUUID=arg("-pluginUUID")||PLUGIN_UUID, registerEvent=arg("-registerEvent")||"registerPlugin";
const pluginRoot=path.resolve(__dirname,"..");
const stateDir=path.join(process.env.APPDATA||path.join(os.homedir(),"AppData","Roaming"),"PackRat","StreamDeckUltimateBundle");
const historyPath=path.join(stateDir,"clipboard.json"), configPath=path.join(stateDir,"config.json"), logPath=path.join(stateDir,"ultimate-bundle.log");
const audioPs=path.join(__dirname,"audio.ps1");
fs.mkdirSync(stateDir,{recursive:true});

const DEFAULT_CONFIG = {
  version:1,
  outputDevice:"",
  inputDevice:"",
  workspaces:{
    work:{apps:["@browser","@discord","@spotify"],layout:"work"},
    focus:{apps:["@browser"],layout:"work"},
    meeting:{apps:["@browser"],layout:"none",url:""},
    gaming:{apps:["@discord","@spotify"],layout:"none"}
  },
  presets:{
    work:{output:"",input:"",volume:45,micMuted:false},
    focus:{output:"",input:"",volume:35,micMuted:true},
    meeting:{output:"",input:"",volume:55,micMuted:false},
    gaming:{output:"",input:"",volume:65,micMuted:false}
  }
};

function log(s){ try{fs.appendFileSync(logPath,`${new Date().toISOString()} ${s}\n`);}catch{} }
function loadJson(file,fallback){ try{return {...fallback,...JSON.parse(fs.readFileSync(file,"utf8"))};}catch{return JSON.parse(JSON.stringify(fallback));} }
let config=loadJson(configPath,DEFAULT_CONFIG);
function saveConfig(){ try{fs.writeFileSync(configPath,JSON.stringify(config,null,2));}catch(e){log(`config save: ${e.message}`);} }
function psQuote(v){ return `'${String(v??"").replace(/'/g,"''")}'`; }
function psArray(a){ return `@(${(a||[]).map(psQuote).join(",")})`; }
function runExe(file,args=[],timeout=15000){
  return new Promise((resolve,reject)=>execFile(file,args,{windowsHide:true,timeout,maxBuffer:4*1024*1024},(e,out,err)=>e?reject(new Error((err||e.message||"command failed").trim())):resolve(String(out||"").trim())));
}
function runPS(script,timeout=15000){ return runExe("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",script],timeout); }
let mockAudio={output:"Speakers (PackRat Test)",input:"Microphone (PackRat Test)",volume:50,inputVolume:60,micMuted:false};
async function audio(action,opts={}){
  if(process.env.PACKRAT_AUDIO_MOCK==="1"){
    if(action==="State")return {...mockAudio};
    if(action==="List")return opts.flow==="input"?[{name:"Microphone (PackRat Test)",id:"mock-in",isDefault:true},{name:"USB Mic",id:"mock-in-2",isDefault:false}]:[{name:"Speakers (PackRat Test)",id:"mock-out",isDefault:true},{name:"Headphones",id:"mock-out-2",isDefault:false}];
    if(action==="MicToggle"){mockAudio.micMuted=!mockAudio.micMuted;return {micMuted:mockAudio.micMuted};}
    if(action==="MicSet"){mockAudio.micMuted=!!opts.muted;return {micMuted:mockAudio.micMuted};}
    if(action==="VolumeSet"){const k=opts.flow==="input"?"inputVolume":"volume";mockAudio[k]=Math.max(0,Math.min(100,Number(opts.value)||0));return {volume:mockAudio[k]};}
    if(action==="VolumeAdjust"){const k=opts.flow==="input"?"inputVolume":"volume";mockAudio[k]=Math.max(0,Math.min(100,mockAudio[k]+Number(opts.value||0)));return {volume:mockAudio[k]};}
    if(action==="Cycle"||action==="Switch"){if(opts.flow==="input")mockAudio.input=action==="Switch"?(opts.match||mockAudio.input):(mockAudio.input.includes("USB")?"Microphone (PackRat Test)":"USB Mic");else mockAudio.output=action==="Switch"?(opts.match||mockAudio.output):(mockAudio.output.includes("Headphones")?"Speakers (PackRat Test)":"Headphones");return {name:opts.flow==="input"?mockAudio.input:mockAudio.output};}
  }
  const a=["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",audioPs,"-Action",action];
  if(opts.flow)a.push("-Flow",opts.flow); if(opts.match!==undefined)a.push("-Match",String(opts.match));
  if(opts.value!==undefined)a.push("-Value",String(opts.value)); if(opts.step!==undefined)a.push("-Step",String(opts.step));
  if(opts.muted!==undefined)a.push("-Muted",String(!!opts.muted));
  const out=await runExe("powershell.exe",a,20000);
  if(!out)return null; try{return JSON.parse(out);}catch{return out;}
}

let ws;
function send(obj){ if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj)); }
const imageCache=new Map();
function imageData(rel){ try{ if(!imageCache.has(rel))imageCache.set(rel,`data:image/png;base64,${fs.readFileSync(path.join(pluginRoot,rel)).toString("base64")}`); return imageCache.get(rel);}catch(e){log(`image missing ${rel}: ${e.message}`);return "";} }
function setImage(ctx,rel){const image=imageData(rel);if(image)send({event:"setImage",context:ctx,payload:{image,target:0}});}
function setFeedback(ctx,payload){send({event:"setFeedback",context:ctx,payload});}

const instances=new Map();
let audioState={output:"",input:"",volume:0,inputVolume:0,micMuted:false}, audioTimer=null, audioBusy=false;

function keyImage(inst){
  const s=inst.settings||{};
  if(inst.action===ACTION.APP){ const r=s.role||"browser"; return `imgs/keys/${r==="browser"?"web":r==="discord"||r==="chat"?"discord":r==="spotify"||r==="music"?"spotify":"app"}.png`; }
  if(inst.action===ACTION.WORKSPACE)return "imgs/keys/work.png";
  if(inst.action===ACTION.WINDOW)return `imgs/keys/${({left:"left",right:"right",maximize:"max",restore:"restore",center:"center","top-left":"top-left","top-right":"top-right","bottom-left":"bottom-left","bottom-right":"bottom-right","next-monitor":"screen",minimize:"minimize",topmost:"topmost"})[s.mode||"left"]||"left"}.png`;
  if(inst.action===ACTION.CLIPBOARD)return s.mode==="clear"?"imgs/keys/clip-clear.png":`imgs/keys/clip${Math.max(1,Math.min(4,Number(s.slot||1)))}.png`;
  if(inst.action===ACTION.SNIPPET)return "imgs/keys/snippet.png";
  if(inst.action===ACTION.CAPTURE)return `imgs/keys/${({region:"shot",full:"shot-full",window:"shot-window",folder:"shots-folder"})[s.mode||"region"]||"shot"}.png`;
  if(inst.action===ACTION.MEDIA)return `imgs/keys/${({mute:"mute","volume-down":"vol-down","volume-up":"vol-up","play-pause":"play",previous:"previous",next:"next"})[s.mode||"play-pause"]||"play"}.png`;
  if(inst.action===ACTION.SYSTEM)return `imgs/keys/${({desktop:"desktop",task:"task",settings:"settings",lock:"lock",explorer:"explorer"})[s.mode||"desktop"]||"desktop"}.png`;
  if(inst.action===ACTION.NAVIGATION){const p=String(s.profile||"");return p.includes("Audio")?"imgs/keys/audio.png":p.includes("Utilities")?"imgs/keys/utilities.png":p.includes("Windows")?"imgs/keys/windows.png":"imgs/keys/home.png";}
  if(inst.action===ACTION.AUDIO){
    const m=s.mode||"mic-toggle"; if(m==="mic-toggle")return audioState.micMuted?"imgs/keys/mic-muted.png":"imgs/keys/mic-live.png";
    if(m.includes("output"))return "imgs/keys/output.png"; if(m.includes("input")||m==="mic-volume-dial")return "imgs/keys/input.png";
    return "imgs/keys/audio.png";
  }
  if(inst.action===ACTION.PRESET)return `imgs/keys/mode-${s.mode||"work"}.png`;
  if(inst.action===ACTION.ROUTINE)return `imgs/keys/${s.mode==="meeting"?"meeting":s.mode==="focus"?"focus":s.mode==="gaming"?"gaming":"work"}.png`;
  if(inst.action===ACTION.SETUP)return "imgs/keys/setup.png";
  return "imgs/keys/app.png";
}
function render(ctx,inst){ if((inst.controller||"Keypad")==="Encoder"){ updateDial(ctx,inst); return; } setImage(ctx,keyImage(inst)); }
function flash(ctx,inst,status,ms=900){setImage(ctx,`imgs/status/${status}.png`);setTimeout(()=>{if(instances.has(ctx))render(ctx,instances.get(ctx)||inst)},ms);}
function fail(ctx,inst,e){log(`action failure ${inst.action}: ${e?.stack||e}`);flash(ctx,inst,"failed",1300);}

async function refreshAudioState(){
  if(audioBusy)return audioState; audioBusy=true;
  try{ const s=await audio("State"); if(s&&typeof s==="object")audioState=s; }
  catch(e){log(`audio state: ${e.message}`);}
  finally{audioBusy=false;}
  for(const [ctx,inst] of instances) if([ACTION.AUDIO,ACTION.PRESET,ACTION.ROUTINE].includes(inst.action))render(ctx,inst);
  return audioState;
}
function ensureAudioPolling(){ if(!audioTimer){refreshAudioState();audioTimer=setInterval(refreshAudioState,1500);} }
function updateDial(ctx,inst){
  const m=inst.settings?.mode||"volume-dial";
  if(m==="volume-dial")setFeedback(ctx,{title:"Master Volume",value:`${audioState.volume||0}%`,indicator:{value:Number(audioState.volume||0)}});
  else if(m==="mic-volume-dial")setFeedback(ctx,{title:"Mic Level",value:`${audioState.inputVolume||0}%`,indicator:{value:Number(audioState.inputVolume||0)}});
  else if(m==="output-cycle")setFeedback(ctx,{title:"Output",value:shortDevice(audioState.output)});
  else if(m==="input-cycle")setFeedback(ctx,{title:"Input",value:shortDevice(audioState.input)});
}
function shortDevice(s){s=String(s||"Unknown");return s.length>18?s.slice(0,17)+"…":s;}

function browserTarget(){return {processNames:["chrome","msedge","firefox","brave","opera"],uri:"https://www.google.com",label:"WEB"};}
function discordTarget(){const local=process.env.LOCALAPPDATA||"";const p=path.join(local,"Discord","Update.exe");return {processNames:["Discord"],path:fs.existsSync(p)?p:"",args:["--processStart","Discord.exe"],uri:"discord://",label:"DISCORD"};}
function spotifyTarget(){const roaming=process.env.APPDATA||"",local=process.env.LOCALAPPDATA||"";const c=[path.join(roaming,"Spotify","Spotify.exe"),path.join(local,"Microsoft","WindowsApps","Spotify.exe")];return {processNames:["Spotify"],path:c.find(p=>fs.existsSync(p))||"",uri:"spotify:",label:"SPOTIFY"};}
function resolveTarget(tokenOrPath,role){
  const token=String(tokenOrPath||"").trim(), effective=token.startsWith("@")?token.slice(1):String(role||"").replace(/^@/,"");
  if(effective==="browser")return browserTarget();if(effective==="discord"||effective==="chat")return discordTarget();if(effective==="spotify"||effective==="music")return spotifyTarget();
  if(token&&fs.existsSync(token))return {processNames:[path.basename(token,path.extname(token))],path:token,args:[],uri:"",label:path.basename(token,path.extname(token)).toUpperCase()};
  return null;
}
function processLookup(t){return `$names=${psArray(t?.processNames||[])};$p=$null;foreach($n in $names){$p=Get-Process -Name $n -ErrorAction SilentlyContinue|Where-Object {$_.MainWindowHandle -ne 0}|Select-Object -First 1;if($p){break}}`;}
function launchScript(t){if(t.path)return `Start-Process -FilePath ${psQuote(t.path)}${t.args?.length?` -ArgumentList ${psArray(t.args)}`:""}`;if(t.uri)return `Start-Process ${psQuote(t.uri)}`;return "throw 'No launch target available'";}
async function focusOrLaunch(t,behavior="focus"){
  if(!t)throw new Error("No application target configured");
  if(behavior==="new"){await runPS(`${launchScript(t)};'OPENED'`);return "OPENED";}
  return runPS(`Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class PRActivate{[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);}\n'@;${processLookup(t)};if($p){[PRActivate]::ShowWindowAsync($p.MainWindowHandle,9)|Out-Null;$s=New-Object -ComObject WScript.Shell;$null=$s.AppActivate($p.Id);'FOCUSED'}else{${launchScript(t)};'OPENED'}`);
}
async function waitForWindow(t,timeoutMs=8000){if(!t?.processNames?.length)return false;return (await runPS(`$d=(Get-Date).AddMilliseconds(${timeoutMs});do{${processLookup(t)};if($p){'READY';exit};Start-Sleep -Milliseconds 160}while((Get-Date)-lt$d);'TIMEOUT'`,timeoutMs+2500))==="READY";}
async function moveTarget(t,mode){
  if(!t?.processNames?.length)return false;
  const map={left:"$a.X,$a.Y,[int]($a.Width/2),$a.Height",right:"$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),$a.Height","top-left":"$a.X,$a.Y,[int]($a.Width/2),[int]($a.Height/2)","top-right":"$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),[int]($a.Height/2)","bottom-left":"$a.X,$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2)","bottom-right":"$a.X+[int]($a.Width/2),$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2)"};
  const dims=map[mode]; if(!dims)return false;
  return (await runPS(`Add-Type -AssemblyName System.Windows.Forms;Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class PRMove{[DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r);[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);}\n'@;${processLookup(t)};if(!$p){'MISSING';exit};$h=$p.MainWindowHandle;[PRMove]::ShowWindowAsync($h,9)|Out-Null;$a=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea;[PRMove]::MoveWindow($h,${dims},$true)|Out-Null;'OK'`))==="OK";
}
async function activeWindow(mode){
  const m=psQuote(mode);
  await runPS(`Add-Type -AssemblyName System.Windows.Forms;Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool MoveWindow(IntPtr h,int x,int y,int w,int he,bool r);[DllImport("user32.dll")]public static extern bool ShowWindowAsync(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);[DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int cx,int cy,uint f);public struct RECT{public int L,T,R,B;}}\n'@;$h=[W]::GetForegroundWindow();if($h-eq[IntPtr]::Zero){throw'No active window'};$a=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea;$m=${m};$r=New-Object W+RECT;[W]::GetWindowRect($h,[ref]$r)|Out-Null;
if($m-eq'maximize'){[W]::ShowWindowAsync($h,3)|Out-Null}elseif($m-eq'restore'){[W]::ShowWindowAsync($h,9)|Out-Null}elseif($m-eq'minimize'){[W]::ShowWindowAsync($h,6)|Out-Null}
elseif($m-eq'left'){[W]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}elseif($m-eq'right'){[W]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),$a.Height,$true)|Out-Null}
elseif($m-eq'top-left'){[W]::MoveWindow($h,$a.X,$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}elseif($m-eq'top-right'){[W]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y,[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m-eq'bottom-left'){[W]::MoveWindow($h,$a.X,$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}elseif($m-eq'bottom-right'){[W]::MoveWindow($h,$a.X+[int]($a.Width/2),$a.Y+[int]($a.Height/2),[int]($a.Width/2),[int]($a.Height/2),$true)|Out-Null}
elseif($m-eq'center'){$w=[Math]::Min(1100,$a.Width);$he=[Math]::Min(760,$a.Height);[W]::MoveWindow($h,$a.X+[int](($a.Width-$w)/2),$a.Y+[int](($a.Height-$he)/2),$w,$he,$true)|Out-Null}
elseif($m-eq'topmost'){[W]::SetWindowPos($h,[IntPtr](-1),0,0,0,0,3)|Out-Null}
elseif($m-eq'next-monitor'){$screens=[System.Windows.Forms.Screen]::AllScreens;$cur=[System.Windows.Forms.Screen]::FromHandle($h);$idx=[Array]::IndexOf($screens,$cur);$n=$screens[($idx+1)%$screens.Count].WorkingArea;$w=$r.R-$r.L;$he=$r.B-$r.T;[W]::MoveWindow($h,$n.X+30,$n.Y+30,[Math]::Min($w,$n.Width),[Math]::Min($he,$n.Height),$true)|Out-Null}`);
}
async function sendVirtualKeys(seq){const body=seq.map(([v,d])=>`[K]::keybd_event(${v},0,${d?0:2},[UIntPtr]::Zero)`).join(";");await runPS(`Add-Type @'\nusing System;using System.Runtime.InteropServices;public static class K{[DllImport("user32.dll")]public static extern void keybd_event(byte v,byte s,uint f,UIntPtr e);}\n'@;${body}`);}
async function capture(mode){if(mode==="region")return runPS("Start-Process 'ms-screenclip:'");if(mode==="full")return sendVirtualKeys([[44,1],[44,0]]);if(mode==="window")return sendVirtualKeys([[18,1],[44,1],[44,0],[18,0]]);if(mode==="folder")return runPS("$p=[Environment]::GetFolderPath('MyPictures');$s=Join-Path $p 'Screenshots';Start-Process $(if(Test-Path $s){$s}else{$p})");}
async function mediaControl(mode){const keys={mute:173,"volume-down":174,"volume-up":175,"play-pause":179,previous:177,next:176};const k=keys[mode];if(k)return sendVirtualKeys([[k,1],[k,0]]);}
async function systemControl(mode){if(mode==="desktop")return sendVirtualKeys([[91,1],[68,1],[68,0],[91,0]]);if(mode==="task")return runPS("Start-Process taskmgr.exe");if(mode==="settings")return runPS("Start-Process 'ms-settings:'");if(mode==="explorer")return runPS("Start-Process explorer.exe");if(mode==="lock")return runPS("rundll32.exe user32.dll,LockWorkStation");}

let clipboardHistory=[];try{const v=JSON.parse(fs.readFileSync(historyPath,"utf8"));if(Array.isArray(v))clipboardHistory=v.filter(x=>typeof x==="string").slice(0,8);}catch{}
let clipboardTimer=null,lastClipboard="",suppressClipboardUntil=0;
function saveHistory(){try{fs.writeFileSync(historyPath,JSON.stringify(clipboardHistory,null,2));}catch{}}
function visibleClipboard(){return [...instances.values()].some(x=>x.action===ACTION.CLIPBOARD);}
async function readClipboardText(){return (await runPS("$v=Get-Clipboard -Raw -ErrorAction SilentlyContinue;if($v-is[string]){$v}",5000)).replace(/\r\n/g,"\n").trimEnd();}
async function pollClipboard(){if(!visibleClipboard()||Date.now()<suppressClipboardUntil)return;try{const t=await readClipboardText();if(t&&t!==lastClipboard){lastClipboard=t;clipboardHistory=[t.slice(0,12000),...clipboardHistory.filter(x=>x!==t)].slice(0,8);saveHistory();}}catch(e){log(`clipboard: ${e.message}`);}}
function startClipboard(){if(!clipboardTimer){clipboardTimer=setInterval(pollClipboard,850);setTimeout(pollClipboard,100);}}
async function pasteText(text,restore=false){if(!text)throw new Error("Nothing to paste");let previous="";if(restore)try{previous=await readClipboardText();}catch{};suppressClipboardUntil=Date.now()+1200;const p=path.join(stateDir,`paste-${process.pid}.txt`);fs.writeFileSync(p,text,"utf8");await runPS(`$v=Get-Content -LiteralPath ${psQuote(p)} -Raw;Set-Clipboard -Value $v`);await sendVirtualKeys([[17,1],[86,1],[86,0],[17,0]]);if(restore&&previous){await new Promise(r=>setTimeout(r,260));const q=path.join(stateDir,`restore-${process.pid}.txt`);fs.writeFileSync(q,previous,"utf8");await runPS(`Set-Clipboard -Value (Get-Content -LiteralPath ${psQuote(q)} -Raw)`);lastClipboard=previous;}else lastClipboard=text;}
async function pasteClipboard(slot){if(!clipboardHistory[slot-1])await pollClipboard();const t=clipboardHistory[slot-1];if(!t)return false;await pasteText(t,false);return true;}
function clearClipboardHistory(){clipboardHistory=[];lastClipboard="";saveHistory();}
async function expandSnippet(text){const n=new Date(),d=n.toLocaleDateString(),t=n.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});let c="";if(String(text).includes("{{clipboard}}"))try{c=await readClipboardText();}catch{};return String(text||"").replaceAll("{{date}}",d).replaceAll("{{time}}",t).replaceAll("{{datetime}}",`${d} ${t}`).replaceAll("{{clipboard}}",c);}

function workspaceDefinition(name,settings={}){
  if(settings.apps)return {apps:String(settings.apps).split(/\r?\n/).map(x=>x.trim()).filter(Boolean),layout:settings.layout||"work"};
  const w=config.workspaces?.[name]||DEFAULT_CONFIG.workspaces[name]||DEFAULT_CONFIG.workspaces.work;
  return {apps:Array.isArray(w.apps)?w.apps:[],layout:w.layout||"work",url:w.url||""};
}
async function runWorkspace(settings={},name="work"){
  const def=workspaceDefinition(name,settings),targets=def.apps.slice(0,6).map(x=>resolveTarget(x,x.startsWith("@")?x.slice(1):"")).filter(Boolean);
  if(!targets.length)throw new Error("Workspace has no valid apps");
  let failures=0;for(const t of targets)try{await focusOrLaunch(t,"focus");}catch(e){failures++;log(`workspace launch ${t.label}: ${e.message}`);}
  const ready=[];for(const t of targets)try{ready.push(await waitForWindow(t,8000));}catch{ready.push(false);}
  if(settings.arrange!==false&&def.layout!=="none"){
    const modes=targets.length===1?["left"]:targets.length===2?["left","right"]:targets.length===3?["left","top-right","bottom-right"]:["top-left","top-right","bottom-left","bottom-right"];
    for(let i=0;i<Math.min(targets.length,modes.length);i++)if(ready[i])try{await moveTarget(targets[i],modes[i]);}catch{failures++;}else failures++;
  }
  if(def.url)try{await runPS(`Start-Process ${psQuote(def.url)}`);}catch{failures++;}
  return failures;
}
async function applyPreset(name,overrides={}){
  const p={...(config.presets?.[name]||DEFAULT_CONFIG.presets[name]||{}),...overrides};
  const out=p.output||config.outputDevice, input=p.input||config.inputDevice;
  if(out)await audio("Switch",{flow:"output",match:out});
  if(input)await audio("Switch",{flow:"input",match:input});
  if(Number.isFinite(Number(p.volume)))await audio("VolumeSet",{flow:"output",value:Number(p.volume)});
  if(typeof p.micMuted==="boolean")await audio("MicSet",{muted:p.micMuted});
  await refreshAudioState(); return p;
}
async function runRoutine(name){
  if(name==="work"){await applyPreset("work");return runWorkspace({}, "work");}
  if(name==="focus"){await applyPreset("focus");return runWorkspace({}, "focus");}
  if(name==="meeting"){await applyPreset("meeting");return runWorkspace({}, "meeting");}
  if(name==="gaming"){await applyPreset("gaming");return runWorkspace({}, "gaming");}
  return 0;
}

let setupServer=null,setupPort=0,setupStarting=null;
async function ensureSetupServer(){
  if(setupServer&&setupPort)return setupPort;
  if(setupStarting)return setupStarting;
  setupStarting=new Promise((resolve,reject)=>{
  setupServer=http.createServer(async(req,res)=>{
    const sendJson=(code,obj)=>{res.writeHead(code,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(obj));};
    try{
      if(req.method==="GET"&&req.url==="/"){const html=fs.readFileSync(path.join(pluginRoot,"ui","onboarding.html"));res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});return res.end(html);}
      if(req.method==="GET"&&req.url==="/api/state")return sendJson(200,{config,audio:audioState});
      if(req.method==="GET"&&req.url==="/api/audio"){const [outputs,inputs]=await Promise.all([audio("List",{flow:"output"}),audio("List",{flow:"input"})]);return sendJson(200,{outputs:Array.isArray(outputs)?outputs:[outputs].filter(Boolean),inputs:Array.isArray(inputs)?inputs:[inputs].filter(Boolean)});}
      if(req.method==="POST"&&req.url==="/api/save"){let body="";req.on("data",d=>body+=d);req.on("end",()=>{try{const next=JSON.parse(body||"{}");config={...config,...next,workspaces:{...config.workspaces,...(next.workspaces||{})},presets:{...config.presets,...(next.presets||{})}};saveConfig();sendJson(200,{ok:true});}catch(e){sendJson(400,{ok:false,error:e.message});}});return;}
      res.writeHead(404);res.end("Not found");
    }catch(e){sendJson(500,{error:e.message});}
  });
  setupServer.once("error",e=>{setupStarting=null;reject(e)});
  setupServer.listen(0,"127.0.0.1",()=>{setupPort=setupServer.address().port;resolve(setupPort)});
  });
  return setupStarting;
}
async function openSetup(){const p=await ensureSetupServer();await refreshAudioState();if(process.env.PACKRAT_AUDIO_MOCK!=="1")await runPS(`Start-Process ${psQuote(`http://127.0.0.1:${p}/`)}`);return p;}

async function execute(ctx,inst){
  const s=inst.settings||{};
  try{
    if(inst.action===ACTION.APP){const t=s.role==="custom"?resolveTarget(s.path,"custom"):resolveTarget("",s.role||"browser");const r=await focusOrLaunch(t,s.behavior||"focus");flash(ctx,inst,r==="OPENED"?"opened":"focused");}
    else if(inst.action===ACTION.WORKSPACE){const f=await runWorkspace(s,s.preset||"work");flash(ctx,inst,f?"partial":"ready",f?1300:900);}
    else if(inst.action===ACTION.WINDOW)await activeWindow(s.mode||"left");
    else if(inst.action===ACTION.CLIPBOARD){if(s.mode==="clear"){clearClipboardHistory();flash(ctx,inst,"cleared");}else flash(ctx,inst,(await pasteClipboard(Math.max(1,Math.min(4,Number(s.slot||1)))))?"pasted":"empty",900);}
    else if(inst.action===ACTION.SNIPPET){const t=await expandSnippet(s.text||"");if(!t)flash(ctx,inst,"empty",1200);else{await pasteText(t,s.restoreClipboard!==false);flash(ctx,inst,"pasted");}}
    else if(inst.action===ACTION.CAPTURE)await capture(s.mode||"region");
    else if(inst.action===ACTION.MEDIA)await mediaControl(s.mode||"play-pause");
    else if(inst.action===ACTION.SYSTEM)await systemControl(s.mode||"desktop");
    else if(inst.action===ACTION.NAVIGATION){if(!inst.device)throw new Error("No Stream Deck device id");send({event:"switchToProfile",context:ctx,device:inst.device,payload:{profile:s.profile}});}
    else if(inst.action===ACTION.AUDIO){
      const m=s.mode||"mic-toggle";
      if(m==="mic-toggle")await audio("MicToggle");
      else if(m==="output-cycle")await audio("Cycle",{flow:"output",step:1});
      else if(m==="input-cycle")await audio("Cycle",{flow:"input",step:1});
      else if(m==="output-device")await audio("Switch",{flow:"output",match:s.device||config.outputDevice});
      else if(m==="input-device")await audio("Switch",{flow:"input",match:s.device||config.inputDevice});
      await refreshAudioState();flash(ctx,inst,"switched",700);
    }
    else if(inst.action===ACTION.PRESET){await applyPreset(s.mode||"work",s);flash(ctx,inst,"applied",850);}
    else if(inst.action===ACTION.ROUTINE){const f=await runRoutine(s.mode||"work");flash(ctx,inst,f?"partial":"started",f?1300:900);}
    else if(inst.action===ACTION.SETUP){await openSetup();flash(ctx,inst,"opened",700);}
  }catch(e){fail(ctx,inst,e);}
}

async function handleDialRotate(ctx,inst,ticks){
  if(inst.action!==ACTION.AUDIO)return;
  const m=inst.settings?.mode||"volume-dial",step=Math.max(-10,Math.min(10,Number(ticks||0)));
  try{
    if(m==="volume-dial")await audio("VolumeAdjust",{flow:"output",value:step*2});
    else if(m==="mic-volume-dial")await audio("VolumeAdjust",{flow:"input",value:step*2});
    else if(m==="output-cycle"&&step)await audio("Cycle",{flow:"output",step:step>0?1:-1});
    else if(m==="input-cycle"&&step)await audio("Cycle",{flow:"input",step:step>0?1:-1});
    await refreshAudioState();updateDial(ctx,inst);
  }catch(e){log(`dial: ${e.message}`);}
}
async function handleDialPress(ctx,inst){if(inst.action===ACTION.AUDIO){try{await audio("MicToggle");await refreshAudioState();updateDial(ctx,inst);}catch(e){log(`dial press: ${e.message}`);}}}

if(!port){log("missing -port");process.exit(1);}
try{ws=new WebSocket(`ws://127.0.0.1:${port}`);}catch(e){log(`websocket create: ${e.message}`);process.exit(1);}
ws.addEventListener("open",()=>{send({event:registerEvent,uuid:pluginUUID});log("connected v0.5");});
ws.addEventListener("message",ev=>{
  let m;try{m=JSON.parse(String(ev.data));}catch{return;}const ctx=m.context;
  if(m.event==="willAppear"||m.event==="didReceiveSettings"){
    const inst={action:m.action,settings:m.payload?.settings||{},device:m.device,controller:m.payload?.controller||"Keypad"};instances.set(ctx,inst);render(ctx,inst);
    if(inst.action===ACTION.CLIPBOARD)startClipboard();if([ACTION.AUDIO,ACTION.PRESET,ACTION.ROUTINE].includes(inst.action))ensureAudioPolling();
  }else if(m.event==="willDisappear")instances.delete(ctx);
  else if(m.event==="keyUp"){const inst=instances.get(ctx)||{action:m.action,settings:m.payload?.settings||{},device:m.device,controller:m.payload?.controller||"Keypad"};execute(ctx,inst);}
  else if(m.event==="dialRotate"){const inst=instances.get(ctx)||{action:m.action,settings:m.payload?.settings||{},device:m.device,controller:"Encoder"};handleDialRotate(ctx,inst,m.payload?.ticks||0);}
  else if(m.event==="dialUp"){const inst=instances.get(ctx)||{action:m.action,settings:m.payload?.settings||{},device:m.device,controller:"Encoder"};handleDialPress(ctx,inst);}
});
ws.addEventListener("error",e=>log(`websocket error ${e?.message||""}`));
ws.addEventListener("close",()=>{log("websocket closed");try{setupServer?.close();}catch{};setTimeout(()=>process.exit(0),250);});
process.on("uncaughtException",e=>log(`uncaught ${e.stack||e.message}`));
process.on("unhandledRejection",e=>log(`rejection ${e?.stack||e}`));
