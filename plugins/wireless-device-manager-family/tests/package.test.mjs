import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { wirelessKeySvg, wirelessTextSize } from "../src/key-visuals.ts";

function readZipEntries(data){
  const entries=new Map();
  let offset=0;
  while(offset+30<=data.length && data.readUInt32LE(offset)===0x04034b50){
    const method=data.readUInt16LE(offset+8);
    const compressedSize=data.readUInt32LE(offset+18);
    const nameLength=data.readUInt16LE(offset+26);
    const extraLength=data.readUInt16LE(offset+28);
    const nameStart=offset+30;
    const name=data.subarray(nameStart,nameStart+nameLength).toString("utf8");
    const bodyStart=nameStart+nameLength+extraLength;
    const compressed=data.subarray(bodyStart,bodyStart+compressedSize);
    const raw=method===0?compressed:method===8?inflateRawSync(compressed):null;
    assert.ok(raw,`Unsupported ZIP compression method ${method} for ${name}`);
    entries.set(name,raw);
    offset=bodyStart+compressedSize;
  }
  return entries;
}

function readProfileBundle(data){
  const entries=readZipEntries(data);
  const rootEntry=[...entries.entries()].find(([name])=>/\.sdProfile\/manifest\.json$/.test(name)&&!name.includes("/Profiles/"));
  assert.ok(rootEntry,"Profile root manifest missing");
  const root=JSON.parse(rootEntry[1].toString("utf8"));
  const pages=[];
  if(root.Actions){
    pages.push({name:rootEntry[0],actions:root.Actions});
  }else{
    for(const [name,raw] of entries){
      if(!/\.sdProfile\/Profiles\/[^/]+\/manifest\.json$/.test(name))continue;
      const manifest=JSON.parse(raw.toString("utf8"));
      const keypad=(manifest.Controllers??[]).find(controller=>controller.Type==="Keypad");
      pages.push({name,actions:keypad?.Actions??{}});
    }
  }
  return {
    root,
    pages,
    allActions:pages.flatMap(page=>Object.values(page.actions))
  };
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
      const bundle=readProfileBundle(data);
      assert.equal(bundle.root.Version,"2.0");
      assert.ok(bundle.pages.length>=1);
      const bounds=profileBounds[suffix];
      for(const page of bundle.pages){
        for(const [position,action] of Object.entries(page.actions)){
          const [col,row]=position.split(",").map(Number);
          assert.ok(col>=0 && col<bounds.cols,`${edition} ${suffix} column out of bounds: ${position}`);
          assert.ok(row>=0 && row<bounds.rows,`${edition} ${suffix} row out of bounds: ${position}`);
          for(const state of action.States??[]){
            assert.equal(state.ShowTitle,false,`${edition} ${suffix} must keep host titles disabled`);
            assert.equal(state.Title,"",`${edition} ${suffix} must not ship an overlay title`);
          }
        }
      }
    });
  }
}

test("Lite exposes exactly one configurable action type",async()=>{
  const m=JSON.parse(await readFile("com.packrat.wireless-device-manager.sdPlugin/manifest.json","utf8"));
  assert.equal(m.Actions.length,1);
  assert.equal(m.Actions[0].UUID,"com.packrat.wireless-device-manager.device");
});

test("Wireless manifests do not pass a fake disabled flag to Node in developer mode",async()=>{
  for(const root of ["com.packrat.wireless-device-manager.sdPlugin","com.packrat.wireless-device-manager-pro.sdPlugin"]){
    const manifest=JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8"));
    assert.equal(Object.prototype.hasOwnProperty.call(manifest.Nodejs??{},"Debug"),false,`${root} must omit Nodejs.Debug unless valid debug arguments are intentionally required`);
  }
});

test("Pro exposes device, dashboard and cycle actions",async()=>{
  const m=JSON.parse(await readFile("com.packrat.wireless-device-manager-pro.sdPlugin/manifest.json","utf8"));
  assert.deepEqual(m.Actions.map(x=>x.Name),["Wireless Device","Device Dashboard","Cycle Device"]);
});

