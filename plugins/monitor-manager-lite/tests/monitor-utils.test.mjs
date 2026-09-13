import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inflateRawSync } from "node:zlib";

import {
  SAFE_VCP, SUPPORT, boundedPercent, classifyProfileResult, matchSavedMonitor, modeSupported, parseVcpCapabilities, vcpSupport
} from "../../_shared/monitor-manager/monitor-utils.mjs";
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
      const keys=Object.keys(controller.Actions??{});
      for(const coordinate of keys){
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
    const text=zipText(data);
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
  const helper=await readFile("../_shared/monitor-manager/windows/monitor-helper.ps1","utf8");
  assert.match(helper,/DISPLAYCONFIG_TARGET_DEVICE_NAME/);
  assert.match(helper,/monitorDevicePath/);
  assert.match(helper,/StableMonitorPath/);
  assert.match(helper,/StableMonitorPath\(mi\.szDevice\).*\+ "#0"/);
});

test("native helper prefers dedicated HDR packet types and has no DISPLAY-number heuristic", async () => {
  const helper=await readFile("../_shared/monitor-manager/windows/monitor-helper.ps1","utf8");
  assert.match(helper,/DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO_2/);
  assert.match(helper,/header\.type = 15/);
  assert.match(helper,/DISPLAYCONFIG_SET_HDR_STATE/);
  assert.match(helper,/header\.type = 16/);
  assert.match(helper,/current = hdr\.activeColorMode == 2/);
  assert.match(helper,/advancedColorLimitedByPolicy/);
  assert.doesNotMatch(helper,/deviceName\.EndsWith/);
});

test("B1 dial feedback updates text and progress indicator", async () => {
  const source=await readFile("src/actions.ts","utf8");
  assert.match(source,/value: String\(value\) \+ "%", indicator: value/);
  assert.match(source,/value: String\(value \?\? 0\) \+ "%", indicator: value \?\? 0/);
});

test("non-finite hardware percentages fail closed", () => {
  assert.equal(boundedPercent(65),65);
  assert.equal(boundedPercent(150),100);
  assert.equal(boundedPercent(-5),0);
  assert.throws(()=>boundedPercent(Number.NaN),/finite number/);
  assert.throws(()=>boundedPercent("not-a-number"),/finite number/);
});

test("malformed power behavior is rejected before a write", async () => {
  const source=await readFile("src/runtime.ts","utf8");
  assert.match(source,/if \(!\["toggle","on","off"\]\.includes\(wanted\)\) throw new Error\("Invalid monitor power behavior\."/);
});

test("Lite inspector does not visually substitute an unplugged configured monitor", async () => {
  const pi=await readFile("com.packrat.monitormanagerlite.sdPlugin/ui/pi.js","utf8");
  assert.match(pi,/Configured monitor not connected/);
  assert.match(pi,/globalSettings\.monitorKey\?monitorRows\.find/);
  assert.match(pi,/CONFIGURED MONITOR NOT CONNECTED/);
});

test("Lite manifest action UUIDs exactly match backend handlers", async () => {
  const manifest=JSON.parse(await readFile("com.packrat.monitormanagerlite.sdPlugin/manifest.json","utf8"));
  const source=await readFile("src/actions.ts","utf8");
  const handlers=[...source.matchAll(/@action\(\{\s*UUID:\s*"([^"]+)"/g)].map((match)=>match[1]).sort();
  const exposed=manifest.Actions.map((action)=>action.UUID).sort();
  assert.deepEqual(handlers,exposed);
  const encoders=manifest.Actions.filter((action)=>action.Controllers?.includes("Encoder")).map((action)=>action.UUID);
  assert.deepEqual(encoders,["com.packrat.monitormanagerlite.brightness"]);
});

test("monitor scans are coalesced and slow DDC discovery gets a dedicated timeout", async () => {
  const runtimeSource=await readFile("src/runtime.ts","utf8");
  const clientSource=await readFile("../_shared/monitor-manager/monitor-client.ts","utf8");
  assert.match(runtimeSource,/scanInFlight/);
  assert.match(runtimeSource,/request\("scan",\{\},30000\)/);
  assert.match(clientSource,/failPending\(error, true\)/);
  assert.match(clientSource,/child\.kill\(\)/);
});

test("successful DDC capability strings are cached while failed reads remain retryable", async () => {
  const helper=await readFile("../_shared/monitor-manager/windows/monitor-helper.ps1","utf8");
  assert.match(helper,/CapsCache/);
  assert.match(helper,/if \(!String\.IsNullOrWhiteSpace\(value\)\) CapsCache\[key\] = value/);
  assert.match(helper,/string stablePath = StableMonitorPath\(mi\.szDevice\) \?\? mi\.szDevice/);
  assert.match(helper,/var availableModes = GetModes\(mi\.szDevice\)/);
});

test("Lite manifest declares the exact four generated profile variants", async () => {
  const manifest=JSON.parse(await readFile("com.packrat.monitormanagerlite.sdPlugin/manifest.json","utf8"));
  assert.deepEqual(
    manifest.Profiles.map((profile)=>[profile.Name,profile.DeviceType]),
    [
      ["profiles/monitor-manager-lite-standard",0],
      ["profiles/monitor-manager-lite-xl",2],
      ["profiles/monitor-manager-lite-plus",7],
      ["profiles/monitor-manager-lite-virtual",11]
    ]
  );
});

test("Lite generated profile coordinates fit Standard XL and Plus hardware", async () => {
  const root=path.resolve("com.packrat.monitormanagerlite.sdPlugin","profiles");
  assertControllerBounds(zipJsonDocuments(await readFile(path.join(root,"monitor-manager-lite-standard.streamDeckProfile"))),5,3);
  assertControllerBounds(zipJsonDocuments(await readFile(path.join(root,"monitor-manager-lite-xl.streamDeckProfile"))),8,4);
  const plus=zipJsonDocuments(await readFile(path.join(root,"monitor-manager-lite-plus.streamDeckProfile")));
  assertControllerBounds(plus,4,2,4);
  const encoderUuids=[];
  for(const doc of plus) for(const controller of doc.json.Controllers??[]) {
    if(controller.Type==="Encoder") for(const action of Object.values(controller.Actions??{})) encoderUuids.push(action.UUID);
  }
  assert.deepEqual([...new Set(encoderUuids)],["com.packrat.monitormanagerlite.brightness"]);
});

test("Lite Pro URL validator requires an exact direct Marketplace product URL", async () => {
  const source=await readFile("src/product.ts","utf8");
  assert.match(source,/hostname\.toLowerCase\(\) !== "marketplace\.elgato\.com"/);
  assert.match(source,/url\.search \|\| url\.hash/);
  assert.match(source,/\[0-9a-f\]\{8\}.*\[0-9a-f\]\{12\}/);
  assert.doesNotMatch(source,/marketplace\.elgato\.com\/search\?/i);
  assert.doesNotMatch(source,/marketplace\.elgato\.com\/@packrat/i);
});
