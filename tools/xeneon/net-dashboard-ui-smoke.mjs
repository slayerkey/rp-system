#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/net-dashboard-ui";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node net-dashboard-ui-smoke.mjs <index.html> [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const original = fs.readFileSync(entry, "utf8");
const harness = `<script id="ratpack-net-ui-harness">
let probeHosts = "";
let probeInterval = 10;
let warnAt = 100;
let customHeader = "MY NETWORK";
let headerTitleSize = 130;
let hostTextSize = 22;
let textColor = "#F4F6F8";
let accentColor = "#2BE86A";
let backgroundColor = "#07090D";
let transparency = 35;
let uniqueId = "ratpack-network-ui-smoke";
globalThis.tr = async function(value){ return value; };
globalThis.__setNetworkUi = function(next) {
  if (next.probeHosts !== undefined) probeHosts = String(next.probeHosts);
  if (next.probeInterval !== undefined) probeInterval = Number(next.probeInterval);
  if (next.warnAt !== undefined) warnAt = Number(next.warnAt);
  if (next.customHeader !== undefined) customHeader = String(next.customHeader);
  if (next.headerTitleSize !== undefined) headerTitleSize = Number(next.headerTitleSize);
  if (next.hostTextSize !== undefined) hostTextSize = Number(next.hostTextSize);
  if (next.textColor !== undefined) textColor = String(next.textColor);
  if (next.accentColor !== undefined) accentColor = String(next.accentColor);
  if (next.backgroundColor !== undefined) backgroundColor = String(next.backgroundColor);
  if (next.transparency !== undefined) transparency = Number(next.transparency);
};
</script>`;
const instrumented = original.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
const temp = path.join(path.dirname(path.resolve(entry)), "__ratpack-net-ui-instrumented.html");
fs.writeFileSync(temp, instrumented, "utf8");