test("Pro profiles separate device controls from groups instead of crowding page one",async()=>{
  const manifest=JSON.parse(await readFile("com.packrat.wireless-device-manager-pro.sdPlugin/manifest.json","utf8"));
  const allowed=new Set(manifest.Actions.map(action=>action.UUID));
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager-pro.sdPlugin","profiles",`wireless-device-manager-pro-${suffix}.streamDeckProfile`));
    const bundle=readProfileBundle(data);
    assert.equal(bundle.pages.length,2,`${suffix} should have DEVICES and GROUPS pages`);
    const first=Object.values(bundle.pages[0].actions);
    const second=Object.values(bundle.pages[1].actions);
    assert.ok(first.length<=7,`${suffix} first page should stay focused`);
    assert.ok(first.some(action=>action.UUID.endsWith(".cycle")),`${suffix} first page should expose Cycle Device`);
    assert.ok(first.some(action=>action.UUID.endsWith(".dashboard")),`${suffix} first page should expose all-device status`);
    assert.ok(second.every(action=>action.UUID.endsWith(".dashboard")),`${suffix} group page should contain dashboards only`);
    for(const action of bundle.allActions) assert.ok(allowed.has(action.UUID),`${suffix} contains unknown action UUID ${action.UUID}`);
  }
});

