import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inflateRawSync } from "node:zlib";

import { SAFE_VCP, SUPPORT, classifyProfileResult, matchSavedMonitor, modeSupported, vcpSupport } from "../../_shared/monitor-manager/monitor-utils.mjs";
function zipText(data) {
  const parts=[];
  let offset=0;
  while(offset+30<=data.length && data.readUInt32LE(offset)===0x04034b50){
    const method=data.readUInt16LE(offset+8);
    const compressedSize=data.readUInt32LE(offset+18);
    const nameLength=data.readUInt16LE(offset+26);
    const extraLength=data.readUInt16LE(offset+28);
    const dataStart=offset+30+nameLength+extraLength;
    const compressed=data.subarray(dataStart,dataStart+compressedSize);
    const raw=method===8?inflateRawSync(compressed):method===0?compressed:null;
    assert.ok(raw, "Unsupported ZIP compression method: "+method);
    parts.push(raw.toString("utf8"));
    offset=dataStart+compressedSize;
  }
  assert.ok(parts.length>0,"Expected at least one local ZIP entry");
  return parts.join("\n");
}

function zipJsonDocuments(data) {
  const docs=[];
  let offset=0;
  while(offset+30<=data.length && data.readUInt32LE(offset)===0x04034b50){
    const method=data.readUInt16LE(offset+8);
    const compressedSize=data.readUInt32LE(offset+18);
    const nameLength=data.readUInt16LE(offset+26);
    const extraLength=data.readUInt16LE(offset+28);
    const name=data.subarray(offset+30,offset+30+nameLength).toString("utf8");
    const dataStart=offset+30+nameLength+extraLength;
    const compressed=data.subarray(dataStart,dataStart+compressedSize);
    const raw=method===8?inflateRawSync(compressed):method===0?compressed:null;
    assert.ok(raw, "Unsupported ZIP compression method: "+method);
    if(name.endsWith("/manifest.json")) docs.push({name,json:JSON.parse(raw.toString("utf8"))});
    offset=dataStart+compressedSize;
  }
  return docs;
}

function assertControllerBounds(docs, keypadCols, keypadRows, encoderCols = null) {
  for(const doc of docs){
    for(const controller of doc.json.Controllers??[]){
      for(const coordinate of Object.keys(controller.Actions??{})){
        const [x,y]=coordinate.split(",").map(Number);
        if(controller.Type==="Keypad"){
          assert.ok(x>=0&&x<keypadCols&&y>=0&&y<keypadRows, "Out-of-bounds Keypad coordinate "+coordinate);
        } else if(controller.Type==="Encoder"&&encoderCols!==null){
          assert.ok(x>=0&&x<encoderCols&&y===0, "Out-of-bounds Encoder coordinate "+coordinate);
        }
      }
    }
  }
}



test("input switching is capability gated and uses advertised values", () => {
  const caps="(vcp(10 60(0F 11 1B) 62 D6(01 04)))";
  const support=vcpSupport(caps,SAFE_VCP.INPUT_SOURCE);
  assert.equal(support.state,SUPPORT.SUPPORTED);
  assert.deepEqual(support.values,[0x0f,0x11,0x1b]);
  assert.equal(support.values.includes(0x12),false);
});

test("unsupported requested 240 Hz mode is rejected by the preflight helper", () => {
  const modes=[
    {width:2560,height:1440,frequency:60,orientation:0},
    {width:2560,height:1440,frequency:165,orientation:0}
  ];
  assert.equal(modeSupported(modes,{width:2560,height:1440,frequency:165,orientation:0}),true);
  assert.equal(modeSupported(modes,{width:2560,height:1440,frequency:240,orientation:0}),false);
});

test("profile result status supports COMPLETE PARTIAL FAILED", () => {
  assert.equal(classifyProfileResult([{status:"COMPLETE"}]),"COMPLETE");
  assert.equal(classifyProfileResult([{status:"COMPLETE"},{status:"SKIPPED"}]),"PARTIAL");
  assert.equal(classifyProfileResult([{status:"FAILED"}]),"FAILED");
  assert.equal(classifyProfileResult([{status:"COMPLETE"},{status:"FAILED"}]),"FAILED");
});

