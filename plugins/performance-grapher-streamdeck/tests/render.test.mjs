import test from "node:test";
import assert from "node:assert/strict";
import { makeView, renderKey } from "../src/render.js";

function decode(data) {
  return decodeURIComponent(data.slice(data.indexOf(",") + 1));
}

for (const size of [72, 96, 144]) {
  test("renderer stays Stream Deck-native at " + size + "px", () => {
    const data = renderKey({
      label: "GPU TEMP",
      value: 73,
      unit: "°C",
      secondary: "5 MIN",
      points: [[1, 60], [2, 66], [3, 73]],
      state: "ready",
      breached: false,
    }, {}, size);
    assert.ok(data.startsWith("data:image/svg+xml"));
    const svg = decode(data);
    assert.match(svg, new RegExp('width="' + size + '"'));
    assert.match(svg, /GPU TEMP/);
    assert.match(svg, />73</);
    assert.ok(svg.length < 10_000);
  });
}

test("permission state is visible instead of showing stale FPS", () => {
  const svg = decode(renderKey({ label: "GAME FPS", value: null, unit: "FPS", secondary: "", points: [], state: "permission_required" }, {}, 144));
  assert.match(svg, /SETUP/);
  assert.match(svg, /ENABLE FPS/);
});


test("Game FPS shows a clear idle state when telemetry is ready but no game is active", () => {
  const telemetry = {
    metricValue() { return null; },
    metricSeries() { return []; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: {
      snapshot() {
        return { active: false, process: "", current: null, lastCompleted: null };
      },
    },
  };

  const view = makeView(telemetry, "fps", { fpsMode: "fps", lowMode: "one", windowMs: 60_000 });
  assert.equal(view.value, null);
  assert.equal(view.secondary, "START A GAME");

  const svg = decodeURIComponent(renderKey(view, {}, 144));
  assert.match(svg, /START A GAME/);
});


test("long process and secondary labels are bounded on key", () => {
  const image = renderKey({
    label: "ExtremelyLongGameExecutableName",
    value: 144,
    unit: "FPS",
    secondary: "An Extremely Long Session Context Label",
    points: [],
    state: "ready",
  }, {}, 72);
  const svg = decodeURIComponent(image);

  assert.ok(svg.includes("EXTREMELYLONGGAM…"));
  assert.ok(svg.includes("AN EXTREMELY LONG SES…"));
  assert.ok(!svg.includes("EXTREMELYLONGGAMEEXECUTABLENAME"));
});


test("generic game FPS graph preserves drops regardless of threshold direction", () => {
  const calls = [];
  const telemetry = {
    watchMetric() {},
    metricDescriptor() { return { id: "game.fps", name: "Game FPS", unit: "FPS", source: "PresentMon" }; },
    metricValue() { return 144; },
    metricSeries() { return [[1, 144], [2, 50], [3, 144]]; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: { snapshot() { return { active: true, process: "game.exe", current: { onePercentLow: 90, pointOnePercentLow: 60 } }; } },
  };

  const view = makeView(telemetry, "graph", {
    metricId: "game.fps",
    thresholdDirection: "above",
    windowMs: 60_000,
  });
  assert.equal(view.mode, "min");
});

test("generic frametime graph preserves spikes regardless of threshold direction", () => {
  const telemetry = {
    watchMetric() {},
    metricDescriptor() { return { id: "game.frametime", name: "Frametime", unit: "ms", source: "PresentMon" }; },
    metricValue() { return 7; },
    metricSeries() { return [[1, 7], [2, 40], [3, 7]]; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: { snapshot() { return { active: true, process: "game.exe", current: { onePercentLow: 90, pointOnePercentLow: 60 } }; } },
  };

  const view = makeView(telemetry, "graph", {
    metricId: "game.frametime",
    thresholdDirection: "below",
    windowMs: 60_000,
  });
  assert.equal(view.mode, "max");
});

test("performance alert downsampling follows the configured threshold direction", () => {
  const telemetry = {
    watchMetric() {},
    metricDescriptor() { return { id: "game.fps", name: "Game FPS", unit: "FPS", source: "PresentMon" }; },
    metricValue() { return 144; },
    metricSeries() { return [[1, 100], [2, 160], [3, 120]]; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: { snapshot() { return { active: true, process: "game.exe", current: { onePercentLow: 90, pointOnePercentLow: 60 } }; } },
  };

  assert.equal(makeView(telemetry, "alert", {
    metricId: "game.fps",
    thresholdDirection: "above",
    threshold: 150,
  }).mode, "max");
  assert.equal(makeView(telemetry, "alert", {
    metricId: "game.fps",
    thresholdDirection: "below",
    threshold: 90,
  }).mode, "min");
});


test("common hardware labels are shortened before key rendering", () => {
  const telemetry = {
    watchMetric() {},
    metricDescriptor(id) {
      return {
        id,
        name: "CPU Temperature",
        unit: "°C",
        source: "Libre Hardware Monitor",
        hardwareName: "AMD Ryzen 7 5700X3D",
      };
    },
    metricValue() { return 47; },
    metricSeries() { return []; },
    safeStatus() { return { fps: { state: "ready" }, hardware: { state: "ready" } }; },
    session: { snapshot() { return { active: false, current: null, lastCompleted: null }; } },
  };

  const view = makeView(telemetry, "metric", { metricId: "cpu.temperature" });
  assert.equal(view.label, "CPU TEMP");
  assert.equal(view.secondary, "Ryzen 7 5700X3D");

  const svg = decode(renderKey(view, {}, 144));
  assert.match(svg, /clipPath id="topText"/);
  assert.match(svg, /clipPath id="bottomText"/);
  assert.match(svg, /CPU TEMP/);
  assert.match(svg, /RYZEN 7 5700X3D/);
  assert.doesNotMatch(svg, /AMD RYZEN/);
});
