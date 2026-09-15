import {resolve} from "node:path";import {profileAction,writeProfiles} from "../../../tools/streamdeck/profile-builder.mjs";
const dir=resolve(import.meta.dirname,"..","com.packrat.audio-manager-lite.sdPlugin","profiles");
const OUT="com.packrat.audio-manager-lite.set-output",IN="com.packrat.audio-manager-lite.set-input";
const make=(prefix,cols=4)=>{
  const keypad={};
  const split=Math.floor(cols/2);
  for(let i=0;i<split;i++)keypad[`${i},0`]=profileAction(`${prefix}:output-${i+1}`,OUT,"Set Output Device",{device:null});
  for(let i=split;i<cols;i++)keypad[`${i},0`]=profileAction(`${prefix}:input-${i-split+1}`,IN,"Set Input Device",{device:null});
  return[{label:"AUDIO DEVICES",keypad}];
};
const specs=[
  {file:"audio-manager-lite-standard",name:"Audio Manager Lite",pages:make("standard",4)},
  {file:"audio-manager-lite-xl",name:"Audio Manager Lite XL",pages:make("xl",6)},
  {file:"audio-manager-lite-plus",name:"Audio Manager Lite +",pages:make("plus",4)},
  {file:"audio-manager-lite-neo",name:"Audio Manager Lite Neo",pages:make("neo",4)}
];
const seen=new Set();for(const spec of specs)for(const page of spec.pages)for(const a of Object.values(page.keypad||{})){if(seen.has(a.ActionID))throw new Error(`Duplicate ActionID ${a.ActionID}`);seen.add(a.ActionID);}
await writeProfiles(dir,specs);
