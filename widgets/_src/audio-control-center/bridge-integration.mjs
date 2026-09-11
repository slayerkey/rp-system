import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const executable = path.resolve(process.argv[2]);
const entry = path.resolve(process.argv[3]);

function startBridge() {
  return spawn(executable, ["--fixture"], {
    env: {
      ...process.env,
      PACKRAT_AUDIO_BRIDGE_TEST: "1"
    },
    stdio: "ignore",
    windowsHide: true
  });
}

async function stopBridge(process) {
  if (!process || process.exitCode !== null) return;
  process.kill();
  await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]);
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:17484/health");
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("PackRat Audio Bridge health endpoint timed out");
}

async function state() {
  const response = await fetch("http://127.0.0.1:17484/state");
  assert.equal(response.ok, true, "bridge /state failed");
  return response.json();
}

let bridge = startBridge();
await waitForHealth();

const forbiddenOrigin = await fetch("http://127.0.0.1:17484/health", {
  headers: { Origin: "https://evil.example" }
});
assert.equal(forbiddenOrigin.status, 403, "remote origin was not rejected");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 840, height: 696 } });
const errors = [];

page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

try {
  await page.addInitScript(() => {
    globalThis.tr = async (value) => value;
    globalThis.icueEvents = {};
  });

  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => (
    document.body.dataset.connection === "ready" &&
    globalThis.__PACKRAT_AUDIO_TEST__?.getState().outputs.length >= 2
  ), { timeout: 10000 });

  await page.locator('.device[title="Headphones (Arctis Nova Pro)"]').click();
  await page.waitForFunction(() => (
    globalThis.__PACKRAT_AUDIO_TEST__.getState().defaultOutputId === "out-headset"
  ));
  assert.equal((await state()).defaultOutputId, "out-headset");

  await page.locator("#outputMute").click();
  await page.waitForFunction(() => (
    globalThis.__PACKRAT_AUDIO_TEST__.getState()
      .outputs.find((value) => value.id === "out-headset")?.muted === true
  ));
  assert.equal(
    (await state()).outputs.find((value) => value.id === "out-headset").muted,
    true
  );

  await page.locator("#inputVolume").evaluate((element) => {
    element.value = "44";
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => (
    globalThis.__PACKRAT_AUDIO_TEST__.getState()
      .inputs.find((value) => value.id === "in-main")?.volume === 44
  ));
  assert.equal(
    (await state()).inputs.find((value) => value.id === "in-main").volume,
    44
  );

  await stopBridge(bridge);

  await page.waitForFunction(() => (
    document.body.dataset.connection === "offline"
  ), { timeout: 6000 });

  bridge = startBridge();
  await waitForHealth();

  await page.waitForFunction(() => (
    document.body.dataset.connection === "ready" &&
    globalThis.__PACKRAT_AUDIO_TEST__.getState().outputs.length >= 2
  ), { timeout: 8000 });

  assert.deepEqual(errors, []);
  console.log(
    "PACKRAT AUDIO REAL BRIDGE INTEGRATION PASS: local security, commands, process loss, reconnect"
  );
} finally {
  await browser.close();
  await stopBridge(bridge);
}
