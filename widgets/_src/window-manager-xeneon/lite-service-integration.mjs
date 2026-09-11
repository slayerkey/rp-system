import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { startWindowManagerXeneonService } from "../../../shared/window-manager-xeneon-service/service.mjs";

const entry = path.resolve(process.argv[2] || "widgets/window-manager-xeneon/index.html");
const outDir = path.resolve(process.argv[3] || "artifacts/window-manager-xeneon-lite-service");
const pairingKey = "window-manager-lite-fixture-key-123456";
await fs.mkdir(outDir, { recursive: true });

function fixtureState() {
  return {
    activeWindowId: "102",
    monitors: [
      { id: "MONITOR-1", name: "Main Display", width: 2560, height: 1440, primary: true },
      { id: "MONITOR-2", name: "Side Display", width: 1920, height: 1080, primary: false },
      { id: "MONITOR-3", name: "Portrait", width: 1080, height: 1920, primary: false },
      { id: "MONITOR-4", name: "Studio Ultrawide", width: 3440, height: 1440, primary: false },
    ],
    windows: [
      { id: "101", appKey: "browser", appName: "Browser", processName: "browser", title: "Creator Dashboard — Analytics", state: "normal", monitorId: "MONITOR-1", iconDataUri: "" },
      { id: "102", appKey: "editor", appName: "Editor", processName: "editor", title: "window-manager-xeneon — rp-system", state: "maximized", monitorId: "MONITOR-1", iconDataUri: "" },
      { id: "103", appKey: "terminal", appName: "Terminal", processName: "terminal", title: "PackRat build output", state: "normal", monitorId: "MONITOR-2", iconDataUri: "" },
      { id: "104", appKey: "mail", appName: "Mail", processName: "mail", title: "Support inbox — 7 unread", state: "normal", monitorId: "MONITOR-2", iconDataUri: "" },
      { id: "105", appKey: "music", appName: "Music", processName: "music", title: "Focus Mix", state: "minimized", monitorId: "MONITOR-1", iconDataUri: "" },
      { id: "106", appKey: "notes", appName: "Notes", processName: "notes", title: "<b>not markup</b> — 日本語 🎮 gyqp", state: "normal", monitorId: "MONITOR-4", iconDataUri: "" },
    ],
  };
}

