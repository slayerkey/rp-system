#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const root=process.argv[2];
if(!root){
  console.error("Usage: node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>");
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
function firstAsset(base){return assetCandidates(base).find(existsSync)??null;}
function inspectSvg(file,name){
  const text=readFileSync(file,"utf8");
  const view=text.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)["']/i);
  if(view){
    const w=Number(view[1]),h=Number(view[2]);
    if(Math.abs(w-h)>0.01)warnings.push(name+": key SVG viewBox is not square ("+w+" x "+h+")");
    if(Math.max(w,h)<72)warnings.push(name+": key SVG source canvas is smaller than 72 px");
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
  else if(!firstAsset(action.Icon))errors.push(name+": action-list Icon asset is missing: "+action.Icon);

  const states=Array.isArray(action.States)?action.States:[];
  if(!states.length){errors.push(name+": no key States declared");continue;}
  for(const [index,state] of states.entries()){
    const stateName=name+" state "+index;
    if(!state.Image){errors.push(stateName+": missing key Image");continue;}
    const file=firstAsset(state.Image);
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

console.log("Stream Deck key visual audit");
console.log("Plugin: "+pluginDir);
console.log("Keypad actions: "+keypad.length);
for(const warning of warnings)console.log("WARN: "+warning);
for(const error of errors)console.error("ERROR: "+error);
console.log("Manual gate still required: review representative runtime-rendered keys at 72 x 72 and 36 x 36. This script prevents host title overlays but cannot prove internal rendered layout quality.");

if(errors.length){
  console.error("FAIL: "+errors.length+" key visual error(s), "+warnings.length+" warning(s)");
  process.exit(1);
}
console.log("PASS: no structural key visual errors, "+warnings.length+" warning(s)");
