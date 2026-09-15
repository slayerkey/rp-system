#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root=process.argv[2];
const flags=new Set(process.argv.slice(3));
const requireMajorProfiles=flags.has("--require-major-profiles");
if(!root){
  console.error("Usage: node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin> [--require-major-profiles]");
  process.exit(2);
}

const pluginDir=resolve(root);
const manifestPath=resolve(pluginDir,"manifest.json");
if(!existsSync(manifestPath)){
  console.error("ERROR: manifest.json not found at "+manifestPath);
  process.exit(2);
}

const manifest=JSON.parse(readFileSync(manifestPath,"utf8"));
const errors=[];
const warnings=[];
const keypad=(manifest.Actions??[]).filter(a=>(a.Controllers??[]).includes("Keypad"));
const reused=new Map();

function assetCandidates(base){
  if(!base)return[];
  if(extname(base))return[resolve(pluginDir,base)];
  return[
    resolve(pluginDir,base+".svg"),
    resolve(pluginDir,base+".png"),
    resolve(pluginDir,base+"@2x.svg"),
    resolve(pluginDir,base+"@2x.png")
  ];
}
function existingAssets(base){return assetCandidates(base).filter(existsSync);}
function firstAsset(base,name="asset"){
  const matches=existingAssets(base);
  if(matches.length>1){
    errors.push(name+": extensionless asset path is ambiguous; keep exactly one canonical target ("+matches.join(", ")+")");
  }
  return matches[0]??null;
}
function inspectSvg(file,name){
  const text=readFileSync(file,"utf8");
  const view=text.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)["']/i);
  if(view){
    const w=Number(view[1]),h=Number(view[2]);
    if(Math.abs(w-h)>0.01)warnings.push(name+": key SVG viewBox is not square ("+w+" x "+h+")");
    if(Math.max(w,h)<72)warnings.push(name+": key SVG source canvas is smaller than 72 px");
  }
  const accent="#ffb21e";
  const canvas=view?Math.max(Number(view[1]),Number(view[2])):144;
  for(const match of text.matchAll(/<line\b[^>]*\bx1=["']([\d.]+)["'][^>]*\by1=["']([\d.]+)["'][^>]*\bx2=["']([\d.]+)["'][^>]*\by2=["']([\d.]+)["'][^>]*\bstroke=["'](#(?:ffb21e|ffc44d))["'][^>]*>/gi)){
    const [,x1,y1,x2,y2,color]=match;
    const yy=Math.max(Number(y1),Number(y2));
    if(Math.abs(Number(y1)-Number(y2))<=1&&Math.abs(Number(x2)-Number(x1))>=canvas*.5&&yy<=canvas*.2){
      errors.push(name+": decorative PackRat accent rail detected near the top of the hardware key. Use orange only for a semantic detail, not a generic repeated stripe.");
    }
  }
  for(const match of text.matchAll(/<path\b[^>]*\bd=["'][^"']*M\s*([\d.]+)[ ,]([\d.]+)\s*h\s*([\d.]+)[^"']*["'][^>]*\bstroke=["'](#(?:ffb21e|ffc44d))["'][^>]*>/gi)){
    const [,x,y,dx,color]=match;
    if(Math.abs(Number(dx))>=canvas*.5&&Number(y)<=canvas*.2){
      errors.push(name+": decorative PackRat accent rail detected near the top of the hardware key. Use orange only for a semantic detail, not a generic repeated stripe.");
    }
  }
  const widths=[...text.matchAll(/stroke-width=["']([\d.]+)["']/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  if(widths.length){
    const min=Math.min(...widths);
    const canvas=view?Math.max(Number(view[1]),Number(view[2])):144;
    if(canvas>=120&&min<4)warnings.push(name+": SVG contains a very thin stroke ("+min+") that may disappear at key scale");
  }
}
function inspectPng(file,name){
  const b=readFileSync(file);
  if(b.length>=24&&b.subarray(1,4).toString("ascii")==="PNG"){
    const w=b.readUInt32BE(16),h=b.readUInt32BE(20);
    if(w!==h)warnings.push(name+": key PNG is not square ("+w+" x "+h+")");
    if(Math.min(w,h)<72)errors.push(name+": key PNG is smaller than 72 x 72");
  }
}

for(const action of keypad){
  const name=action.Name??action.UUID??"Unnamed action";
  if(!action.Icon)errors.push(name+": missing action-list Icon");
  else{
    const iconFile=firstAsset(action.Icon,name+" action-list icon");
    if(!iconFile)errors.push(name+": action-list Icon asset is missing: "+action.Icon);
    else if(iconFile.endsWith(".svg")){
      const iconText=readFileSync(iconFile,"utf8");
      const colors=[...iconText.matchAll(/(?:fill|stroke)=["'](#[0-9a-f]{3,8}|[a-z]+)["']/gi)]
        .map(m=>m[1].toLowerCase())
        .filter(v=>!["none","white","#fff","#ffffff","currentcolor"].includes(v));
      if(colors.length)warnings.push(name+": action-list SVG uses non-white color(s) ("+[...new Set(colors)].join(", ")+"). Keep sidebar/action-list icons monochrome white unless a documented exception requires color.");
    }
  }

  const states=Array.isArray(action.States)?action.States:[];
  if(!states.length){errors.push(name+": no key States declared");continue;}
  for(const [index,state] of states.entries()){
    const stateName=name+" state "+index;
    if(!state.Image){errors.push(stateName+": missing key Image");continue;}
    const file=firstAsset(state.Image,stateName+" key image");
    if(!file)errors.push(stateName+": key Image asset is missing: "+state.Image);
    else{
      const list=reused.get(state.Image)??[];
      list.push(name);reused.set(state.Image,list);
      if(file.endsWith(".svg"))inspectSvg(file,stateName);
      if(file.endsWith(".png"))inspectPng(file,stateName);
    }

    if(state.ShowTitle!==false){
      errors.push(stateName+": PackRat Keypad actions must explicitly set ShowTitle=false and render any text into the key image");
    }
  }
}

for(const [image,names] of reused){
  const unique=[...new Set(names)];
  if(unique.length>=3)warnings.push("Key image "+image+" is reused by "+unique.length+" actions ("+unique.join(", ")+"). Confirm this is intentional and semantically distinct at runtime.");
}

if(!keypad.length)warnings.push("No Keypad actions found. Nothing to audit.");

const profiles=Array.isArray(manifest.Profiles)?manifest.Profiles:[];
const seenDeviceTypes=new Set();
for(const profile of profiles){
  const name=String(profile?.Name??"").trim();
  const deviceType=Number(profile?.DeviceType);
  if(!name){errors.push("Bundled profile is missing Name");continue;}
  if(!Number.isInteger(deviceType))errors.push("Bundled profile "+name+" is missing a numeric DeviceType");
  else if(seenDeviceTypes.has(deviceType))errors.push("Duplicate bundled profile DeviceType "+deviceType);
  else seenDeviceTypes.add(deviceType);

  const file=resolve(pluginDir,name+".streamDeckProfile");
  if(!existsSync(file))errors.push("Bundled profile file is missing: "+name+".streamDeckProfile");
  else{
    const b=readFileSync(file);
    if(b.length<4||b.subarray(0,2).toString("ascii")!=="PK")errors.push("Bundled profile is not a valid ZIP-style .streamDeckProfile: "+name);
  }
  if(profile.AutoInstall!==true)warnings.push("Bundled profile "+name+" should normally set AutoInstall=true");
  if(profile.DontAutoSwitchWhenInstalled!==true)warnings.push("Bundled profile "+name+" should normally set DontAutoSwitchWhenInstalled=true");
  if(profile.Readonly!==false)warnings.push("Bundled profile "+name+" should normally set Readonly=false");
}

if(requireMajorProfiles){
  const required=[
    [0,"standard / MK.2"],
    [2,"XL"],
    [7,"Plus"],
    [9,"Neo"],
  ];
  for(const [deviceType,label] of required){
    if(!seenDeviceTypes.has(deviceType))errors.push("Missing required major-model profile for "+label+" (DeviceType "+deviceType+")");
  }
}

console.log("Stream Deck key visual audit");
console.log("Plugin: "+pluginDir);
console.log("Keypad actions: "+keypad.length);
console.log("Bundled profiles: "+profiles.length+(requireMajorProfiles?" (major-model coverage required)":""));
for(const warning of warnings)console.log("WARN: "+warning);
for(const error of errors)console.error("ERROR: "+error);
console.log("Manual gate still required: review representative runtime-rendered keys at 72 x 72 and 36 x 36, including longest labels, two-line labels, error/N-A states, presets, and live values. This script prevents host title overlays and ambiguous extensionless assets but cannot prove internal rendered layout quality.");

if(errors.length){
  console.error("FAIL: "+errors.length+" key visual error(s), "+warnings.length+" warning(s)");
  process.exit(1);
}
console.log("PASS: no structural key visual errors, "+warnings.length+" warning(s)");
