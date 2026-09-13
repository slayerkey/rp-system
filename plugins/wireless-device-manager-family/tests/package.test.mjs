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
  xl:{cols:8,rows:4},
  plus:{cols:4,rows:2}
};

const roots=[
  ["lite","com.packrat.wireless-device-manager.sdPlugin","wireless-device-manager"],
  ["pro","com.packrat.wireless-device-manager-pro.sdPlugin","wireless-device-manager-pro"]
];

for(const [edition,root,prefix] of roots){
  test(`${edition} manifest is Windows key-only and has three bundled profiles`,async()=>{
    const manifest=JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8"));
    assert.equal(manifest.OS[0].Platform,"windows");
    assert.equal(manifest.Profiles.length,3);
    for(const action of manifest.Actions) {
      assert.deepEqual(action.Controllers,["Keypad"]);
      for (const state of action.States ?? []) {
        if ("FontSize" in state) assert.equal(typeof state.FontSize, "number");
      }
    }
  });
  for(const suffix of ["standard","xl","plus"]){
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
  for(const suffix of ["standard","xl","plus"]){
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
  for(const suffix of ["standard","xl","plus"]){
    const data=await readFile(path.join("com.packrat.wireless-device-manager.sdPlugin","profiles",`wireless-device-manager-${suffix}.streamDeckProfile`));
    const manifest=readStoredProfileManifest(data);
    for(const action of Object.values(manifest.Actions)){
      assert.equal("favorite" in (action.Settings??{}),false);
      assert.equal("groupName" in (action.Settings??{}),false);
    }
  }
});
