import test from "node:test";
import assert from "node:assert/strict";
import { BoundedHistory } from "../src/history.js";

test("history stays bounded and preserves worst bucket point", () => {
  const h = new BoundedHistory({ rawMax: 5, archiveMax: 3, archiveMs: 1000, archiveMode: "max" });
  for (let i = 0; i < 30; i += 1) h.push(i * 250, i === 26 ? 999 : i);
  const json = h.toJSON();
  assert.equal(json.raw.length, 5);
  assert.ok(json.archive.length <= 3);
  assert.ok(json.archive.some((p) => p[1] === 999));
});

test("corrupt persistence input degrades to an empty bounded history", () => {
  const h = BoundedHistory.fromJSON({ raw: [["bad", "x"], [1, 2]], archive: null }, { rawMax: 4, archiveMax: 4 });
  assert.deepEqual(h.raw, [[1, 2]]);
  assert.equal(h.latest(), 2);
});

test("long windows merge archive and recent data in timestamp order", () => {
  const h = new BoundedHistory({ rawMax: 4, archiveMax: 20, archiveMs: 1000, archiveMode: "max" });
  for (let i = 0; i < 40; i += 1) h.push(i * 250, i);
  const series = h.series(20_000, 10_000);
  for (let i = 1; i < series.length; i += 1) assert.ok(series[i][0] >= series[i - 1][0]);
  assert.equal(series.at(-1)[1], 39);
});


test("whole-session reads include retained archive plus recent points", () => {
  const h = new BoundedHistory({ rawMax: 4, archiveMax: 20, archiveMs: 1000, archiveMode: "max" });
  for (let i = 0; i < 40; i += 1) h.push(i * 250, i);
  h.toJSON();
  const series = h.series(0, 10_000);
  assert.ok(series.some(([at]) => at < h.raw[0][0]));
  assert.equal(series.at(-1)[1], 39);
});


test("15 minute FPS history falls back to archive when raw coverage is shorter", () => {
  const history = new BoundedHistory({
    rawMax: 3600,
    archiveMax: 21600,
    archiveMs: 1000,
    archiveMode: "min",
  });
  const now = 1_000_000;

  for (let at = now - 15 * 60_000; at <= now; at += 100) {
    history.push(at, at === now - 12 * 60_000 ? 30 : 144);
  }
  history.toJSON();

  const series = history.series(15 * 60_000, now);
  assert.ok(series[0][0] <= now - 14 * 60_000, "archive must supply history older than retained raw points");
  assert.ok(series.some(([, value]) => value === 30), "older FPS drop must survive in the 15 minute window");
});

test("restored histories are sorted chronologically before latest/series use", () => {
  const history = BoundedHistory.fromJSON({
    raw: [[3000, 3], [1000, 1], [2000, 2]],
    archive: [[2000, 20], [0, 0], [1000, 10]],
  }, { rawMax: 10, archiveMax: 10, archiveMs: 1000 });

  assert.deepEqual(history.raw.map(([at]) => at), [1000, 2000, 3000]);
  assert.deepEqual(history.archive.map(([at]) => at), [0, 1000, 2000]);
  assert.equal(history.latest(), 3);
});
