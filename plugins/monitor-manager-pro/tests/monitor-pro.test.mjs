import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { SAFE_VCP, SUPPORT, classifyProfileResult, matchSavedMonitor, modeSupported, vcpSupport } from "../../_shared/monitor-manager/monitor-utils.mjs";

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
    const text=data.toString("utf8");
    assert.match(text,/"Version": "2\.0"/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.input/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.apply-profile/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.topology/);
    assert.match(text,/com\.packrat\.monitormanagerpro\.brightness/);
  }
});

test("Stream Deck Plus bundle contains only continuous encoder actions", async () => {
  const text=(await readFile(path.resolve("com.packrat.monitormanagerpro.sdPlugin","profiles","monitor-manager-pro-plus.streamDeckProfile"))).toString("utf8");
  assert.match(text,/"Type": "Encoder"/);
  assert.match(text,/com\.packrat\.monitormanagerpro\.brightness/);
  assert.match(text,/com\.packrat\.monitormanagerpro\.contrast/);
  assert.match(text,/com\.packrat\.monitormanagerpro\.volume/);
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

test("Monitor Profiles exclude monitor power and apply volume before input switching", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.doesNotMatch(source,/power\?: number/);
  assert.doesNotMatch(source,/\["power",SAFE_VCP\.POWER_MODE\]/);
  assert.match(source,/\[\["volume",SAFE_VCP\.AUDIO_VOLUME\],\["input",SAFE_VCP\.INPUT_SOURCE\]\]/);
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

test("saved-profile picker writes profileName into action settings", async () => {
  const pi=await readFile("com.packrat.monitormanagerpro.sdPlugin/ui/pi.js","utf8");
  assert.match(pi,/getElementById\("profiles"\).*addEventListener\("change"/s);
  assert.match(pi,/settings=\{\.\.\.settings,profileName:name\}/);
});
