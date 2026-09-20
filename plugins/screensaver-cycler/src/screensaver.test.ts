/** Pure-logic checks. Run: npm test  (tsx, no Stream Deck needed). */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { advanceIndex, friendlyName, resolveList, scrFilesIn } from "./screensaver";

// friendlyName
assert.equal(friendlyName("Mystify.scr"), "Mystify");
assert.equal(friendlyName("PhotoScreensaver.scr"), "Photo Screensaver");
assert.equal(friendlyName("my_cool-saver.SCR"), "my cool saver");

// advanceIndex: rings forward, tolerates junk / out-of-range current
assert.equal(advanceIndex(3, undefined), 0, "no current -> first");
assert.equal(advanceIndex(3, 0), 1);
assert.equal(advanceIndex(3, 2), 0, "wraps");
assert.equal(advanceIndex(3, 99), 1, "oob current still lands in range");
assert.equal(advanceIndex(0, 0), 0, "empty list never throws");

// scrFilesIn: only .scr, missing dir is empty
const dir = mkdtempSync(path.join(tmpdir(), "scr-test-"));
writeFileSync(path.join(dir, "Alpha.scr"), "");
writeFileSync(path.join(dir, "Beta.SCR"), "");
writeFileSync(path.join(dir, "notes.txt"), "");
const found = scrFilesIn(dir).map((s) => s.name).sort();
assert.deepEqual(found, ["Alpha", "Beta"]);
assert.deepEqual(scrFilesIn(path.join(dir, "nope")), [], "missing dir -> []");

// resolveList: chosen paths win; otherwise falls back to the folder scan (System32 + folder)
assert.deepEqual(resolveList(["a.scr", "b.scr"]), ["a.scr", "b.scr"]);
const fallback = resolveList(undefined, dir);
assert.ok(fallback.includes(path.join(dir, "Alpha.scr")), "empty selection falls back to the custom folder");
assert.ok(fallback.includes(path.join(dir, "Beta.SCR")), "empty selection includes all folder .scr");

console.log("screensaver.test.ts: all assertions passed");
