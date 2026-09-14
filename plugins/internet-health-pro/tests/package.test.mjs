import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("com.packrat.internet-health-pro.sdPlugin/manifest.json", "utf8"));
const pluginSource = fs.readFileSync("src/plugin.js", "utf8");
const probesSource = fs.readFileSync("src/probes.js", "utf8");
const renderSource = fs.readFileSync("src/render.js", "utf8");
const inspectorSource = fs.readFileSync("ui/inspector.js", "utf8");
const submission = JSON.parse(fs.readFileSync("submission.json", "utf8"));
const product = JSON.parse(fs.readFileSync("../../products/internet-health-pro.json", "utf8"));

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

test("speed test stays manual, warmed and transfer-capped in source and marketplace copy", () => {
  assert.match(probesSource, /256_000_000/);
  assert.match(probesSource, /16_000_000/);
  assert.match(probesSource, /warmed-adaptive-multistream/);
  assert.match(submission.description, /manual only/i);
  assert.match(submission.description, /300 MB/i);
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


test("ship metadata stays version-consistent and release notes stay scannable", () => {
  assert.equal(manifest.Version, submission.version);
  assert.equal(product.version, submission.version);
  const bullets = String(submission.release_notes || "").split("\n").filter(Boolean);
  assert.ok(bullets.length >= 3 && bullets.length <= 6);
  assert.ok(bullets.every((line) => line.startsWith("- ")));
});

test("manifest asset references use extensionless Elgato paths", () => {
  const paths = [manifest.Icon, manifest.CategoryIcon];
  for (const action of manifest.Actions) {
    paths.push(action.Icon);
    for (const state of action.States || []) paths.push(state.Image);
  }
  assert.ok(paths.every((value) => typeof value === "string" && !/\.(?:png|svg)$/i.test(value)));
});


test("hardware-key typography prioritizes physical readability", () => {
  assert.match(renderSource, /font-size="16\.5"/);
  assert.match(renderSource, /fitFont\(primary, 38, 32, 25\)/);
  assert.match(renderSource, /fitFont\(secondary, 16, 14\.5, 13\)/);
  assert.match(renderSource, /label: "INTERNET"/);
  assert.match(renderSource, /label: "SPEED"/);
});

test("property inspector uses Monitor Manager's proven PI transport pattern", () => {
  assert.match(inspectorSource, /context: uiUuid/);
  assert.match(inspectorSource, /actionContext = String\(actionInfo\.context \|\| ""\)/);
  assert.doesNotMatch(inspectorSource, /context: actionContext/);
  assert.match(inspectorSource, /setInterval\(requestState, 1500\)/);
  assert.match(inspectorSource, /setSaveStatus\("Saved"\)/);
  assert.match(pluginSource, /streamDeck\.ui\.onSendToPlugin/);
  assert.match(pluginSource, /streamDeck\.ui\.sendToPropertyInspector/);
  assert.doesNotMatch(pluginSource, /record\.action\.sendToPropertyInspector/);
});


test("physical key graphs use a dedicated 30 second visual window", () => {
  assert.match(renderSource, /const KEY_GRAPH_SECONDS = 30/);
  assert.match(renderSource, /const windowMs = seconds \* 1000/);
  assert.match(renderSource, /graphPath\(samples, KEY_GRAPH_SECONDS, 116, hasFooter \? 29 : 40, 14, 94\)/);
  assert.doesNotMatch(renderSource, /graphPath\(samples, minutes/);
});


test("pre-release monitoring cadence migrates to five seconds", () => {
  assert.match(pluginSource, /intervalSeconds: 5, cadenceVersion: 1/);
  assert.match(pluginSource, /setGlobalSettings\(migrated\)/);
  assert.match(inspectorSource, /intervalSeconds: 5/);
  assert.match(inspectorSource, /number\("intervalSeconds", 5\)/);
});

test("speed key gives download and upload equal visual hierarchy", () => {
  assert.match(renderSource, /function speedResultSvg/);
  assert.match(renderSource, /const downSize = fitFont\(down, 36, 33, 29\)/);
  assert.match(renderSource, /const upSize = fitFont\(up, 36, 33, 29\)/);
  assert.match(renderSource, /font-size="\$\{downSize\}"/);
  assert.match(renderSource, /font-size="\$\{upSize\}"/);
  assert.doesNotMatch(renderSource, /PRESS TO RETEST/);
});
