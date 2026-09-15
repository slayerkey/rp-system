import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getWindowsContext, focusWindow } from "../src/windows.mjs";

const here=path.dirname(fileURLToPath(import.meta.url));
const bridgePath=path.join(here,"..","runtime","win-bridge.ps1");
const windowsSourcePath=path.join(here,"..","src","windows.mjs");

test("Windows bridge compiles and returns local foreground context", { skip: process.platform !== "win32" }, async () => {
  const value = await getWindowsContext();
  assert.equal(value.ok, true);
  assert.equal(typeof value.hwnd, "string");
  assert.equal(typeof value.app, "string");
  assert.equal(typeof value.username, "string");
  assert.equal(typeof value.computer, "string");
  assert.equal(value.inputStructSize, value.expectedInputStructSize);
  assert.equal(value.inputStructSize, process.arch === "x64" ? 40 : 28);
});

test("Windows bridge safely rejects a zero foreground handle", { skip: process.platform !== "win32" }, async () => {
  assert.equal(await focusWindow("0"), false);
});

test("Windows bridge declares the full native INPUT union", async () => {
  const source=await fs.readFile(bridgePath,"utf8");
  assert.match(source,/struct MOUSEINPUT/);
  assert.match(source,/struct KEYBDINPUT/);
  assert.match(source,/struct HARDWAREINPUT/);
  assert.match(source,/ExpectedInputStructSize/);
  assert.match(source,/IntPtr\.Size == 8 \? 40 : 28/);
});

test("Windows bridge treats authored line breaks and tabs as text, not submit/navigation keys", async () => {
  const source=await fs.readFile(bridgePath,"utf8");
  const start=source.indexOf("public static void TypeText");
  const end=source.indexOf("public static void Paste",start);
  assert.ok(start>=0&&end>start);
  const typeText=source.slice(start,end);
  assert.match(typeText,/UnicodeChar\('\\r'\)/);
  assert.match(typeText,/UnicodeChar\('\\t'\)/);
  assert.doesNotMatch(typeText,/Press\(VK_RETURN\)/);
  assert.doesNotMatch(typeText,/Press\(VK_TAB\)/);
});

test("clipboard paste always releases Ctrl, retries clipboard locks, and waits adaptively before restore", async () => {
  const source=await fs.readFile(bridgePath,"utf8");
  assert.match(source,/public static void Paste\(\)[\s\S]*?try[\s\S]*?Press\(VK_V\)[\s\S]*?finally[\s\S]*?VirtualKey\(VK_CONTROL, true\)/);
  assert.match(source,/function Invoke-ClipboardRetry/);
  assert.match(source,/pasteDelayMs/);
  assert.match(source,/SetDataObject\(\$original, \$true\)/);
});

test("Node bridge wrapper times out hung PowerShell input work", async () => {
  const source=await fs.readFile(windowsSourcePath,"utf8");
  assert.match(source,/Windows bridge timed out while running/);
  assert.match(source,/15000/);
  assert.match(source,/child\.kill\(\)/);
});