test("Pro bundled profiles are V2 archives with four real control surfaces", async () => {
  const root=path.resolve("com.packrat.monitormanagerpro.sdPlugin","profiles");
  for(const name of ["monitor-manager-pro-standard","monitor-manager-pro-xl","monitor-manager-pro-plus","monitor-manager-pro-virtual"]){
    const data=await readFile(path.join(root,name+".streamDeckProfile"));
    assert.equal(data.readUInt32LE(0),0x04034b50);
    const text=zipText(data);
    assert.match(text,/"Version": "2\.0"/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.input/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.apply-profile/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.topology/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.brightness/);
  }
});

test("Stream Deck Plus bundle contains only continuous encoder actions", async () => {
  const data=await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","profiles","monitor-manager-pro-plus.streamDeckProfile"));
  const docs=zipJsonDocuments(data);
  const encoderUuids=[];
  for(const doc of docs){
    for(const controller of doc.json.Controllers??[]){
      if(controller.Type!=="Encoder") continue;
      for(const action of Object.values(controller.Actions??{})) encoderUuids.push(action.UUID);
    }
  }
  assert.ok(encoderUuids.length>0);
  assert.deepEqual(
    [...new Set(encoderUuids)].sort(),
    [
      "com.packrat.monitormanagerpro.brightness",
      "com.packrat.monitormanagerpro.contrast",
      "com.packrat.monitormanagerpro.volume"
    ].sort()
  );
});

test("profile storage refuses to silently overwrite corrupt saved data", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.match(source,/Saved Monitor Profiles file is corrupt or incompatible\. It was not overwritten\./);
  assert.match(source,/rollbackErrors/);
  assert.match(source,/status:"FAILED"/);
});

test("low-level helper keeps the VCP write surface allowlisted", async () => {
  const helper=await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","helper","monitor-helper.ps1"),"utf8");
  assert.match(helper,/\$allowed = @\(0x60,0x62,0xD6\)/);
  assert.match(helper,/outside the PackRat safe allowlist/);
});

test("60 / 120 / 144 / 165 / 240 Hz fixtures pass when Windows reports them", () => {
  const modes=[60,120,144,165,240].map((frequency)=>({width:2560,height:1440,frequency,orientation:0}));
  for(const frequency of [60,120,144,165,240]){
    assert.equal(modeSupported(modes,{width:2560,height:1440,frequency,orientation:0}),true);
  }
  assert.equal(modeSupported(modes,{width:2560,height:1440,frequency:360,orientation:0}),false);
});

test("saved profile matching survives 1-4 monitor sets by stable key and fails closed on ambiguity", () => {
  for(const count of [1,2,3,4]){
    const current=Array.from({length:count},(_,i)=>({monitorKey:"path:monitor-"+i,description:"Panel "+i}));
    for(let i=0;i<count;i+=1){
      assert.equal(matchSavedMonitor({monitorKey:"path:monitor-"+i,description:"Panel "+i},current),current[i]);
    }
  }
  assert.equal(matchSavedMonitor({monitorKey:"path:gone",description:"Gone"},[]),null);
  assert.equal(matchSavedMonitor({monitorKey:"",description:"Twin"},[
    {monitorKey:"one",description:"Twin"},{monitorKey:"two",description:"Twin"}
  ]),null);
});

test("Monitor Profiles exclude monitor power and keep all input switching in the final phase", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.doesNotMatch(source,/power\?: number/);
  assert.doesNotMatch(source,/\["power",SAFE_VCP\.POWER_MODE\]/);
  assert.match(source,/const pendingInputs:ProfileMonitor\[\]=\[\]/);
  assert.match(source,/Input changes are intentionally the final transaction phase/);
  assert.match(source,/if\(!support\.values\.length\|\|!support\.values\.includes\(native\)\)/);
});

