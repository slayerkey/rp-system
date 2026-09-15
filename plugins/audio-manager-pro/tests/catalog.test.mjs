import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const productRoot = resolve(here, "..");
const repoRoot = resolve(productRoot, "..", "..");

function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifest = json(resolve(productRoot, "com.packrat.audio-manager-pro.sdPlugin", "manifest.json"));
const submission = json(resolve(productRoot, "submission.json"));
const ratDev = json(resolve(productRoot, "rat-dev.json"));
const product = json(resolve(repoRoot, "products", "audio-manager-pro.json"));
const index = json(resolve(repoRoot, "products", "index.json"));
const editionMap = json(resolve(repoRoot, "products", "lite-pro-map.json"));
const roster = index.products.find((entry) => entry.id === "audio-manager-pro");
const inspectorSource = readFileSync(resolve(productRoot, "ui", "inspector.js"), "utf8");
const inspectorHtml = readFileSync(resolve(productRoot, "ui", "inspector.html"), "utf8");
const inspectorCss = readFileSync(resolve(productRoot, "ui", "inspector.css"), "utf8");
const buildSource = readFileSync(resolve(productRoot, "scripts", "build.mjs"), "utf8");
const pluginSource = readFileSync(resolve(productRoot, "src", "plugin.js"), "utf8");

test("Audio Manager intentionally ships without bundled Stream Deck profiles", () => {
  assert.equal(Object.hasOwn(manifest, "Profiles"), false);
  assert.equal(existsSync(resolve(productRoot, "com.packrat.audio-manager-pro.sdPlugin", "profiles")), false);
});

test("Audio Manager is not inventing a Lite-to-Pro relationship or unrelated Marketplace upsell", () => {
  const pairs = Array.isArray(editionMap.pairs) ? editionMap.pairs : [];
  assert.equal(pairs.some((pair) => pair.lite_id === "audio-manager-pro" || pair.pro_id === "audio-manager-pro"), false);
  assert.equal(/marketplace\.elgato\.com\/product\//i.test(submission.description), false);
  assert.equal(/upgrade\s+to\s+audio\s+manager|audio\s+manager\s+lite/i.test(submission.description), false);
});

test("Audio Manager catalog price and version stay consistent", () => {
  assert.ok(roster);
  assert.equal(product.price_usd, 9.99);
  assert.equal(submission.price_usd, 9.99);
  assert.equal(roster.price_usd, 9.99);
  assert.equal(product.version, "1.0.0.0");
  assert.equal(submission.version, "1.0.0.0");
  assert.equal(manifest.Version, "1.0.0.0");
  assert.equal(roster.version, "1.0.0.0");
});

test("Audio Manager canonical catalog paths and product identity stay aligned", () => {
  assert.equal(product.type, "plugin");
  assert.equal(product.source, "plugins/audio-manager-pro");
  assert.equal(product.submission_metadata, "plugins/audio-manager-pro/submission.json");
  assert.equal(manifest.UUID, "com.packrat.audio-manager-pro");
  assert.equal(submission.slug, "audio-manager-pro");
  assert.equal(manifest.Name, "Audio Manager Pro");
  assert.equal(submission.name, "Audio Manager Pro");
});

test("Audio Manager declares that Rat Dev may defer the .NET SDK prerequisite to its private bootstrap", () => {
  assert.equal(ratDev.build_prerequisites?.dotnet_sdk, "self-managed");
});


test("Audio Manager Property Inspector keeps UI and action contexts distinct", () => {
  assert.match(inspectorSource, /context:uiUuid/);
  assert.match(inspectorSource, /actionContext/);
  assert.match(inspectorSource, /requestId:nextRequestId\(\)/);
  assert.doesNotMatch(inspectorSource, /context:ctx/);
  assert.match(pluginSource, /streamDeck\.ui\.onSendToPlugin/);
  assert.match(pluginSource, /recordForInspectorEvent/);
  assert.match(pluginSource, /acceptInspectorRequest/);
  assert.match(pluginSource, /streamDeck\.ui\.sendToPropertyInspector/);
  assert.doesNotMatch(pluginSource, /record\.action\.sendToPropertyInspector/);
});


test("Audio Manager Property Inspector follows the canonical PackRat visual system", () => {
  assert.match(inspectorHtml, /id="brandLink"/);
  assert.match(inspectorHtml, /packrat-logo\\.png/);
  assert.match(inspectorSource, /https:\/\/marketplace\.elgato\.com\/maker\/packrat/);
  assert.match(inspectorCss, /--packrat-bg:#080A0E/i);
  assert.match(inspectorCss, /--packrat-accent:#FFB21E/i);
  assert.match(inspectorCss, /body::before/);
  assert.match(inspectorCss, /button\.secondary/);
  assert.match(inspectorCss, /button\.danger/);
  assert.doesNotMatch(inspectorCss, /button\{background:#366b58/i);
  assert.match(buildSource, /packrat-logo\\.png/);
});

test("Audio Manager listing follows current PackRat standalone paid conventions", () => {
  assert.equal(submission.marketplace_auto_publish, true);
  assert.match(submission.description, /Part of the Packrat Ecosystem\.$/);
  assert.match(submission.headline, /Switch your entire audio setup with one key\./);
  assert.equal(submission.marketplace_operating_systems?.includes("Windows"), true);
});

test("Audio Manager stays on the current PackRat Stream Deck runtime baseline", () => {
  assert.equal(manifest.Author, "PackRat");
  assert.equal(manifest.SDKVersion, 3);
  assert.equal(manifest.Nodejs?.Version, "24");
  assert.equal(Object.hasOwn(manifest.Nodejs || {}, "Debug"), false);
  assert.equal(manifest.Software?.MinimumVersion, "7.3");
  assert.equal(manifest.OS?.[0]?.Platform, "windows");
  assert.equal(manifest.OS?.[0]?.MinimumVersion, "10");
  assert.equal(manifest.Actions?.length, 7);
  assert.equal(new Set(manifest.Actions.map((action) => action.UUID)).size, 7);
});
