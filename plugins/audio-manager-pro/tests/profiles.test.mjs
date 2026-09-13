import test from "node:test";
import assert from "node:assert/strict";
import { endpointIdentity, matchEndpoint } from "../src/device-matching.js";
import { buildApplyPlan, captureProfileFromSnapshot, mergeApplyResult, profileMatchesSnapshot } from "../src/profiles.js";

function ep(id,name,{instanceId="",containerId="",volume=50,muted=false}={}) {
  return { id,name,instanceId,containerId,volume,muted,volumeAvailable:true,muteAvailable:true };
}
function snap() {
  const headset=ep("render-headset","USB Headset",{instanceId:"USB\\HEADSET",containerId:"aaa",volume:42});
  const speakers=ep("render-speakers","Speakers",{instanceId:"HDAUDIO\\SPEAKERS",containerId:"bbb",volume:55});
  const shure=ep("capture-shure","Shure MV7",{instanceId:"USB\\SHURE",containerId:"ccc",volume:76});
  const headsetMic=ep("capture-headset","Headset Mic",{instanceId:"USB\\HEADSETMIC",containerId:"aaa",volume:68});
  return {
    defaultDeviceSwitching:true,
    defaultOutputId:headset.id,
    communicationsOutputId:headset.id,
    defaultInputId:shure.id,
    communicationsInputId:headsetMic.id,
    outputs:[headset,speakers],
    inputs:[shure,headsetMic],
    error:null,
  };
}

test("exact endpoint identity wins",()=>{
  const s=snap(), wanted=endpointIdentity(s.outputs[0]);
  const m=matchEndpoint(wanted,s.outputs);
  assert.equal(m.status,"matched"); assert.equal(m.strategy,"endpoint-id");
});

test("rebinds safely after endpoint ID recreation by hardware instance",()=>{
  const s=snap(), wanted=endpointIdentity(s.outputs[0]);
  s.outputs[0]={...s.outputs[0],id:"render-new-id"};
  const m=matchEndpoint(wanted,s.outputs);
  assert.equal(m.status,"matched"); assert.equal(m.endpoint.id,"render-new-id"); assert.equal(m.strategy,"device-instance");
});

test("Bluetooth-like endpoint recreation can rebind by container plus friendly name",()=>{
  const saved={endpointId:"old-bt",name:"WH-1000XM5 Stereo",instanceId:"",containerId:"BT-CONTAINER"};
  const list=[ep("new-bt","WH-1000XM5 Stereo",{containerId:"bt-container"})];
  const m=matchEndpoint(saved,list);
  assert.equal(m.status,"matched"); assert.equal(m.strategy,"container+name");
});

test("friendly-name-only match requires explicit rebind",()=>{
  const m=matchEndpoint({endpointId:"gone",name:"Speakers",instanceId:"",containerId:""},[ep("new","Speakers")]);
  assert.equal(m.status,"rebind-required");
});

test("duplicate friendly names never auto-bind",()=>{
  const m=matchEndpoint({endpointId:"gone",name:"Microphone",instanceId:"",containerId:""},[ep("a","Microphone"),ep("b","Microphone")]);
  assert.equal(m.status,"ambiguous");
});

test("Unicode names survive identity matching",()=>{
  const saved={endpointId:"gone",name:"麦克风 🎙️",instanceId:"USB-UNICODE",containerId:"z"};
  const m=matchEndpoint(saved,[ep("new","麦克风 🎙️",{instanceId:"usb-unicode",containerId:"z"})]);
  assert.equal(m.status,"matched");
});

test("captured meeting profile owns all four Windows roles",()=>{
  const s=snap();
  const p=captureProfileFromSnapshot("MEETING",s,"meeting");
  assert.equal(p.slots.outputDefault.device.name,"USB Headset");
  assert.equal(p.slots.outputCommunications.device.name,"USB Headset");
  assert.equal(p.slots.inputDefault.device.name,"Shure MV7");
  assert.equal(p.slots.inputCommunications.device.name,"Headset Mic");
  assert.equal(p.slots.outputDefault.restoreVolume,true);
  assert.equal(p.slots.outputCommunications.restoreVolume,false);
});

test("profile plan includes role routing plus saved default endpoint state",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  const plan=buildApplyPlan(p,s);
  const defaults=plan.operations.filter(x=>x.kind==="set-default");
  assert.equal(defaults.length,4);
  assert(defaults.some(x=>x.flow==="output"&&x.role==="communications"));
  assert(defaults.some(x=>x.flow==="input"&&x.role==="communications"));
  assert(plan.operations.some(x=>x.kind==="set-volume"&&x.endpointId===s.defaultOutputId&&x.value===42));
  assert(plan.operations.some(x=>x.kind==="set-mute"&&x.endpointId===s.defaultInputId));
  assert.equal(plan.failures.length,0);
});

test("missing profile device is visible and does not bind the wrong endpoint",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  s.inputs=s.inputs.filter(x=>x.id!=="capture-headset");
  const plan=buildApplyPlan(p,s);
  assert(plan.failures.some(x=>x.slot==="inputCommunications"));
  assert(!plan.operations.some(x=>x.slot==="inputCommunications"));
});

test("contradictory saved state on one endpoint is skipped instead of choosing a winner",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  p.slots.outputCommunications.restoreVolume=true;
  p.slots.outputCommunications.volume=77;
  p.slots.outputCommunications.restoreMute=true;
  p.slots.outputCommunications.muted=true;

  const plan=buildApplyPlan(p,s);
  assert.equal(plan.operations.filter(x=>x.kind==="set-default"&&x.flow==="output").length,2);
  assert(!plan.operations.some(x=>x.kind==="set-volume"&&x.endpointId===s.defaultOutputId));
  assert(!plan.operations.some(x=>x.kind==="set-mute"&&x.endpointId===s.defaultOutputId));
  assert(plan.failures.some(x=>String(x.error).includes("volume restore was skipped")));
  assert(plan.failures.some(x=>String(x.error).includes("mute restore was skipped")));
});

test("partial helper failure is reported as PARTIAL",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  const plan=buildApplyPlan(p,s);
  const results=plan.operations.map((x,index)=>({index,ok:index!==1,error:index===1?"device disconnected":null}));
  const merged=mergeApplyResult(plan,{results,snapshot:s});
  assert.equal(merged.status,"PARTIAL");
  assert.equal(merged.failureCount,1);
});

test("all operation failures are FAILED",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  const plan=buildApplyPlan(p,s);
  const merged=mergeApplyResult(plan,{results:plan.operations.map((x,index)=>({index,ok:false,error:"nope"})),snapshot:s});
  assert.equal(merged.status,"FAILED");
});

test("matching profile status checks roles and restored state",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  assert.equal(profileMatchesSnapshot(p,s),true);
  s.communicationsInputId=s.defaultInputId;
  assert.equal(profileMatchesSnapshot(p,s),false);
});

test("profile status fails closed when requested volume cannot be read",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  s.outputs[0]={...s.outputs[0],volumeAvailable:false,volume:null};
  assert.equal(profileMatchesSnapshot(p,s),false);
});

test("profile status fails closed when requested mute cannot be read",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  s.inputs[0]={...s.inputs[0],muteAvailable:false};
  assert.equal(profileMatchesSnapshot(p,s),false);
});

test("rapid profile planning is deterministic and does not mutate profiles",()=>{
  const s=snap();
  const a=captureProfileFromSnapshot("HEADSET",s,"a");
  const before=JSON.stringify(a);
  for(let i=0;i<100;i++) buildApplyPlan(a,s);
  assert.equal(JSON.stringify(a),before);
});
