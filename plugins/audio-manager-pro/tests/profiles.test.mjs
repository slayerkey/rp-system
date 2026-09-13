import test from "node:test";
import assert from "node:assert/strict";
import { endpointIdentity, matchEndpoint } from "../src/device-matching.js";
import { buildApplyPlan, captureProfileFromSnapshot, cycleCurrentIndex, endpointMuteMatches, endpointVolumeMatches, mergeApplyResult, normalizeGlobalSettings, normalizeProfile, profileMatchesSnapshot, roleMatchesSnapshot, snapshotDefaultRoleConflicts, verifyApplyResult } from "../src/profiles.js";

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
    multimediaOutputId:headset.id,
    communicationsOutputId:headset.id,
    defaultInputId:shure.id,
    multimediaInputId:shure.id,
    communicationsInputId:headsetMic.id,
    outputs:[headset,speakers],
    inputs:[shure,headsetMic],
    error:null,
  };
}

test("global settings normalization drops invalid and duplicate profile IDs",()=>{
  const valid={
    schemaVersion:1,
    id:"same-id",
    name:"Headset",
    accent:"#56f2a5",
    slots:{},
  };
  const duplicate={...valid,name:"Duplicate"};
  const normalized=normalizeGlobalSettings({
    profiles:[null,{id:"",name:"Invalid"},valid,duplicate],
    lastAppliedProfileId:"same-id",
  });
  assert.equal(normalized.profiles.length,1);
  assert.equal(normalized.profiles[0].name,"Headset");
  assert.equal(normalized.lastAppliedProfileId,"same-id");
});

test("profile normalization preserves unset volume as null",()=>{
  const p=normalizeProfile({
    id:"p",
    name:"Profile",
    slots:{
      outputCommunications:{
        device:{endpointId:"out",name:"Headset"},
        restoreVolume:false,
        volume:null,
        restoreMute:false,
        muted:false,
      },
    },
  });
  assert.equal(p.slots.outputCommunications.volume,null);
});

test("disabled volume restore discards latent saved volume",()=>{
  const p=normalizeProfile({
    id:"p-latent",
    name:"Profile",
    slots:{
      outputCommunications:{
        device:{endpointId:"out",name:"Headset"},
        restoreVolume:false,
        volume:88,
        restoreMute:false,
        muted:false,
      },
    },
  });
  assert.equal(p.slots.outputCommunications.volume,null);
});

test("captured communications roles do not silently become zero-volume restores",()=>{
  const s=snap();
  const p=captureProfileFromSnapshot("MEETING",s,"meeting-null-volume");
  assert.equal(p.slots.outputCommunications.restoreVolume,false);
  assert.equal(p.slots.outputCommunications.volume,null);
  assert.equal(p.slots.inputCommunications.restoreVolume,false);
  assert.equal(p.slots.inputCommunications.volume,null);
});

test("profile normalization clamps state and canonicalizes accent",()=>{
  const p=normalizeProfile({
    id:"  profile  ",
    name:"  Test Profile  ",
    accent:"#aabbcc",
    slots:{
      outputDefault:{
        device:{endpointId:"out",name:"Speakers"},
        restoreVolume:true,
        volume:999,
        restoreMute:true,
        muted:true,
      },
    },
  });
  assert.equal(p.id,"profile");
  assert.equal(p.name,"Test Profile");
  assert.equal(p.accent,"#AABBCC");
  assert.equal(p.slots.outputDefault.volume,100);
  assert.equal(p.slots.outputDefault.muted,true);
});

test("last applied profile is cleared when its profile no longer exists",()=>{
  const normalized=normalizeGlobalSettings({
    profiles:[{id:"a",name:"A",slots:{}}],
    lastAppliedProfileId:"deleted",
  });
  assert.equal(normalized.lastAppliedProfileId,"");
});

test("exact endpoint identity wins",()=>{
  const s=snap(), wanted=endpointIdentity(s.outputs[0]);
  const m=matchEndpoint(wanted,s.outputs);
  assert.equal(m.status,"matched"); assert.equal(m.strategy,"endpoint-id");
});

test("endpoint recreation does not auto-bind from instance ID alone",()=>{
  const s=snap(), wanted=endpointIdentity(s.outputs[0]);
  s.outputs[0]={...s.outputs[0],id:"render-new-id",containerId:""};
  const m=matchEndpoint(wanted,s.outputs);
  assert.equal(m.status,"rebind-required");
  assert.equal(m.strategy,"friendly-name-only");
});

