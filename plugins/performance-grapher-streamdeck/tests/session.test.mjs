import test from "node:test";
import assert from "node:assert/strict";
import { SessionTracker } from "../src/session.js";

function feed(tracker, process, start, count, frameMs, metrics = {}) {
  tracker.setForeground(process);
  let now = start;
  for (let i = 0; i < count; i += 1) {
    now += frameMs;
    tracker.observeFrame({ application: process, frameTimeMs: frameMs }, metrics, now);
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


test("recent persisted session resumes after a short plugin restart", () => {
  const original = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  const savedAt = feed(original, "game.exe", 1000, 120, 10, {
    "gpu.load": 97,
    "gpu.temperature": 72,
    "cpu.temperature": 62,
  });
  const before = original.snapshot(savedAt);
  const state = original.toJSON(savedAt);

  const restored = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  restored.restore(state, { savedAt, now: savedAt + 5000, resumeGraceMs: 60_000 });

  const resumed = restored.snapshot(savedAt + 5000);
  assert.equal(resumed.active, true);
  assert.equal(resumed.process, "game.exe");
  assert.equal(resumed.currentFps, null, "live FPS must not be restored as a stale current value");
  assert.equal(resumed.current.samples, before.current.samples);
  assert.ok(resumed.recent.series(0, savedAt + 5000).length > 0);

  const later = feed(restored, "game.exe", savedAt + 5000, 20, 10);
  const continued = restored.snapshot(later);
  assert.equal(continued.active, true);
  assert.ok(continued.current.samples > before.current.samples);
  assert.equal(continued.current.startedAt, before.current.startedAt);
});

test("old persisted active session finalizes at its save boundary instead of false resume", () => {
  const original = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  const savedAt = feed(original, "oldgame.exe", 2000, 80, 12.5);
  const state = original.toJSON(savedAt);

  const restored = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  restored.restore(state, { savedAt, now: savedAt + 120_000, resumeGraceMs: 60_000 });

  const snap = restored.snapshot(savedAt + 120_000);
  assert.equal(snap.active, false);
  assert.equal(snap.lastCompleted.process, "oldgame.exe");
  assert.equal(snap.lastCompleted.endedAt, savedAt);
  assert.ok(snap.recent.series(0, savedAt + 120_000).length > 0);
});


test("low-FPS dominant process starts without foreground telemetry", () => {
  const tracker = new SessionTracker({ switchMs: 800, idleMs: 3000 });
  let now = 0;
  for (let i = 0; i < 30; i += 1) {
    now += 125; // 8 FPS
    tracker.observeFrame({ application: "slowgame.exe", frameTimeMs: 125 }, {}, now);
    if (i % 4 === 0) {
      tracker.observeFrame({ application: "background.exe", frameTimeMs: 500 }, {}, now + 1);
    }
  }
  const snap = tracker.snapshot(now);
  assert.equal(snap.active, true);
  assert.equal(snap.process, "slowgame.exe");
});

test("ambiguous low-FPS fallback producers do not steal a session", () => {
  const tracker = new SessionTracker({ switchMs: 600, idleMs: 3000 });
  let now = 0;
  for (let i = 0; i < 16; i += 1) {
    now += 125;
    tracker.observeFrame({ application: "one.exe", frameTimeMs: 125 }, {}, now);
    tracker.observeFrame({ application: "two.exe", frameTimeMs: 125 }, {}, now + 1);
  }
  assert.equal(tracker.snapshot(now).active, false);
});

test("foreground identity still wins immediately over fallback activity", () => {
  const tracker = new SessionTracker({ switchMs: 800, idleMs: 3000 });
  tracker.setForeground("foreground.exe");
  let now = 0;
  for (let i = 0; i < 12; i += 1) {
    now += 125;
    tracker.observeFrame({ application: "background.exe", frameTimeMs: 8 }, {}, now);
    tracker.observeFrame({ application: "foreground.exe", frameTimeMs: 125 }, {}, now + 1);
  }
  assert.equal(tracker.snapshot(now).process, "foreground.exe");
});


test("session summary uses slowest-frame-time low averages", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  tracker._start("game.exe", 0);
  let now = 0;

  for (let i = 0; i < 1000; i += 1) {
    const frameTimeMs = i < 990 ? 10 : i < 995 ? 50 : 100;
    now += frameTimeMs;
    tracker.observeFrame({ application: "game.exe", frameTimeMs }, {}, now);
  }

  const summary = tracker.snapshot(now).current;
  assert.ok(Math.abs(summary.averageFps - (1_000_000 / 10_650)) < 0.01);
  assert.ok(Math.abs(summary.onePercentLow - (10_000 / 750)) < 0.01);
  assert.ok(Math.abs(summary.pointOnePercentLow - 10) < 0.01);
});


test("frametime graph history preserves the worst raw frame in each bucket", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  tracker._start("game.exe", 0);

  tracker.observeFrame({ application: "game.exe", frameTimeMs: 10 }, {}, 10);
  tracker.observeFrame({ application: "game.exe", frameTimeMs: 10 }, {}, 20);
  tracker.observeFrame({ application: "game.exe", frameTimeMs: 50 }, {}, 30);
  tracker.observeFrame({ application: "game.exe", frameTimeMs: 10 }, {}, 120);

  const snap = tracker.snapshot(120);
  const fpsPoint = snap.recent.raw.at(-1);
  const framePoint = snap.frametimeRecent.raw.at(-1);

  assert.ok(fpsPoint[1] < 100, "FPS bucket should reflect average frame time");
  assert.equal(framePoint[1], 50, "Frametime graph must preserve the worst raw frame");
});


test("manual reset preserves final bucket peak and pressure context", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  tracker._start("game.exe", 0);
  tracker.observeFrame({ application: "game.exe", frameTimeMs: 40 }, {}, 10);
  tracker.reset(20, {
    "gpu.load": 99,
    "gpu.temperature": 81,
    "cpu.temperature": 68,
  });

  const done = tracker.snapshot(20).lastCompleted;
  assert.equal(done.peakGpuLoad, 99);
  assert.equal(done.peakGpuTemperature, 81);
  assert.equal(done.peakCpuTemperature, 68);
});

test("process switch carries diagnostics through the outgoing final bucket", () => {
  const tracker = new SessionTracker({ switchMs: 0, idleMs: 3000 });
  tracker._start("first.exe", 0);
  tracker.observeFrame({ application: "first.exe", frameTimeMs: 40 }, {}, 10);

  tracker._start("second.exe", 20, {
    "gpu.load": 99,
    "gpu.temperature": 82,
    "cpu.temperature": 69,
  });

  const done = tracker.lastCompleted;
  assert.equal(done.process, "first.exe");
  assert.equal(done.peakGpuLoad, 99);
  assert.equal(done.peakGpuTemperature, 82);
  assert.equal(done.peakCpuTemperature, 69);
});
