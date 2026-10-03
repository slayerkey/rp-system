(()=>{
"use strict";
const PREFIX="com.packrat.smart-lighting-streamdeck.",$=id=>document.getElementById(id);
let uiUuid="",actionContext="",socket=null,kind="",settings={},targets=[],providers={},connection="connecting";
let dirty=new Set(),savePending=false,lastStateVersion=0,search="";
const controls=["targetId","brightness","toneMode","hex","kelvin","powerMode"];
const val={targetId:"target",brightness:"brightness",toneMode:"toneMode",hex:"hex",kelvin:"kelvin",powerMode:"powerMode"};
const label={power:"Power toggle",brightness:"Brightness",tone:"Color / temperature",scene:"Scene recall",favorites:"Mixed-brand favorites","neo-infobar":"Neo status"};
const details={power:"Select a power-capable light, Hue room or zone. This key shows actual live state.",brightness:"Set a fixed brightness on keys; turn the Plus dial for actual brightness.",tone:"Set a supported color or temperature preset.",scene:"Only provider-advertised Hue/Govee scenes appear.",favorites:"One press controls favorite Hue and Govee lights together.","neo-infobar":"Read-only live overview of supported lights."};
function send(event,payload){if(socket?.readyState===1)socket.send(JSON.stringify({event,context:uiUuid,payload}));}
function inspect(){send("sendToPlugin",{type:"lighting.inspect",actionContext});}
function setStatus(t){$("saveState").textContent=t;}
function save(field,newValue){
 settings[field]=newValue;dirty.add(field);savePending=true;setStatus("Saving…");
 send("setSettings",Object.fromEntries(controls.filter(k=>k in settings).map(k=>[k,settings[k]])));
}
function safe(s){return String(s??"");}
function currentTarget(){return targets.find(t=>t.id===settings.targetId);}
function permitted(t){if(kind==="scene")return t.kind==="scene"&&!!t.capabilities?.scene;
 if(kind==="power")return!!t.capabilities?.power;
 if(kind==="brightness")return!!t.capabilities?.brightness;
 if(kind==="tone")return!!t.capabilities?.[settings.toneMode||"color"];return false;}
function renderOptions(){
 const select=$("target"),wanted=settings.targetId||"";
 select.replaceChildren(new Option("Choose a target…",""));
 const list=targets.filter(permitted).filter(t=>(t.name+" "+t.provider+" "+t.kind).toLowerCase().includes(search));
 list.sort((a,b)=>(a.provider+" "+a.name+" "+a.id).localeCompare(b.provider+" "+b.name+" "+b.id));
 // Never silently switch to another target if the configured ID vanished.
 if(wanted&&!list.some(t=>t.id===wanted)){
  const old=targets.find(t=>t.id===wanted);
  select.add(new Option(old?"Filtered: "+old.name:"Missing target: "+wanted,wanted));
 }
 for(const t of list)select.add(new Option((t.provider==="hue"?"Hue":"Govee")+" · "+t.name+" ["+t.kind+"]"+(t.reachable===false?" · offline":""),t.id));
 select.value=wanted;
}
function render(){
 $("actionName").textContent=label[kind]||"Smart Lighting";
 $("actionHelp").textContent=details[kind]||"";
 $("connection").textContent=connection.toUpperCase();
 $("connection").style.color=connection==="connected"?"#2BE86A":connection==="unauthorized"?"#FF5D6C":"#FFB21E";
 $("detail").textContent=connection==="connected"?"Connected to shared local companion":
  connection==="unauthorized"?"Pairing token rejected; paste the current token.":
  connection==="incompatible"?"Companion protocol mismatch; update the companion.":
  connection==="setup"?"Paste the pairing token from your local companion.":"Start the companion on this PC.";
 $("pair").open=connection==="setup"||connection==="unauthorized";
 $("deviceSection").hidden=kind==="favorites"||kind==="neo-infobar";
 $("brightnessSection").hidden=kind!=="brightness";
 $("toneSection").hidden=kind!=="tone";
 $("favoritesSection").hidden=kind!=="favorites";
 $("neoSection").hidden=kind!=="neo-infobar";
 $("colorFields").hidden=settings.toneMode==="temperature";
 $("tempFields").hidden=settings.toneMode!=="temperature";
 renderOptions();
 const t=currentTarget();
 $("selectedState").textContent=!settings.targetId?"Choose a supported target.":!t?"This target was removed. Re-select explicitly.":
  t.reachable===false?t.name+" is unavailable.":providers[t.provider]&&!["connected","partial","lan","cloud"].some(k=>providers[t.provider]?.[k]===true)?t.name+" · Provider unavailable":t.name+" · "+(t.on?"ON":"OFF")+(t.brightness==null?"":" · "+Math.round(t.brightness)+"%")+(t.provider==="hue"?" · Hue":" · Govee");
 for(const [field,dom] of Object.entries(val)){if(field!=="targetId"&&!dirty.has(field))$(dom).value=settings[field]??$(dom).value;}
 $("brightnessValue").textContent=safe(settings.brightness||65)+"%";
 const range=Array.isArray(t?.temperatureRange)?t.temperatureRange:[1500,9000];
 $("kelvin").min=range[0];$("kelvin").max=range[1];$("kelvinValue").textContent=safe(settings.kelvin||4000)+"K";
 const f=targets.filter(t=>t.favorite&&t.capabilities?.power&&t.kind!=="scene");
 $("favoriteCount").textContent=f.length+" power-capable favorites · "+new Set(f.map(t=>t.provider)).size+" provider(s)";
 $("providers").replaceChildren(...["hue","govee"].map(provider=>{
  const p=providers[provider]||{},line=document.createElement("p");
  line.textContent=(provider==="hue"?"Hue":"Govee")+": "+(p.connected?"CONNECTED":p.partial?"PARTIAL":"UNAVAILABLE")+(p.detail?" · "+p.detail:"");
  return line;
 }));
}
window.connectElgatoStreamDeckSocket=(port,uuid,event,info,actionInfo)=>{
 uiUuid=uuid;try{const a=JSON.parse(actionInfo);actionContext=a.context||"";kind=String(a.action||"").replace(PREFIX,"");settings=a.payload?.settings||{};}catch{}
 socket=new WebSocket("ws://127.0.0.1:"+port);
 socket.onopen=()=>{socket.send(JSON.stringify({event,uuid}));send("getSettings");inspect();};
 socket.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
  if(m.event==="didReceiveSettings"){const incoming=m.payload?.settings||{};for(const field of controls){
   if(!dirty.has(field))settings[field]=incoming[field]??settings[field];
   else if(JSON.stringify(incoming[field])===JSON.stringify(settings[field]))dirty.delete(field);
  }
  if(savePending&&!dirty.size){savePending=false;setStatus("Saved");}
  render();
  }
  if(m.event==="sendToPropertyInspector"&&m.payload?.type==="lighting.state"){
   const p=m.payload;connection=p.connection||"connecting";targets=Array.isArray(p.targets)?p.targets:[];providers=p.providers||{};
   // Background snapshots must never overwrite an unsaved selection.
   for(const field of controls)if(!dirty.has(field)&&p.settings?.[field]!==undefined)settings[field]=p.settings[field];
   $("error").textContent=p.error||p.detail||"";render();
  }
 };
};
$("setup").onclick=()=>send("sendToPlugin",{type:"lighting.setup",actionContext});
$("download").onclick=()=>send("sendToPlugin",{type:"lighting.download",actionContext});
$("saveToken").onclick=()=>{const token=$("token").value.trim();if(!token)return;send("setGlobalSettings",{pairingToken:token});$("token").value="";$("pair").open=false;setStatus("Token saved. Connecting…");setTimeout(inspect,350);};
$("clearToken").onclick=()=>{send("setGlobalSettings",{pairingToken:""});setStatus("Companion token cleared");setTimeout(inspect,350);};
$("findDevice").oninput=e=>{search=e.target.value.toLowerCase();renderOptions();};
$("target").onchange=e=>save("targetId",e.target.value);
$("brightness").onchange=e=>save("brightness",Number(e.target.value));
$("brightness").oninput=e=>$("brightnessValue").textContent=e.target.value+"%";
$("toneMode").onchange=e=>{save("toneMode",e.target.value);render();};
$("hex").onchange=e=>save("hex",e.target.value.toUpperCase());
$("kelvin").onchange=e=>save("kelvin",Number(e.target.value));
$("kelvin").oninput=e=>$("kelvinValue").textContent=e.target.value+"K";
$("powerMode").onchange=e=>save("powerMode",e.target.value);
})();
