#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error("Usage: node tools/security/packrat-provenance.mjs <validated-intake.json> <provenance.json>");
  process.exit(2);
}

const key = process.env.PACKRAT_PROVENANCE_KEY;
const keyId = process.env.PACKRAT_PROVENANCE_KEY_ID || "unversioned";

if (!key || Buffer.byteLength(key, "utf8") < 32) {
  console.error("PACKRAT_PROVENANCE_KEY must be supplied by private build infrastructure and be at least 32 bytes.");
  process.exit(1);
}

const descriptor = JSON.parse(fs.readFileSync(inputPath, "utf8"));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, canonicalize(value[k])])
    );
  }
  return value;
}

const canonicalDescriptor = JSON.stringify(canonicalize(descriptor));
const descriptorSha256 = crypto
  .createHash("sha256")
  .update(canonicalDescriptor)
  .digest("hex");

const hmac = crypto
  .createHmac("sha256", key)
  .update("packrat-provenance-v1\0", "utf8")
  .update(canonicalDescriptor, "utf8")
  .digest("hex");

const manifest = {
  schema_version: 1,
  provenance_id: `PRV1-${hmac.slice(0, 40).toUpperCase()}`,
  hmac_key_id: keyId,
  descriptor_sha256: descriptorSha256,
  descriptor: canonicalize(descriptor)
};

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", {
  encoding: "utf8",
  mode: 0o600
});

console.log(manifest.provenance_id);
