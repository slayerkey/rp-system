import test from "node:test";
import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { TelemetryService } from "../src/telemetry.js";
import { renderKey } from "../src/render.js";
import { SessionTracker } from "../src/session.js";

test("no NVIDIA/AMD/Intel GPU leaves advanced aliases unavailable without breaking CPU/RAM", () => {
  const telemetry = new TelemetryService({ pluginRoot: resolve(tmpdir(), "missing-performance-provider"), persistPath: resolve(tmpdir(), "packrat-test-state-none.json") });
  telemetry._consumeHardwareLine(JSON.stringify({ type: "catalog", sensors: [] }));
  telemetry._setMetric("cpu.load", 42, Date.now());
  telemetry._setMetric("ram.load", 51, Date.now());
  assert.equal(telemetry.metricValue("cpu.load"), 42);
  assert.equal(telemetry.metricValue("ram.load"), 51);
  assert.equal(telemetry.metricValue("gpu.temperature"), null);
  assert.equal(telemetry.metricValue("gpu.load"), null);
});

test("AMD, NVIDIA, and Intel-style hardware catalogs map to the same canonical GPU jobs", () => {
  const telemetry = new TelemetryService({ pluginRoot: resolve(tmpdir(), "missing-performance-provider"), persistPath: resolve(tmpdir(), "packrat-test-state-alias.json") });
  for (const hardwareType of ["GpuNvidia", "GpuAmd", "GpuIntel"]) {
    telemetry._consumeHardwareLine(JSON.stringify({
      type: "catalog",
      sensors: [
        { id: hardwareType + ".temp", name: "GPU Core", sensorType: "Temperature", hardwareType, hardwareName: hardwareType, unit: "°C" },
        { id: hardwareType + ".load", name: "GPU Core", sensorType: "Load", hardwareType, hardwareName: hardwareType, unit: "%" }
      ]
    }));
    telemetry._consumeHardwareLine(JSON.stringify({
      type: "sample",
      at: Date.now(),
      foregroundProcess: "game.exe",
      values: { [hardwareType + ".temp"]: 72, [hardwareType + ".load"]: 98 }
    }));
    assert.equal(telemetry.metricValue("gpu.temperature"), 72);
    assert.equal(telemetry.metricValue("gpu.load"), 98);
  }
});

test("sensor disappearance expires stale readings instead of showing a frozen number", () => {
  const telemetry = new TelemetryService({ pluginRoot: resolve(tmpdir(), "missing-performance-provider"), persistPath: resolve(tmpdir(), "packrat-test-state-expire.json") });
  const oldNow = Date.now;
  let clock = 10_000;
  Date.now = () => clock;
  try {
    telemetry._setMetric("gpu.temperature", 80, clock);
    assert.equal(telemetry.metricValue("gpu.temperature"), 80);
    clock += 6000;
    assert.equal(telemetry.metricValue("gpu.temperature"), null);
  } finally {
    Date.now = oldNow;
  }
});

test("corrupt persistence is quarantined and startup continues", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "packrat-perf-"));
  const path = resolve(dir, "state.json");
  await writeFile(path, "{not-json", "utf8");
  const telemetry = new TelemetryService({ pluginRoot: resolve(dir, "missing"), persistPath: path });
  await telemetry._restore();
  const names = await readdir(dir);
  assert.ok(names.some((name) => name.startsWith("state.json.corrupt.")));
});

test("synthetic aggregation + key rendering stays cheap and bounded", () => {
  const tracker = new SessionTracker({ switchMs: 100, idleMs: 5000 });
  tracker.setForeground("benchmark.exe");
  const before = process.memoryUsage().heapUsed;
  const started = performance.now();
  let now = 1000;
  for (let i = 0; i < 60_000; i += 1) {
    tracker.observeFrame({ application: "benchmark.exe", frameTimeMs: 7 + (i % 4000 === 0 ? 30 : 0) }, { "gpu.load": 96, "cpu.load": 55 }, now);
    now += 10;
  }
  tracker.tick({ "gpu.load": 96 }, now + 150);
  const sessionElapsed = performance.now() - started;

  const renderStarted = performance.now();
  for (let i = 0; i < 1200; i += 1) {
    renderKey({
      label: "FPS",
      value: 144,
      unit: "FPS",
      secondary: "1% 118",
      points: Array.from({ length: 120 }, (_, j) => [j, 100 + ((i + j) % 50)]),
      state: "ready",
      mode: "min",
    }, {}, 144);
  }
  const renderElapsed = performance.now() - renderStarted;
  const heapDeltaMb = Math.max(0, process.memoryUsage().heapUsed - before) / 1024 / 1024;
  console.log("PERF_BENCH session60k_ms=" + sessionElapsed.toFixed(1) + " render1200_ms=" + renderElapsed.toFixed(1) + " heap_delta_mb=" + heapDeltaMb.toFixed(1));

  assert.ok(sessionElapsed < 5000, "60k frame aggregation exceeded 5s synthetic budget");
  assert.ok(renderElapsed < 5000, "1200 key renders exceeded 5s synthetic budget");
  assert.ok(heapDeltaMb < 96, "synthetic heap growth exceeded 96 MB");
  assert.ok(tracker.snapshot(now).recent.raw.length <= 3600);
});


test("persistence commits through a temporary file and leaves valid JSON", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "packrat-perf-persist-"));
  const path = resolve(dir, "state.json");
  const telemetry = new TelemetryService({ pluginRoot: resolve(dir, "missing"), persistPath: path });
  telemetry._setMetric("cpu.load", 47, Date.now());
  await telemetry._persistNow();

  const names = await readdir(dir);
  assert.ok(names.includes("state.json"));
  assert.ok(!names.includes("state.json.tmp"));

  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.equal(saved.version, 1);
  assert.ok(saved.histories["cpu.load"]);
});


