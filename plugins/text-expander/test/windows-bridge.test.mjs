import test from "node:test";
import assert from "node:assert/strict";
import { getWindowsContext, focusWindow } from "../src/windows.mjs";

test("Windows bridge compiles and returns local foreground context", { skip: process.platform !== "win32" }, async () => {
  const value = await getWindowsContext();
  assert.equal(value.ok, true);
  assert.equal(typeof value.hwnd, "string");
  assert.equal(typeof value.app, "string");
  assert.equal(typeof value.username, "string");
  assert.equal(typeof value.computer, "string");
});

test("Windows bridge safely rejects a zero foreground handle", { skip: process.platform !== "win32" }, async () => {
  assert.equal(await focusWindow("0"), false);
});
