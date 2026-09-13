import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root=new URL("../",import.meta.url);

test("Lite property inspector source parses and required controls exist",async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL("ui/inspector.html",root),"utf8"),
    readFile(new URL("ui/inspector.js",root),"utf8"),
  ]);
  new vm.Script(js);
  for(const id of ["cancelRecording","stopPlayback","assignLatest","timeline","timelinePager","timelinePrev","timelineNext","timelinePageLabel","errorText"]){
    assert.match(html,new RegExp(`id=["']${id}["']`),`missing inspector control ${id}`);
  }
  assert.match(js,/PAGE_SIZE=200/);
});

test("Lite manifest keeps the intended platform and action contract",async()=>{
  const raw=await readFile(new URL("com.packrat.macro-recorder-lite.sdPlugin/manifest.json",root),"utf8");
  const manifest=JSON.parse(raw);
  assert.equal(manifest.UUID,"com.packrat.macro-recorder-lite");
  assert.equal(manifest.Nodejs?.Version,"24");
  assert.equal(manifest.Software?.MinimumVersion,"7.1");
  assert.deepEqual(manifest.OS,[{Platform:"windows",MinimumVersion:"10"}]);
  assert.equal(manifest.Profiles?.length,1);
  assert.equal(manifest.Profiles[0].DeviceType,0);
  assert.equal(manifest.Profiles[0].Name,"profiles/macro-recorder-lite-starter");
  assert.ok(!manifest.Profiles[0].Name.endsWith(".streamDeckProfile"));
  const ids=manifest.Actions.map(action=>action.UUID);
  assert.deepEqual(ids,[
    "com.packrat.macro-recorder-lite.record",
    "com.packrat.macro-recorder-lite.stop",
    "com.packrat.macro-recorder-lite.replay",
  ]);
});
