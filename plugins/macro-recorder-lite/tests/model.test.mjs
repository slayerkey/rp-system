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

test("rapid keyboard sequences retain every event in order",()=>{
 const events=[];
 for(let i=0;i<12;i++){
  const vk=65+(i%4);
  events.push({type:"keyDown",vk,delayMs:0},{type:"keyUp",vk,delayMs:1});
 }
 const macro=normalizeMacro({events},{pro:false,limits});
 assert.equal(macro.events.length,24);
 assert.deepEqual(macro.events.slice(0,4).map(e=>e.type),["keyDown","keyUp","keyDown","keyUp"]);
});

test("Windows key survives normalization and balanced playback validation",()=>{
 const macro=normalizeMacro({events:[
  {type:"keyDown",vk:91,name:"Left Windows",delayMs:5},
  {type:"keyDown",vk:82,name:"R",delayMs:25},
  {type:"keyUp",vk:82,name:"R",delayMs:20},
  {type:"keyUp",vk:91,name:"Left Windows",delayMs:10}
 ]},{pro:false,limits});
 assert.deepEqual(macro.events.map(e=>e.vk),[91,82,82,91]);
 assert.equal(validateMacro(macro,{pro:false}).unmatchedKeys.length,0);
});

test("unmatched key-down is surfaced for edited or truncated recordings",()=>{
 const macro=normalizeMacro({events:[{type:"keyDown",vk:16,name:"Shift",delayMs:5}]},{pro:false,limits});
 const result=validateMacro(macro,{pro:false});
 assert.deepEqual(result.unmatchedKeys,[16]);
});

test("slow sequence just inside Lite duration remains valid",()=>{
 const macro=normalizeMacro({events:[
  {type:"keyDown",vk:65,delayMs:29_000},
  {type:"keyUp",vk:65,delayMs:900}
 ]},{pro:false,limits});
 assert.equal(macro.events.length,2);
 assert.equal(macro.durationMs,29_900);
});

test("auto-repeat key-downs clear with one logical key-up",()=>{
 const macro=normalizeMacro({events:[
  {type:"keyDown",vk:65,delayMs:1},
  {type:"keyDown",vk:65,delayMs:30},
  {type:"keyDown",vk:65,delayMs:30},
  {type:"keyUp",vk:65,delayMs:30}
 ]},{pro,limits});
 assert.equal(validateMacro(macro,{pro}).unmatchedKeys.length,0);
});

test("malformed executable events are dropped rather than coerced",()=>{
 const events=[
  {type:"not-real",vk:65,delayMs:1},
  {type:"keyDown",vk:0,delayMs:1},
  {type:"keyDown",vk:65,delayMs:1}
 ];
 
 const macro=normalizeMacro({events},{pro,limits});
 assert.equal(macro.events.length,1);
 assert.equal(macro.events[0].vk,65);
});
