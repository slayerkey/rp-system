"use strict";
const fs=require("fs"),path=require("path");
const {spawn,execFileSync}=require("child_process");
const pluginDir=path.resolve(process.argv[2]);
const manifest=JSON.parse(fs.readFileSync(path.join(pluginDir,"manifest.json"),"utf8"));
const codePath=path.join(pluginDir,...String(manifest.CodePath||"").split("/"));
if(!manifest.CodePath||!fs.existsSync(codePath))throw new Error(`Manifest CodePath is missing: ${manifest.CodePath||"<none>"}`);
if(!manifest.Actions?.some(a=>a.UUID==="com.packrat.stream-deck-ultimate-bundle.audio"))throw new Error("Premium audio action missing from manifest");
const WebSocket=require(path.join(pluginDir,"node_modules","ws"));
const {WebSocketServer}=WebSocket;
const UUID="com.packrat.stream-deck-ultimate-bundle";
const messages=[];let child;
const tiny=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5xYkAAAAASUVORK5CYII=","base64");

const files=[
"imgs/keys/app.png","imgs/keys/web.png","imgs/keys/discord.png","imgs/keys/spotify.png","imgs/keys/work.png","imgs/keys/left.png","imgs/keys/right.png","imgs/keys/max.png","imgs/keys/restore.png","imgs/keys/center.png","imgs/keys/top-left.png","imgs/keys/top-right.png","imgs/keys/bottom-left.png","imgs/keys/bottom-right.png","imgs/keys/screen.png","imgs/keys/minimize.png","imgs/keys/topmost.png",
"imgs/keys/clip1.png","imgs/keys/clip2.png","imgs/keys/clip3.png","imgs/keys/clip4.png","imgs/keys/clip-clear.png","imgs/keys/snippet.png","imgs/keys/shot.png","imgs/keys/shot-full.png","imgs/keys/shot-window.png","imgs/keys/shots-folder.png",
"imgs/keys/mute.png","imgs/keys/vol-down.png","imgs/keys/vol-up.png","imgs/keys/play.png","imgs/keys/previous.png","imgs/keys/next.png","imgs/keys/desktop.png","imgs/keys/task.png","imgs/keys/settings.png","imgs/keys/lock.png","imgs/keys/explorer.png",
"imgs/keys/windows.png","imgs/keys/utilities.png","imgs/keys/home.png","imgs/keys/audio.png","imgs/keys/output.png","imgs/keys/input.png","imgs/keys/mic-live.png","imgs/keys/mic-muted.png","imgs/keys/mode-work.png","imgs/keys/mode-focus.png","imgs/keys/mode-meeting.png","imgs/keys/mode-gaming.png","imgs/keys/focus.png","imgs/keys/meeting.png","imgs/keys/gaming.png","imgs/keys/setup.png",
"imgs/status/opened.png","imgs/status/focused.png","imgs/status/cleared.png","imgs/status/empty.png","imgs/status/failed.png","imgs/status/pasted.png","imgs/status/partial.png","imgs/status/ready.png","imgs/status/switched.png","imgs/status/applied.png","imgs/status/started.png"
];
for(const rel of files){const p=path.join(pluginDir,rel);fs.mkdirSync(path.dirname(p),{recursive:true});if(!fs.existsSync(p))fs.writeFileSync(p,tiny);}
const onboarding=path.join(pluginDir,"ui","onboarding.html");fs.mkdirSync(path.dirname(onboarding),{recursive:true});if(!fs.existsSync(onboarding))fs.writeFileSync(onboarding,"<html>ok</html>");
const audioPs=path.join(pluginDir,"bin","audio.ps1");if(!fs.existsSync(audioPs))fs.writeFileSync(audioPs,"param()");

