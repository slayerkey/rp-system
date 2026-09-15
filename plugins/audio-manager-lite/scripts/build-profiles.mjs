import {resolve} from "node:path";import {profileAction,writeProfiles} from "../../../tools/streamdeck/profile-builder.mjs";
const dir=resolve(import.meta.dirname,"..","com.packrat.audio-manager-lite.sdPlugin","profiles"),U="com.packrat.audio-manager-lite.set-output";
const make=(prefix,count=4)=>{const keypad={};for(let i=0;i<count;i++){keypad[`${i},0`]=profileAction(`${prefix}:output-${i+1}`,U,"Set Output Device",{device:null});}return[{label:"OUTPUTS",keypad}];};
const specs=[{file:"audio-manager-lite-standard",name:"Audio Manager Lite",pages:make("standard")},{file:"audio-manager-lite-xl",name:"Audio Manager Lite XL",pages:make("xl",6)},{file:"audio-manager-lite-plus",name:"Audio Manager Lite +",pages:make("plus")},{file:"audio-manager-lite-neo",name:"Audio Manager Lite Neo",pages:make("neo")}];
const seen=new Set();for(const spec of specs)for(const page of spec.pages)for(const a of Object.values(page.keypad||{})){if(seen.has(a.ActionID))throw new Error(`Duplicate ActionID ${a.ActionID}`);seen.add(a.ActionID);}
await writeProfiles(dir,specs);
