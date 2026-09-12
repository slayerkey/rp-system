import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = path.resolve(process.argv[2] || "widgets/_src/window-manager-xeneon/index.html");
const artifactDir = path.resolve(process.argv[3] || "artifacts/window-manager-xeneon-visual");
await fs.mkdir(artifactDir, { recursive: true });

const slots = [
  { id: "s-h", width: 840, height: 344, minTouch: 58 },
  { id: "s-v", width: 696, height: 416, minTouch: 58 },
  { id: "m-h", width: 840, height: 696, minTouch: 72 },
  { id: "m-v", width: 696, height: 840, minTouch: 72 },
  { id: "l-h", width: 1688, height: 696, minTouch: 82 },
  { id: "l-v", width: 696, height: 1688, minTouch: 80 },
  { id: "xl-h", width: 2536, height: 696, minTouch: 86 },
  { id: "xl-v", width: 696, height: 2536, minTouch: 82 },
];

function dataIcon(label) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#334155"/><text x="32" y="40" text-anchor="middle" fill="white" font-family="Arial" font-size="24">${label}</text></svg>`)}`;
}

function snapshot() {
  return {
    type: "snapshot",
    protocol: 1,
    activeWindowId: "102",
    monitors: [
      { id: "MONITOR-1", name: "Main Display", width: 2560, height: 1440, primary: true },
      { id: "MONITOR-2", name: "Side Display", width: 1920, height: 1080, primary: false },
      { id: "MONITOR-3", name: "Portrait", width: 1080, height: 1920, primary: false },
      { id: "MONITOR-4", name: "Studio Ultrawide", width: 3440, height: 1440, primary: false },
    ],
    windows: [
      { id: "101", appKey: "browser", appName: "Browser", processName: "browser", title: "Creator Dashboard — Analytics", state: "normal", monitorId: "MONITOR-1", iconDataUri: dataIcon("B") },
      { id: "102", appKey: "editor", appName: "Editor", processName: "editor", title: "window-manager-xeneon — rp-system", state: "maximized", monitorId: "MONITOR-1", iconDataUri: dataIcon("E") },
      { id: "103", appKey: "terminal", appName: "Terminal", processName: "terminal", title: "PackRat build output", state: "normal", monitorId: "MONITOR-2", iconDataUri: dataIcon(">") },
      { id: "104", appKey: "mail", appName: "Mail", processName: "mail", title: "Support inbox — 7 unread", state: "normal", monitorId: "MONITOR-2", iconDataUri: dataIcon("M") },
      { id: "105", appKey: "music", appName: "Music", processName: "music", title: "Focus Mix", state: "minimized", monitorId: "MONITOR-1", iconDataUri: dataIcon("♪") },
      { id: "106", appKey: "notes", appName: "Notes", processName: "notes", title: "<b>not markup</b> — 日本語 🎮 gyqp descenders", state: "normal", monitorId: "MONITOR-4", iconDataUri: "https://example.invalid/remote-icon.png" },
    ],
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const slot of slots) {
    const context = await browser.newContext({ viewport: { width: slot.width, height: slot.height } });
    await context.addInitScript((value) => {
      globalThis.bridgeKey = "fixture-key";
      globalThis.showPinned = true;
      globalThis.showIcons = true;
      globalThis.textColor = "#F4F6F8";
      globalThis.accentColor = "#2BE86A";
      globalThis.backgroundColor = "#080B0F";
      globalThis.icueEvents = {};
      globalThis.tr = async (text) => text;
      globalThis.__PACKRAT_WINDOW_FIXTURE__ = value;
      try { localStorage.removeItem("packrat.window-manager-xeneon.pins.v1"); } catch {}
    }, snapshot());

    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_WINDOW_TEST__) && document.body.getAttribute("data-connection") === "live");
    await page.waitForTimeout(350);

    const state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
    assert.equal(state.slot, slot.id, `${slot.id}: nearest-slot detection`);
    assert.equal(state.windows.length, 6, `${slot.id}: fixture window count`);
    assert.equal(state.monitors.length, 4, `${slot.id}: fixture monitor count`);
    assert.equal(state.activeWindowId, "102", `${slot.id}: active window state`);
    assert.equal(await page.locator(".window-card").count(), 6, `${slot.id}: rendered cards`);
    assert.equal(await page.locator(".window-card.active").count(), 1, `${slot.id}: one active card`);

    assert.equal(await page.locator("#windowList b").count(), 0, `${slot.id}: HTML-looking title rendered as markup`);
    assert.match(await page.locator('[data-window-id="106"] .window-title').innerText(), /<b>not markup<\/b>.*日本語.*gyqp/, `${slot.id}: Unicode/HTML-looking title lost`);
    assert.equal(await page.locator('[data-window-id="106"] img.window-icon').count(), 0, `${slot.id}: remote icon URI should be rejected`);

    const layout = await page.evaluate(() => {
      const rect = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return {
        docW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        bodyW: document.body.scrollWidth,
        bodyH: document.body.scrollHeight,
        pin: rect("pinAction"),
        minimize: rect("minimizeAction"),
        maximize: rect("maximizeAction"),
        snapLeft: rect("snapLeftAction"),
        snapRight: rect("snapRightAction"),
        move: rect("moveAction"),
        close: rect("closeAction"),
      };
    });
    assert.ok(layout.docW <= slot.width + 1, `${slot.id}: document horizontal overflow ${layout.docW}/${slot.width}`);
    assert.ok(layout.docH <= slot.height + 1, `${slot.id}: document vertical overflow ${layout.docH}/${slot.height}`);
    assert.ok(layout.bodyW <= slot.width + 1, `${slot.id}: body horizontal overflow ${layout.bodyW}/${slot.width}`);
    assert.ok(layout.bodyH <= slot.height + 1, `${slot.id}: body vertical overflow ${layout.bodyH}/${slot.height}`);
    for (const key of ["pin", "minimize", "maximize", "snapLeft", "snapRight", "move", "close"]) {
      assert.ok(Math.min(layout[key].width, layout[key].height) >= slot.minTouch, `${slot.id}: ${key} touch target below ${slot.minTouch}px`);
    }

    if (slot.id === "m-h") {
      await page.locator('[data-window-id="103"]').click();
      let next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.equal(next.selectedWindowId, "103", "card tap did not select Terminal");
      assert.equal(next.activeWindowId, "103", "card tap did not focus Terminal in fixture");
      assert.equal(next.commandLog.at(-1)?.command, "focus", "card tap did not send focus command");

      await page.locator("#minimizeAction").click();
      next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.equal(next.windows.find((item) => item.id === "103")?.state, "minimized", "minimize failed");
      assert.equal(next.activeWindowId, null, "minimized active window should clear active state");
      assert.equal(await page.locator(".window-card.active").count(), 0, "active visual did not clear");
      assert.match(await page.locator("#activeText").innerText(), /NO ACTIVE WINDOW/, "no-active copy missing");

      await page.locator("#maximizeAction").click();
      next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.equal(next.windows.find((item) => item.id === "103")?.state, "maximized", "maximize failed");

      await page.locator("#snapLeftAction").click();
      await page.locator("#snapRightAction").click();
      next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.deepEqual(next.commandLog.slice(-2).map((item) => item.command), ["snap_left", "snap_right"], "snap commands failed");

      await page.locator("#pinAction").click();
      next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.equal(next.pins.length, 1, "pin did not persist in fixture model");
      assert.equal(await page.locator(".pinned-app").count(), 1, "pinned dock did not render");

      await page.locator("#moveAction").click();
      assert.equal(await page.locator("#monitorSheet").getAttribute("aria-hidden"), "false", "monitor picker did not open");
      await page.locator('[data-monitor-id="MONITOR-3"]').click();
      next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.equal(next.windows.find((item) => item.id === "103")?.monitorId, "MONITOR-3", "move monitor failed");

      await page.locator("#closeAction").click();
      assert.equal(await page.locator("#closeSheet").getAttribute("aria-hidden"), "false", "close confirmation did not open");
      await page.locator("#cancelClose").click();
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState())).windows.length, 6, "cancel close mutated window list");
      await page.locator("#closeAction").click();
      await page.locator("#confirmClose").click();
      next = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
      assert.equal(next.windows.length, 5, "safe close confirmation did not close fixture window");
      assert.equal(next.windows.some((item) => item.id === "103"), false, "closed window remains");

      await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.connection("disconnected"));
      assert.match(await page.locator("#emptyTitle").innerText(), /WINDOW MANAGER LITE OFFLINE/, "disconnected state copy missing");
      await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.connection("pairing"));
      assert.match(await page.locator("#emptyTitle").innerText(), /PAIRING KEY NEEDED/, "pairing state copy missing");
      await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.connection("version_mismatch"));
      assert.match(await page.locator("#emptyTitle").innerText(), /UPDATE NEEDED/, "version mismatch state copy missing");
      for (const selector of ["#pinAction","#minimizeAction","#maximizeAction","#snapLeftAction","#snapRightAction","#moveAction","#closeAction"]) {
        assert.equal(await page.locator(selector).isDisabled(), true, `disconnected/version-mismatch control should be disabled: ${selector}`);
      }
      await page.evaluate((value) => globalThis.__PACKRAT_WINDOW_TEST__.snapshot({ ...value, windows: [], activeWindowId: null }), snapshot());
      assert.match(await page.locator("#emptyTitle").innerText(), /NO OPEN WINDOWS/, "empty live state copy missing");
      await page.evaluate((value) => globalThis.__PACKRAT_WINDOW_TEST__.snapshot(value), snapshot());
      assert.equal((await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState())).windows.length, 6, "fixture recovery failed");
    }

    await page.screenshot({ path: path.join(artifactDir, `${slot.id}.png`), fullPage: false });
    assert.deepEqual(pageErrors, [], `${slot.id}: page errors: ${pageErrors.join(" | ")}`);
    assert.deepEqual(consoleErrors, [], `${slot.id}: console errors: ${consoleErrors.join(" | ")}`);
    results.push({ slot: slot.id, viewport: [slot.width, slot.height], minTouch: slot.minTouch, layout });
    await context.close();
  }

  // Persistence recovery: corrupt JSON must never block startup.
  {
    const context = await browser.newContext({ viewport: { width: 840, height: 696 } });
    await context.addInitScript((value) => {
      globalThis.bridgeKey = "fixture-key";
      globalThis.showPinned = true;
      globalThis.showIcons = true;
      globalThis.textColor = "#F4F6F8";
      globalThis.accentColor = "#2BE86A";
      globalThis.backgroundColor = "#080B0F";
      globalThis.icueEvents = {};
      globalThis.tr = async (text) => text;
      globalThis.__PACKRAT_WINDOW_FIXTURE__ = value;
    }, snapshot());
    const page = await context.newPage();
    await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
    await page.evaluate(() => localStorage.setItem("packrat.window-manager-xeneon.pins.v1", "{not-json"));
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_WINDOW_TEST__) && document.body.getAttribute("data-connection") === "live");
    let state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
    assert.deepEqual(state.pins, [], "corrupt pin storage did not recover to empty");

    await page.evaluate(() => localStorage.setItem("packrat.window-manager-xeneon.pins.v1", JSON.stringify({
      legacy: { key: "legacy", appKey: "legacy", appName: "Legacy App" }
    })));
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => Boolean(globalThis.__PACKRAT_WINDOW_TEST__) && document.body.getAttribute("data-connection") === "live");
    state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
    assert.deepEqual(state.pins, ["legacy"], "legacy pin schema did not migrate");

    await page.evaluate(() => {
      globalThis.icueEvents.onICUEInitialized();
      globalThis.icueEvents.onICUEInitialized();
      globalThis.icueEvents.onDataUpdated();
      globalThis.icueEvents.onDataUpdated();
    });
    state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
    assert.equal(state.booted, true, "widget lost boot state after repeated lifecycle callbacks");
    assert.equal(state.windows.length, 6, "repeated lifecycle callbacks changed fixture state");

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    state = await page.evaluate(() => globalThis.__PACKRAT_WINDOW_TEST__.getState());
    assert.equal(state.shuttingDown, true, "pagehide cleanup did not run");
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(path.join(artifactDir, "results.json"), JSON.stringify({ entry, results }, null, 2));
console.log(`WINDOW MANAGER XENEON VISUAL QA PASS: ${slots.length} layouts, overflow, touch targets, Unicode/HTML text safety, icon allowlist, active-state clearing, focus, minimize, maximize/restore, snap, pins, four-monitor movement, safe close, disconnected/pairing/version-mismatch/empty states, persistence recovery, lifecycle idempotence and pagehide cleanup`);
