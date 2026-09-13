import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  SAFE_VCP, SUPPORT, classifyProfileResult, matchSavedMonitor, modeSupported, parseVcpCapabilities, vcpSupport
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
  assert.equal(classifyProfileResult([{status:"COMPLETE"},{status:"FAILED"}]),"FAILED");
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

test("all common high-refresh fixtures are accepted when Windows enumerates them", () => {
  const modes = [60,120,144,165,240].map((frequency) => ({
    width:2560,height:1440,frequency,orientation:0
  }));
  for (const frequency of [60,120,144,165,240]) {
    assert.equal(modeSupported(modes,{width:2560,height:1440,frequency,orientation:0}),true);
  }
  assert.equal(modeSupported(modes,{width:2560,height:1440,frequency:360,orientation:0}),false);
});

test("saved monitor matching handles one through four monitors and rejects ambiguous fallback", () => {
  for (const count of [1,2,3,4]) {
    const current = Array.from({length:count},(_,index)=>({
      monitorKey:"path:display-"+index,
      description:"Monitor "+index
    }));
    for (let index=0; index<count; index+=1) {
      assert.equal(
        matchSavedMonitor({monitorKey:"path:display-"+index,description:"Monitor "+index},current),
        current[index]
      );
    }
  }
  assert.equal(matchSavedMonitor({monitorKey:"path:missing",description:"Missing"},[]),null);
  assert.equal(
    matchSavedMonitor({monitorKey:"",description:"Same"},[
      {monitorKey:"a",description:"Same"},
      {monitorKey:"b",description:"Same"}
    ]),
    null
  );
});

test("Lite binds monitor choice globally and never falls through from an external display to laptop brightness", async () => {
  const runtimeSource=await readFile("src/runtime.ts","utf8");
  const pluginSource=await readFile("src/plugin.ts","utf8");
  const piSource=await readFile("com.packrat.monitormanagerlite.sdPlugin/ui/pi.js","utf8");
  assert.match(runtimeSource,/monitor\.internalDisplay && snapshot\.internalBrightness\?\.available/);
  assert.match(pluginSource,/getGlobalSettings<LiteGlobalSettings>/);
  assert.match(pluginSource,/setGlobalSettings\(\{ monitorKey:/);
  assert.match(piSource,/setGlobalSettings/);
  assert.match(piSource,/globalSettings\.monitorKey/);
});

test("monitor discovery prefers the stable Windows target device path", async () => {
  const helper=await readFile("../../_shared/monitor-manager/windows/monitor-helper.ps1","utf8");
  assert.match(helper,/DISPLAYCONFIG_TARGET_DEVICE_NAME/);
  assert.match(helper,/monitorDevicePath/);
  assert.match(helper,/StableMonitorPath/);
  assert.match(helper,/StableMonitorPath\(mi\.szDevice\).*\+ "#0"/);
});

test("native helper prefers dedicated HDR packet types and has no DISPLAY-number heuristic", async () => {
  const helper=await readFile("../../_shared/monitor-manager/windows/monitor-helper.ps1","utf8");
  assert.match(helper,/DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2/);
  assert.match(helper,/header\.type = 15/);
  assert.match(helper,/DISPLAYCONFIG_SET_HDR_STATE/);
  assert.match(helper,/header\.type = 16/);
  assert.doesNotMatch(helper,/deviceName\.EndsWith/);
});
