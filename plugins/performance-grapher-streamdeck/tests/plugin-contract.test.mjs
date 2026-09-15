import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("plugin action UUIDs exactly match the manifest action UUIDs", async () => {
  const [plugin, manifestRaw] = await Promise.all([
    readFile(resolve(root, "src", "plugin.js"), "utf8"),
    readFile(resolve(root, "com.packrat.performance-grapher.sdPlugin", "manifest.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const sourceIds = [...plugin.matchAll(/\b(?:graph|fps|session|metric|alert):\s*"([^"]+)"/g)].map((match) => match[1]);
  const manifestIds = manifest.Actions.map((action) => action.UUID);

  assert.equal(sourceIds.length, 5);
  assert.deepEqual(new Set(sourceIds), new Set(manifestIds));
});

test("PerformanceAction assigns manifestId before registering every action", async () => {
  const plugin = await readFile(resolve(root, "src", "plugin.js"), "utf8");
  assert.match(plugin, /constructor\(manifestId, kind\)\s*\{\s*super\(\);\s*this\.manifestId\s*=\s*manifestId;/s);
  assert.match(plugin, /for \(const \[kind, manifestId\] of Object\.entries\(ACTIONS\)\)\s*\{\s*streamDeck\.actions\.registerAction\(new PerformanceAction\(manifestId, kind\)\);/s);
});

test("manifest action category and plugin identity remain canonical", async () => {
  const manifest = JSON.parse(await readFile(
    resolve(root, "com.packrat.performance-grapher.sdPlugin", "manifest.json"),
    "utf8",
  ));
  assert.equal(manifest.UUID, "com.packrat.performance-grapher");
  assert.equal(manifest.Name, "Performance Grapher for Stream Deck");
  assert.equal(manifest.Category, "Performance Grapher");
  assert.equal(manifest.Actions.length, 5);
});
