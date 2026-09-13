import test from "node:test";
import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { PresentMonProvider, parsePresentMonRows, splitCsv } from "../src/presentmon.js";

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


test("live provider prefers MsBetweenPresents over v2 FrameTime", () => {
  const provider = new PresentMonProvider({ executable: "unused" });
  const frames = [];
  provider.on("frame", (frame) => frames.push(frame));
  provider._consumeLine("Application,ProcessID,FrameTime,MsBetweenPresents");
  provider._consumeLine("game.exe,4242,6.50,16.67");
  assert.equal(frames.length, 1);
  assert.equal(frames[0].application, "game.exe");
  assert.equal(frames[0].frameTimeMs, 16.67);
});


function fakePresentMonChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = () => { child.killed = true; };
  return child;
}

function fakeLineInterface() {
  return { on() {}, close() {} };
}

test("stale PresentMon child cannot overwrite replacement status", () => {
  const children = [];
  const provider = new PresentMonProvider({
    executable: "PresentMon.exe",
    spawnProcess: () => {
      const child = fakePresentMonChild();
      children.push(child);
      return child;
    },
    createLineInterface: fakeLineInterface,
  });

  provider.start();
  const first = children[0];
  provider.restart();
  const second = children[1];

  assert.equal(first.killed, true);
  assert.equal(provider.child, second);
  assert.equal(provider.status.state, "starting");

  first.emit("close", 1);
  assert.equal(provider.child, second);
  assert.equal(provider.status.state, "starting");
  assert.equal(provider.restartTimer, null);
  provider.stop();
});

test("PresentMon launch error remains unavailable and schedules recovery after close", () => {
  const child = fakePresentMonChild();
  const provider = new PresentMonProvider({
    executable: "PresentMon.exe",
    spawnProcess: () => child,
    createLineInterface: fakeLineInterface,
  });

  provider.start();
  child.emit("error", new Error("spawn blocked"));
  assert.equal(provider.status.state, "unavailable");
  child.emit("close", -1);
  assert.equal(provider.status.state, "unavailable");
  assert.ok(provider.restartTimer);
  provider.stop();
});


test("unquoted PresentMon rows use the same parser semantics", () => {
  assert.deepEqual(splitCsv("game.exe,4242,16.67"), ["game.exe", "4242", "16.67"]);
  const rows = parsePresentMonRows([
    "Application,ProcessID,MsBetweenPresents",
    "game.exe,4242,16.67",
  ]);
  assert.deepEqual(rows, [{ application: "game.exe", pid: 4242, frameTimeMs: 16.67 }]);
});

test("live PresentMon cached columns survive quoted process names", () => {
  const provider = new PresentMonProvider({ executable: "unused" });
  const frames = [];
  provider.on("frame", (frame) => frames.push(frame));
  provider._consumeLine("Application,ProcessID,FrameTime,MsBetweenPresents");
  provider._consumeLine('"game,name.exe",4242,6.50,16.67');
  assert.deepEqual(frames, [{ application: "game,name.exe", pid: 4242, frameTimeMs: 16.67 }]);
});


test("PresentMon permission denial waits for explicit restart", () => {
  const child = fakePresentMonChild();
  const children = [child];
  const provider = new PresentMonProvider({
    executable: "PresentMon.exe",
    spawnProcess: () => {
      const next = children.shift() || fakePresentMonChild();
      return next;
    },
    createLineInterface: fakeLineInterface,
  });

  provider.start();
  child.stderr.emit("data", "Access is denied. Add the user to Performance Log Users.");
  assert.equal(provider.status.state, "permission_required");
  child.emit("close", 5);
  assert.equal(provider.status.state, "permission_required");
  assert.equal(provider.restartTimer, null);
  assert.equal(provider.child, null);
  assert.equal(provider.running, true);

  provider.restart();
  assert.equal(provider.status.state, "starting");
  provider.stop();
});
