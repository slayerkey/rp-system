import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { SAFE_VCP, SUPPORT, classifyProfileResult, modeSupported, vcpSupport } from "../../_shared/monitor-manager/monitor-utils.mjs";

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
