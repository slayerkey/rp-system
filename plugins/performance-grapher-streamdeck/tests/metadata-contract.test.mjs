import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pluginRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("submission, manifest, product metadata, and registry agree", async () => {
  const [submission, manifest, product, index] = await Promise.all([
    json(resolve(pluginRoot, "submission.json")),
    json(resolve(pluginRoot, "com.packrat.performance-grapher.sdPlugin", "manifest.json")),
    json(resolve(repoRoot, "products", "performance-grapher-streamdeck.json")),
    json(resolve(repoRoot, "products", "index.json")),
  ]);

  const registry = index.products.filter((item) => item.id === product.id);
  assert.equal(registry.length, 1);

  assert.equal(submission.slug, product.id);
  assert.equal(submission.name, product.name);
  assert.equal(submission.type, product.type);
  assert.equal(submission.price_usd, product.price_usd);
  assert.equal(submission.version, product.version);

  assert.equal(manifest.Name, product.name);
  assert.equal(manifest.Version, product.version);
  assert.equal(manifest.UUID, "com.packrat.performance-grapher");
  assert.equal(manifest.Actions.length, 5);

  assert.equal(registry[0].name, product.name);
  assert.equal(registry[0].price_usd, product.price_usd);
  assert.equal(registry[0].version, product.version);
});

test("Marketplace submission keeps required product disclosures", async () => {
  const submission = await json(resolve(pluginRoot, "submission.json"));
  assert.ok(submission.description.includes("PresentMon"));
  assert.ok(submission.description.includes("Libre Hardware Monitor"));
  assert.ok(submission.description.includes("Performance Log Users"));
  assert.ok(submission.description.includes("Sensor availability varies by hardware"));
  assert.ok(submission.description.includes("Part of the PackRat Ecosystem."));
  assert.deepEqual(submission.marketplace_operating_systems, ["Windows"]);
  assert.ok(submission.marketplace_category.includes("Gaming"));
  assert.ok(submission.marketplace_category.includes("Monitoring"));
  assert.ok(submission.marketplace_category.includes("Utilities"));
});