test("primary-display helper places the requested primary at the Windows origin", async () => {
  const helper=await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","helper","monitor-helper.ps1"),"utf8");
  assert.match(helper,/dm\.dmPositionX=0; dm\.dmPositionY=0;/);
  assert.match(helper,/CDS_SET_PRIMARY/);
  assert.match(helper,/CDS_TEST/);
});

test("stable target paths and internal-panel detection are present in the bundled helper", async () => {
  const helper=await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","helper","monitor-helper.ps1"),"utf8");
  assert.match(helper,/DISPLAYCONFIG_TARGET_DEVICE_NAME/);
  assert.match(helper,/monitorDevicePath/);
  assert.match(helper,/IsInternalDisplay/);
});

test("orientation swaps dimensions and is preflighted against enumerated Windows modes", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.match(source,/currentPortrait===wantedPortrait\?Number\(current\.width\):Number\(current\.height\)/);
  assert.match(source,/if\(!modeSupported\(monitor\.modes,request\)\) throw new Error\("Requested orientation is not available/);
});

test("saved-profile datalist writes profileName through the profile input", async () => {
  const html=await readFile("com.packrat.monitormanagerpro.sdPlugin/ui/config.html","utf8");
  const pi=await readFile("com.packrat.monitormanagerpro.sdPlugin/ui/pi.js","utf8");
  assert.match(html,/id="profileName" list="profiles"/);
  assert.match(html,/<datalist id="profiles">/);
  assert.match(pi,/getElementById\("profileName"\).*addEventListener\("change"/s);
  assert.match(pi,/profileName:e\.target\.value\.trim\(\)/);
});

test("new Pro actions persist the first discovered stable monitor key", async () => {
  const pi=await readFile("com.packrat.monitormanagerpro.sdPlugin/ui/pi.js","utf8");
  assert.match(pi,/if\(!settings\.monitorKey&&monitorRows\[0\]\)/);
  assert.match(pi,/settings=\{\.\.\.settings,monitorKey:monitorRows\[0\]\.monitorKey\}/);
  assert.match(pi,/save\(\)/);
});

test("true HDR uses Windows 11 24H2 dedicated packets and fails closed without them", async () => {
  const helper=await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","helper","monitor-helper.ps1"),"utf8");
  assert.match(helper,/DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2/);
  assert.match(helper,/header\.type = 15/);
  assert.match(helper,/highDynamicRangeSupported/);
  assert.match(helper,/DISPLAYCONFIG_SET_HDR_STATE/);
  assert.match(helper,/header\.type = 16/);
  assert.match(helper,/current = hdr\.activeColorMode == 2/);
  assert.match(helper,/supported = current \|\| \(hdrCapable && !policyLimited\)/);
  assert.match(helper,/Older Windows exposes only "Advanced Color"/);
});

test("profile capture stores only advertised input values", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.match(source,/if\(support\.values\.length&&support\.values\.includes\(current\)\) item\.input=current/);
});

test("Pro B1 dial feedback updates both text and indicator", async () => {
  const source=await readFile("src/actions/continuous.ts","utf8");
  assert.match(source,/value:String\(value\)\+"%",indicator:value/);
  assert.match(source,/value:String\(value\?\?0\)\+"%",indicator:value\?\?0/);
});

test("Pro capability reporting receives scan context for internal-panel brightness", async () => {
  const source=await readFile("src/plugin.ts","utf8");
  assert.match(source,/capabilitySummary\(m,snapshot\)/);
});

test("saved primary display is restored independently from saved mode", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.doesNotMatch(source,/\.\.\.saved\.mode,primary:Boolean\(saved\.primary\)/);
  assert.match(source,/const savedPrimary=profile\.monitors\.find\(\(item\)=>item\.primary\)/);
  assert.match(source,/item:savedPrimary\.description\+" primary display"/);
  assert.match(source,/primary:true/);
});

test("profile persistence validates entries serializes mutations and replaces atomically", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.match(source,/parsed\.profiles\.every/);
  assert.match(source,/profileMutationQueue/);
  assert.match(source,/const temp=file\+"\.tmp-"\+process\.pid/);
  assert.match(source,/await rename\(temp,file\)/);
  assert.match(source,/await rm\(temp,\{force:true\}\)/);
});

