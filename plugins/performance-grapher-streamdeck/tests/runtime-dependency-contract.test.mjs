import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("package-lock production runtime graph is complete and license-declared", async () => {
  const [packageRaw, lockRaw] = await Promise.all([
    readFile(resolve(root, "package.json"), "utf8"),
    readFile(resolve(root, "package-lock.json"), "utf8"),
  ]);
  const pkg = JSON.parse(packageRaw);
  const lock = JSON.parse(lockRaw);
  const queue = Object.keys(pkg.dependencies || {});
  const seen = new Set();
  const resolved = [];

  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = lock.packages?.["node_modules/" + name];
    assert.ok(entry, "Runtime dependency missing from package-lock: " + name);
    assert.ok(entry.version, "Runtime dependency missing version: " + name);
    assert.ok(entry.integrity, "Runtime dependency missing integrity hash: " + name);
    assert.ok(entry.license, "Runtime dependency missing license declaration: " + name);
    resolved.push(name + "@" + entry.version);
    for (const child of [
      ...Object.keys(entry.dependencies || {}),
      ...Object.keys(entry.optionalDependencies || {}),
    ]) {
      queue.push(child);
    }
  }

  assert.deepEqual(resolved.sort(), [
    "@elgato/schemas@0.4.16",
    "@elgato/streamdeck@2.1.2",
    "@elgato/utils@0.6.0",
    "ws@8.21.3",
    "zod@3.25.76",
  ]);
  assert.ok(resolved.every((key) => lock.packages["node_modules/" + key.replace(/@[^@]+$/, "")]?.license === "MIT"));
});

test("build invokes the runtime npm license inventory before packaging", async () => {
  const build = await readFile(resolve(root, "scripts", "build.mjs"), "utf8");
  const inventoryAt = build.indexOf('scripts", "npm-license-inventory.mjs');
  const presentMonAt = build.indexOf("await fetchPresentMon()");
  assert.ok(inventoryAt >= 0, "Build must invoke npm license inventory.");
  assert.ok(presentMonAt > inventoryAt, "License inventory must run before build packaging completes.");
});
