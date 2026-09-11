import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".");
const source = path.join(repo, "widgets", "_src", "window-manager-xeneon");
const ship = path.join(repo, "widgets", "window-manager-xeneon");

for (const file of ["window-manager.js", "rat-art.mjs", "visual-smoke.mjs"]) {
  const full = path.join(source, file);
  assert.equal(fs.existsSync(full), true, `missing ${file}`);
  const result = spawnSync(process.execPath, ["--check", full], { encoding: "utf8" });
  assert.equal(result.status, 0, `${file} syntax failed: ${result.stderr || result.stdout}`);
}

const html = fs.readFileSync(path.join(source, "index.html"), "utf8");
const css = fs.readFileSync(path.join(source, "window-manager.css"), "utf8");
const js = fs.readFileSync(path.join(source, "window-manager.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(ship, "manifest.json"), "utf8"));
const submission = JSON.parse(fs.readFileSync(path.join(source, "submission.json"), "utf8"));

assert.equal(manifest.author, "PackRat 🐀");
assert.equal(manifest.id, "com.packrat.window-manager-xeneon");
assert.equal(manifest.name, "Window Manager for XENEON");
assert.equal(manifest.version, "1.0.0");
assert.equal(manifest.interactive, true);
assert.deepEqual(manifest.os, [{ platform: "windows" }]);
assert.equal(submission.slug, "window-manager-xeneon");
assert.equal(submission.type, "widget");
assert.equal(submission.price_usd, 9.99);
assert.equal(submission.version, "1.0.0");
assert.match(submission.description, /free PackRat Window Bridge companion/i);
assert.match(submission.description, /127\.0\.0\.1/);
assert.match(submission.description, /not sent to a cloud service/i);

const properties = [...html.matchAll(/name=["']x-icue-property["'][^>]*content=["']([^"']+)["']/g)].map((match) => match[1]);
for (const property of ["bridgeKey", "showPinned", "showIcons", "textColor", "accentColor", "backgroundColor"]) {
  assert.ok(properties.includes(property), `missing iCUE property ${property}`);
}
const tripletStart = properties.indexOf("textColor");
assert.deepEqual(properties.slice(tripletStart, tripletStart + 3), ["textColor", "accentColor", "backgroundColor"], "Custom Style triplet must remain contiguous and ordered");

for (const slot of ["s-h", "s-v", "m-h", "m-v", "l-h", "l-v", "xl-h", "xl-v"]) {
  assert.match(css, new RegExp(`data-slot=["']${slot}["']`), `missing responsive CSS for ${slot}`);
}

for (const action of ["focus", "minimize", "maximize_restore", "snap_left", "snap_right", "move_monitor", "close"]) {
  assert.ok(js.includes(`\"${action}\"`), `missing action ${action}`);
}
assert.match(js, /ws:\/\/127\.0\.0\.1:17487\/widget/);
assert.match(js, /type:\s*"hello"/);
assert.match(js, /key:\s*model\.settings\.bridgeKey/);
assert.match(js, /confirmClose/);
assert.match(js, /sendCommand\("close"\)/);
assert.match(js, /PIN_STORAGE_KEY/);
assert.match(js, /schemaVersion:\s*1/);
assert.match(js, /version_mismatch/);
assert.match(js, /pagehide/);
assert.equal(/setInterval\s*\(/.test(js), false, "widget must not own a polling interval");
assert.match(js, /\^data:image\\\/(?:png\|svg\\\+xml);/);
assert.match(js, /__PACKRAT_WINDOW_FIXTURE__/);
assert.match(js, /__PACKRAT_WINDOW_TEST__/);
assert.equal(/https?:\/\//i.test(js), false, "widget runtime must not call remote HTTP services");
assert.equal(/<script[^>]+src=["']https?:/i.test(html), false, "no remote scripts");
assert.equal(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i.test(html), false, "no remote stylesheets");
assert.equal(js.includes("EnumWindows"), false, "widget must not pretend it can call Win32 directly");

const closeHandler = js.indexOf('byId("confirmClose").addEventListener');
const directClose = js.indexOf('byId("closeAction").addEventListener');
assert.ok(directClose >= 0 && closeHandler > directClose, "safe close confirmation path missing");

console.log("WINDOW MANAGER XENEON DEV QA PASS: identity, paid-only metadata, localhost pairing, safe close, actions, fixtures, all eight layouts, Custom Style triplet and no remote runtime dependencies");
