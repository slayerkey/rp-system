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
