import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("com.packrat.internet-health-pro.sdPlugin/manifest.json", "utf8"));
const pluginSource = fs.readFileSync("src/plugin.js", "utf8");
const probesSource = fs.readFileSync("src/probes.js", "utf8");
const renderSource = fs.readFileSync("src/render.js", "utf8");
const inspectorSource = fs.readFileSync("ui/inspector.js", "utf8");
const inspectorHtml = fs.readFileSync("ui/inspector.html", "utf8");
const inspectorCss = fs.readFileSync("ui/inspector.css", "utf8");
const packratLogo = fs.readFileSync("ui/packrat-logo.svg", "utf8");
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


test("canonical PackRat visual contract is applied without changing product semantics", () => {
  assert.match(inspectorCss, /--packrat-bg:\s*#080A0E/i);
  assert.match(inspectorCss, /--packrat-card-start:\s*#151920/i);
  assert.match(inspectorCss, /--packrat-card-end:\s*#0D1015/i);
  assert.match(inspectorCss, /--packrat-input:\s*#15191E/i);
  assert.match(inspectorCss, /--packrat-button:\s*#181C21/i);
  assert.match(inspectorCss, /--packrat-button-hover:\s*#22272E/i);
  assert.match(inspectorCss, /--packrat-border:\s*#303640/i);
  assert.match(inspectorCss, /--packrat-text:\s*#F5F7FB/i);
  assert.match(inspectorCss, /--packrat-muted:\s*#9AA2AF/i);
  assert.match(inspectorCss, /--packrat-accent:\s*#FFB21E/i);
  assert.match(inspectorCss, /body::before/);
  assert.match(inspectorCss, /rgba\(255,178,30,\.12\)/);
  assert.match(inspectorCss, /button\.secondary[\s\S]*var\(--packrat-button\)/);
  assert.match(inspectorHtml, /packrat-logo\.svg/);
  assert.match(inspectorHtml, /PackRat ↗/);
  assert.match(inspectorSource, /https:\/\/marketplace\.elgato\.com\/maker\/packrat/);
  assert.match(inspectorSource, /event:\s*"openUrl"/);
  assert.match(packratLogo, /<svg/);
  assert.match(packratLogo, /fill="white"/);

  assert.match(renderSource, /fill="#080A0E"/);
  assert.match(renderSource, /fill="#9AA2AF"/);
  assert.match(renderSource, /fill="#F5F7FB"/);
  assert.match(renderSource, /stroke="#303640"/);
  assert.match(renderSource, /fill="#FFB21E"/);

  for (const action of manifest.Actions) {
    const statePath = action.States?.[0]?.Image;
    assert.ok(statePath, "missing state image for " + action.UUID);
    const fallback = fs.readFileSync("com.packrat.internet-health-pro.sdPlugin/" + statePath + ".svg", "utf8");
    assert.match(fallback, /fill="#080A0E"/);
    assert.match(fallback, /fill="#FFB21E"/);
    assert.match(fallback, /fill="#F5F7FB"/);
  }
});

test("physical key graphs use a dedicated 30 second visual window", () => {
  assert.match(renderSource, /const KEY_GRAPH_SECONDS = 30/);
  assert.match(renderSource, /const windowMs = seconds \* 1000/);
  assert.match(renderSource, /graphPath\(samples, KEY_GRAPH_SECONDS, 116, hasFooter \? 29 : 40, 14, 94\)/);
  assert.doesNotMatch(renderSource, /graphPath\(samples, minutes/);
});


test("pre-release monitoring cadence migrates to one second", () => {
  assert.match(pluginSource, /intervalSeconds: 1, cadenceVersion: 2/);
  assert.match(pluginSource, /setGlobalSettings\(migrated\)/);
  assert.match(inspectorSource, /intervalSeconds: 1/);
  assert.match(inspectorSource, /number\("intervalSeconds", 1\)/);
});

test("speed key gives download and upload equal visual hierarchy", () => {
  assert.match(renderSource, /function speedResultSvg/);
  assert.match(renderSource, /const downSize = fitFont\(down, 36, 33, 29\)/);
  assert.match(renderSource, /const upSize = fitFont\(up, 36, 33, 29\)/);
  assert.match(renderSource, /font-size="\$\{downSize\}"/);
  assert.match(renderSource, /font-size="\$\{upSize\}"/);
  assert.doesNotMatch(renderSource, /PRESS TO RETEST/);
});


test("bundled major-model profiles are declared, generated and deterministic archives", () => {
  const expected = [
    ["internet-health-dashboard-mk2.streamDeckProfile", 0],
    ["internet-health-dashboard-xl.streamDeckProfile", 2],
    ["internet-health-dashboard-plus.streamDeckProfile", 7],
    ["internet-health-dashboard-neo.streamDeckProfile", 9],
  ];
  assert.equal(manifest.Profiles.length, expected.length);
  for (const [file, deviceType] of expected) {
    const entry = manifest.Profiles.find((profile) => profile.DeviceType === deviceType);
    assert.ok(entry, "missing DeviceType " + deviceType);
    assert.equal(entry.AutoInstall, true);
    assert.equal(entry.DontAutoSwitchWhenInstalled, true);
    assert.equal(entry.Readonly, false);
    const full = "com.packrat.internet-health-pro.sdPlugin/" + entry.Name + ".streamDeckProfile";
    assert.equal(fs.existsSync(full), true, "missing profile " + full);
    const buffer = fs.readFileSync(full);
    assert.equal(buffer.subarray(0, 2).toString("ascii"), "PK");
    assert.equal(file, entry.Name.split("/").pop() + ".streamDeckProfile");
  }
});


test("one second is the default cadence while five seconds remains available", () => {
  assert.match(inspectorSource, /const allowed = \[1,5,10,15,30,60\]/);
  assert.match(inspectorHtml, /value="1">1 second \(default\)<\/option>/);
  assert.match(inspectorHtml, /value="5">5 seconds<\/option>/);
  assert.match(inspectorHtml, /1 second is the default/);
});


test("outage key uses a clipped-safe dedicated layout", () => {
  assert.match(renderSource, /function outageSvg/);
  assert.match(renderSource, /font-size="15\.5"[^>]*>OUTAGE<\/text>/);
  assert.match(renderSource, /fitFont\(secondary, 14, 12\.5, 11\)/);
  assert.match(renderSource, /secondary = "ACTIVE"/);
  assert.match(renderSource, /secondary = "LAST 24H"/);
  assert.match(renderSource, /return outageSvg\(primary, secondary, state, settings\.accent, snapshot\.samples\)/);
});
