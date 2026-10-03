import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

const repo=process.argv[2]?path.resolve(process.argv[2]):path.resolve(".");
const source=path.join(repo,"widgets","_src","hwinfo-sensor-dashboard");
const ship=path.join(repo,"widgets","hwinfo-sensor-dashboard");
for(const file of ["dashboard.js","rat-art.mjs"]){
  const full=path.join(source,file);
  assert.equal(fs.existsSync(full),true,`missing ${file}`);
  const r=spawnSync(process.execPath,["--check",full],{encoding:"utf8"});
  assert.equal(r.status,0,`${file} syntax failed: ${r.stderr||r.stdout}`);
}
const html=fs.readFileSync(path.join(source,"index.html"),"utf8");
const css=fs.readFileSync(path.join(source,"dashboard.css"),"utf8");
const js=fs.readFileSync(path.join(source,"dashboard.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(ship,"manifest.json"),"utf8"));
const submission=JSON.parse(fs.readFileSync(path.join(source,"submission.json"),"utf8"));

assert.equal(manifest.author,"PackRat 🐀");
assert.equal(manifest.id,"com.packrat.hwinfo-sensor-dashboard");
assert.equal(manifest.version,"1.0.0");
assert.equal(manifest.interactive,true);
assert.deepEqual(manifest.os,[{platform:"windows"}]);
assert.deepEqual(manifest.required_plugins,["widgetbuilder.linkprovider:Url:1.0"]);
assert.equal(submission.type,"widget");
assert.equal(submission.price_usd,11.99);
assert.equal(submission.companion_required,true);
assert.equal(submission.marketplace_auto_publish,false);
assert.match(submission.description,/HWiNFO must be installed separately/i);
assert.match(submission.description,/12 hours/i);
assert.match(submission.description,/not affiliated/i);
assert.match(submission.description,/127\.0\.0\.1/);

const props=[...html.matchAll(/name=["']x-icue-property["'][^>]*content=["']([^"']+)["']/g)].map(m=>m[1]);
for(const p of ["bridgeKey","historyWindow","staleSeconds","textColor","accentColor","backgroundColor","graphColor"]) assert.ok(props.includes(p),`missing iCUE property ${p}`);
const triplet=props.indexOf("textColor");
assert.deepEqual(props.slice(triplet,triplet+3),["textColor","accentColor","backgroundColor"]);

for(const slot of ["s-h","s-v","m-h","m-v","l-h","l-v","xl-h","xl-v"]) assert.match(css,new RegExp(`data-slot=["']${slot}["']`),`missing CSS for ${slot}`);
for(const code of ["hwinfo_not_running","shared_memory_unavailable","shared_memory_lost","shared_memory_inactive","no_sensors","access_denied","malformed"]) assert.ok(js.includes(code),`missing status ${code}`);

assert.match(js,/ws:\/\/127\.0\.0\.1:17489\/widget/);
assert.match(js,/pairing_required/);
assert.match(js,/protocol_mismatch/);
assert.match(js,/pagehide/);
assert.match(js,/hist\.length>900/);
assert.match(js,/staleSeconds/);
assert.match(js,/sensorFingerprint/);
assert.match(js,/available===false/);
assert.equal(/\bfetch\s*\(|XMLHttpRequest/i.test(js),false,"widget runtime must not call remote HTTP services");
assert.equal(/innerHTML\s*=.*sensor\.label/.test(js),false,"sensor labels must not be injected as HTML");
assert.ok(js.includes('textContent=text(sensor.label'),"sensor label textContent safety missing");
assert.ok(js.includes('value=stale?"—"'),"stale sensors must render unavailable rather than zero");
assert.match(html,/Does not reset HWiNFO's own min\/max counters/);
assert.match(html,/SEARCH SENSORS/);

console.log("HWiNFO SENSOR DASHBOARD DEV QA PASS");
