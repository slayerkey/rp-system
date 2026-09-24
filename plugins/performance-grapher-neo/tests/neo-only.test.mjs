import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  makeNeoFeedback, makeNeoMetricFeedback, neoMetricIds,
  normalizeNeoSettings,
} from "../../performance-grapher-streamdeck/src/neo.js";

const root = resolve(import.meta.dirname, "..");
const folder = resolve(root, "com.packrat.performance-grapher-neo.sdPlugin");
const manifest = JSON.parse(await readFile(resolve(folder, "manifest.json"), "utf8"));
const source = await readFile(resolve(root, "src/plugin.js"), "utf8");

test("standalone product is Neo-only with its own permanent UUID", () => {
  assert.equal(manifest.UUID, "com.packrat.performance-grapher-neo");
  assert.equal(manifest.Version, "1.0.0.0");
  assert.equal(manifest.Software.MinimumVersion, "7.6");
  assert.equal(manifest.SDKVersion, 3);
  assert.equal(manifest.Actions.length, 1);
  assert.deepEqual(manifest.Actions[0].Controllers, ["Neo"]);
  assert.equal(manifest.Actions[0].UUID, "com.packrat.performance-grapher-neo.infobar");
  assert.equal(manifest.Profiles, undefined);
  assert.doesNotMatch(source, /registerAction\\(new PerformanceAction/);
});
test("physical Neo layouts are wholly inside 232 x 50 with no equal-z overlaps", async () => {
  for (const name of ["neo-overview.json", "neo-metric.json"]) {
    const layout = JSON.parse(await readFile(resolve(folder, "layouts", name), "utf8"));
    assert.equal(layout.controller, "Neo");
    const seen = new Set();
    for (const item of layout.items) {
      assert.ok(!seen.has(item.key), "Duplicate layout key: " + item.key);
      seen.add(item.key);
      const [x, y, w, h] = item.rect;
      assert.ok(x >= 0 && y >= 0 && x + w <= 232 && y + h <= 50, name + ": bounds");
      assert.ok(w > 0 && h > 0);
    }
    for (let i = 0; i < layout.items.length; i++) {
      for (let j = i + 1; j < layout.items.length; j++) {
        const a = layout.items[i], b = layout.items[j];
        if ((a.zOrder || 0) !== (b.zOrder || 0)) continue;
        const [ax, ay, aw, ah] = a.rect, [bx, by, bw, bh] = b.rect;
        assert.equal(ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by, false);
      }
    }
  }
});
test("only reliable shared sensor data is advertised; missing GPU is not fake 0", () => {
  const metricValue = (id) => id === "cpu.load" ? 23 : id === "ram.load" ? 42 : null;
  const metricDescriptor = (id) => ({ unit: "%", name: id });
  const telemetry = {
    metricValue, metricDescriptor,
    metricSeries: () => [[1, 22], [2, 23], [3, 29]],
  };
  assert.deepEqual(makeNeoFeedback(telemetry, normalizeNeoSettings({})), {
    cpuLabel: "CPU", cpuValue: "23%", gpuLabel: "GPU", gpuValue: "--",
    ramLabel: "RAM", ramValue: "42%",
  });
  const single = makeNeoMetricFeedback(telemetry, {
    ...normalizeNeoSettings({ neoMode: "single" }), metricId: "cpu.load", accent: "#2BE86A",
  });
  assert.equal(single.value, "23%");
  assert.match(single.sparkline, /<svg /);
  assert.equal(neoMetricIds({
    metricId: "cpu.load", neoMetric2: "ram.load", neoMetric3: "ram.load",
  }).length, 2);
});
test("Neo-only process never starts PresentMon or registers legacy keypad actions", () => {
  assert.match(source, /presentMonProvider: new DisabledGameCapture\\(\\)/);
  assert.match(source, /isNeoInfobar\\(\\)/);
  assert.match(source, /setFeedbackLayout\\(/);
  assert.match(source, /setFeedback\\(/);
  assert.match(source, /if \\(!visible\\.size && ticker\\)/);
  assert.doesNotMatch(source, /getSettings\\s*\\(/);
  assert.doesNotMatch(source, /getGlobalSettings\\s*\\(/);
  assert.doesNotMatch(source, /streamDeck\\.actions\\.registerAction\\(new (?!NeoPerformanceInfobar)/);
});
test("Neo inspector contains no hidden FPS/normal-key options", async () => {
  const html = await readFile(resolve(root, "ui/inspector.html"), "utf8");
  const js = await readFile(resolve(root, "ui/inspector.js"), "utf8");
  for (const mode of ["overview", "single", "rotate"]) assert.match(html, new RegExp(mode));
  assert.match(js, /performanceNeo\\.inspect/);
  assert.doesNotMatch(html, /Game FPS|Frametime|Press the key/i);
  assert.doesNotMatch(html, /Preview Pro|Upgrade/);
});
