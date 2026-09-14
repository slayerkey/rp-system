import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("Pro property inspector keeps replay setup visible and debuggable",async()=>{
  const [html,css,js,runtime,assets]=await Promise.all([
    readFile(new URL("ui/inspector.html",root),"utf8"),
    readFile(new URL("ui/inspector.css",root),"utf8"),
    readFile(new URL("ui/inspector.js",root),"utf8"),
    readFile(new URL("shared/macro-recorder/runtime.mjs",repoRoot),"utf8"),
    readFile(new URL("scripts/build-assets.mjs",root),"utf8"),
  ]);
  new vm.Script(js);
  for(const id of ["packratLink","captureMouseMovement","macroSelect","stateConnection","refreshLibrary","renameMacro","duplicateMacro","deleteMacro","importFile","exportMacro","playbackSpeed","playbackMode","repeatCount","coordinateMode","assignedSummary","timeline","timelinePager","timelinePrev","timelineNext","timelinePageLabel","errorText"]){
    assert.match(html,new RegExp(`id=["']${id}["']`),`missing inspector control ${id}`);
  }
  assert.doesNotMatch(html,/id=["']macroName["']/);
  assert.match(html,/Press the same Record key again to save/);
  assert.match(html,/Better Hotkeys is the simpler tool for individual keyboard or mouse actions/);
  assert.match(js,/PAGE_SIZE=200/);
  assert.match(js,/MAX_IMPORT_BYTES=16\*1024\*1024/);
  assert.match(js,/assignedSummary/);
  assert.match(js,/function applyStatus/);
  assert.match(runtime,/if \(recording\) return stopRecording\(record\.action\);/);
  assert.match(runtime,/assignNewRecordingToReplayKeys/);
  assert.match(runtime,/No macro is assigned to this Play key/);
  assert.match(runtime,/Rapid Left Click/);
  assert.match(runtime,/title = "STOP"/);
  assert.match(runtime,/saved && macro\?\.id === saved\.macroId\) title = "SAVED"/);
  assert.match(runtime,/recentSaved/);
  assert.match(html,/1× follows the timing you originally recorded/);
  assert.match(html,/Emergency Stop now/);
  assert.match(js,/NEW · /);
  assert.match(js,/LATEST · /);
  assert.match(runtime,/latestMacroId/);
  assert.match(runtime,/Date\.now\(\) \+ 15000/);
  assert.match(runtime,/settings: record \? \{ \.\.\.record\.settings/);
  assert.match(runtime,/autoLatest: pro \? source\.autoLatest !== false : false/);
  assert.match(js,/autoLatest:false/);
  assert.doesNotMatch(runtime,/record\.kind === "record"[\s\S]{0,180}else if \(saved\) title = "SAVED"/);
  assert.match(js,/context:uiUuid/);
  assert.doesNotMatch(js,/actionContext/);
  assert.match(js,/sendToPlugin"[\s\S]{0,120}context:uiUuid/);
  assert.match(js,/function requestState/);
  assert.match(js,/stateRetries<5/);
  assert.match(js,/Macro Library connected/);
  assert.match(js,/Macro Library connection failed/);
  assert.match(js,/state\?\.settings\?\.macroId/);
  assert.match(js,/if\(next\?\.settings\)applySettings\(next\.settings\)/);
  assert.match(html,/<option value="1" selected>1×<\/option>/);
  assert.ok(html.indexOf('value="0.25"') < html.indexOf('value="0.5"'));
  assert.ok(html.indexOf('value="0.5"') < html.indexOf('value="1" selected'));
  for(const token of ["#14171B","#1B1F24","#15191E","#181C21","#22272E","#303640","#F5F7FB","#9AA2AF","#FFB21E","#FFC44D","#FF5D6C","#2BE86A"]){
    assert.ok(css.includes(token),`missing canonical PackRat token ${token}`);
  }
  assert.match(css,/body::before/);
  assert.match(css,/rgba\(255,178,30,\.12\)/);
  assert.match(css,/button\.secondary\{background:var\(--packrat-button\)/);
  assert.match(css,/button\.danger\{background:var\(--packrat-danger\)/);
  assert.match(html,/packrat\.png/);
  assert.match(html,/PackRat ↗/);
  assert.match(js,/https:\/\/marketplace\.elgato\.com\/maker\/packrat/);
  assert.match(assets,/ratpack-icon-transparent\.png/);
  assert.match(assets,/accent=\[255,178,30,255\]/);
  assert.match(runtime,/function packRatKeyImage/);
  assert.match(runtime,/setImage\(packRatKeyImage\(record\.kind, title\)\)/);
  assert.match(runtime,/#14171B/);
  assert.match(runtime,/#FFB21E/);
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
  for(const profile of manifest.Profiles) assert.ok(!profile.Name.endsWith(".streamDeckProfile"));
  for(const action of manifest.Actions) assert.equal(action.UserTitleEnabled,false);
  const record=manifest.Actions.find(action=>action.UUID.endsWith(".record"));
  const stop=manifest.Actions.find(action=>action.UUID.endsWith(".stop"));
  assert.equal(stop?.Name,"Stop");
  for(const action of manifest.Actions) assert.equal(action.States?.[0]?.ShowTitle,false);
  const replay=manifest.Actions.find(action=>action.UUID==="com.packrat.macro-recorder-pro.replay");
  assert.equal(record?.SupportedInKeyLogicActions,false);
  assert.equal(stop?.SupportedInKeyLogicActions,false);
  assert.equal(replay?.SupportedInMultiActions,false);
  assert.equal(replay?.SupportedInKeyLogicActions,false);
});
