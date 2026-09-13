import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("com.packrat.internet-health-pro.sdPlugin/manifest.json", "utf8"));
const pluginSource = fs.readFileSync("src/plugin.js", "utf8");
const probesSource = fs.readFileSync("src/probes.js", "utf8");
const submission = JSON.parse(fs.readFileSync("submission.json", "utf8"));

test("manifest exposes exactly the seven planned actions", () => {
  assert.equal(manifest.UUID, "com.packrat.internet-health-pro");
  assert.equal(manifest.Actions.length, 7);
  const ids = manifest.Actions.map((action) => action.UUID);
  for (const suffix of ["health","latency","jitter-loss","outage","target","speed-test","summary"]) {
    assert.ok(ids.includes("com.packrat.internet-health-pro." + suffix));
  }
});

test("plugin process instantiates one shared NetworkMonitor", () => {
  assert.equal((pluginSource.match(/new NetworkMonitor\s*\(/g) || []).length, 1);
  assert.equal((pluginSource.match(/setInterval\s*\(/g) || []).length, 0);
});

test("speed test stays manual and transfer-capped in source and marketplace copy", () => {
  assert.match(probesSource, /8_000_000/);
  assert.match(probesSource, /2_000_000/);
  assert.match(submission.description, /manual only/i);
  assert.match(submission.description, /10 MB/i);
});

test("marketplace positioning is Internet Health, not a generic speed-test launcher", () => {
  assert.equal(submission.price_usd, 7.99);
  assert.equal(submission.headline, "Know when your internet is the problem.");
  assert.match(submission.description, /GOOD, DEGRADED, BAD, or OFFLINE/);
  assert.match(submission.description, /no PackRat telemetry/i);
});

test("global settings changes read the SDK event payload shape", () => {
  assert.match(pluginSource, /ev\?\.payload\?\.settings/);
  assert.doesNotMatch(pluginSource, /normalizeGlobalSettings\(ev\?\.settings/);
});
