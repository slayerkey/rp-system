import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const repoRoot=new URL("../../",root);

test("Lite Pro upsell matches canonical PackRat catalog routing",async()=>{
  const [mapRaw,productRaw,submissionRaw,html,js,build]=await Promise.all([
    readFile(new URL("products/lite-pro-map.json",repoRoot),"utf8"),
    readFile(new URL("products/macro-recorder-lite.json",repoRoot),"utf8"),
    readFile(new URL("plugins/macro-recorder-lite/submission.json",repoRoot),"utf8"),
    readFile(new URL("ui/inspector.html",root),"utf8"),
    readFile(new URL("ui/inspector.js",root),"utf8"),
    readFile(new URL("scripts/build-assets.mjs",root),"utf8")
  ]);
  const map=JSON.parse(mapRaw);
  const product=JSON.parse(productRaw);
  const submission=JSON.parse(submissionRaw);
  const pair=map.pairs.find(item=>item.lite_id==="macro-recorder-lite");
  assert.ok(pair,"Macro Recorder Lite/Pro pair must be registered");
  assert.equal(pair.pro_id,"macro-recorder-pro");

  const match=html.match(/data-pro-url="([^"]*)"/);
  assert.ok(match,"Lite PI must expose a canonical Pro URL slot");
  const piUrl=match[1]||"";
  const canonical=pair.pro_marketplace_url||null;

  assert.equal(product.upgrade_url,canonical);
  assert.equal(submission.pro_marketplace_url,canonical);

  assert.equal(piUrl,"","source PI keeps the URL slot blank; build injects the canonical catalog URL");
  if(canonical){
    assert.match(canonical,/^https:\/\/marketplace\.elgato\.com\/product\/[a-z0-9-]+$/i);
  }else{
    assert.equal(product.upgrade_url_state,"withheld_until_verified_direct_pro_listing");
    assert.notEqual(product.workflow_state,"READY_TO_SHIP","Lite cannot be READY_TO_SHIP without the verified direct Pro Marketplace URL");
  }

  assert.match(build,/lite-pro-map\.json/);
  assert.match(build,/pro_marketplace_url/);
  assert.match(build,/data-pro-url/);
  assert.match(build,/marketplace\\\.elgato\\\.com\\\/product/);
  assert.match(js,/event:"openUrl"/);
  assert.match(js,/marketplace\\\.elgato\\\.com\\\/product/);
  assert.doesNotMatch(html,/marketplace\.elgato\.com\/(search|@|maker|creator)/i);
});
