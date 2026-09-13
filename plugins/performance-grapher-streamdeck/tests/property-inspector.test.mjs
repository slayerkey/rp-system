import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

test("property inspector JavaScript references only controls present in HTML", async () => {
  const [html, js] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.html"), "utf8"),
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
  ]);

  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
  const references = new Set([...js.matchAll(/\$\(["']([^"']+)["']\)/g)].map((match) => match[1]));

  assert.ok(references.size > 0);
  for (const id of references) {
    assert.ok(ids.has(id), "Inspector JS references missing HTML id: " + id);
  }
});

test("property inspector reveals itself only after action-specific filtering", async () => {
  const [css, js] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.css"), "utf8"),
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
  ]);

  assert.match(css, /body:not\(\.ready\)\s+main\s*\{[^}]*visibility:\s*hidden/i);
  const filterAt = js.indexOf("filterFields();");
  const revealAt = js.indexOf('document.body.classList.add("ready")');
  assert.ok(filterAt >= 0);
  assert.ok(revealAt > filterAt, "Inspector must reveal only after filtering fields");
});

test("diagnostic buttons have matching plugin commands", async () => {
  const [js, plugin] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
    readFile(resolve(root, "src", "plugin.js"), "utf8"),
  ]);

  for (const command of ["restart-fps", "reset-session", "open-presentmon-help"]) {
    assert.ok(js.includes('command("' + command + '")'), "Inspector missing command: " + command);
    assert.ok(plugin.includes('payload.command === "' + command + '"'), "Plugin missing command handler: " + command);
  }
});
