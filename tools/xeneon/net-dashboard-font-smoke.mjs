#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/net-dashboard-font";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node net-dashboard-font-smoke.mjs <exact-package-index.html> [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const original = fs.readFileSync(entry, "utf8");
const requiredKeys = ["system", "bahnschriftSemi", "bahnschrift", "segoe", "arial", "consolas"];
for (const key of requiredKeys) {
  if (!original.includes(`'${key}'`)) throw new Error(`fontChoice metadata missing ${key}`);
}

const harness = `<script id="ratpack-net-font-harness">
let fontChoice = "consolas";
let uniqueId = "ratpack-net-font-smoke";
globalThis.tr = async function(value){ return value; };
globalThis.__setNetFont = function(value){ fontChoice = String(value); };
</script>`;
const instrumented = original.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const temp = path.join(path.dirname(path.resolve(entry)), "__ratpack-net-font-instrumented.html");
fs.writeFileSync(temp, instrumented, "utf8");

const report = { schema_version: 1, entry: path.basename(entry), passed: false };
let exitCode = 0;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 840, height: 344 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(pathToFileURL(temp).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(globalThis.__netDashboardFontTest && globalThis.__ratpackIcueBindingBridge), null, { timeout: 10_000 });
  await page.waitForFunction(() => document.body?.getAttribute("data-font") === "consolas", null, { timeout: 5_000 });

  report.initial = await page.evaluate(() => ({
    bridge: globalThis.__ratpackIcueBindingBridge,
    font: document.body.getAttribute("data-font"),
    family: getComputedStyle(document.body).fontFamily,
    read: globalThis.__netDashboardFontTest.read(),
    normalized: globalThis.__netDashboardFontTest.normalize("consolas")
  }));
  if (report.initial.bridge?.version !== 2 || report.initial.bridge?.mode !== "direct-binding") throw new Error(`direct-binding bridge missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.font !== "consolas" || !/Consolas/i.test(report.initial.family)) throw new Error(`Consolas not applied: ${JSON.stringify(report.initial)}`);

  // Real-iCUE regression: lexical binding changes without onDataUpdated.
  await page.evaluate(() => globalThis.__setNetFont("arial"));
  await page.waitForFunction(() => document.body?.getAttribute("data-font") === "arial", null, { timeout: 3_000 });
  report.liveArial = await page.evaluate(() => ({
    font: document.body.getAttribute("data-font"),
    family: getComputedStyle(document.body).fontFamily,
    read: globalThis.__netDashboardFontTest.read()
  }));
  if (!/Arial/i.test(report.liveArial.family)) throw new Error(`Arial did not apply live: ${JSON.stringify(report.liveArial)}`);

  await page.evaluate(() => globalThis.__setNetFont("bahnschriftSemi"));
  await page.waitForFunction(() => document.body?.getAttribute("data-font") === "bahnschriftSemi", null, { timeout: 3_000 });
  report.liveBahnschriftSemi = await page.evaluate(() => ({
    font: document.body.getAttribute("data-font"),
    family: getComputedStyle(document.body).fontFamily,
    read: globalThis.__netDashboardFontTest.read()
  }));
  if (!/Bahnschrift SemiBold SemiCondensed/i.test(report.liveBahnschriftSemi.family)) throw new Error(`Bahnschrift SemiBold SemiCondensed did not apply live: ${JSON.stringify(report.liveBahnschriftSemi)}`);

  await page.evaluate(() => globalThis.__setNetFont("not-a-font"));
  await page.waitForFunction(() => document.body?.getAttribute("data-font") === "system", null, { timeout: 3_000 });
  report.invalidFallback = await page.evaluate(() => ({
    font: document.body.getAttribute("data-font"),
    normalized: globalThis.__netDashboardFontTest.normalize("not-a-font")
  }));
  if (report.invalidFallback.font !== "system") throw new Error(`invalid font did not fall back to system: ${JSON.stringify(report.invalidFallback)}`);

  report.pageErrors = pageErrors;
  if (pageErrors.length) throw new Error(`runtime page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, "network-dashboard-font.png") });
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "net-dashboard-font-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(temp); } catch {}
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
