#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2] || "products/index.json";
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const products = Array.isArray(data.products) ? data.products : [];

const violations = products.filter((p) =>
  String(p?.status || "").toLowerCase() === "idea" ||
  String(p?.type || "").toLowerCase() === "idea"
);

if (violations.length) {
  console.error("Public products/index.json must not contain unreleased idea/roadmap records.");
  for (const p of violations) {
    console.error(`- ${p.id || "(missing id)"}: ${p.name || "(missing name)"}`);
  }
  console.error("Store unreleased roadmap/commercial intelligence in PackRat-private infrastructure instead.");
  process.exit(1);
}

console.log(`PUBLIC PRODUCT INDEX POLICY PASS: ${products.length} non-idea records`);