test("malformed destructive enum settings fail closed", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.match(source,/Invalid HDR behavior/);
  assert.match(source,/Invalid display topology/);
  assert.match(source,/validStoredPercent/);
  assert.match(source,/validStoredMode/);
});

test("Pro inspector does not visually substitute an unplugged configured monitor", async () => {
  const pi=await readFile("com.packrat.monitormanagerpro.sdPlugin/ui/pi.js","utf8");
  assert.match(pi,/Configured monitor not connected/);
  assert.match(pi,/settings\.monitorKey\?monitorRows\.find/);
  assert.match(pi,/CONFIGURED MONITOR NOT CONNECTED/);
  assert.match(pi,/if\(input&&!row\) input\.textContent=""/);
  assert.match(pi,/if\(mode&&!row\) mode\.textContent=""/);
});

test("Pro manifest action UUIDs exactly match backend handlers", async () => {
  const manifest=JSON.parse(await readFile("com.packrat.monitormanagerpro.sdPlugin/manifest.json","utf8"));
  const files=["src/actions/continuous.ts","src/actions/hardware.ts","src/actions/windows.ts","src/actions/profiles.ts"];
  let source="";
  for(const file of files) source+="\n"+await readFile(file,"utf8");
  const handlers=[...source.matchAll(/@action\(\{\s*UUID:\s*"([^"]+)"/g)].map((match)=>match[1]).sort();
  const exposed=manifest.Actions.map((action)=>action.UUID).sort();
  assert.deepEqual(handlers,exposed);
  const encoders=manifest.Actions.filter((action)=>action.Controllers?.includes("Encoder")).map((action)=>action.UUID).sort();
  assert.deepEqual(encoders,[
    "com.packrat.monitormanagerpro.brightness",
    "com.packrat.monitormanagerpro.contrast",
    "com.packrat.monitormanagerpro.volume"
  ].sort());
});

test("Pro inherits single-flight monitor scanning and timeout recovery", async () => {
  const base=await readFile("../monitor-manager-lite/src/runtime.ts","utf8");
  const client=await readFile("../_shared/monitor-manager/monitor-client.ts","utf8");
  assert.match(base,/scanInFlight/);
  assert.match(base,/request\("scan",\{\},30000\)/);
  assert.match(client,/failPending\(error, true\)/);
});

test("native scan caches only successful capability strings and reuses logical display queries", async () => {
  const helper=await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","helper","monitor-helper.ps1"),"utf8");
  assert.match(helper,/CapsCache/);
  assert.match(helper,/if \(!String\.IsNullOrWhiteSpace\(value\)\) CapsCache\[key\] = value/);
  assert.match(helper,/var currentMode = GetCurrentMode\(mi\.szDevice\)/);
  assert.match(helper,/var availableModes = GetModes\(mi\.szDevice\)/);
});

test("Pro manifest declares the exact four generated profile variants", async () => {
  const manifest=JSON.parse(await readFile("com.packrat.monitormanagerpro.sdPlugin/manifest.json","utf8"));
  assert.deepEqual(
    manifest.Profiles.map((profile)=>[profile.Name,profile.DeviceType]),
    [
      ["profiles/monitor-manager-pro-standard",0],
      ["profiles/monitor-manager-pro-xl",2],
      ["profiles/monitor-manager-pro-plus",7],
      ["profiles/monitor-manager-pro-virtual",11]
    ]
  );
});

test("Pro generated profile coordinates fit Standard XL and Plus hardware", async () => {
  const root=path.resolve("com.packrat.monitormanagerpro.sdPlugin","profiles");
  assertControllerBounds(zipJsonDocuments(await readFile(path.join(root,"monitor-manager-pro-standard.streamDeckProfile"))),5,3);
  assertControllerBounds(zipJsonDocuments(await readFile(path.join(root,"monitor-manager-pro-xl.streamDeckProfile"))),8,4);
  assertControllerBounds(zipJsonDocuments(await readFile(path.join(root,"monitor-manager-pro-plus.streamDeckProfile"))),4,2,4);
});
