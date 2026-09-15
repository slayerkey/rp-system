import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("Lite submission matches its standalone free release contract",async()=>{
  const [submissionRaw,productRaw,manifestRaw,ratArt]=await Promise.all([
    readFile(new URL("submission.json",root),"utf8"),
    readFile(new URL("products/macro-recorder-lite.json",repoRoot),"utf8"),
    readFile(new URL("com.packrat.macro-recorder-lite.sdPlugin/manifest.json",root),"utf8"),
    readFile(new URL("rat-art.ps1",root),"utf8")
  ]);
  const submission=JSON.parse(submissionRaw);
  const product=JSON.parse(productRaw);
  const manifest=JSON.parse(manifestRaw);

  assert.equal(submission.version,product.version);
  assert.equal(manifest.Version,product.version);
  assert.equal(Number(submission.price_usd),0);
  assert.equal(Number(product.price_usd),0);
  assert.equal(submission.slug,product.id);
  assert.equal(submission.name,product.name);
  assert.equal(submission.type,"plugin");
  assert.ok(submission.description.trim().length>0);
  assert.ok(Array.from(submission.description).length<=1500,`description is ${Array.from(submission.description).length} characters`);

  const releaseNotes=String(submission.release_notes).split(/\r?\n/).filter(Boolean);
  assert.ok(releaseNotes.length>=3&&releaseNotes.length<=6);
  assert.ok(releaseNotes.every(line=>line.startsWith("- ")));

  assert.equal(submission.media.gallery.length,4);
  assert.equal(submission.marketplace_auto_publish,false);
  assert.ok(submission.marketplace_operating_systems.includes("Windows"));
  assert.equal(submission.bundled_profiles.device_types.length,5);
  assert.deepEqual(submission.bundled_profiles.device_types.map(x=>x.device_type),[0,1,2,7,9]);
  assert.equal(manifest.Profiles.length,5);

  assert.equal(product.workflow_state,"TESTING");
  assert.equal(product.blocker_kind,"fresh_lite_release_qa");
  assert.equal(product.upgrade_url,null);
  assert.equal(product.upgrade_url_state,"deferred_until_verified_direct_pro_listing");
  assert.equal(product.upsell_release_gate.required_before_public_lite_launch,false);
  assert.equal(submission.pro_marketplace_url,null);
  assert.match(submission.pro_url_policy,/Optional post-launch upgrade link/);

  assert.deepEqual(product.limits,{recording_seconds:30,events:60,input:"keyboard only"});
  assert.match(submission.description,/30 seconds and 60 keyboard events/);
  assert.match(submission.description,/Macro Recorder Pro adds mouse recording/);
  assert.ok(Array.isArray(submission.limitations)&&submission.limitations.length>=2);

  for(const name of ["01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png"]){
    assert.ok(ratArt.includes(name),`Rat Art adapter missing ${name}`);
  }
});
