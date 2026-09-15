import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { SessionTracker } from "../src/session.js";
import { renderKey } from "../src/render.js";

test("synthetic long-session aggregation remains bounded and cheap", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 10_000 });
  tracker.setForeground("benchmark.exe");
  const beforeHeap = process.memoryUsage().heapUsed;
  const start = performance.now();
  let now = 0;
  for (let i = 0; i < 250_000; i += 1) {
    now += 8.333;
    const frame = i % 997 === 0 ? 38 : 8.333;
    tracker.observeFrame({ application: "benchmark.exe", frameTimeMs: frame }, { "gpu.load": 92, "cpu.load": 55 }, now);
    if (i % 30 === 0) tracker.tick({}, now);
  }
  const elapsed = performance.now() - start;
  const afterHeap = process.memoryUsage().heapUsed;
  const snap = tracker.snapshot(now);
  assert.ok(snap.recent.raw.length <= 3600);
  assert.ok(snap.recent.archive.length <= 21600);
  assert.ok(elapsed < 8000, "250k-frame aggregation exceeded 8s: " + elapsed.toFixed(1));
  assert.ok(afterHeap - beforeHeap < 80 * 1024 * 1024, "heap grew by more than 80 MB");

  const points = snap.recent.series(300_000, now).slice(-120);
  const renderStart = performance.now();
  for (let i = 0; i < 5000; i += 1) {
    renderKey({ label: "FPS", value: 238, unit: "FPS", secondary: "1% 181", points, state: "ready", mode: "min" }, {}, 144);
  }
  const renderElapsed = performance.now() - renderStart;
  assert.ok(renderElapsed < 5000, "5000 key renders exceeded 5s: " + renderElapsed.toFixed(1));
});
