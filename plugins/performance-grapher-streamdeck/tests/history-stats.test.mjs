import test from "node:test";
import assert from "node:assert/strict";
import { BoundedHistory } from "../src/history.js";
import { LowFpsHistogram, lowestAverage } from "../src/stats.js";

test("XENEON-style percent-low calculation averages the lowest fraction", () => {
  const values = [];
  for (let i = 1; i <= 100; i += 1) values.push(i);
  assert.equal(lowestAverage(values, 0.01), 1);
  assert.equal(lowestAverage(values, 0.1), 5.5);
});

test("incremental histogram preserves percent-low context without retaining the whole session", () => {
  const hist = new LowFpsHistogram({ step: 0.5, maxFps: 1000 });
  for (let i = 0; i < 10_000; i += 1) hist.add(120);
  for (let i = 0; i < 100; i += 1) hist.add(60);
  for (let i = 0; i < 10; i += 1) hist.add(30);
  assert.ok(hist.average() > 118);
  assert.ok(hist.lowest(0.01) < 65);
  assert.ok(hist.lowest(0.001) <= 31);
  assert.ok(hist.counts.length < 2500);
});

test("history stays bounded and archived max preserves spikes", () => {
  const history = new BoundedHistory({ rawMax: 10, archiveMax: 5, archiveMs: 1000, archiveMode: "max" });
  for (let i = 0; i < 100; i += 1) {
    history.push(i * 100, i === 54 ? 99 : i % 7);
  }
  history.toJSON();
  assert.equal(history.raw.length, 10);
  assert.ok(history.archive.length <= 5);
  assert.ok(history.archive.some((point) => point[1] === 99) || history.raw.some((point) => point[1] === 99) === false);
  const restored = BoundedHistory.fromJSON(history.toJSON(), { rawMax: 10, archiveMax: 5, archiveMs: 1000, archiveMode: "max" });
  assert.equal(restored.raw.length, 10);
  assert.ok(restored.archive.length <= 5);
});
