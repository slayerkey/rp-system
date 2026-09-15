import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("Lite keeps the canonical Pro relationship without requiring a launch-time upsell URL",async()=>{
  const [mapRaw,productRaw,submissionRaw,html,build]=await Promise.all([
    readFile(new URL("products/lite-pro-map.json",repoRoot),"utf8"),
    readFile(new URL("products/macro-recorder-lite.json",repoRoot),"utf8"),
    readFile(new URL("plugins/macro-recorder-lite/submission.json",repoRoot),"utf8"),
    readFile(new URL("ui/inspector.html",root),"utf8"),
    readFile(new URL("scripts/build-assets.mjs",root),"utf8")
  ]);
  const map=JSON.parse(mapRaw);
  const product=JSON.parse(productRaw);
  const submission=JSON.parse(submissionRaw);
  const pair=map.pairs.find(item=>item.lite_id==="macro-recorder-lite");

  assert.ok(pair,"Macro Recorder Lite/Pro pair must stay registered");
  assert.equal(pair.pro_id,"macro-recorder-pro");
  assert.equal(product.upgrade_url,null);
  assert.equal(submission.pro_marketplace_url,null);
  assert.equal(product.upgrade_url_state,"deferred_until_verified_direct_pro_listing");
  assert.equal(pair.launch_sequence,"Lite may launch standalone. Add the verified direct Pro product URL in a later Lite update.");
  assert.doesNotMatch(html,/marketplace\.elgato\.com\/product\//i);
  assert.doesNotMatch(build,/pro_marketplace_url/);
  assert.doesNotMatch(build,/data-pro-url/);
});

test("a future Pro upsell must still use a verified direct Marketplace product URL",async()=>{
  const map=JSON.parse(await readFile(new URL("products/lite-pro-map.json",repoRoot),"utf8"));
  const pair=map.pairs.find(item=>item.lite_id==="macro-recorder-lite");
  if(pair.pro_marketplace_url){
    assert.match(pair.pro_marketplace_url,/^https:\/\/marketplace\.elgato\.com\/product\/[a-z0-9-]+$/i);
  }
});