function waitFor(pred,timeout=8000,from=0){
 return new Promise((resolve,reject)=>{const start=Date.now();const t=setInterval(()=>{const v=messages.slice(from).find(pred);if(v){clearInterval(t);resolve(v)}else if(Date.now()-start>timeout){clearInterval(t);reject(new Error("Timed out. Seen: "+JSON.stringify(messages.slice(from))))}},35)});
}
function cleanup(){try{child?.kill()}catch{};try{if(process.platform==="win32")execFileSync("taskkill",["/IM","notepad.exe","/F"],{stdio:"ignore",timeout:2000})}catch{}}
(async()=>{
 const server=new WebSocketServer({port:0,host:"127.0.0.1"});await new Promise(r=>server.once("listening",r));const port=server.address().port;
 const connection=new Promise(r=>server.once("connection",s=>{s.on("message",raw=>{try{messages.push(JSON.parse(raw.toString()))}catch{}});r(s)}));
 child=spawn(process.execPath,[codePath,"-port",String(port),"-pluginUUID",UUID,"-registerEvent","registerPlugin"],{stdio:["ignore","pipe","pipe"],env:{...process.env,APPDATA:path.join(pluginDir,".smoke-state"),PACKRAT_AUDIO_MOCK:"1"}});
 let stderr="";child.stderr.on("data",d=>stderr+=d);const ws=await Promise.race([connection,new Promise((_,rej)=>setTimeout(()=>rej(new Error("No socket "+stderr)),5000))]);
 await waitFor(m=>m.event==="registerPlugin");
 let mark=messages.length;
 ws.send(JSON.stringify({event:"willAppear",action:UUID+".audio",context:"mic",device:"d",payload:{controller:"Keypad",settings:{mode:"mic-toggle"}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="mic",5000,mark);
 mark=messages.length;ws.send(JSON.stringify({event:"keyUp",action:UUID+".audio",context:"mic",device:"d",payload:{controller:"Keypad",settings:{mode:"mic-toggle"}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="mic",5000,mark);

 mark=messages.length;ws.send(JSON.stringify({event:"willAppear",action:UUID+".audio",context:"dial",device:"d",payload:{controller:"Encoder",settings:{mode:"volume-dial"}}}));
 await waitFor(m=>m.event==="setFeedback"&&m.context==="dial",5000,mark);
 mark=messages.length;ws.send(JSON.stringify({event:"dialRotate",action:UUID+".audio",context:"dial",device:"d",payload:{controller:"Encoder",settings:{mode:"volume-dial"},ticks:2}}));
 await waitFor(m=>m.event==="setFeedback"&&m.context==="dial",5000,mark);

 mark=messages.length;ws.send(JSON.stringify({event:"willAppear",action:UUID+".audio-preset",context:"preset",device:"d",payload:{controller:"Keypad",settings:{mode:"work"}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="preset",5000,mark);
 mark=messages.length;ws.send(JSON.stringify({event:"keyUp",action:UUID+".audio-preset",context:"preset",device:"d",payload:{controller:"Keypad",settings:{mode:"work"}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="preset",5000,mark);

 mark=messages.length;ws.send(JSON.stringify({event:"willAppear",action:UUID+".routine",context:"routine",device:"d",payload:{controller:"Keypad",settings:{mode:"test"}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="routine",5000,mark);
 mark=messages.length;ws.send(JSON.stringify({event:"keyUp",action:UUID+".routine",context:"routine",device:"d",payload:{controller:"Keypad",settings:{mode:"test"}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="routine",5000,mark);

 mark=messages.length;ws.send(JSON.stringify({event:"willAppear",action:UUID+".setup",context:"setup",device:"d",payload:{controller:"Keypad",settings:{}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="setup",5000,mark);
 mark=messages.length;ws.send(JSON.stringify({event:"keyUp",action:UUID+".setup",context:"setup",device:"d",payload:{controller:"Keypad",settings:{}}}));
 await waitFor(m=>m.event==="setImage"&&m.context==="setup",5000,mark);

 console.log(`v0.5 smoke passed through manifest CodePath ${manifest.CodePath}: registration, audio state, dial feedback, preset, routine, setup`);
 try{ws.terminate()}catch{};try{server.close()}catch{};cleanup();process.exit(0);
})().catch(e=>{console.error(e.stack||e);cleanup();process.exit(1)});