test("Wireless keys use canonical PackRat full-key visuals",async()=>{
  const visuals=await readFile("src/key-visuals.ts","utf8");
  const actions=await readFile("src/actions.ts","utf8");
  const lite=JSON.parse(await readFile("com.packrat.wireless-device-manager.sdPlugin/manifest.json","utf8"));
  const pro=JSON.parse(await readFile("com.packrat.wireless-device-manager-pro.sdPlugin/manifest.json","utf8"));
  assert.match(visuals,/#FFB21E/);
  assert.match(visuals,/fill="#05070A"/);
  assert.match(visuals,/stroke="#F5F7FB"/);
  assert.match(visuals,/width="5"[\s\S]*WIRELESS_ACCENT/);
  assert.match(actions,/setWirelessKey/);
  for(const manifest of [lite,pro]){
    for(const action of manifest.Actions){
      for(const state of action.States??[]) assert.equal(state.ShowTitle,false);
    }
  }
  assert.equal(pro.Actions.find(a=>a.UUID.endsWith(".device")).Icon,"imgs/actions/device/icon");
  assert.equal(pro.Actions.find(a=>a.UUID.endsWith(".dashboard")).Icon,"imgs/actions/dashboard/icon");
  assert.equal(pro.Actions.find(a=>a.UUID.endsWith(".cycle")).Icon,"imgs/actions/cycle/icon");
});

test("Wireless renderer keeps long labels inside the canonical text hierarchy and uses distinct semantic glyphs",()=>{
  const kinds=["status","battery","charging","connect","disconnect","control","dashboard","group","cycle"];
  const svgs=new Map(kinds.map(kind=>[kind,wirelessKeySvg(kind,[kind.toUpperCase()])]));
  for(const [kind,svg] of svgs){
    assert.match(svg,/width="144" height="144"/,`${kind} should render at canonical source size`);
    assert.match(svg,/fill="#05070A"/,`${kind} should use canonical key background`);
    assert.match(svg,/x="8" y="12" width="5" height="32"/,`${kind} should use the short canonical accent rail`);
  }
  assert.equal(new Set([...svgs.values()]).size,kinds.length,"Every semantic key kind should render differently");
  assert.match(svgs.get("charging"),/fill="#FFB21E" stroke="none"/);
  assert.match(svgs.get("cycle"),/M21 9l3\.2 6\.5/,"Cycle should include a favorite star");
  assert.match(svgs.get("cycle"),/M34 23h25/,"Cycle should include a next arrow");
  assert.match(svgs.get("group"),/M10 15h18l6 6h28v25H10Z/,"Group should read as a folder, not a node triangle");
  assert.match(svgs.get("control"),/M14 36L58 6/,"Unavailable control should use a disabled-link slash");
  assert.doesNotMatch(svgs.get("control"),/M18 12v12M27 12v12/,"Control must not regress to the old plug glyph");
  assert.doesNotMatch(svgs.get("cycle"),/a21|A21/,"Cycle must not regress to a circular refresh glyph");
  assert.equal(wirelessTextSize(["HEADPHONES"]),17);
  assert.equal(wirelessTextSize(["CONTROLLER"]),17);
  assert.equal(wirelessTextSize(["NO FAVORITES"]),15);
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


test("Pro bundled profiles seed favorites without silently assigning example groups",async()=>{
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager-pro.sdPlugin","profiles",`wireless-device-manager-pro-${suffix}.streamDeckProfile`));
    const bundle=readProfileBundle(data);
    const deviceSettings=bundle.allActions
      .filter(action=>action.UUID==="com.packrat.wireless-device-manager-pro.device")
      .map(action=>action.Settings);
    assert.ok(deviceSettings.length>=3);
    assert.ok(deviceSettings.every(settings=>settings.favorite===true));
    assert.ok(deviceSettings.every(settings=>String(settings.groupName||"")===""),`${suffix} should not auto-assign a selected device to an example group`);
    const dashboards=bundle.allActions.filter(action=>action.UUID==="com.packrat.wireless-device-manager-pro.dashboard");
    const names=dashboards.map(action=>String(action.Settings?.groupName||""));
    assert.ok(names.includes("GAMING"));
    assert.ok(names.includes("WORK"));
    assert.ok(names.includes("TRAVEL"));
  }
});

test("Lite bundled profiles stay free of Pro-only favorite and group settings",async()=>{
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager.sdPlugin","profiles",`wireless-device-manager-${suffix}.streamDeckProfile`));
    const bundle=readProfileBundle(data);
    for(const action of bundle.allActions){
      assert.equal("favorite" in (action.Settings??{}),false);
      assert.equal("groupName" in (action.Settings??{}),false);
    }
  }
});

test("Wireless Property Inspector consumes the canonical PackRat visual contract",async()=>{
  const html=await readFile("ui/inspector.html","utf8");
  const css=await readFile("ui/inspector.css","utf8");
  const assets=await readFile("scripts/render-assets.py","utf8");
  assert.match(css,/--packrat-bg:#080A0E/i);
  assert.match(css,/--packrat-card-start:#151920/i);
  assert.match(css,/--packrat-card-end:#0D1015/i);
  assert.match(css,/--packrat-input:#15191E/i);
  assert.match(css,/--packrat-button:#181C21/i);
  assert.match(css,/--packrat-button-hover:#22272E/i);
  assert.match(css,/--packrat-border:#303640/i);
  assert.match(css,/--packrat-text:#F5F7FB/i);
  assert.match(css,/--packrat-muted:#9AA2AF/i);
  assert.match(css,/--packrat-accent:#FFB21E/i);
  assert.match(css,/--packrat-accent-hover:#FFC44D/i);
  assert.match(css,/rgba\(255,178,30,\.28\)/);
  assert.match(css,/--packrat-error:#FF5D6C/i);
  assert.match(css,/body::before/);
  assert.match(html,/packrat-logo\.png/);
  assert.match(html,/marketplace\.elgato\.com\/maker\/packrat/);
  assert.match(assets,/tools\/art\/assets\/ratpack-icon-transparent\.png|tools\\art\\assets\\ratpack-icon-transparent\.png/);
  assert.match(assets,/packrat-logo\.png/);
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
  assert.match(source,/batteryObservedAt\s*=\s*DateTimeOffset\.UtcNow\.ToUnixTimeMilliseconds\(\)/);
  assert.match(source,/batterySource\s*=\s*"hid-feature-report"/);
  assert.match(source,/transport\s*=\s*"usb-hid"/);
});

test("wireless inspector does not block USB devices when Bluetooth is unavailable",async()=>{
  const html=await readFile("ui/inspector.html","utf8");
  const inspector=await readFile("ui/inspector.js","utf8");
  const runtime=await readFile("src/runtime.ts","utf8");
  assert.match(html,/Plugin starting/);
  assert.match(inspector,/Refreshing wireless devices/);
  assert.match(html,/Supported USB receivers can work without Bluetooth/);
  assert.match(inspector,/No supported USB wireless devices found/);
  assert.match(inspector,/soleVisibleDevice/);
  assert.match(inspector,/direct HID read/);
  assert.match(inspector,/2\.4 GHz receiver/);
  assert.match(runtime,/soleVisibleDeviceId\(this\.devices\(\)\)/);
  assert.match(runtime,/hidAvailable/);
  assert.match(runtime,/bluetooth:\s*result\.adapterAvailable/);
  assert.match(runtime,/hid:\s*result\.hidAvailable/);
});


test("Property Inspector uses the canonical PackRat UI envelope and preserves action context in payload",async()=>{
  const runtime=await readFile("src/runtime.ts","utf8");
  const lite=await readFile("src/lite.ts","utf8");
  const pro=await readFile("src/pro.ts","utf8");
  const inspector=await readFile("ui/inspector.js","utf8");
  assert.match(lite,/streamDeck\.ui\.onDidAppear/);
  assert.match(lite,/streamDeck\.ui\.onSendToPlugin/);
  assert.match(pro,/streamDeck\.ui\.onDidAppear/);
  assert.match(pro,/streamDeck\.ui\.onSendToPlugin/);
  assert.match(runtime,/payload\?\.type === "refresh-wireless"/);
  assert.match(inspector,/uiUuid=inUUID/);
  assert.match(inspector,/actionContext=String\(actionInfo\.context\|\|""\)/);
  assert.match(inspector,/event,uuid:uiUuid/);
  assert.match(inspector,/event:"sendToPlugin"[\s\S]*context:uiUuid[\s\S]*payload:\{\.\.\.payload,actionContext\}/);
  assert.match(inspector,/event:"setSettings",action:actionUuid,context:uiUuid/);
  assert.match(inspector,/type:"refresh-wireless"/);
  assert.match(inspector,/requestId:lastRequestId/);
  assert.doesNotMatch(inspector,/setInterval\(requestSnapshot/);
  assert.match(inspector,/Plugin process did not reply/);
});

test("Wireless troubleshooting contract captures every real-machine transport stage",async()=>{
  const inspector=await readFile("ui/inspector.js","utf8");
  const pro=await readFile("src/pro.ts","utf8");
  const runtime=await readFile("src/runtime.ts","utf8");
  const packageJson=JSON.parse(await readFile("package.json","utf8"));
  const probe=await readFile("scripts/host-probe.ps1","utf8");
  assert.match(inspector,/logMessage/);
  assert.match(inspector,/websocket-registered/);
  assert.match(inspector,/command-sent/);
  assert.match(inspector,/snapshot-received/);
  assert.match(inspector,/render-exception/);
  assert.match(inspector,/snapshot-timeout/);
  assert.match(inspector,/requestId/);
  assert.match(pro,/pi-command-received/);
  assert.match(pro,/pi-send-complete/);
  assert.match(runtime,/bridge-snapshot-start/);
  assert.match(runtime,/bridge-snapshot-result/);
  assert.match(runtime,/lastSnapshotDeviceCount/);
  assert.equal(packageJson.scripts["host:probe"],"powershell -NoProfile -ExecutionPolicy Bypass -File scripts/host-probe.ps1");
  assert.match(probe,/Matches Rat Dev build/);
  assert.match(probe,/Direct Pro bridge snapshot/);
  assert.match(probe,/StreamDeck0\.log/);
  assert.match(probe,/127\.0\.0\.1:23654/);
});


test("settings reads are side-effect free and global writes are explicit",async()=>{
  const actions=await readFile("src/actions.ts","utf8");
  const runtime=await readFile("src/runtime.ts","utf8");
  const inspector=await readFile("ui/inspector.js","utf8");

  const didReceive=actions.match(/onDidReceiveSettings[\s\S]*?\n  }/m)?.[0]||"";
  assert.doesNotMatch(didReceive,/setFavorite|assignGroups|setThreshold|setLiteDeviceId/);
  assert.doesNotMatch(actions,/onSendToPlugin/);
  assert.match(runtime,/payload\?\.type === "set-favorite"/);
  assert.match(runtime,/payload\?\.type === "set-groups"/);
  assert.match(runtime,/payload\?\.type === "set-threshold"/);
  assert.match(inspector,/type:"set-favorite"/);
  assert.match(inspector,/type:"set-groups"/);
  assert.match(inspector,/type:"set-threshold"/);
  assert.match(runtime,/globalCache/);
  assert.match(runtime,/globalWrite/);
  assert.match(runtime,/mutateGlobals/);
});


test("bundled Pro profiles use neutral logical slots without pretending a device type",async()=>{
  for(const suffix of ["standard","mini","xl","plus","neo"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager-pro.sdPlugin","profiles",`wireless-device-manager-pro-${suffix}.streamDeckProfile`));
    const bundle=readProfileBundle(data);
    const devices=bundle.allActions.filter(action=>action.UUID==="com.packrat.wireless-device-manager-pro.device");
    const device1=devices.filter(action=>action.Settings?.slot==="DEVICE_1");
    assert.ok(device1.some(action=>action.Settings?.view==="status"));
    assert.ok(device1.some(action=>action.Settings?.view==="control"));
    assert.ok(device1.every(action=>action.Settings?.groupName===""));
    assert.ok(devices.every(action=>!["HEADPHONES","MOUSE","KEYBOARD","CONTROLLER"].includes(String(action.Settings?.label||""))));
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
  assert.match(html,/id="pro-link"[^>]*hidden/);
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
