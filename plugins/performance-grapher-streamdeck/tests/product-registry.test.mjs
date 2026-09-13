import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pluginRoot = resolve(import.meta.dirname, "..");
const repoRoot = resolve(pluginRoot, "..", "..");

test("Performance Grapher is registered exactly once in the PackRat product index", async () => {
  const [indexRaw, productRaw] = await Promise.all([
    readFile(resolve(repoRoot, "products", "index.json"), "utf8"),
    readFile(resolve(repoRoot, "products", "performance-grapher-streamdeck.json"), "utf8"),
  ]);
  const index = JSON.parse(indexRaw);
  const product = JSON.parse(productRaw);
  const matches = index.products.filter((item) => item.id === product.id);

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0], {
    id: product.id,
    name: product.name,
    type: product.type,
    status: product.status,
    price_usd: product.price_usd,
    version: product.version,
  });
});
