export const UUID = Object.freeze({
  power: "com.packrat.smart-lighting-streamdeck.power",
  brightness: "com.packrat.smart-lighting-streamdeck.brightness",
  tone: "com.packrat.smart-lighting-streamdeck.tone",
  scene: "com.packrat.smart-lighting-streamdeck.scene",
  favorites: "com.packrat.smart-lighting-streamdeck.favorites",
  "neo-infobar": "com.packrat.smart-lighting-streamdeck.neo-infobar",
});
export const KINDS = Object.fromEntries(Object.entries(UUID).map(([kind,id])=>[id,kind]));
export const PORT = 17486;
export const PROTOCOL = 1;
export const SETUP_URL = "http://127.0.0.1:17486/";
export const DOWNLOAD_URL = "https://packrat-site.pages.dev/downloads/smart-lighting";
export const clamp = (v,low,high) => Math.max(low,Math.min(high,v));
export function settingsFor(raw={},kind="power") {
 const s=raw && typeof raw==="object"?raw:{};
 return {
   targetId: typeof s.targetId==="string"?s.targetId:"",
   brightness: clamp(Number.isFinite(Number(s.brightness)) && s.brightness!=="" ? Math.round(Number(s.brightness)):65,1,100),
   toneMode: s.toneMode==="temperature"?"temperature":"color",
   hex: /^#[0-9A-F]{6}$/i.test(s.hex||"")?s.hex.toUpperCase():"#FFB21E",
   kelvin: clamp(Number.isFinite(Number(s.kelvin))?Math.round(Number(s.kelvin)):4000,1500,9000),
   powerMode:s.powerMode==="off"?"off":"on",
   kind
 };
}
export function currentTarget(snapshot,id) {
 return (snapshot?.targets||[]).find(t=>t.id===id)||null;
}
export function optionsFor(snapshot,kind,settings={}) {
 const list=(snapshot?.targets||[]).filter(t=>{
  if(kind==="scene")return t.kind==="scene" && !!t.capabilities?.scene;
  if(kind==="power")return !!t.capabilities?.power;
  if(kind==="brightness")return !!t.capabilities?.brightness;
  if(kind==="tone")return !!t.capabilities?.[settings.toneMode||"color"];
  return false;
 });
 return [...list].sort((a,b)=> (a.provider+" "+a.name+" "+a.id).localeCompare(b.provider+" "+b.name+" "+b.id));
}
export function commandFor(kind,target,settings) {
 if(!target||target.reachable===false)throw new Error("Selected lighting target is unavailable");
 const cap=target.capabilities||{};
 if(kind==="power"&&cap.power)return {command:"power",id:target.id,value:!target.on};
 if(kind==="brightness"&&cap.brightness)return {command:"brightness",id:target.id,value:settings.brightness};
 if(kind==="scene"&&target.kind==="scene"&&cap.scene)return {command:"scene",id:target.id,sceneId:target.id};
 if(kind==="tone"&&settings.toneMode==="temperature"&&cap.temperature) {
  const [low,high]=Array.isArray(target.temperatureRange)&&target.temperatureRange.length===2?target.temperatureRange:[1500,9000];
  return {command:"temperature",id:target.id,value:clamp(settings.kelvin,low,high)};
 }
 if(kind==="tone"&&settings.toneMode==="color"&&cap.color) {
  const hex=settings.hex;
  return {command:"color",id:target.id,r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)};
 }
 throw new Error("This device does not support the selected control");
}
export function favoriteCommands(snapshot,on) {
 return (snapshot?.targets||[]).filter(t=>t.favorite&&t.reachable!==false&&t.capabilities?.power&&t.kind!=="scene")
  .map(t=>({command:"power",id:t.id,value:!!on}));
}
export function observed(snapshot,command) {
 const t=currentTarget(snapshot,command.id);
 if(!t)return false;
 if(command.command==="power")return t.on===command.value;
 if(command.command==="brightness")return t.brightness!=null && Math.abs(t.brightness-command.value)<=2;
 if(command.command==="temperature")return t.temperatureK!=null && Math.abs(t.temperatureK-command.value)<=125;
 if(command.command==="color")return t.color && Math.abs(t.color.r-command.r)+Math.abs(t.color.g-command.g)+Math.abs(t.color.b-command.b)<60;
 // Scene recall has no observable state value in the existing v1 protocol.
 return false;
}
