import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const manifest=JSON.parse(await readFile(new URL("com.packrat.windowmanager.sdPlugin/manifest.json",root),"utf8"));
const css=await readFile(new URL("com.packrat.windowmanager.sdPlugin/ui/pi.css",root),"utf8");
const footer=await readFile(new URL("com.packrat.windowmanager.sdPlugin/ui/pro-footer.js",root),"utf8");
const runtime=await readFile(new URL("com.packrat.windowmanager.sdPlugin/bin/plugin.js",root),"utf8");

test("Lite action and identity boundary stays unchanged",()=>{
  assert.equal(manifest.UUID,"com.packrat.windowmanager");
  assert.equal(manifest.Version,"1.0.0.4");
  assert.deepEqual(manifest.Actions.map(a=>[a.Name,a.UUID]),[
    ["Snap Window","com.packrat.windowmanager.snap"],
    ["Cycle Windows","com.packrat.windowmanager.cycle"]
  ]);
});

test("canonical PackRat visuals and branding are present",async()=>{
  assert.match(css,/#080a0e/i);
  assert.match(css,/linear-gradient\(145deg,#151920,#0d1015\)/i);
  assert.match(css,/#FFB21E/i);
  assert.match(css,/rgba\(255,178,30,\.12\)/);
  assert.match(footer,/https:\/\/marketplace\.elgato\.com\/maker\/packrat/);
  assert.match(footer,/PackRat ↗/);
  await access(new URL("com.packrat.windowmanager.sdPlugin/imgs/plugin/packrat-logo.png",root));
});

test("Lite to Pro CTA is in the top PackRat bar and points at the published Pro product",()=>{
  assert.match(footer,/buildPackRatTopbar\(\)/);
  assert.match(footer,/packrat-topbar/);
  assert.match(footer,/Upgrade to Pro ↗/);
  assert.match(footer,/topbar\.append\(brand, upgrade\)/);
  assert.match(footer,/f3ed6217-0282-419d-a71d-4b1548147b11/);
  assert.match(css,/\.packrat-topbar\{/);
  assert.match(css,/justify-content:space-between/);
  assert.match(css,/\.packrat-upgrade\{/);
  assert.doesNotMatch(footer,/workspace|launch missing|missing apps/i);
});

test("runtime key art uses PackRat orange and preserves XENEON service",()=>{
  assert.match(runtime,/Ds="#FFB21E"/);
  assert.doesNotMatch(runtime,/#2be86a/i);
  assert.match(runtime,/pluginVersion:"1\.0\.0\.4"/);
  assert.match(runtime,/windowManagerXeneonKey/);
  assert.match(runtime,/xeneon-service\.js/);
});

test("action assets have one unambiguous extensionless target",async()=>{
  for(const action of ["snap","cycle"]){
    await access(new URL(`com.packrat.windowmanager.sdPlugin/imgs/actions/${action}/icon.svg`,root));
    await access(new URL(`com.packrat.windowmanager.sdPlugin/imgs/actions/${action}/key.svg`,root));
  }
});
