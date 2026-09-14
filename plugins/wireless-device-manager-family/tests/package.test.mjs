import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

function readStoredProfileManifest(data){
  assert.equal(data.readUInt32LE(0),0x04034b50);
  const compressedSize=data.readUInt32LE(18);
  const nameLength=data.readUInt16LE(26);
  const extraLength=data.readUInt16LE(28);
  const start=30+nameLength+extraLength;
  return JSON.parse(data.subarray(start,start+compressedSize).toString("utf8"));
}

const profileBounds={
  standard:{cols:5,rows:3},
  mini:{cols:3,rows:2},
  xl:{cols:8,rows:4},
  plus:{cols:4,rows:2},
  neo:{cols:4,rows:2}
};

const roots=[
  ["lite","com.packrat.wireless-device-manager.sdPlugin","wireless-device-manager"],
  ["pro","com.packrat.wireless-device-manager-pro.sdPlugin","wireless-device-manager-pro"]
];

for(const [edition,root,prefix] of roots){
  test(`${edition} manifest is Windows key-only and has five bundled profiles`,async()=>{
    const manifest=JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8"));
    assert.equal(manifest.OS[0].Platform,"windows");
    assert.equal(manifest.Profiles.length,5);
    assert.deepEqual(manifest.Profiles.map(profile=>profile.DeviceType),[0,1,2,7,9]);
    for(const action of manifest.Actions) {
      assert.deepEqual(action.Controllers,["Keypad"]);
      for (const state of action.States ?? []) {
        if ("FontSize" in state) assert.equal(typeof state.FontSize, "number");
      }
    }
  });
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    test(`${edition} ${suffix} profile archive is deterministic and within device bounds`,async()=>{
      const data=await readFile(path.join(root,"profiles",`${prefix}-${suffix}.streamDeckProfile`));
      const text=data.toString("utf8");
      assert.match(text,/\.sdProfile\/manifest\.json/);
      const manifest=readStoredProfileManifest(data);
      assert.equal(manifest.Version,"1.0");
      const bounds=profileBounds[suffix];
      for(const position of Object.keys(manifest.Actions)){
        const [col,row]=position.split(",").map(Number);
        assert.ok(col>=0 && col<bounds.cols,`${edition} ${suffix} column out of bounds: ${position}`);
        assert.ok(row>=0 && row<bounds.rows,`${edition} ${suffix} row out of bounds: ${position}`);
      }
    });
  }
}

test("Lite exposes exactly one configurable action type",async()=>{
  const m=JSON.parse(await readFile("com.packrat.wireless-device-manager.sdPlugin/manifest.json","utf8"));
  assert.equal(m.Actions.length,1);
  assert.equal(m.Actions[0].UUID,"com.packrat.wireless-device-manager.device");
});

test("Pro exposes device, dashboard and cycle actions",async()=>{
  const m=JSON.parse(await readFile("com.packrat.wireless-device-manager-pro.sdPlugin/manifest.json","utf8"));
  assert.deepEqual(m.Actions.map(x=>x.Name),["Wireless Device","Device Dashboard","Cycle Device"]);
});

test("SEO copy is truthful and contains requested discovery language",async()=>{
  for(const file of ["submission-lite.json","submission-pro.json"]){
    const text=(await readFile(file,"utf8")).toLowerCase();
    for(const term of ["bluetooth","wireless","battery","headphones","keyboard","mouse","controller","connect","disconnect","windows","stream deck"]){
      assert.match(text,new RegExp(term.replace(" ","\\s+")));
    }
    assert.match(text,/when .*expose|capability-gated|capabilit/);
  }
});


test("Pro bundled profiles seed favorites and example multi-group memberships",async()=>{
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager-pro.sdPlugin","profiles",`wireless-device-manager-pro-${suffix}.streamDeckProfile`));
    const manifest=readStoredProfileManifest(data);
    const deviceSettings=Object.values(manifest.Actions)
      .filter(action=>action.UUID==="com.packrat.wireless-device-manager-pro.device")
      .map(action=>action.Settings);
    assert.ok(deviceSettings.length>=4);
    assert.ok(deviceSettings.slice(0,4).every(settings=>settings.favorite===true));
    assert.ok(deviceSettings.some(settings=>settings.groupName==="GAMING, TRAVEL"));
    assert.ok(deviceSettings.some(settings=>settings.groupName==="WORK"));
    assert.ok(deviceSettings.some(settings=>settings.groupName==="GAMING"));
  }
});

test("Lite bundled profiles stay free of Pro-only favorite and group settings",async()=>{
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager.sdPlugin","profiles",`wireless-device-manager-${suffix}.streamDeckProfile`));
    const manifest=readStoredProfileManifest(data);
    for(const action of Object.values(manifest.Actions)){
      assert.equal("favorite" in (action.Settings??{}),false);
      assert.equal("groupName" in (action.Settings??{}),false);
    }
  }
});


