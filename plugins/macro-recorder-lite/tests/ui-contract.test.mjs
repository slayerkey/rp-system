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
  assert.match(js,/MAX_IMPORT_BYTES=16\*1024\*1024/);
  assert.match(js,/durationLimit/);
  assert.match(js,/otherDelay/);
  assert.match(js,/macroRecorder\.status/);
  assert.match(js,/function applyStatus/);
});

test("Lite manifest keeps the intended platform and action contract",async()=>{
  const raw=await readFile(new URL("com.packrat.macro-recorder-lite.sdPlugin/manifest.json",root),"utf8");
  const manifest=JSON.parse(raw);
  assert.equal(manifest.UUID,"com.packrat.macro-recorder-lite");
  assert.equal(manifest.Nodejs?.Version,"24");
  assert.equal(manifest.Software?.MinimumVersion,"7.1");
  assert.deepEqual(manifest.OS,[{Platform:"windows",MinimumVersion:"10"}]);
  assert.equal(manifest.Profiles?.length,4);
  assert.deepEqual(manifest.Profiles.map(profile=>profile.DeviceType),[0,2,7,9]);
  assert.deepEqual(manifest.Profiles.map(profile=>profile.Name),[
    "profiles/macro-recorder-lite-starter-mk2",
    "profiles/macro-recorder-lite-starter-xl",
    "profiles/macro-recorder-lite-starter-plus",
    "profiles/macro-recorder-lite-starter-neo"
  ]);
  for(const profile of manifest.Profiles) assert.ok(!profile.Name.endsWith(".streamDeckProfile"));
  for(const action of manifest.Actions) assert.equal(action.UserTitleEnabled,false);
  const record=manifest.Actions.find(action=>action.UUID.endsWith(".record"));
  const stop=manifest.Actions.find(action=>action.UUID.endsWith(".stop"));
  assert.equal(record?.SupportedInKeyLogicActions,false);
  assert.equal(stop?.SupportedInKeyLogicActions,false);
  const ids=manifest.Actions.map(action=>action.UUID);
  assert.deepEqual(ids,[
    "com.packrat.macro-recorder-lite.record",
    "com.packrat.macro-recorder-lite.stop",
    "com.packrat.macro-recorder-lite.replay",
  ]);
});
