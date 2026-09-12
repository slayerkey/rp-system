import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const exe = path.resolve(process.argv[2] || "");
const entry = path.resolve(process.argv[3] || "widgets/window-manager-xeneon/index.html");
const outDir = path.resolve(process.argv[4] || "artifacts/window-manager-xeneon-bridge");
const baseUrl = "http://127.0.0.1:17487";
await fs.mkdir(outDir, { recursive: true });

if (!exe || !(await exists(exe))) throw new Error("Window Bridge executable missing");
if (!(await exists(entry))) throw new Error("packaged widget entry missing");

function exists(file) {
  return fs.access(file).then(() => true).catch(() => false);
}

let child = null;
const childLogs = [];

async function startBridge(extraArgs = []) {
  if (child) throw new Error("bridge already running");
  child = spawn(exe, ["--fixture", "--no-browser", ...extraArgs], {
    env: { ...process.env, PACKRAT_WINDOW_BRIDGE_TEST: "1" },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => childLogs.push("OUT " + chunk.toString()));
  child.stderr.on("data", (chunk) => childLogs.push("ERR " + chunk.toString()));
  child.on("exit", (code, signal) => childLogs.push(`EXIT code=${code} signal=${signal}`));

  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(baseUrl + "/health", { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Window Bridge fixture did not become healthy");
}

async function stopBridge() {
  if (!child) return;
  const current = child;
  child = null;
  try { current.kill(); } catch {}
  await Promise.race([
    new Promise((resolve) => current.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  try { if (!current.killed) current.kill("SIGKILL"); } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const browser = await chromium.launch({ headless: true });
const report = {
  exactEntry: entry,
  focus: false,
  minimize: false,
  maximizeRestore: false,
  snap: false,
  moveMonitor: false,
  safeClose: false,
  restartRecovery: false,
  badKeyRejected: false,
  protocolMismatch: false,
  pageErrors: [],
  consoleErrors: [],
};

try {
  await startBridge();

  const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
  await context.addInitScript(() => {
    globalThis.bridgeKey = "window-fixture-key";
    globalThis.showPinned = true;
    globalThis.showIcons = true;
    globalThis.textColor = "#F4F6F8";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#080B0F";
    globalThis.icueEvents = {};
    globalThis.tr = async (value) => value;
  });

  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(String(error?.stack || error)));
  page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });

  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_WINDOW_TEST__) && document.body.getAttribute("data-connection") === "live", { timeout: 15000 });

  let state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
  assert.equal(state.windows.length, 6, "real bridge fixture window count");
  assert.equal(state.monitors.length, 4, "real bridge fixture monitor count");
  assert.equal(state.activeWindowId, "102", "real bridge fixture active window");

  await page.locator('[data-window-id="103"]').click();
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().activeWindowId === "103");
  report.focus = true;

  await page.locator("#minimizeAction").click();
  await page.waitForFunction(() => {
    const s = globalThis.__PACKRAT_WINDOW_TEST__.getState();
    return s.activeWindowId === null && s.windows.find((w) => w.id === "103")?.state === "minimized";
  });
  report.minimize = true;

  await page.locator("#maximizeAction").click();
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.find((w) => w.id === "103")?.state === "maximized");
  report.maximizeRestore = true;

  await page.locator("#snapLeftAction").click();
  await page.locator("#snapRightAction").click();
  await page.waitForTimeout(250);
  state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
  assert.equal(state.windows.find((w) => w.id === "103")?.state, "normal", "snap should normalize fixture window");
  report.snap = true;

  await page.locator("#moveAction").click();
  await page.locator('[data-monitor-id="MONITOR-4"]').click();
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.find((w) => w.id === "103")?.monitorId === "MONITOR-4");
  report.moveMonitor = true;

  await page.locator("#closeAction").click();
  assert.equal(await page.locator("#closeSheet").getAttribute("aria-hidden"), "false", "safe-close sheet missing");
  await page.locator("#cancelClose").click();
  assert.equal((await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState())).windows.length, 6, "cancel close mutated state");
  await page.locator("#closeAction").click();
  await page.locator("#confirmClose").click();
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.length === 5);
  report.safeClose = true;

  await stopBridge();
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "disconnected", { timeout: 10000 });
  await startBridge();
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "live" && globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.length === 6, { timeout: 15000 });
  report.restartRecovery = true;

  const badContext = await browser.newContext({ viewport: { width: 840, height: 696 } });
  await badContext.addInitScript(() => {
    globalThis.bridgeKey = "definitely-wrong-key";
    globalThis.showPinned = true;
    globalThis.showIcons = true;
    globalThis.textColor = "#F4F6F8";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#080B0F";
    globalThis.icueEvents = {};
    globalThis.tr = async (value) => value;
  });
  const badPage = await badContext.newPage();
  await badPage.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await badPage.waitForFunction(() => document.body.getAttribute("data-connection") === "denied", { timeout: 10000 });
  await badPage.waitForTimeout(1200);
  assert.equal(await badPage.evaluate(() => document.body.getAttribute("data-connection")), "denied", "bad pairing state was overwritten after socket close");
  assert.match(await badPage.locator("#emptyTitle").innerText(), /REJECTED/, "bad pairing key did not render persistent rejection");
  report.badKeyRejected = true;
  await badContext.close();

  await stopBridge();
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "disconnected", { timeout: 10000 });
  await startBridge(["--fixture-protocol", "2"]);
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "version_mismatch", { timeout: 15000 });
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => document.body.getAttribute("data-connection")), "version_mismatch", "protocol mismatch state was overwritten after socket close");
  assert.match(await page.locator("#emptyTitle").innerText(), /UPDATE NEEDED/, "protocol mismatch copy missing");
  report.protocolMismatch = true;

  await page.screenshot({ path: path.join(outDir, "exact-package-real-bridge.png") });
  await context.close();

  assert.deepEqual(report.pageErrors, [], "page errors: " + report.pageErrors.join(" | "));
  assert.deepEqual(report.consoleErrors, [], "console errors: " + report.consoleErrors.join(" | "));
} finally {
  await stopBridge();
  await browser.close();
  await fs.writeFile(path.join(outDir, "bridge-integration-result.json"), JSON.stringify(report, null, 2) + "\n");
  await fs.writeFile(path.join(outDir, "bridge-process.log"), childLogs.join("") + "\n");
}

assert.equal(Object.entries(report).filter(([key, value]) => typeof value === "boolean" && key !== "exactEntry").every(([, value]) => value), true, "not every bridge integration assertion passed");
console.log("WINDOW MANAGER BRIDGE INTEGRATION PASS: exact file package, auth, focus/minimize/maximize/snap/move/safe-close, restart recovery, bad-key rejection and protocol mismatch");
