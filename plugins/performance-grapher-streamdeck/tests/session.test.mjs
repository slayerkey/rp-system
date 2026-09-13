import test from "node:test";
import assert from "node:assert/strict";
import { SessionTracker } from "../src/session.js";

function feed(tracker, process, start, count, frameMs, metrics = {}) {
  tracker.setForeground(process);
  let now = start;
  for (let i = 0; i < count; i += 1) {
    now += frameMs;
    tracker.observeFrame({ application: process, frameTimeMs }, metrics, now);
  }
  tracker.tick(metrics, now + 150);
  return now;
}

test("game session starts, calculates lows from frame samples, and finalizes on idle", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 500 });
  let now = feed(tracker, "game.exe", 0, 80, 10, { "gpu.load": 97, "gpu.temperature": 70, "cpu.temperature": 60 });
  now = feed(tracker, "game.exe", now, 4, 40, { "gpu.load": 98, "gpu.temperature": 75, "cpu.temperature": 64 });
  const live = tracker.snapshot(now);
  assert.equal(live.active, true);
  assert.equal(live.process, "game.exe");
  assert.ok(live.current.onePercentLow < live.current.averageFps);
  assert.ok(live.current.worstFrametimeMs >= 40);
  assert.ok(live.current.peakGpuTemperature >= 75);

  tracker.tick({}, now + 700);
  const done = tracker.snapshot(now + 700);
  assert.equal(done.active, false);
  assert.equal(done.lastCompleted.process, "game.exe");
  assert.ok(done.lastCompleted.samples > 0);
});

test("stable foreground process change closes the previous session", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 2000 });
  let now = feed(tracker, "first.exe", 0, 40, 16.6);
  now = feed(tracker, "second.exe", now + 100, 40, 12.5);
  const snap = tracker.snapshot(now);
  assert.equal(snap.process, "second.exe");
  assert.equal(snap.lastCompleted.process, "first.exe");
});

test("desktop compositor and PackRat helper frames are ignored", () => {
  const tracker = new SessionTracker({ switchMs: 0 });
  tracker.setForeground("dwm.exe");
  for (let i = 0; i < 100; i += 1) tracker.observeFrame({ application: "dwm.exe", frameTimeMs: 16 }, {}, i * 16);
  assert.equal(tracker.snapshot().active, false);
});
