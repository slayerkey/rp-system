import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const packagePath = process.argv[2];
const outputDir = process.argv[3] || "artifacts/streamspell";
const site = process.env.STREAMSPELL_URL || "https://icue-widgets.streamspell.com/";

if (!packagePath) {
  console.error("Usage: node tools/xeneon/streamspell.mjs <package.icuewidget> [output-dir]");
  process.exit(2);
}

if (!fs.existsSync(packagePath)) {
  console.error(`Package not found: ${packagePath}`);
  process.exit(2);
}

fs.mkdirSync(outputDir, { recursive: true });

const expectedPresets = [
  "XENEON_S_H",
  "XENEON_S_V",
  "XENEON_M_H",
  "XENEON_M_V",
  "XENEON_L_H",
  "XENEON_L_V",
  "XENEON_XL_H",
  "XENEON_XL_V",
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1250 } });
const consoleErrors = [];
const sandboxNetworkBlocks = [];

page.on("console", (msg) => {
  if (msg.type() !== "error") return;
  const text = msg.text();

  // StreamSpell deliberately injects connect-src 'none' into its sandboxed iframe.
  // Network widgets therefore cannot reach their providers in this independent
  // package preview unless the builder proxy is enabled. The proxy intentionally
  // does not forward arbitrary custom request headers, so it is not a faithful
  // provider test for widgets such as Helldivers. Classify only these builder-
  // induced outbound-network blocks as expected evidence. Product/provider
  // behavior belongs in deterministic fixtures; every other console error still
  // fails this packaged-widget gate.
  if (
    /violates the following Content Security Policy directive:\s*["']connect-src 'none'/i.test(text)
    || /Fetch API cannot load https?:\/\/\S+\. Refused to connect because it violates the document's Content Security Policy/i.test(text)
  ) {
    sandboxNetworkBlocks.push(text.slice(0, 320));
    return;
  }

  if (/CORS|Failed to load resource|net::ERR|Access to fetch/i.test(text)) return;
  consoleErrors.push(text.slice(0, 240));
});

let exitCode = 0;
const result = {
  site,
  package: path.basename(packagePath),
  validation: null,
  presets: [],
  consoleErrors,
  sandboxNetworkBlocks,
};

try {
  await page.goto(site, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector("#widgetFile", { timeout: 30_000 });

  // StreamSpell registers a Service Worker and may reload once before it can
  // serve uploaded widget assets. Uploading before the page is controlled can
  // strand loadWidgetFromUpload() on the builder's intentional reload promise,
  // leaving validation Idle and the preview iframe hidden.
  let previewReady = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      previewReady = await page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return false;
        const registration = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(() => resolve(null), 500)),
        ]);
        return Boolean(registration?.active && navigator.serviceWorker.controller);
      });
    } catch {
      // A first-run Service Worker reload can destroy this execution context.
      previewReady = false;
    }
    if (previewReady) break;
    await page.waitForTimeout(500);
  }
  if (!previewReady) {
    throw new Error("StreamSpell preview Service Worker did not become ready/control the page before upload.");
  }

  await page.setInputFiles("#widgetFile", packagePath);

  await page.waitForFunction(() => {
    const active = (document.getElementById("activeWidgetName")?.textContent || "").trim();
    const badge = (document.getElementById("validationBadge")?.textContent || "").trim();
    return Boolean(active) && Boolean(badge) && !/^idle$/i.test(badge);
  }, { timeout: 45_000 }).catch(() => {});

  await page.waitForTimeout(2_000);

  const info = await page.evaluate(() => {
    const txt = (id) => (document.getElementById(id)?.textContent || "").trim().replace(/\s+/g, " ");
    const options = Array.from(document.querySelectorAll("#viewportSelect option"))
      .map((option) => option.value)
      .filter(Boolean);
    return {
      badge: txt("validationBadge"),
      summary: txt("validationSummary"),
      details: txt("validationDetails"),
      status: txt("statusMessage"),
      active: txt("activeWidgetName"),
      options,
    };
  });

  result.validation = info;
  const badValidation = /invalid|error|fail/i.test(`${info.badge} ${info.summary}`);
  if (!info.active || /^idle$/i.test(info.badge) || badValidation) {
    exitCode = 1;
    throw new Error(
      "StreamSpell did not activate the uploaded package: active=\"" +
      (info.active || "(empty)") + "\", badge=\"" +
      (info.badge || "(empty)") + "\", summary=\"" +
      (info.summary || "(empty)") + "\"."
    );
  }

  const availablePresets = expectedPresets.filter((preset) => info.options.includes(preset));
  if (availablePresets.length !== expectedPresets.length) {
    const missing = expectedPresets.filter((preset) => !info.options.includes(preset));
    console.error(`Missing StreamSpell viewport presets: ${missing.join(", ")}`);
    exitCode = 1;
  }

  for (const preset of availablePresets) {
    await page.selectOption("#viewportSelect", preset);
    await page.waitForTimeout(900);

    const frame = page.locator("#widgetFrame");
    await frame.waitFor({ state: "visible", timeout: 15_000 });
    const screenshot = path.join(outputDir, `${preset}.png`);
    await frame.screenshot({ path: screenshot });

    const frameBox = await frame.boundingBox();
    result.presets.push({
      preset,
      screenshot: path.basename(screenshot),
      rendered: Boolean(frameBox && frameBox.width > 0 && frameBox.height > 0),
      width: frameBox?.width || 0,
      height: frameBox?.height || 0,
    });

    if (!frameBox || frameBox.width <= 0 || frameBox.height <= 0) exitCode = 1;
  }

  if (consoleErrors.length) exitCode = 1;
} catch (error) {
  result.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outputDir, "streamspell-result.json"), JSON.stringify(result, null, 2));
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(exitCode);
