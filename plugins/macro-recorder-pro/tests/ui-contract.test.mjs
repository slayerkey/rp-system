import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root=new URL("../",import.meta.url);

test("Pro property inspector source parses and long-editor controls exist",async()=>{
  const [html,js]=await Promise.all([
    readFile(new URL("ui/inspector.html",root),"utf8"),
    readFile(new URL("ui/inspector.js",root),"utf8"),
  ]);
  new vm.Script(js);
  for(const id of ["captureMouseMovement","macroSelect","macroName","duplicateMacro","deleteMacro","importFile","exportMacro","playbackSpeed","playbackMode","repeatCount","coordinateMode","timeline","timelinePager","timelinePrev","timelineNext","timelinePageLabel","errorText"]){
    assert.match(html,new RegExp(`id=["']${id}["']`),`missing inspector control ${id}`);
  }
  assert.match(js,/PAGE_SIZE=200/);
  assert.match(js,/MAX_IMPORT_BYTES=16\*1024\*1024/);
  assert.match(js,/durationLimit/);
  assert.match(js,/otherDelay/);
  assert.match(js,/macroRecorder\.status/);
  assert.match(js,/function applyStatus/);
  assert.doesNotMatch(html,/id=["']recordCoordinateMode["']/);
});

test("Pro manifest keeps the intended platform, profile and loop safety contract",async()=>{
  const raw=await readFile(new URL("com.packrat.macro-recorder-pro.sdPlugin/manifest.json",root),"utf8");
  const manifest=JSON.parse(raw);
  assert.equal(manifest.UUID,"com.packrat.macro-recorder-pro");
  assert.equal(manifest.Nodejs?.Version,"24");
  assert.equal(manifest.Software?.MinimumVersion,"7.1");
  assert.deepEqual(manifest.OS,[{Platform:"windows",MinimumVersion:"10"}]);
  assert.equal(manifest.Profiles?.length,5);
  assert.deepEqual(manifest.Profiles.map(profile=>profile.DeviceType),[0,1,2,7,9]);
  assert.deepEqual(manifest.Profiles.map(profile=>profile.Name),[
    "profiles/macro-recorder-pro-starter-mk2",
    "profiles/macro-recorder-pro-starter-mini",
    "profiles/macro-recorder-pro-starter-xl",
    "profiles/macro-recorder-pro-starter-plus",
    "profiles/macro-recorder-pro-starter-neo"
  ]);
  for(const profile of manifest.Profiles) assert.ok(!profile.Name.endsWith(".streamDeckProfile"));
  for(const action of manifest.Actions) assert.equal(action.UserTitleEnabled,false);
  const record=manifest.Actions.find(action=>action.UUID.endsWith(".record"));
  const stop=manifest.Actions.find(action=>action.UUID.endsWith(".stop"));
  const replay=manifest.Actions.find(action=>action.UUID==="com.packrat.macro-recorder-pro.replay");
  assert.equal(record?.SupportedInKeyLogicActions,false);
  assert.equal(stop?.SupportedInKeyLogicActions,false);
  assert.equal(replay?.SupportedInMultiActions,false);
  assert.equal(replay?.SupportedInKeyLogicActions,false);
});