test("Marketplace release notes use concise bullets",async()=>{
  for(const file of ["submission-lite.json","submission-pro.json"]){
    const submission=JSON.parse(await readFile(file,"utf8"));
    const lines=String(submission.release_notes||"").split(/\r?\n/).filter(Boolean);
    assert.ok(lines.length>=3 && lines.length<=6,`${file} should have 3-6 release-note bullets`);
    assert.ok(lines.every(line=>line.startsWith("- ")),`${file} release notes must be bullet lines`);
  }
});


test("native Bluetooth boundary uses AEP services and fail-closed service errors",async()=>{
  const source=await readFile("bridge/Program.cs","utf8");
  assert.match(source,/DeviceInformationKind\.AssociationEndpointService/);
  assert.match(source,/System\.Devices\.AepService\.ServiceClassId/);
  assert.match(source,/0000110B-0000-1000-8000-00805F9B34FB/i);
  assert.match(source,/0000111E-0000-1000-8000-00805F9B34FB/i);
  assert.match(source,/controlId/);
  assert.doesNotMatch(source,/AudioVideo-class|MajorClass\.AudioVideo|ERROR_INVALID_PARAMETER\s*\|\|/);
  assert.match(source,/code\s*==\s*E_INVALIDARG/);
});

test("native bridge supports LAMZU Maya X battery telemetry over USB HID",async()=>{
  const source=await readFile("bridge/Program.cs","utf8");
  assert.match(source,/LamzuVendorId\s*=\s*0x373E/i);
  assert.match(source,/MayaXWirelessPid\s*=\s*0x001E/i);
  assert.match(source,/MayaXWiredPid\s*=\s*0x001C/i);
  assert.match(source,/MayaBatteryCommand\s*=\s*0x83/i);
  assert.match(source,/MayaReplyTag\s*=\s*0xA1/i);
  assert.match(source,/HidD_SetFeature/);
  assert.match(source,/HidD_GetFeature/);
  assert.match(source,/response\[7\]\s*==\s*1/);
  assert.match(source,/response\[8\]/);
  assert.match(source,/transport\s*=\s*"usb-hid"/);
});

test("wireless inspector does not block USB devices when Bluetooth is unavailable",async()=>{
  const html=await readFile("ui/inspector.html","utf8");
  const inspector=await readFile("ui/inspector.js","utf8");
  const runtime=await readFile("src/runtime.ts","utf8");
  assert.match(html,/Scanning wireless devices/);
  assert.match(html,/Supported USB receivers can work without Bluetooth/);
  assert.match(inspector,/No supported USB wireless devices found/);
  assert.match(runtime,/hidAvailable/);
  assert.match(runtime,/bluetooth:\s*result\.adapterAvailable/);
  assert.match(runtime,/hid:\s*result\.hidAvailable/);
});


test("Property Inspector state is sent through the concrete action context",async()=>{
  const actions=await readFile("src/actions.ts","utf8");
  const runtime=await readFile("src/runtime.ts","utf8");
  const inspector=await readFile("ui/inspector.js","utf8");
  assert.match(actions,/onPropertyInspectorDidAppear/);
  assert.match(actions,/ev\.action\.sendToPropertyInspector\(await this\.runtime\.inspectorPayload\(\)\)/);
  assert.match(actions,/payload\.type === "get-wireless-snapshot"[\s\S]*sendToPropertyInspector/);
  assert.match(runtime,/inspectorPayload\(\)/);
  assert.doesNotMatch(runtime,/streamDeck\.ui\.sendToPropertyInspector/);
  assert.match(inspector,/setInterval\(requestSnapshot,1500\)/);
  assert.match(inspector,/Wireless plugin is not responding/);
});

test("settings reads are side-effect free and global writes are explicit",async()=>{
  const actions=await readFile("src/actions.ts","utf8");
  const runtime=await readFile("src/runtime.ts","utf8");
  const inspector=await readFile("ui/inspector.js","utf8");

  const didReceive=actions.match(/onDidReceiveSettings[\s\S]*?\n  }/m)?.[0]||"";
  assert.doesNotMatch(didReceive,/setFavorite|assignGroups|setThreshold|setLiteDeviceId/);
  assert.match(actions,/onSendToPlugin/);
  assert.match(inspector,/type:"set-favorite"/);
  assert.match(inspector,/type:"set-groups"/);
  assert.match(inspector,/type:"set-threshold"/);
  assert.match(runtime,/globalCache/);
  assert.match(runtime,/globalWrite/);
  assert.match(runtime,/mutateGlobals/);
});


