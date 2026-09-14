#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const rootArg=process.argv[2];
if(!rootArg){
  console.error("Usage: node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root>");
  process.exit(2);
}
const root=resolve(rootArg);
const errors=[];
const warnings=[];

function findPluginDir(){
  const entries=readdirSync(root,{withFileTypes:true});
  const match=entries.find((entry)=>entry.isDirectory()&&entry.name.endsWith(".sdPlugin"));
  return match?resolve(root,match.name):null;
}
function text(file){
  return existsSync(file)?readFileSync(file,"utf8"):"";
}

const pluginDir=findPluginDir();
if(!pluginDir){
  console.error("ERROR: no .sdPlugin directory found under "+root);
  process.exit(2);
}
const manifestPath=resolve(pluginDir,"manifest.json");
if(!existsSync(manifestPath)){
  console.error("ERROR: manifest.json not found at "+manifestPath);
  process.exit(2);
}
const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
const pluginSource=text(resolve(root,"src","plugin.js"));
const inspectorSource=text(resolve(root,"ui","inspector.js"));

for(const action of manifest.Actions??[]){
  if(!(action.Controllers??[]).includes("Keypad"))continue;
  const suffix=String(action.UUID||"").split(".").pop();
  if(!suffix)errors.push((action.Name||"Unnamed action")+": action UUID has no stable semantic suffix");
  if(action.Icon&&!String(action.Icon).includes("/actions/"+suffix+"/")){
    warnings.push((action.Name||action.UUID)+": action Icon path does not mirror UUID suffix '"+suffix+"'");
  }
  for(const [index,state] of (action.States??[]).entries()){
    if(state.ShowTitle!==false)errors.push((action.Name||action.UUID)+" state "+index+": ShowTitle must be false");
  }
}

if(manifest.PropertyInspectorPath){
  if(!inspectorSource)errors.push("PropertyInspectorPath is declared but ui/inspector.js was not found");
  else{
    if(/sendToPlugin/.test(inspectorSource)&&!/context:\s*uiUuid/.test(inspectorSource)){
      errors.push("Property Inspector sends plugin messages but does not use the PI UUID as websocket context");
    }
    if(/setSettings/.test(inspectorSource)&&!/context:\s*uiUuid/.test(inspectorSource)){
      errors.push("Property Inspector saves settings but does not use the PI UUID as websocket context");
    }
    if(/actionInfo\.context/.test(inspectorSource)&&/context:\s*actionContext/.test(inspectorSource)){
      errors.push("Property Inspector uses action context as websocket context; pass it separately in payload instead");
    }
  }

  if(pluginSource){
    if(/sendToPlugin/.test(inspectorSource)&&!/streamDeck\.ui\.onSendToPlugin/.test(pluginSource)){
      errors.push("Plugin does not use global streamDeck.ui.onSendToPlugin for Property Inspector commands");
    }
    if(/sendToPropertyInspector/.test(pluginSource)&&!/streamDeck\.ui\.sendToPropertyInspector/.test(pluginSource)){
      errors.push("Plugin sends Property Inspector state without the global streamDeck.ui channel");
    }
    if(/\.action\.sendToPropertyInspector/.test(pluginSource)){
      errors.push("Per-action sendToPropertyInspector found; PackRat default is the global streamDeck.ui channel");
    }
  }
}

const profileEntries=Array.isArray(manifest.Profiles)?manifest.Profiles:[];
if(profileEntries.length){
  const types=new Set(profileEntries.map((p)=>Number(p.DeviceType)));
  for(const [type,label] of [[0,"standard / MK.2"],[2,"XL"],[7,"Plus"],[9,"Neo"]]){
    if(!types.has(type))warnings.push("Bundled profiles do not cover "+label+" (DeviceType "+type+")");
  }
}

console.log("Stream Deck plugin design audit");
console.log("Plugin: "+root);
console.log("Actions: "+(manifest.Actions??[]).length);
console.log("Profiles: "+profileEntries.length);
for(const warning of warnings)console.log("WARN: "+warning);
for(const error of errors)console.error("ERROR: "+error);
if(errors.length){
  console.error("FAIL: "+errors.length+" design contract error(s), "+warnings.length+" warning(s)");
  process.exit(1);
}
console.log("PASS: no design contract errors, "+warnings.length+" warning(s)");