test("whole-session hardware graph is bounded to the active or last game session", () => {
  const telemetry = new TelemetryService({
    pluginRoot: resolve(tmpdir(), "missing-performance-provider"),
    persistPath: resolve(tmpdir(), "packrat-test-session-window.json")
  });

  const now = Date.now();
  telemetry._history("gpu.temperature").push(now - 20_000, 60);
  telemetry._history("gpu.temperature").push(now - 8_000, 70);
  telemetry._history("gpu.temperature").push(now - 4_000, 75);
  telemetry._history("gpu.temperature").push(now - 1_000, 68);

  telemetry.session.setLastCompleted({
    process: "game.exe",
    startedAt: now - 9_000,
    endedAt: now - 2_000,
    durationMs: 7_000,
    averageFps: 144,
    onePercentLow: 120,
    pointOnePercentLow: 100,
    worstFrametimeMs: 20,
    peakGpuTemperature: 75,
    peakCpuTemperature: 65,
    peakGpuLoad: 99,
    samples: 1000,
    pressure: "GPU PRESSURE",
  });

  assert.deepEqual(
    telemetry.metricSeries("gpu.temperature", 0).map((point) => point[1]),
    [70, 75]
  );
});


test("persistence round trip retains recent FPS session history", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "packrat-perf-session-persist-"));
  const path = resolve(dir, "state.json");
  const first = new TelemetryService({ pluginRoot: resolve(dir, "missing"), persistPath: path });

  first.session.setForeground("game.exe");
  let now = Date.now();
  for (let i = 0; i < 120; i += 1) {
    now += 10;
    first.session.observeFrame({ application: "game.exe", frameTimeMs: 10 }, { "gpu.load": 95 }, now);
  }
  first.session.tick({ "gpu.load": 95 }, now + 150);
  const before = first.session.snapshot(now + 150);
  assert.equal(before.active, true);
  assert.ok(before.recent.series(0, now + 150).length > 0);

  await first._persistNow();

  const second = new TelemetryService({ pluginRoot: resolve(dir, "missing"), persistPath: path });
  const oldNow = Date.now;
  Date.now = () => now + 1000;
  try {
    await second._restore();
  } finally {
    Date.now = oldNow;
  }

  const restored = second.session.snapshot(now + 1000);
  assert.equal(restored.active, true);
  assert.equal(restored.process, "game.exe");
  assert.equal(restored.currentFps, null);
  assert.equal(restored.current.samples, before.current.samples);
  assert.ok(restored.recent.series(0, now + 1000).length > 0);
});


function fakeProvider() {
  const provider = new EventEmitter();
  provider.start = () => {};
  provider.stop = () => {};
  provider.restart = () => {};
  return provider;
}

function fakeHardwareChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = () => { child.killed = true; };
  return child;
}

function fakeHardwareLines() {
  return { on() {}, close() {} };
}

test("stale hardware helper cannot overwrite replacement state", () => {
  const children = [];
  const telemetry = new TelemetryService({
    pluginRoot: resolve(tmpdir(), "provider-lifecycle"),
    persistPath: resolve(tmpdir(), "packrat-provider-lifecycle.json"),
    spawnProcess: () => {
      const child = fakeHardwareChild();
      children.push(child);
      return child;
    },
    createLineInterface: fakeHardwareLines,
    presentMonProvider: fakeProvider(),
  });

  telemetry._startHardware();
  const first = children[0];
  first.kill();
  telemetry.hardware = null;
  telemetry._startHardware();
  const second = children[1];

  assert.equal(telemetry.hardware, second);
  assert.equal(telemetry.status.hardware.state, "starting");
  first.emit("close", 1);
  assert.equal(telemetry.hardware, second);
  assert.equal(telemetry.status.hardware.state, "starting");
  assert.equal(telemetry.hardwareBackoff, null);
});

test("hardware launch error remains unavailable and schedules recovery after close", () => {
  const child = fakeHardwareChild();
  const telemetry = new TelemetryService({
    pluginRoot: resolve(tmpdir(), "provider-error"),
    persistPath: resolve(tmpdir(), "packrat-provider-error.json"),
    spawnProcess: () => child,
    createLineInterface: fakeHardwareLines,
    presentMonProvider: fakeProvider(),
  });

  telemetry._startHardware();
  child.emit("error", new Error("spawn blocked"));
  assert.equal(telemetry.status.hardware.state, "unavailable");
  child.emit("close", -1);
  assert.equal(telemetry.status.hardware.state, "unavailable");
  assert.ok(telemetry.hardwareBackoff);
  clearTimeout(telemetry.hardwareBackoff);
  telemetry.hardwareBackoff = null;
});


test("graceful shutdown persists the latest active session before resolving", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "packrat-perf-shutdown-"));
  const path = resolve(dir, "state.json");
  const provider = fakeProvider();
  let providerStopped = false;
  provider.stop = () => { providerStopped = true; };

  const telemetry = new TelemetryService({
    pluginRoot: resolve(dir, "missing"),
    persistPath: path,
    presentMonProvider: provider,
  });

  telemetry.session._start("game.exe", Date.now() - 1000);
  telemetry.session.observeFrame({ application: "game.exe", frameTimeMs: 10 }, {}, Date.now());
  await telemetry.shutdown();

  assert.equal(providerStopped, true);
  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.equal(saved.session.active.process, "game.exe");
  assert.ok(saved.session.active.histogram.count >= 1);
});
