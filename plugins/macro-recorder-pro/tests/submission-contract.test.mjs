import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("Pro submission matches registry and Marketplace contract",async()=>{
  const [submissionRaw,productRaw,manifestRaw]=await Promise.all([
    readFile(new URL("submission.json",root),"utf8"),
    readFile(new URL("products/macro-recorder-pro.json",repoRoot),"utf8"),
    readFile(new URL("com.packrat.macro-recorder-pro.sdPlugin/manifest.json",root),"utf8")
  ]);
  const submission=JSON.parse(submissionRaw);
  const product=JSON.parse(productRaw);
  const manifest=JSON.parse(manifestRaw);

  assert.equal(submission.version,product.version);
  assert.equal(manifest.Version,product.version);
  assert.equal(Number(submission.price_usd),Number(product.price_usd));
  assert.equal(submission.product_name,product.name);
  assert.ok(submission.description.trim().length>0);
  assert.ok(Array.from(submission.description).length<=1500,`description is ${Array.from(submission.description).length} characters`);
  assert.ok(Array.isArray(submission.release_notes));
  assert.ok(submission.release_notes.length>=3&&submission.release_notes.length<=6);
  assert.equal(submission.media.gallery.length,3);
  assert.equal(submission.bundled_profiles.device_types.length,4);
  assert.deepEqual(submission.bundled_profiles.device_types.map(x=>x.device_type),[0,2,7,9]);
  assert.equal(manifest.Profiles.length,4);
  assert.equal(product.workflow_state,"TESTING");
  assert.equal(product.native_release_gate,"docs/MACRO_RECORDER_NATIVE_GATE.json");
  assert.ok(Array.isArray(submission.limitations)&&submission.limitations.length>=2);
  assert.equal(submission.pro_marketplace_url,null);
});
