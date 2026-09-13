import test from "node:test";
import assert from "node:assert/strict";
import { parsePresentMonRows, splitCsv } from "../src/presentmon.js";

test("CSV splitter handles quoted application names", () => {
  assert.deepEqual(splitCsv('"Game, Test.exe",123,16.7'), ["Game, Test.exe", "123", "16.7"]);
});

test("PresentMon v2 rows parse process and frametime", () => {
  const rows = parsePresentMonRows([
    "Application,ProcessID,SwapChainAddress,PresentRuntime,MsBetweenPresents",
    "game.exe,4242,0x1,DXGI,16.67",
    "game.exe,4242,0x1,DXGI,33.33",
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].application, "game.exe");
  assert.equal(rows[0].pid, 4242);
  assert.equal(rows[1].frameTimeMs, 33.33);
});

test("PresentMon parser tolerates alternate timing headers and malformed rows", () => {
  const rows = parsePresentMonRows([
    "ProcessName,PID,CPUFrameTime",
    "app.exe,5,8.25",
    "bad.exe,6,NA",
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].frameTimeMs, 8.25);
});


test("prefers MsBetweenPresents when v2 FrameTime is also present", () => {
  const rows = parsePresentMonRows([
    "Application,ProcessID,FrameTime,MsBetweenPresents",
    "game.exe,4242,6.50,16.67",
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].frameTimeMs, 16.67);
});