function createBackend() {
  let state = fixtureState();
  const subscribers = new Set();
  const commands = [];

  function emit() {
    for (const callback of [...subscribers]) callback();
  }

  return {
    snapshot() {
      return structuredClone(state);
    },
    async execute({ command, windowId, monitorId }) {
      commands.push({ command, windowId, monitorId });
      const window = state.windows.find((item) => String(item.id) === String(windowId));
      if (!window) throw new Error("Window is no longer available.");

      if (command === "focus") {
        if (window.state === "minimized") window.state = "normal";
        state.activeWindowId = window.id;
      } else if (command === "minimize") {
        window.state = "minimized";
        if (state.activeWindowId === window.id) state.activeWindowId = null;
      } else if (command === "maximize_restore") {
        window.state = window.state === "maximized" ? "normal" : "maximized";
        state.activeWindowId = window.id;
      } else if (command === "snap_left" || command === "snap_right") {
        window.state = "normal";
        window.layout = command === "snap_left" ? "left" : "right";
        state.activeWindowId = window.id;
      } else if (command === "move_monitor") {
        if (!state.monitors.some((monitor) => String(monitor.id) === String(monitorId))) {
          throw new Error("Monitor is no longer available.");
        }
        window.monitorId = String(monitorId);
        state.activeWindowId = window.id;
      } else if (command === "close") {
        state.windows = state.windows.filter((item) => item.id !== window.id);
        if (state.activeWindowId === window.id) state.activeWindowId = null;
      } else {
        throw new Error("Unknown window command.");
      }

      emit();
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    reset() {
      state = fixtureState();
      commands.length = 0;
      emit();
    },
    getCommandLog() {
      return structuredClone(commands);
    },
  };
}

let backend = createBackend();
let service = null;

async function startService(protocol = 1) {
  if (service) throw new Error("Lite service already running");
  service = await startWindowManagerXeneonService({
    backend,
    pairingKey,
    pluginVersion: "lite-test-1.0.0",
    port: 17487,
    protocol,
    reconcileMs: 5000,
    debounceMs: 50,
  });
  const health = await fetch("http://127.0.0.1:17487/health").then((response) => response.json());
  assert.equal(health.product, "PackRat Window Manager Lite");
  assert.equal(health.service, "xeneon-window-manager");
}

async function stopService() {
  if (!service) return;
  const current = service;
  service = null;
  await current.close();
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const browser = await chromium.launch({ headless: true });
const report = {
  exactEntry: entry,
  serviceIdentity: false,
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

function initSettings(key) {
  return {
    key,
  };
}

try {
  await startService();
  report.serviceIdentity = true;

  const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
  const settings = initSettings(pairingKey);
  await context.addInitScript(({ key }) => {
    globalThis.bridgeKey = key;
    globalThis.showPinned = true;
    globalThis.showIcons = true;
    globalThis.textColor = "#F4F6F8";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#080B0F";
    globalThis.icueEvents = {};
    globalThis.tr = async (value) => value;
  }, settings);

  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(String(error?.stack || error)));
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });

  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_WINDOW_TEST__) && document.body.getAttribute("data-connection") === "live", { timeout: 15000 });

  let state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
  assert.equal(state.windows.length, 6);
  assert.equal(state.monitors.length, 4);
  assert.equal(state.activeWindowId, "102");

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
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.find((w) => w.id === "103")?.state === "normal");
  assert.equal(backend.getCommandLog().some((item) => item.command === "snap_left" && item.windowId === "103"), true);
  await page.locator("#snapRightAction").click();
  for (let i = 0; i < 40 && !backend.getCommandLog().some((item) => item.command === "snap_right" && item.windowId === "103"); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(backend.getCommandLog().some((item) => item.command === "snap_right" && item.windowId === "103"), true);
  report.snap = true;

  await page.locator("#moveAction").click();
  await page.locator('[data-monitor-id="MONITOR-4"]').click();
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.find((w) => w.id === "103")?.monitorId === "MONITOR-4");
  report.moveMonitor = true;

  await page.locator("#closeAction").click();
  assert.equal(await page.locator("#closeSheet").getAttribute("aria-hidden"), "false");
  await page.locator("#cancelClose").click();
  assert.equal((await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState())).windows.length, 6);
  await page.locator("#closeAction").click();
  await page.locator("#confirmClose").click();
  await page.waitForFunction(() => globalThis.__PACKRAT_WINDOW_TEST__.getState().windows.length === 5);
  report.safeClose = true;

  backend.reset();
  await stopService();
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "disconnected", { timeout: 10000 });
  await startService();
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
  await badPage.waitForTimeout(1000);
  assert.match(await badPage.locator("#emptyTitle").innerText(), /REJECTED/);
  report.badKeyRejected = true;
  await badContext.close();

  await stopService();
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "disconnected", { timeout: 10000 });
  await startService(2);
  await page.waitForFunction(() => document.body.getAttribute("data-connection") === "version_mismatch", { timeout: 15000 });
  await page.waitForTimeout(1000);
  assert.match(await page.locator("#emptyTitle").innerText(), /UPDATE NEEDED/);
  report.protocolMismatch = true;

  await page.screenshot({ path: path.join(outDir, "exact-package-lite-service.png") });
  await context.close();

  assert.deepEqual(report.pageErrors, [], "page errors: " + report.pageErrors.join(" | "));
  assert.deepEqual(report.consoleErrors, [], "console errors: " + report.consoleErrors.join(" | "));
} finally {
  await stopService();
  await browser.close();
  await fs.writeFile(path.join(outDir, "lite-service-integration-result.json"), JSON.stringify(report, null, 2) + "\n");
}

for (const [key, value] of Object.entries(report)) {
  if (typeof value === "boolean") assert.equal(value, true, `${key} did not pass`);
}

console.log("WINDOW MANAGER LITE SERVICE INTEGRATION PASS: exact XENEON package, Lite service identity, auth, focus/minimize/maximize/snap/move/safe-close, restart recovery, bad-key rejection and protocol mismatch");
