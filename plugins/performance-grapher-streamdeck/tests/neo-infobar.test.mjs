import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  makeNeoMetricFeedback,
  makeNeoOverviewFeedback,
  neoLayoutFor,
  neoMetricIds,
  normalizeNeoSettings,
} from "../src/neo.js";

const root = resolve(import.meta.dirname, "..");

function fakeTelemetry() {
  const values = new Map([
    ["cpu.load", 34],
    ["gpu.load", 61],
    ["ram.load", 47],
    ["gpu.temperature", 63],
  ]);
  const descriptors = new Map([
    ["cpu.load", { id: "cpu.load", name: "CPU Load", unit: "%" }],
    ["gpu.load", { id: "gpu.load", name: "GPU Load", unit: "%" }],
    ["ram.load", { id: "ram.load", name: "RAM Used", unit: "%" }],
    ["gpu.temperature", { id: "gpu.temperature", name: "GPU Temperature", unit: "°C" }],
  ]);
  return {
    metricValue: (id) => values.has(id) ? values.get(id) : null,
    metricDescriptor: (id) => descriptors.get(id) || null,
    metricSeries: () => [[1, 20], [2, 35], [3, 61], [4, 54]],
  };
}

function overlap(a, b) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

test("Neo settings default to the glanceable system overview", () => {
  const settings = normalizeNeoSettings({});
  assert.equal(settings.neoMode, "overview");
  assert.equal(settings.neoRefreshMs, 1000);
  assert.equal(settings.neoRotationMs, 5000);
  assert.equal(settings.neoShowLabels, true);
  assert.equal(settings.neoShowHistory, true);
  assert.equal(neoLayoutFor(settings), "layouts/neo-overview.json");
});

test("Neo overview renders CPU GPU RAM from shared telemetry", () => {
  const feedback = makeNeoOverviewFeedback(fakeTelemetry(), normalizeNeoSettings({}));
  assert.deepEqual(feedback, {
    cpuLabel: "CPU",
    cpuValue: "34%",
    gpuLabel: "GPU",
    gpuValue: "61%",
    ramLabel: "RAM",
    ramValue: "47%",
  });
});

test("Neo single metric renders a companion value and existing-history sparkline", () => {
  const settings = {
    ...normalizeNeoSettings({ neoMode: "single" }),
    metricId: "gpu.load",
    accent: "#FFB21E",
  };
  const feedback = makeNeoMetricFeedback(fakeTelemetry(), settings, "gpu.load");
  assert.equal(feedback.label, "GPU");
  assert.equal(feedback.value, "61%");
  assert.match(feedback.secondary, /GPU TEMP 63°C/);
  assert.match(feedback.sparkline, /^<svg /);
  assert.match(feedback.sparkline, /stroke="#FFB21E"/);
});

test("Neo rotating metric list is unique and preserves configured order", () => {
  assert.deepEqual(neoMetricIds({
    metricId: "gpu.load",
    neoMetric2: "cpu.load",
    neoMetric3: "gpu.load",
  }), ["gpu.load", "cpu.load"]);
});

test("Neo layouts stay inside 232x50 and do not overlap at the same z-order", async () => {
  for (const name of ["neo-overview.json", "neo-metric.json"]) {
    const layout = JSON.parse(await readFile(resolve(root, "com.packrat.performance-grapher.sdPlugin", "layouts", name), "utf8"));
    assert.equal(layout.controller, "Neo");
    const keys = new Set();
    for (const item of layout.items) {
      assert.ok(!keys.has(item.key), "duplicate layout key: " + item.key);
      keys.add(item.key);
      const [x, y, width, height] = item.rect;
      assert.ok(x >= 0 && y >= 0 && width > 0 && height > 0);
      assert.ok(x + width <= 232, name + " item exceeds Neo width");
      assert.ok(y + height <= 50, name + " item exceeds Neo height");
    }
    for (let i = 0; i < layout.items.length; i += 1) {
      for (let j = i + 1; j < layout.items.length; j += 1) {
        const a = layout.items[i];
        const b = layout.items[j];
        if ((a.zOrder || 0) === (b.zOrder || 0)) {
          assert.equal(overlap(a.rect, b.rect), false, name + " same-z items overlap: " + a.key + " / " + b.key);
        }
      }
    }
  }
});

test("manifest advertises exactly one Neo Infobar action and requires Stream Deck 7.6", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "com.packrat.performance-grapher.sdPlugin", "manifest.json"), "utf8"));
  const neo = manifest.Actions.filter((action) => Array.isArray(action.Controllers) && action.Controllers.includes("Neo"));
  assert.equal(neo.length, 1);
  assert.equal(neo[0].UUID, "com.packrat.performance-grapher.neo-infobar");
  assert.deepEqual(neo[0].Controllers, ["Neo"]);
  assert.equal(manifest.Software.MinimumVersion, "7.6");
});

test("SDK 3 lifecycle initializes settings from willAppear instead of relying on getSettings side effects", async () => {
  const [plugin, pkgRaw] = await Promise.all([
    readFile(resolve(root, "src", "plugin.js"), "utf8"),
    readFile(resolve(root, "package.json"), "utf8"),
  ]);
  const pkg = JSON.parse(pkgRaw);
  assert.equal(pkg.dependencies["@elgato/streamdeck"], "3.0.0");
  assert.match(plugin, /normalizeSettings\(ev\.payload\?\.settings, this\.kind\)/);
  assert.match(plugin, /isNeoInfobar/);
  assert.match(plugin, /setFeedbackLayout/);
  assert.match(plugin, /setFeedback\(/);
  assert.doesNotMatch(plugin, /getGlobalSettings\s*\(/);
  assert.doesNotMatch(plugin, /getSettings\s*\(/);
});
