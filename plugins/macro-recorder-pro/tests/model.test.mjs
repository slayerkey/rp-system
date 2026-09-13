import test from "node:test";
import assert from "node:assert/strict";
import { PRO_LIMITS, exportEnvelope, importEnvelope, normalizeMacro, playbackSafetyError, playbackSettings, validateMacro } from "../../../shared/macro-recorder/model.mjs";

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

test("mouse drag and wheel sequences preserve Pro event semantics",()=>{
 const macro=normalizeMacro({events:[
  {type:"mouseMove",x:-1600,y:220,relX:.2,relY:.3,delayMs:0},
  {type:"mouseDown",button:"left",x:-1600,y:220,relX:.2,relY:.3,delayMs:15},
  {type:"mouseMove",x:2400,y:900,relX:.8,relY:.7,delayMs:16},
  {type:"mouseUp",button:"left",x:2400,y:900,relX:.8,relY:.7,delayMs:15},
  {type:"wheel",delta:-120,horizontal:false,x:2400,y:900,delayMs:20},
  {type:"wheel",delta:120,horizontal:true,x:2400,y:900,delayMs:20}
 ]},{pro:true,limits});
 assert.deepEqual(macro.events.map(e=>e.type),["mouseMove","mouseDown","mouseMove","mouseUp","wheel","wheel"]);
 assert.equal(macro.events[0].x,-1600);
 assert.equal(macro.events[2].x,2400);
 assert.equal(macro.events[4].delta,-120);
 assert.equal(macro.events[5].horizontal,true);
});

test("Pro playback settings clamp speed and repeat count safely",()=>{
 assert.equal(playbackSettings({playbackSpeed:99},{pro:true}).speed,4);
 assert.equal(playbackSettings({playbackSpeed:0},{pro:true}).speed,.25);
 assert.equal(playbackSettings({playbackMode:"count",repeatCount:999},{pro:true}).repeatCount,100);
 assert.equal(playbackSettings({playbackMode:"count",repeatCount:0},{pro:true}).repeatCount,1);
 assert.equal(playbackSettings({playbackMode:"while-held"},{pro:true}).repeatCount,0);
});

test("active-window relative coordinates survive normalization",()=>{
 const macro=normalizeMacro({events:[
  {type:"mouseMove",x:100,y:200,relX:.125,relY:.875,delayMs:4}
 ]},{pro:true,limits});
 assert.equal(macro.events[0].relX,.125);
 assert.equal(macro.events[0].relY,.875);
 assert.equal(playbackSettings({coordinateMode:"active-window"},{pro:true}).coordinateMode,"active-window");
});

test("invalid PackRat macro envelope is rejected",()=>{
 assert.throws(()=>importEnvelope({format:"other",schema:1,macro:{events:[]}}),/Unsupported PackRat macro file/);
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
 events.push({type:"mouseDown",button:"not-a-button",x:1,y:1,delayMs:1});
 const macro=normalizeMacro({events},{pro,limits});
 assert.equal(macro.events.length,1);
 assert.equal(macro.events[0].vk,65);
});

test("Pro preserves a single edited or imported delay beyond 60 seconds",()=>{
 const macro=normalizeMacro({events:[
  {type:"keyDown",vk:65,delayMs:120_000},
  {type:"keyUp",vk:65,delayMs:1_000}
 ]},{pro:true,limits});
 assert.equal(macro.events.length,2);
 assert.equal(macro.events[0].delayMs,120_000);
 assert.equal(macro.durationMs,121_000);
});

test("Pro validation reports unmatched held mouse buttons",()=>{
 const macro=normalizeMacro({events:[
  {type:"mouseDown",button:"left",x:0,y:0,delayMs:1}
 ]},{pro:true,limits});
 const validation=validateMacro(macro,{pro:true});
 assert.deepEqual(validation.unmatchedButtons,["left"]);
});

test("infinite repeat modes reject effectively zero-duration macros",()=>{
 const macro=normalizeMacro({events:[
  {type:"keyDown",vk:65,delayMs:0},
  {type:"keyUp",vk:65,delayMs:0}
 ]},{pro:true,limits});
 const settings=playbackSettings({playbackMode:"toggle"},{pro:true});
 assert.match(playbackSafetyError(macro,settings),/25 ms/);
 const safe=normalizeMacro({events:[
  {type:"keyDown",vk:65,delayMs:25},
  {type:"keyUp",vk:65,delayMs:1}
 ]},{pro:true,limits});
 assert.equal(playbackSafetyError(safe,settings),"");
});

test("PackRat import rejects envelopes with no playable events",()=>{
 assert.throws(()=>importEnvelope({
  format:"packrat-macro",
  schema:1,
  macro:{name:"Empty",events:[{type:"not-real",delayMs:1}]}
 }),/no playable events/i);
});

test("malformed Pro playback settings fall back to UI defaults",()=>{
 const settings=playbackSettings({
  playbackMode:"count",
  playbackSpeed:"not-a-number",
  repeatCount:"not-a-number"
 },{pro:true});
 assert.equal(settings.speed,1);
 assert.equal(settings.repeatCount,2);
 assert.equal(settings.mode,"count");
});
