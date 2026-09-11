import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const [beforeManifestArg, afterManifestArg, afterRootArg] = process.argv.slice(2);
if (!beforeManifestArg || !afterManifestArg || !afterRootArg) {
  console.error("Usage: node tools/qa/window-manager-lite-conversion-guard.mjs <before-manifest.json> <after-manifest.json> <after-plugin-root>");
  process.exit(2);
}

const beforeManifest = path.resolve(beforeManifestArg);
const afterManifest = path.resolve(afterManifestArg);
const afterRoot = path.resolve(afterRootArg);
const PRO_URL = "https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function visibleActions(manifest) {
  const actions = Array.isArray(manifest.Actions) ? manifest.Actions : [];
  return actions
    .filter((action) => action && action.VisibleInActionsList !== false)
    .map((action) => ({
      uuid: String(action.UUID || ""),
      name: String(action.Name || ""),
    }))
    .sort((a, b) => (a.uuid + "\0" + a.name).localeCompare(b.uuid + "\0" + b.name));
}

function walkText(root) {
  const chunks = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      chunks.push(...walkText(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(?:html|js|mjs|cjs|ts|tsx|json|md|txt)$/i.test(entry.name)) continue;
    try { chunks.push(fs.readFileSync(full, "utf8")); } catch {}
  }
  return chunks;
}

const before = readJson(beforeManifest);
const after = readJson(afterManifest);
const beforeVisible = visibleActions(before);
const afterVisible = visibleActions(after);

assert.ok(beforeVisible.length > 0, "baseline Lite manifest has no visible actions");
assert.deepEqual(
  afterVisible,
  beforeVisible,
  "Window Manager Lite visible action UUID/name set changed. XENEON backend work must not expand or shrink the visible Lite action surface."
);

const afterText = walkText(afterRoot).join("\n");
assert.ok(
  afterText.includes(PRO_URL),
  "Window Manager Pro Marketplace upsell URL disappeared from Window Manager Lite."
);

const servicePath = path.resolve("shared/window-manager-xeneon-service/service.mjs");
if (fs.existsSync(servicePath)) {
  const service = fs.readFileSync(servicePath, "utf8");
  for (const forbidden of [
    "child_process",
    "exec(",
    "execFile(",
    "spawn(",
    "powershell",
    "cmd.exe",
    "shell:",
    "registerAction",
    "VisibleInActionsList",
  ]) {
    assert.equal(
      service.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `hidden XENEON service contains forbidden Stream Deck/command surface: ${forbidden}`
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  visibleLiteActions: afterVisible,
  proUpsellPreserved: true,
  proUrl: PRO_URL,
}, null, 2));