test("bundled Pro headset status and control keys share one logical slot",async()=>{
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager-pro.sdPlugin","profiles",`wireless-device-manager-pro-${suffix}.streamDeckProfile`));
    const manifest=readStoredProfileManifest(data);
    const devices=Object.values(manifest.Actions).filter(action=>action.UUID==="com.packrat.wireless-device-manager-pro.device");
    const headset=devices.find(action=>action.Settings?.label==="HEADPHONES");
    const control=devices.find(action=>action.Settings?.view==="control");
    assert.equal(headset?.Settings?.slot,"HEADPHONES");
    assert.equal(control?.Settings?.slot,"HEADPHONES");
    assert.equal(control?.Settings?.favorite,headset?.Settings?.favorite);
    assert.equal(control?.Settings?.groupName,headset?.Settings?.groupName);
    assert.equal(control?.Settings?.lowBatteryThreshold,headset?.Settings?.lowBatteryThreshold);
  }
});

test("Lite upsell is catalog-driven and never hardcodes a placeholder Marketplace destination",async()=>{
  const html=await readFile("ui/inspector.html","utf8");
  const submission=JSON.parse(await readFile("submission-lite.json","utf8"));
  const map=JSON.parse(await readFile("../../products/lite-pro-map.json","utf8"));
  const pair=map.pairs.find(item=>item.lite_id==="wireless-device-manager");
  const config=(await readFile("com.packrat.wireless-device-manager.sdPlugin/ui/upsell-config.js","utf8")).trim();
  const proConfig=(await readFile("com.packrat.wireless-device-manager-pro.sdPlugin/ui/upsell-config.js","utf8")).trim();

  assert.match(html,/Wireless Device Manager Pro/);
  assert.match(html,/favorites/i);
  assert.match(html,/low-battery alerts/i);
  assert.match(html,/id="pro-link" hidden/);
  assert.match(submission.description,/Upgrade to Wireless Device Manager Pro/);
  assert.doesNotMatch(html,/marketplace\.elgato\.com\/product\/wireless-device-manager-pro/i);
  assert.equal(config,`window.WIRELESS_PRO_MARKETPLACE_URL = ${JSON.stringify(pair?.pro_marketplace_url??"")};`);
  assert.equal(proConfig,'window.WIRELESS_PRO_MARKETPLACE_URL = "";');
});


test("PackRat catalog registers the Wireless Device Manager Lite/Pro family consistently",async()=>{
  const index=JSON.parse(await readFile("../../products/index.json","utf8"));
  const map=JSON.parse(await readFile("../../products/lite-pro-map.json","utf8"));
  const lite=index.products.filter(product=>product.id==="wireless-device-manager");
  const pro=index.products.filter(product=>product.id==="wireless-device-manager-pro");
  assert.equal(lite.length,1);
  assert.equal(pro.length,1);
  assert.equal(lite[0].type,"plugin");
  assert.equal(pro[0].type,"plugin");
  assert.equal(lite[0].price_usd,0);
  assert.equal(pro[0].price_usd,7.99);

  const pairs=map.pairs.filter(pair=>pair.lite_id==="wireless-device-manager"||pair.pro_id==="wireless-device-manager-pro");
  assert.equal(pairs.length,1);
  assert.equal(pairs[0].lite_id,"wireless-device-manager");
  assert.equal(pairs[0].pro_id,"wireless-device-manager-pro");
  assert.equal(pairs[0].classification,"lite_to_pro");
  assert.equal(pairs[0].platform,"streamdeck");
  const direct=/^https:\/\/marketplace\.elgato\.com\/product\/[a-z0-9][a-z0-9-]*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i;
  if(pairs[0].lite_marketplace_url) assert.match(pairs[0].lite_marketplace_url,direct);
  if(pairs[0].pro_marketplace_url) assert.match(pairs[0].pro_marketplace_url,direct);
  if(String(pro[0].status).toLowerCase()==="published") {
    assert.match(String(pairs[0].pro_marketplace_url||""),direct);
  } else {
    assert.equal(pairs[0].pro_marketplace_url??null,null);
  }
  if(String(lite[0].status).toLowerCase()==="published") {
    assert.match(String(pairs[0].lite_marketplace_url||""),direct);
  }
});


test("wireless repaint notifier is non-recursive",async()=>{
  const runtime=await readFile("src/runtime.ts","utf8");
  assert.match(runtime,/notify\(\): void \{[\s\S]*for \(const listener of this\.listeners\) listener\(\);[\s\S]*\}/);
  assert.doesNotMatch(runtime,/notify\(\): void \{\s*this\.notify\(\);\s*\}/);
});


test("wireless upsell renderer validates direct Marketplace URLs",async()=>{
  const source=await readFile("scripts/render-assets.py","utf8");
  assert.match(source,/DIRECT_MARKETPLACE/);
  assert.match(source,/pro_marketplace_url/);
  assert.match(source,/raise SystemExit/);
  assert.match(source,/upsell-config\.js/);
});


test("native address normalization uses an explicit string target",async()=>{
  const source=await readFile("bridge/Program.cs","utf8");
  assert.match(source,/new string\(value\.Where\(Uri\.IsHexDigit\)\.ToArray\(\)\)/);
  assert.doesNotMatch(source,/=>\s*new\(value\.Where\(Uri\.IsHexDigit\)/);
});
