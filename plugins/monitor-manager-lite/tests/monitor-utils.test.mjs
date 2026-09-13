import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  SAFE_VCP, SUPPORT, classifyProfileResult, modeSupported, parseVcpCapabilities, vcpSupport
} from "../../_shared/monitor-manager/monitor-utils.mjs";

test("capability parser discovers safe VCP codes and advertised input values", () => {
  const caps = "(prot(monitor)type(LCD)model(TEST)vcp(10 12 60(0F 10 11 12) 62 D6(01 04 05)))";
  const parsed = parseVcpCapabilities(caps);
  assert.equal(parsed.has(0x60), true);
  assert.deepEqual(parsed.get(0x60), [0x0f,0x10,0x11,0x12]);
  assert.equal(vcpSupport(caps, SAFE_VCP.POWER_MODE).state, SUPPORT.SUPPORTED);
});

test("capability state distinguishes unknown and explicitly absent", () => {
  assert.equal(vcpSupport(null, SAFE_VCP.INPUT_SOURCE).state, SUPPORT.UNKNOWN);
  assert.equal(vcpSupport("(vcp(10 12))", SAFE_VCP.INPUT_SOURCE).state, SUPPORT.NOT_SUPPORTED);
});

test("mode support rejects refresh rates Windows did not enumerate", () => {
  const modes = [
    {width:1920,height:1080,frequency:60,orientation:0},
    {width:1920,height:1080,frequency:165,orientation:0}
  ];
  assert.equal(modeSupported(modes,{width:1920,height:1080,frequency:165,orientation:0}),true);
  assert.equal(modeSupported(modes,{width:1920,height:1080,frequency:240,orientation:0}),false);
});

test("profile result classifier preserves complete partial failed semantics", () => {
  assert.equal(classifyProfileResult([{status:"COMPLETE"}]),"COMPLETE");
  assert.equal(classifyProfileResult([{status:"COMPLETE"},{status:"SKIPPED"}]),"PARTIAL");
  assert.equal(classifyProfileResult([{status:"FAILED"}]),"FAILED");
});

test("bundled profiles are V2 archives with real Monitor Manager actions", async () => {
  const root=path.resolve("com.packrat.monitormanagerlite.sdPlugin","profiles");
  for(const name of ["monitor-manager-lite-standard","monitor-manager-lite-xl","monitor-manager-lite-plus","monitor-manager-lite-virtual"]){
    const data=await readFile(path.join(root,name+".streamDeckProfile"));
    assert.equal(data.readUInt32LE(0),0x04034b50);
    const text=data.toString("utf8");
    assert.match(text,/"Version": "2\.0"/);
    assert.match(text,/com\.packrat\.monitormanagerlite\.brightness/);
    assert.match(text,/com\.packrat\.monitormanagerlite\.refresh-rate/);
  }
});

test("Lite Pro CTA stays fail closed until the real Marketplace product URL is committed", async () => {
  const text=await readFile("src/product.ts","utf8");
  assert.match(text,/PRO_MARKETPLACE_URL: string \| null = null/);
  assert.doesNotMatch(text,/packrat.*\.com\/.*pro/i);
});
