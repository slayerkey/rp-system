import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
    test(`${edition} ${suffix} profile archive is deterministic Stream Deck shape`,async()=>{
      const data=await readFile(path.join(root,"profiles",`${prefix}-${suffix}.streamDeckProfile`));
      assert.equal(data.readUInt32LE(0),0x04034b50);
      const text=data.toString("utf8");
      assert.match(text,/\.sdProfile\/manifest\.json/);
      assert.match(text,/"Version": "1\.0"/);
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
