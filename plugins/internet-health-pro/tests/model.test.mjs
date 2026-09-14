import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GLOBAL_SETTINGS, classifyHealth, computeMetrics, normalizeGlobalSettings, outageSummary } from "../src/model.js";

function sample(t, ms, extra = {}) {
  return { t, ok: true, ms, method: "icmp", lossCounted: true, lossOk: true, ...extra };
}

test("healthy connection remains GOOD", () => {
  const now = 1_000_000;
  const metrics = computeMetrics([sample(now - 20_000, 22), sample(now - 10_000, 24), sample(now, 23)], 30, now);
  assert.equal(metrics.current, 23);
  assert.equal(metrics.loss, 0);
  assert.ok(metrics.jitter <= 2);
  assert.equal(classifyHealth({ status: "online" }, metrics, {}).state, "GOOD");
});

test("latency and very slow connection cross transparent thresholds", () => {
  const now = 1_000_000;
  const degraded = computeMetrics([sample(now, 95)], 30, now);
  const bad = computeMetrics([sample(now, 900)], 30, now);
  assert.equal(classifyHealth({ status: "online" }, degraded, {}).state, "DEGRADED");
  assert.equal(classifyHealth({ status: "online" }, bad, {}).state, "BAD");
});

test("jitter spike uses adjacent successful probes from the same method", () => {
  const now = 1_000_000;
  const metrics = computeMetrics([
    sample(now - 30_000, 20),
    sample(now - 20_000, 21),
    sample(now - 10_000, 80),
    sample(now, 18)
  ], 30, now);
  assert.ok(metrics.jitter > 30);
  assert.equal(classifyHealth({ status: "online" }, metrics, {}).reason, "HIGH JITTER");
});

test("probe loss is counted from explicit observed loss channel", () => {
  const now = 1_000_000;
  const samples = [
    sample(now - 30_000, 20),
    sample(now - 20_000, 21, { ok: true, method: "tcp", lossOk: false }),
    sample(now - 10_000, 22),
    sample(now, 23)
  ];
  const metrics = computeMetrics(samples, 30, now);
  assert.equal(metrics.attempts, 4);
  assert.equal(metrics.failures, 1);
  assert.equal(metrics.loss, 25);
  assert.equal(classifyHealth({ status: "online" }, metrics, {}).reason, "HIGH PROBE LOSS");
});

test("outage summary separates current duration, last outage and recent count", () => {
  const now = 10_000_000;
  const outages = [
    { start: now - 90_000, end: now - 60_000, durationMs: 30_000 },
    { start: now - 10_000, end: null, durationMs: null }
  ];
  const summary = outageSummary(outages, now, null);
  assert.equal(summary.currentDurationMs, 10_000);
  assert.equal(summary.last.durationMs, 30_000);
  assert.equal(summary.count24h, 2);
});


test("default monitoring cadence is five seconds with optional one second mode", () => {
  assert.equal(DEFAULT_GLOBAL_SETTINGS.intervalSeconds, 5);
  assert.equal(normalizeGlobalSettings({}).intervalSeconds, 5);
  assert.equal(normalizeGlobalSettings({ intervalSeconds: 1 }).intervalSeconds, 1);
  assert.equal(normalizeGlobalSettings({ intervalSeconds: 10 }).intervalSeconds, 10);
});
