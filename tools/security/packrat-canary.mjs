#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const provenancePath = process.argv[2];
const outDir = process.argv[3];

if (!provenancePath || !outDir) {
  console.error("Usage: node tools/security/packrat-canary.mjs <provenance.json> <out-dir>");
  process.exit(2);
}

const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
if (!provenance.provenance_id || !provenance.descriptor_sha256 || !provenance.descriptor) {
  throw new Error("Expected a PackRat provenance manifest");
}

const seed = crypto
  .createHash("sha256")
  .update("packrat-canary-v1\0", "utf8")
  .update(String(provenance.provenance_id), "utf8")
  .update("\0", "utf8")
  .update(String(provenance.descriptor_sha256), "utf8")
  .digest();

const embeddedToken = "PKR1-" + seed.subarray(0, 10).toString("hex").toUpperCase();

const OPENERS = [
  "Built for", "Designed for", "Tuned for", "Made for",
  "Created for", "Shaped for", "Focused on", "Optimized for"
];
const SETUP = [
  "quick setup", "simple setup", "fast setup", "low-friction setup",
  "straightforward setup", "clean setup", "easy setup", "direct setup"
];
const SIGNAL = [
  "clear feedback", "at-a-glance feedback", "readable feedback", "clean feedback",
  "immediate feedback", "focused feedback", "useful feedback", "consistent feedback"
];
const DAILY = [
  "everyday control", "daily control", "repeat use", "regular use",
  "day-to-day use", "daily workflows", "everyday workflows", "routine use"
];
const ENDINGS = [
  "without extra clutter", "without unnecessary friction", "with a clean workflow", "with predictable behavior",
  "with a focused workflow", "with dependable behavior", "without getting in the way", "with a simple workflow"
];

const pick = (arr, byte) => arr[byte % arr.length];
const marketingPhrase =
  `${pick(OPENERS, seed[10])} ${pick(SETUP, seed[11])}, ${pick(SIGNAL, seed[12])}, and ${pick(DAILY, seed[13])} ${pick(ENDINGS, seed[14])}.`;

const machine = {
  schema_version: 1,
  packrat_build_marker: embeddedToken,
  provenance_id: provenance.provenance_id,
  descriptor_sha256: provenance.descriptor_sha256,
  product_slug: provenance.descriptor.product_slug,
  sku: provenance.descriptor.sku,
  purpose: "Non-behavioral PackRat build provenance marker. No telemetry, customer data, or phone-home behavior."
};

const marketing = {
  schema_version: 1,
  packrat_build_marker: embeddedToken,
  exact_listing_canary_sentence: marketingPhrase,
  instructions: "Include this sentence verbatim once in the Marketplace long description. It is a searchable corroborating canary, not a secret or ownership guarantee."
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "PACKRAT-PROVENANCE.json"), JSON.stringify(machine, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "MARKETING-CANARY.json"), JSON.stringify(marketing, null, 2) + "\n");
fs.writeFileSync(path.join(outDir, "MARKETING-CANARY.txt"), marketingPhrase + "\n");

console.log(JSON.stringify({ embedded_token: embeddedToken, marketing_phrase: marketingPhrase }));
