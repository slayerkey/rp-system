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

  for (const command of ["restart-fps", "reset-session", "enable-fps-access", "open-presentmon-help"]) {
    assert.ok(js.includes('command("' + command + '")'), "Inspector missing command: " + command);
    assert.ok(plugin.includes('payload.command === "' + command + '"'), "Plugin missing command handler: " + command);
  }
});


test("property inspector sources contain no escaped-newline patch artifacts", async () => {
  const [html, js] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.html"), "utf8"),
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
  ]);
  assert.equal(html.includes("\\n"), false);
  assert.equal(js.includes("\\n"), false);
});


test("property inspector uses SDPI Components instead of a hand-rolled WebSocket settings channel", async () => {
  const [html, js] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.html"), "utf8"),
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
  ]);

  const sdpiAt = html.indexOf('src="sdpi-components.js');
  const inspectorAt = html.indexOf('src="inspector.js');
  assert.ok(sdpiAt >= 0, "Inspector must load the vendored SDPI Components runtime.");
  assert.ok(inspectorAt > sdpiAt, "SDPI Components must load before inspector.js.");
  assert.doesNotMatch(js, /new\s+WebSocket\s*\(/);
  assert.match(js, /const\s*\{\s*streamDeckClient,\s*useSettings\s*\}\s*=\s*SDPIComponents/);
  assert.match(js, /useSettings\("metricId"/);
  assert.match(js, /sendToPropertyInspector\.subscribe/);
  assert.match(js, /streamDeckClient\.send\("sendToPlugin"/);
});

test("standard inspector fields persist through SDPI setting controls", async () => {
  const html = await readFile(resolve(root, "ui", "inspector.html"), "utf8");
  for (const key of [
    "windowMs",
    "fpsMode",
    "lowMode",
    "thresholdDirection",
    "threshold",
    "scaleMin",
    "scaleMax",
    "accent",
  ]) {
    assert.match(html, new RegExp('setting="' + key + '"'), "Missing SDPI setting binding for " + key);
  }
  assert.doesNotMatch(html, /Checking game telemetry/i);
  assert.doesNotMatch(html, /Checking hardware sensors/i);
});

test("plugin sends live inspector state through the SDK UI channel", async () => {
  const plugin = await readFile(resolve(root, "src", "plugin.js"), "utf8");
  assert.match(plugin, /streamDeck\.ui\.sendToPropertyInspector/);
  assert.match(plugin, /streamDeck\.ui\.action/);
  assert.doesNotMatch(plugin, /record\.action\.sendToPropertyInspector/);
});

test("build packages vendored SDPI Components and its license", async () => {
  const build = await readFile(resolve(root, "scripts", "build.mjs"), "utf8");
  assert.match(build, /sdpi-components\.js/);
  assert.match(build, /SDPI-Components-MIT\.txt/);
  await readFile(resolve(root, "ui", "sdpi-components.js"), "utf8");
  await readFile(resolve(root, "licenses", "SDPI-Components-MIT.txt"), "utf8");
});

test("property inspector sources contain no escaped-newline CSS patch artifacts", async () => {
  const css = await readFile(resolve(root, "ui", "inspector.css"), "utf8");
  assert.equal(css.includes("\\n"), false);
});

test("metric picker prioritizes common metrics and hides raw hardware behind an explicit advanced toggle", async () => {
  const [html, js] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.html"), "utf8"),
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
  ]);

  assert.match(html, /id="advancedMetricsButton"/);
  assert.match(js, /const COMMON_METRICS = \[/);
  for (const label of [
    "GPU Temperature",
    "CPU Temperature",
    "GPU Fan Speed",
    "GPU Load",
    "CPU Load",
    "RAM Used",
    "GPU Power",
    "CPU Power",
    "Game FPS",
    "Frametime",
  ]) {
    assert.ok(js.includes(label), "Missing common metric label: " + label);
  }
  assert.match(js, /showAdvanced = !showAdvanced/);
  assert.match(js, /startsWith\("lhm\."\)/);
  assert.doesNotMatch(html, />Libre Hardware Monitor</);
});

test("permission-required UX offers one-click FPS enablement without exposing group-management jargon", async () => {
  const [html, js, plugin] = await Promise.all([
    readFile(resolve(root, "ui", "inspector.html"), "utf8"),
    readFile(resolve(root, "ui", "inspector.js"), "utf8"),
    readFile(resolve(root, "src", "plugin.js"), "utf8"),
  ]);

  assert.match(js, /Enable Game FPS/);
  assert.match(js, /command\("enable-fps-access"\)/);
  assert.match(plugin, /enable-fps-access/);
  assert.doesNotMatch(html, /Performance Log Users/i);
  assert.doesNotMatch(js, /Add your Windows account to Performance Log Users/i);
});

test("build packages the one-click Windows FPS setup helper", async () => {
  const build = await readFile(resolve(root, "scripts", "build.mjs"), "utf8");
  const setup = await readFile(resolve(root, "setup", "enable-fps-access.ps1"), "utf8");
  assert.match(build, /enable-fps-access\.ps1/);
  assert.match(setup, /S-1-5-32-559/);
  assert.match(setup, /Start-Process/);
  assert.match(setup, /Add-LocalGroupMember/);
});
