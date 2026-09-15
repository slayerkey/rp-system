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


test("Performance Grapher stays standalone and is not invented as a Lite to Pro pair", async () => {
  const [indexRaw, mapRaw] = await Promise.all([
    readFile(resolve(repoRoot, "products", "index.json"), "utf8"),
    readFile(resolve(repoRoot, "products", "lite-pro-map.json"), "utf8"),
  ]);
  const index = JSON.parse(indexRaw);
  const map = JSON.parse(mapRaw);

  const streamDeck = index.products.filter((item) => item.id === "performance-grapher-streamdeck");
  const xeneon = index.products.filter((item) => item.id === "perf-grapher");
  const editionPairs = (map.pairs || []).filter((pair) =>
    pair.lite_id === "performance-grapher-streamdeck" ||
    pair.pro_id === "performance-grapher-streamdeck"
  );

  assert.equal(streamDeck.length, 1);
  assert.equal(streamDeck[0].type, "plugin");
  assert.equal(streamDeck[0].price_usd, 9.99);
  assert.equal(xeneon.length, 1);
  assert.equal(xeneon[0].type, "widget");
  assert.equal(xeneon[0].status, "published");
  assert.equal(editionPairs.length, 0);
});
