#!/usr/bin/env node
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/security/verify-contractor-intake.mjs <submission.json>");
  process.exit(2);
}

const input = JSON.parse(fs.readFileSync(file, "utf8"));

const ALLOWED_KEYS = new Set([
  "schema_version",
  "assignment_id",
  "builder_id",
  "sku",
  "product_slug",
  "product_type",
  "source_repository",
  "source_commit",
  "pull_request",
  "workflow_run",
  "artifact_sha256"
]);

const SECRETISH = /(secret|token|password|passwd|private[_-]?key|cookie|credential|session)/i;

function fail(message) {
  console.error(`CONTRACTOR INTAKE REJECTED: ${message}`);
  process.exit(1);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function requiredString(name, pattern) {
  const value = input[name];
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${name} is invalid`);
  }
}

if (!input || typeof input !== "object" || Array.isArray(input)) fail("root must be an object");
if (input.schema_version !== 1) fail("schema_version must be 1");

for (const key of Object.keys(input)) {
  if (!ALLOWED_KEYS.has(key)) fail(`unexpected field: ${key}`);
  if (SECRETISH.test(key)) fail(`secret-like field is forbidden: ${key}`);
}

requiredString("assignment_id", /^asg_[a-z0-9][a-z0-9_-]{2,79}$/);
requiredString("builder_id", /^ctr_[a-z0-9][a-z0-9_-]{1,63}$/);
requiredString("sku", /^[A-Z0-9][A-Z0-9._-]{2,79}$/);
requiredString("product_slug", /^[a-z0-9][a-z0-9-]{1,79}$/);
if (!["plugin", "widget"].includes(input.product_type)) fail("product_type must be plugin or widget");
requiredString("source_repository", /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
requiredString("source_commit", /^[a-f0-9]{40}$/);
requiredString("artifact_sha256", /^[a-f0-9]{64}$/);

for (const field of ["pull_request", "workflow_run"]) {
  if (!Number.isSafeInteger(input[field]) || input[field] <= 0) fail(`${field} must be a positive integer`);
}

const canonical = canonicalize(input);
process.stdout.write(JSON.stringify(canonical));
