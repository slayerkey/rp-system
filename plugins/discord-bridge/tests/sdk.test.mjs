import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

async function text(relative) {
  return fs.readFile(path.join(root, relative), "utf8");
}

async function exists(relative) {
  try {
    await fs.access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

test("Voice Bridge uses the official Stream Deck v2 SDK and SDKVersion 3", async () => {
  const pkg = JSON.parse(await text("package.json"));
  const manifest = JSON.parse(await text("com.packrat.discord-bridge.sdPlugin/manifest.json"));
  const source = await text("src/plugin.js");

  assert.equal(pkg.dependencies?.["@elgato/streamdeck"], "2.1.2");
  assert.equal(manifest.SDKVersion, 3);
  assert.equal(manifest.Nodejs?.Version, "24");
  assert.equal(manifest.Software?.MinimumVersion, "7.3");
  assert.equal(manifest.Version, "1.0.0.0");

  assert.match(source, /from "@elgato\/streamdeck"/);
  assert.match(source, /extends SingletonAction/);
  assert.match(source, /streamDeck\.actions\.registerAction/);
  assert.match(source, /streamDeck\.system\.onSystemDidWakeUp/);
  assert.match(source, /await streamDeck\.connect\(\)/);

  assert.doesNotMatch(source, /streamDeck\.settings\.getGlobalSettings/);
  assert.doesNotMatch(source, /streamDeck\.settings\.setGlobalSettings/);
  assert.doesNotMatch(source, /streamkitAccessToken/);
  assert.match(source, /tokenPersistence: "memory_only"/);
  assert.match(source, /let sessionAccessToken = ""/);

  assert.doesNotMatch(source, /EventEmitter/);
  assert.doesNotMatch(source, /-pluginUUID/);
  assert.doesNotMatch(source, /registerEvent/);
  assert.doesNotMatch(source, /didReceiveGlobalSettings/);
  assert.doesNotMatch(source, /showAlert/);
});

test("obsolete Discord fallback implementations are removed", async () => {
  for (const relative of [
    "src/hotkeys.js",
    "src/oauth.js",
    "src/streamkit-edge.js",
    "scripts/build-streamkit.mjs",
    "tests/hotkeys.test.mjs",
    "tests/oauth.test.mjs",
    "tests/streamkit.test.mjs",
  ]) {
    assert.equal(await exists(relative), false, `${relative} should not ship in the release source tree`);
  }
});

test("Marketplace-facing Voice Bridge branding stays trademark-safe", async () => {
  const manifestText = await text("com.packrat.discord-bridge.sdPlugin/manifest.json");
  const manifest = JSON.parse(manifestText);
  const submissionText = await text("submission.json");
  const submission = JSON.parse(submissionText);
  const ratArt = await text("rat-art.ps1");
  const publicCopy = [manifestText, submissionText, ratArt].join("\n");

  assert.equal(manifest.Name, "Discord Voice Bridge");
  assert.equal(manifest.Category, "Discord Voice Bridge");
  assert.equal(submission.name, "Discord Voice Bridge");
  assert.equal(submission.price_usd, 0);
  assert.equal(submission.marketplace_auto_publish, false);
  assert.match(submission.description, /independent third-party product/);
  assert.match(submission.description, /not affiliated with, endorsed by, or sponsored by Discord Inc\./);

  for (const forbidden of ["PackRat Discord Bridge", "Discord Voice Panel", "PackRat PackRat"] ) {
    assert.equal(publicCopy.includes(forbidden), false, `legacy marketplace product name remains: ${forbidden}`);
  }
  assert.equal(ratArt.includes("FromArgb(88, 101, 242)"), false, "Discord brand blurple should not be used as the Marketplace art accent");
});
