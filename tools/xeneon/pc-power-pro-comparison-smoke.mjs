#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/pc-power-pro-comparisons";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node pc-power-pro-comparison-smoke.mjs <index.html> [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(entry, "utf8");
if (/data-type=["']sensors-factory["']/i.test(html)) {
  throw new Error("PC Power Pro exact package still contains sensors-factory");
}
for (const name of ["comparisonSensor1", "comparisonSensor2", "comparisonSensor3"]) {
  if (!new RegExp(`content=["']${name}["'][^>]+data-type=["']sensors-combobox["']`, "i").test(html)) {
    throw new Error(`PC Power Pro is missing standard ${name} sensors-combobox`);
  }
}

const harness = `<script id="ratpack-power-comparison-harness">
let primarySensor = "psu-total";
let comparisonSensor1 = "cpu-package";
let comparisonColor1 = "#112233";
let comparisonSensor2 = "gpu-power";
let comparisonColor2 = "#445566";
let comparisonSensor3 = "psu-total";
let comparisonColor3 = "#778899";
let textColor = "#F4F6F8";
let accentColor = "#2BE86A";
let backgroundColor = "#070A0D";
let graphColor = "#2BE86A";
let electricityRate = 0.15;
let currencySymbol = "$";
let graphWindow = "180";
let highPowerThreshold = 0;
let uniqueId = "ratpack-power-pro-comparison";
globalThis.tr = async function(value){ return value; };
globalThis.iCUE = { isPreview: false };
globalThis.plugins = {};
</script>`;
const instrumented = html.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const temp = path.join(path.dirname(path.resolve(entry)), "__ratpack-power-comparison-instrumented.html");
fs.writeFileSync(temp, instrumented, "utf8");

const report = { schema_version: 1, passed: false };
let exitCode = 0;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 840, height: 344 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(pathToFileURL(temp).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(globalThis.__pcPowerProComparisonTest), null, { timeout: 5_000 });
  report.comparisons = await page.evaluate(() => globalThis.__pcPowerProComparisonTest.buildComparisonSensors());
  report.pageErrors = pageErrors;
  if (JSON.stringify(report.comparisons) !== JSON.stringify([
    { sensorId: "cpu-package", color: "#112233" },
    { sensorId: "gpu-power", color: "#445566" }
  ])) {
    throw new Error(`comparison adapter did not preserve selections/dedupe primary: ${JSON.stringify(report.comparisons)}`);
  }
  if (pageErrors.length) throw new Error(`runtime page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, "pc-power-pro-standard-comparison-controls.png") });
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "pc-power-pro-comparison-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(temp); } catch {}
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
