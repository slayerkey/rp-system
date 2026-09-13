import test from "node:test";
import assert from "node:assert/strict";
import { SessionTracker } from "../src/session.js";

function feed(tracker, app, start, frames, step, frameMs, metrics = {}) {
  let now = start;
  for (let i = 0; i < frames; i += 1) {
    tracker.observeFrame({ application: app, frameTimeMs }, metrics, now);
    now += step;
  }
  return now;
}

test("foreground frame producer starts one process-aware session", () => {
  const tracker = new SessionTracker({ switchMs: 600, idleMs: 1500 });
  tracker.setForeground("game.exe");
  let now = feed(tracker, "game.exe", 1000, 40, 25, 8.33, { "gpu.load": 92, "cpu.load": 55, "gpu.temperature": 70 });
  tracker.tick({ "gpu.load": 92 }, now + 150);
  const snap = tracker.snapshot(now + 150);
  assert.equal(snap.active, true);
  assert.equal(snap.process, "game.exe");
  assert.ok(snap.currentFps > 110 && snap.currentFps < 130);
  assert.ok(snap.current.onePercentLow > 100);
});

test("stable process change finalizes the previous session and begins the next", () => {
  const tracker = new SessionTracker({ switchMs: 500, idleMs: 1500 });
  tracker.setForeground("first.exe");
  let now = feed(tracker, "first.exe", 1000, 40, 25, 10, { "gpu.load": 97 });
  tracker.tick({ "gpu.load": 97 }, now + 150);
  assert.equal(tracker.snapshot(now).process, "first.exe");

  tracker.setForeground("second.exe");
  now = feed(tracker, "second.exe", now + 200, 40, 25, 12, { "cpu.load": 95, "gpu.load": 60 });
  tracker.tick({ "cpu.load": 95, "gpu.load": 60 }, now + 150);
  const snap = tracker.snapshot(now);
  assert.equal(snap.process, "second.exe");
  assert.equal(snap.lastCompleted.process, "first.exe");
  assert.ok(snap.lastCompleted.averageFps > 90);
});

test("game stop preserves a completed session summary", () => {
  const tracker = new SessionTracker({ switchMs: 400, idleMs: 1000 });
  tracker.setForeground("game.exe");
  let now = feed(tracker, "game.exe", 1000, 50, 20, 16.67, { "gpu.temperature": 76, "cpu.temperature": 68, "gpu.load": 99 });
  const completed = tracker.tick({ "gpu.temperature": 76, "cpu.temperature": 68, "gpu.load": 99 }, now + 1200);
  assert.ok(completed);
  assert.equal(completed.process, "game.exe");
  assert.ok(completed.worstFrametimeMs >= 16.67);
  assert.equal(tracker.snapshot(now + 1200).active, false);
});

test("desktop/system processes never become the game session", () => {
  const tracker = new SessionTracker({ switchMs: 200, idleMs: 1000 });
  tracker.setForeground("dwm.exe");
  const now = feed(tracker, "dwm.exe", 1000, 200, 10, 8);
  assert.equal(tracker.snapshot(now).active, false);
});

test("long synthetic session keeps bounded graph history", () => {
  const tracker = new SessionTracker({ switchMs: 100, idleMs: 5000 });
  tracker.setForeground("benchmark.exe");
  let now = 1000;
  for (let i = 0; i < 80_000; i += 1) {
    tracker.observeFrame({ application: "benchmark.exe", frameTimeMs: 8 + (i % 5000 === 0 ? 35 : 0) }, { "gpu.load": 97, "cpu.load": 50 }, now);
    now += 10;
  }
  tracker.tick({ "gpu.load": 97 }, now + 150);
  const recent = tracker.snapshot(now).recent;
  recent.toJSON();
  assert.ok(recent.raw.length <= 3600);
  assert.ok(recent.archive.length <= 21600);
});
