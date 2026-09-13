import test from "node:test";
import assert from "node:assert/strict";
import { PRO_LIMITS, exportEnvelope, importEnvelope, normalizeMacro, playbackSettings, validateMacro } from "../../../shared/macro-recorder/model.mjs";

const pro=true;
const limits=PRO_LIMITS;

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

test("Pro preserves mouse events, loop modes and import/export",()=>{
 const macro=normalizeMacro({name:"Mouse",events:[{type:"mouseMove",x:-1200,y:400,relX:.5,relY:.5,delayMs:5},{type:"mouseDown",button:"left",x:0,y:0,delayMs:10},{type:"mouseUp",button:"left",x:0,y:0,delayMs:20}]},{pro:true});
 assert.equal(macro.events.length,3);
 assert.equal(playbackSettings({playbackMode:"toggle",playbackSpeed:2},{pro:true}).repeatCount,0);
 const round=importEnvelope(exportEnvelope(macro));
 assert.equal(round.name,"Mouse");
 assert.equal(round.events.length,3);
});