const report = { schema_version: 3, entry: path.basename(entry), passed: false };
let exitCode = 0;
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 840, height: 344 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(pathToFileURL(temp).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(() => Boolean(globalThis.__netDashboardUiTest && globalThis.icueEvents), null, { timeout: 10_000 });
  await page.waitForFunction(() => document.getElementById("networkHeaderTitle")?.textContent === "MY NETWORK", null, { timeout: 5_000 });

  report.initial = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const panel = getComputedStyle(document.getElementById("hostsPanel"));
    const title = document.getElementById("networkHeaderTitle");
    const topbar = document.getElementById("networkTopbar").getBoundingClientRect();
    const metrics = document.getElementById("metrics").getBoundingClientRect();
    return {
      header: title?.textContent,
      ribbonHeader: document.getElementById("ribbonEyebrow")?.textContent,
      headerScale: root.getPropertyValue("--net-header-scale").trim(),
      headerPx: parseFloat(getComputedStyle(title).fontSize),
      hostSize: root.getPropertyValue("--net-user-host-size").trim(),
      backgroundFactor: root.getPropertyValue("--net-background-factor").trim(),
      text: root.getPropertyValue("--text").trim(),
      accent: root.getPropertyValue("--accent").trim(),
      background: root.getPropertyValue("--bg").trim(),
      panelBackground: panel.backgroundColor,
      panelOpacity: panel.opacity,
      topbarAboveMetrics: topbar.bottom <= metrics.top + 1,
      slot: document.body.getAttribute("data-slot")
    };
  });
  if (report.initial.header !== "MY NETWORK") throw new Error(`product header missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.ribbonHeader !== "LATENCY HISTORY") throw new Error(`custom header still replaced ribbon label: ${JSON.stringify(report.initial)}`);
  if (Math.abs(Number(report.initial.headerScale) - 1.30) > 0.001) throw new Error(`header scale setting missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.hostSize !== "22px") throw new Error(`host size setting missing: ${JSON.stringify(report.initial)}`);
  if (Math.abs(Number(report.initial.backgroundFactor) - 0.35) > 0.001) throw new Error(`background opacity setting missing: ${JSON.stringify(report.initial)}`);
  if (report.initial.panelOpacity !== "1" || /rgba\([^)]*,\s*0(?:\.0+)?\)/i.test(report.initial.panelBackground)) throw new Error(`dashboard panel became transparent: ${JSON.stringify(report.initial)}`);
  if (!report.initial.topbarAboveMetrics) throw new Error(`product header overlaps metrics: ${JSON.stringify(report.initial)}`);
  if (report.initial.slot !== "s-h") throw new Error(`small composition not detected: ${JSON.stringify(report.initial)}`);

  // Critical real-iCUE regression: mutate lexical bindings and DO NOT call
  // icueEvents.onDataUpdated. The widget itself must detect and repaint them.
  await page.evaluate(() => {
    globalThis.__setNetworkUi({
      customHeader: "OFFICE NET",
      headerTitleSize: 170,
      hostTextSize: 18,
      transparency: 70,
      textColor: "#FFF4D6",
      accentColor: "#FFB84D",
      backgroundColor: "#140C06"
    });
  });
  await page.waitForFunction(() => {
    const root = getComputedStyle(document.documentElement);
    return document.getElementById("networkHeaderTitle")?.textContent === "OFFICE NET"
      && Math.abs(Number(root.getPropertyValue("--net-header-scale")) - 1.70) < 0.001
      && root.getPropertyValue("--net-user-host-size").trim() === "18px"
      && Math.abs(Number(root.getPropertyValue("--net-background-factor")) - 0.70) < 0.001
      && root.getPropertyValue("--accent").trim().toLowerCase() === "#ffb84d";
  }, null, { timeout: 3_000 });

  report.updatedWithoutCallback = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const panel = getComputedStyle(document.getElementById("ribbonPanel"));
    const title = document.getElementById("networkHeaderTitle");
    const topbar = document.getElementById("networkTopbar").getBoundingClientRect();
    const metrics = document.getElementById("metrics").getBoundingClientRect();
    return {
      header: title?.textContent,
      ribbonHeader: document.getElementById("ribbonEyebrow")?.textContent,
      headerScale: root.getPropertyValue("--net-header-scale").trim(),
      headerPx: parseFloat(getComputedStyle(title).fontSize),
      hostSize: root.getPropertyValue("--net-user-host-size").trim(),
      backgroundFactor: root.getPropertyValue("--net-background-factor").trim(),
      text: root.getPropertyValue("--text").trim(),
      accent: root.getPropertyValue("--accent").trim(),
      background: root.getPropertyValue("--bg").trim(),
      panelBackground: panel.backgroundColor,
      panelOpacity: panel.opacity,
      topbarAboveMetrics: topbar.bottom <= metrics.top + 1
    };
  });
  if (report.updatedWithoutCallback.header !== "OFFICE NET") throw new Error(`live header update failed without callback: ${JSON.stringify(report.updatedWithoutCallback)}`);
  if (report.updatedWithoutCallback.ribbonHeader !== "LATENCY HISTORY") throw new Error(`ribbon label changed with product header: ${JSON.stringify(report.updatedWithoutCallback)}`);
  if (Math.abs(Number(report.updatedWithoutCallback.headerScale) - 1.70) > 0.001 || report.updatedWithoutCallback.headerPx <= report.initial.headerPx) throw new Error(`live header size update failed without callback: ${JSON.stringify(report.updatedWithoutCallback)}`);
  if (!report.updatedWithoutCallback.topbarAboveMetrics) throw new Error(`larger header overlaps metrics: ${JSON.stringify(report.updatedWithoutCallback)}`);
  if (report.updatedWithoutCallback.hostSize !== "18px") throw new Error(`live host size update failed without callback: ${JSON.stringify(report.updatedWithoutCallback)}`);
  if (Math.abs(Number(report.updatedWithoutCallback.backgroundFactor) - 0.70) > 0.001) throw new Error(`live background update failed without callback: ${JSON.stringify(report.updatedWithoutCallback)}`);
  if (report.updatedWithoutCallback.panelOpacity !== "1" || /rgba\([^)]*,\s*0(?:\.0+)?\)/i.test(report.updatedWithoutCallback.panelBackground)) throw new Error(`panel transparency leaked after update: ${JSON.stringify(report.updatedWithoutCallback)}`);

  // Simulate leaving and returning to the XENEON dashboard page. Values must stay
  // stable and must not wait for a page transition to become visible.
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await page.waitForTimeout(300);
  report.afterPageReturn = await page.evaluate(() => ({
    header: document.getElementById("networkHeaderTitle")?.textContent,
    headerScale: getComputedStyle(document.documentElement).getPropertyValue("--net-header-scale").trim(),
    hostSize: getComputedStyle(document.documentElement).getPropertyValue("--net-user-host-size").trim(),
    backgroundFactor: getComputedStyle(document.documentElement).getPropertyValue("--net-background-factor").trim()
  }));
  if (report.afterPageReturn.header !== "OFFICE NET" || Math.abs(Number(report.afterPageReturn.headerScale) - 1.70) > 0.001 || report.afterPageReturn.hostSize !== "18px") throw new Error(`settings did not persist through page return: ${JSON.stringify(report.afterPageReturn)}`);

  report.pageErrors = pageErrors;
  if (pageErrors.length) throw new Error(`runtime page errors: ${JSON.stringify(pageErrors)}`);
  await page.screenshot({ path: path.join(outDir, "network-dashboard-small-live-settings.png") });
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "net-dashboard-ui-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(temp); } catch {}
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);