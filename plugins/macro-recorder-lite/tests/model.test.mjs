import test from "node:test";
import assert from "node:assert/strict";
import { LITE_LIMITS, exportEnvelope, importEnvelope, normalizeMacro, playbackSettings, validateMacro } from "../../../shared/macro-recorder/model.mjs";

const pro=false;
const limits=LITE_LIMITS;

test("preserves modifier down/up ordering and timing",()=>{
 const macro=normalizeMacro({name:"Ctrl+C",events:[
  {type:"keyDown",vk:17,name:"Ctrl",delayMs:20},
  {type:"keyDown",vk:67,name:"C",delayMs:25},
  {type:"keyUp",vk:67,name:"C",delayMs:30},
  {type:"keyUp",vk:17,name:"Ctrl",delayMs:35}
 ]},{pro,limits});
 assert.deepEqual(macro.events.map(e=>e.type),["keyDown","keyDown","keyUp","keyUp"]);
 assert.equal(validateMacro(macro,{pro}).unmatchedKeys.length,0);
});

test("edition event caps are enforced",()=>{
 const count=limits.maxEvents+10;
 const macro=normalizeMacro({events:Array.from({length:count},(_,i)=>({type:"keyDown",vk:65+(i%20),delayMs:0}))},{pro,limits});
 assert.equal(macro.events.length,limits.maxEvents);
});

test("duration cap is enforced",()=>{
 const macro=normalizeMacro({events:[
  {type:"keyDown",vk:65,delayMs:limits.maxDurationMs-10},
  {type:"keyUp",vk:65,delayMs:50}
 ]},{pro,limits});
 assert.equal(macro.events.length,1);
});

test("Lite filters mouse input and fixes playback to one pass",()=>{
 const macro=normalizeMacro({events:[{type:"mouseDown",button:"left",delayMs:1},{type:"keyDown",vk:65,delayMs:1}]},{pro:false,limits});
 assert.equal(macro.events.length,1);
 assert.deepEqual(playbackSettings({playbackMode:"toggle",playbackSpeed:4},{pro:false}),{speed:1,mode:"once",repeatCount:1,coordinateMode:"absolute"});
});
