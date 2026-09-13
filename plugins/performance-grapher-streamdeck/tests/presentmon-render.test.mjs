import test from "node:test";
import assert from "node:assert/strict";
import { parsePresentMonRows, splitCsv } from "../src/presentmon.js";
import { makeView, renderKey } from "../src/render.js";

test("CSV parser handles quoted application names and common PresentMon timing headers", () => {
  assert.deepEqual(splitCsv('"Game, Test.exe",42,8.3'), ["Game, Test.exe", "42", "8.3"]);
  const rows = parsePresentMonRows([
    "Application,ProcessID,FrameTime",
    '"Game, Test.exe",42,8.33',
    "other.exe,43,16.67",
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].application, "Game, Test.exe");
  assert.equal(rows[0].pid, 42);
  assert.equal(rows[1].frameTimeMs, 16.67);
});

test("renderer stays valid at Mini/MK.2/XL/+ key raster sizes", () => {
  const view = {
    label: "GPU TEMP",
    value: 73,
    unit: "°C",
    secondary: "60 SEC",
    points: Array.from({ length: 80 }, (_, i) => [i * 1000, 55 + Math.sin(i / 5) * 12]),
    state: "ready",
    mode: "max",
  };
  for (const size of [72, 96, 144]) {
    const image = renderKey(view, { accent: "#2BE86A", threshold: 85 }, size);
    assert.ok(image.startsWith("data:image/svg+xml"));
    const svg = decodeURIComponent(image.split(",").slice(1).join(","));
    assert.match(svg, new RegExp('width="' + size + '"'));
    assert.match(svg, /GPU TEMP/);
    assert.match(svg, /<path d="M/);
  }
});

test("FPS action exposes one useful low statistic rather than cramming the key", () => {
  const fake = {
    metricValue(id) { return id === "game.fps" ? 144 : 6.94; },
    metricSeries() { return [[1, 130], [2, 144], [3, 120]]; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: { snapshot() { return { process: "valorant.exe", current: { onePercentLow: 111, pointOnePercentLow: 93 } }; } },
  };
  const one = makeView(fake, "fps", { fpsMode: "fps", lowMode: "one", windowMs: 60000 });
  const pointOne = makeView(fake, "fps", { fpsMode: "fps", lowMode: "pointOne", windowMs: 60000 });
  assert.equal(one.secondary, "1% 111");
  assert.equal(pointOne.secondary, "0.1% 93");
});


test("whole-session history window passes zero through to telemetry", () => {
  const windows = [];
  const fake = {
    metricValue() { return 144; },
    metricSeries(id, windowMs) { windows.push([id, windowMs]); return [[1, 120], [2, 144]]; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    watchMetric() {},
    metricDescriptor() { return { id: "cpu.load", name: "CPU Load", unit: "%", source: "Windows" }; },
    session: { snapshot() { return { process: "game.exe", current: { onePercentLow: 120, pointOnePercentLow: 100 } }; } },
  };

  makeView(fake, "fps", { fpsMode: "fps", lowMode: "one", windowMs: 0 });
  makeView(fake, "graph", { metricId: "cpu.load", windowMs: 0 });
  assert.deepEqual(windows, [["game.fps", 0], ["cpu.load", 0]]);
});
