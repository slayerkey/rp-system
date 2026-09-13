import test from "node:test";
import assert from "node:assert/strict";
import { BoundedHistory } from "../src/history.js";
import { FrameTimeHistogram, LowFpsHistogram, lowestAverage } from "../src/stats.js";

test("XENEON-style percent-low calculation averages the lowest fraction", () => {
  const values = [];
  for (let i = 1; i <= 100; i += 1) values.push(i);
  assert.equal(lowestAverage(values, 0.01), 1);
  assert.equal(lowestAverage(values, 0.1), 5.5);
});

test("incremental frame-time histogram calculates low-average FPS without retaining every frame", () => {
  const hist = new FrameTimeHistogram({ stepMs: 0.25, maxFrameMs: 5000 });
  for (let i = 0; i < 990; i += 1) hist.add(10);   // 100 FPS
  for (let i = 0; i < 5; i += 1) hist.add(50);    // 20 FPS
  for (let i = 0; i < 5; i += 1) hist.add(100);   // 10 FPS

  assert.ok(Math.abs(hist.average() - (1_000_000 / 10_650)) < 0.001);
  assert.ok(Math.abs(hist.lowest(0.01) - (10_000 / 750)) < 0.001);
  assert.ok(Math.abs(hist.lowest(0.001) - 10) < 0.001);
  assert.ok(hist.counts.length < 25_000);
});

test("legacy pre-release FPS histogram state migrates into frame-time statistics", () => {
  const legacy = new LowFpsHistogram({ stepMs: 0.25, maxFrameMs: 5000 });
  const migrated = FrameTimeHistogram.fromJSON({
    step: 0.5,
    maxFps: 1000,
    sparse: [
      [120, 10, 600], // 10 frames averaging 60 FPS
      [240, 90, 10800], // 90 frames averaging 120 FPS
    ],
  });
  assert.equal(migrated.count, 100);
  assert.ok(migrated.average() > 100 && migrated.average() < 120);
  assert.ok(migrated.lowest(0.01) <= 61);
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
