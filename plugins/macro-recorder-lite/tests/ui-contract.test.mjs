import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("Lite Property Inspector uses canonical PackRat UI and proven global transport",async()=>{
  const [html,css,js,runtime,assets]=await Promise.all([
    readFile(new URL("ui/inspector.html",root),"utf8"),
    readFile(new URL("ui/inspector.css",root),"utf8"),
    readFile(new URL("ui/inspector.js",root),"utf8"),
    readFile(new URL("shared/macro-recorder/runtime.mjs",repoRoot),"utf8"),
    readFile(new URL("scripts/build-assets.mjs",root),"utf8"),
  ]);
  new vm.Script(js);

  for(const id of [
    "packratLink","topProUpgrade","proUpgrade","cancelRecording","stopPlayback","assignLatest","assignedSummary",
    "recordedStepsDetails","timeline","timelinePager","timelinePrev","timelineNext",
    "timelinePageLabel","runDiagnostic","copyDiagnostic","diagnosticStatus",
    "diagnosticReport","errorText"
  ]){
    assert.match(html,new RegExp(`id=["']${id}["']`),`missing inspector control ${id}`);
  }

  for(const token of ["#080A0E","#151920","#0D1015","#FFB21E","#FF5D6C","#2BE86A"]){
    assert.ok(css.includes(token),`missing canonical PackRat token ${token}`);
  }
  assert.match(css,/body::before/);
  assert.match(html,/PackRat ↗/);
  assert.match(html,/10 seconds and 50 keyboard events/);
  assert.match(html,/Upgrade to Pro ↗/);
  assert.match(html,/Open Macro Recorder Pro ↗/);
  assert.match(html,/mouse recording|Mouse \+ longer recording/i);
  assert.match(html,/10-minute|10 minutes/i);
  assert.match(html,/playback speed|Playback controls/i);
  assert.match(html,/<details id="recordedStepsDetails"/);
  assert.match(html,/<summary>Troubleshooting<\/summary>/);
  assert.ok(
    html.indexOf('<section class="group privacy">') < html.indexOf('<section class="upsell">'),
    "Macro Recorder Pro upsell should render after Local by design at the bottom"
  );

  assert.match(js,/context:uiUuid/);
  assert.match(js,/actionContext/);
  assert.match(js,/type:"macroRecorder\.inspect",actionContext/);
  assert.match(js,/type:"macroRecorder\.diagnostic",actionContext/);
  assert.match(js,/PACKRAT_MAKER_URL="https:\/\/marketplace\.elgato\.com\/maker\/packrat"/);
  assert.match(js,/PRO_MARKETPLACE_URL\|\|PACKRAT_MAKER_URL/);
  assert.match(js,/topProUpgrade/);
  assert.match(js,/proUpgrade/);
  assert.match(js,/PAGE_SIZE=200/);
  assert.match(js,/function runDiagnostic/);
  assert.match(js,/no plugin diagnostic response within 2\.5 seconds/);
  assert.match(js,/saveLiteMacro/);

  assert.match(runtime,/if \(streamDeck\.ui\) \{/);
  assert.match(runtime,/streamDeck\.ui\.onSendToPlugin/);
  assert.match(runtime,/streamDeck\.ui\.sendToPropertyInspector/);
  assert.match(runtime,/!pro && macro\?\.id\?\.startsWith\("starter-"\)/);
  assert.match(runtime,/return !item\.settings\.macro/);
  assert.match(runtime,/setImage\(packRatKeyImage\(record\.kind, title\)\)/);

  assert.match(assets,/ratpack-icon-transparent\.png/);
  assert.match(assets,/recordRed=\[255,93,108,255\]/);
  assert.match(assets,/playGreen=\[43,232,106,255\]/);
  assert.match(assets,/accent=\[255,178,30,255\]/);
});

test("Lite manifest keeps the intended platform and owns its key labels",async()=>{
  const raw=await readFile(new URL("com.packrat.macro-recorder-lite.sdPlugin/manifest.json",root),"utf8");
  const manifest=JSON.parse(raw);
  assert.equal(manifest.UUID,"com.packrat.macro-recorder-lite");
  assert.equal(manifest.Nodejs?.Version,"24");
  assert.equal(manifest.Software?.MinimumVersion,"7.1");
  assert.deepEqual(manifest.OS,[{Platform:"windows",MinimumVersion:"10"}]);
  assert.equal(manifest.Profiles?.length,5);
  assert.deepEqual(manifest.Profiles.map(profile=>profile.DeviceType),[0,1,2,7,9]);
  for(const profile of manifest.Profiles)assert.ok(!profile.Name.endsWith(".streamDeckProfile"));
  for(const action of manifest.Actions){
    assert.equal(action.UserTitleEnabled,false);
    assert.equal(action.States?.[0]?.ShowTitle,false);
  }
  assert.equal(manifest.Actions.find(action=>action.UUID.endsWith(".stop"))?.Name,"Stop");
  assert.deepEqual(manifest.Actions.map(action=>action.UUID),[
    "com.packrat.macro-recorder-lite.record",
    "com.packrat.macro-recorder-lite.stop",
    "com.packrat.macro-recorder-lite.replay",
  ]);
});
