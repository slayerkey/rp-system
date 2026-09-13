import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HistoryStore } from "../src/history.js";

test("simulated 24h+ monitoring stays bounded and survives plugin restart", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ihp-storage-"));
  const filePath = path.join(dir, "history.json");
  const store = new HistoryStore({ filePath, maxHours: 24 });
  const start = Date.now() - 17_499 * 10_000;
  for (let i = 0; i < 17_500; i += 1) {
    store.addSample({
      t: start + i * 10_000,
      ok: true,
      ms: 20 + (i % 5),
      method: "icmp",
      lossCounted: true,
      lossOk: true
    });
  }
  store.addSpeedTest({ ok: true, completedAt: start, totalBytes: 10_000_000 });
  store.flush(true);

  assert.ok(store.state.samples.length <= 8_641, "at most roughly 24h of 10-second samples");
  assert.ok(fs.statSync(filePath).size < 2_500_000, "bounded history file stays comfortably below a few MB");

  const reloaded = new HistoryStore({ filePath, maxHours: 24 });
  reloaded.load();
  assert.equal(reloaded.state.speedTests.length, 1);
  assert.ok(reloaded.state.samples.length > 0);
});

test("outage list and speed-test history are independently bounded", () => {
  const store = new HistoryStore({ filePath: path.join(os.tmpdir(), "ihp-nonexistent-" + Date.now() + ".json"), maxHours: 24 });
  for (let i = 0; i < 150; i += 1) {
    store.state.outages.push({ start: Date.now() - i * 1000, end: Date.now() - i * 1000 + 500, durationMs: 500 });
  }
  for (let i = 0; i < 50; i += 1) store.addSpeedTest({ ok: true, completedAt: Date.now() + i });
  store.prune();
  assert.ok(store.state.outages.length <= 100);
  assert.equal(store.state.speedTests.length, 20);
});