test("endpoint recreation can rebind by physical container plus exact friendly name",()=>{
  const s=snap(), wanted=endpointIdentity(s.outputs[0]);
  s.outputs[0]={...s.outputs[0],id:"render-new-id"};
  const m=matchEndpoint(wanted,s.outputs);
  assert.equal(m.status,"matched");
  assert.equal(m.endpoint.id,"render-new-id");
  assert.equal(m.strategy,"container+name");
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

test("capture preflight detects split or incomplete Console and Multimedia defaults",()=>{
  const s=snap();
  assert.deepEqual(snapshotDefaultRoleConflicts(s),[]);

  s.multimediaOutputId="render-speakers";
  assert(snapshotDefaultRoleConflicts(s).some(x=>x.includes("output")));

  s.multimediaOutputId=s.defaultOutputId;
  s.multimediaInputId="capture-headset";
  assert(snapshotDefaultRoleConflicts(s).some(x=>x.includes("input")));

  s.multimediaInputId=s.defaultInputId;
  s.defaultOutputId="";
  assert(snapshotDefaultRoleConflicts(s).some(x=>x.includes("output")));

  s.defaultOutputId=s.multimediaOutputId;
  s.multimediaInputId="";
  assert(snapshotDefaultRoleConflicts(s).some(x=>x.includes("input")));
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

test("direct role verification checks both Console and Multimedia for Default",()=>{
  const s=snap();
  assert.equal(roleMatchesSnapshot("output","default",s.defaultOutputId,s),true);
  s.multimediaOutputId="render-speakers";
  assert.equal(roleMatchesSnapshot("output","default",s.defaultOutputId,s),false);
  assert.equal(roleMatchesSnapshot("output","communications",s.communicationsOutputId,s),true);
});

test("endpoint state verification checks volume tolerance and mute",()=>{
  const s=snap();
  assert.equal(endpointVolumeMatches(s,s.defaultOutputId,42),true);
  assert.equal(endpointVolumeMatches(s,s.defaultOutputId,43),true);
  assert.equal(endpointVolumeMatches(s,s.defaultOutputId,45),false);
  assert.equal(endpointMuteMatches(s,s.defaultInputId,false),true);
  assert.equal(endpointMuteMatches(s,s.defaultInputId,true),false);
});

test("direct verification helpers fail closed on snapshot errors",()=>{
  const s={...snap(),error:"audio unavailable"};
  assert.equal(roleMatchesSnapshot("output","default",s.defaultOutputId,s),false);
  assert.equal(endpointVolumeMatches(s,s.defaultOutputId,42),false);
  assert.equal(endpointMuteMatches(s,s.defaultInputId,false),false);
});

test("successful operations stay SUCCESS only when final Windows state matches",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  const plan=buildApplyPlan(p,s);
  const merged=mergeApplyResult(plan,{results:plan.operations.map((x,index)=>({index,ok:true})),snapshot:s});
  const verified=verifyApplyResult(p,merged,s);
  assert.equal(verified.status,"SUCCESS");
});

test("successful operations downgrade to PARTIAL when final roles drift",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  const plan=buildApplyPlan(p,s);
  const merged=mergeApplyResult(plan,{results:plan.operations.map((x,index)=>({index,ok:true})),snapshot:s});
  const drift={...s,multimediaOutputId:"render-speakers"};
  const verified=verifyApplyResult(p,merged,drift);
  assert.equal(verified.status,"PARTIAL");
  assert(verified.failures.some(x=>x.slot==="verification"));
});

test("successful operations downgrade to PARTIAL when final snapshot cannot be verified",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  const plan=buildApplyPlan(p,s);
  const merged=mergeApplyResult(plan,{results:plan.operations.map((x,index)=>({index,ok:true})),snapshot:s});
  const verified=verifyApplyResult(p,merged,{...s,error:"snapshot unavailable"});
  assert.equal(verified.status,"PARTIAL");
  assert(verified.failures.some(x=>String(x.error).includes("verification failed")));
});

test("matching profile status checks roles and restored state",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  assert.equal(profileMatchesSnapshot(p,s),true);
  s.communicationsInputId=s.defaultInputId;
  assert.equal(profileMatchesSnapshot(p,s),false);
});

test("default profile status also requires Windows Multimedia role to match",()=>{
  const s=snap(),p=captureProfileFromSnapshot("MEETING",s,"meeting");
  s.multimediaOutputId="render-speakers";
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

test("cycle cursor advances from the last attempted profile when no profile is active",()=>{
  const s=snap();
  const a=captureProfileFromSnapshot("A",s,"a");
  const b=captureProfileFromSnapshot("B",s,"b");
  const c=captureProfileFromSnapshot("C",s,"c");

  const drift={...s,defaultOutputId:"none",multimediaOutputId:"none",communicationsOutputId:"none",defaultInputId:"none",multimediaInputId:"none",communicationsInputId:"none"};
  const globals={schemaVersion:1,profiles:[a,b,c],lastAppliedProfileId:"a"};

  assert.equal(cycleCurrentIndex(globals,drift,"b"),1);
  assert.equal(cycleCurrentIndex(globals,drift,""),0);
});

test("cycle cursor prefers the profile that is actually active in Windows",()=>{
  const s=snap();
  const a=captureProfileFromSnapshot("A",s,"a");
  const b=JSON.parse(JSON.stringify(a));
  b.id="b"; b.name="B";
  b.slots.outputDefault.device=endpointIdentity(s.outputs[1]);
  b.slots.outputDefault.volume=s.outputs[1].volume;

  const globals={schemaVersion:1,profiles:[a,b],lastAppliedProfileId:"b"};
  assert.equal(cycleCurrentIndex(globals,s,"b"),0);
});

test("rapid profile planning is deterministic and does not mutate profiles",()=>{
  const s=snap();
  const a=captureProfileFromSnapshot("HEADSET",s,"a");
  const before=JSON.stringify(a);
  for(let i=0;i<100;i++) buildApplyPlan(a,s);
  assert.equal(JSON.stringify(a),before);
});
