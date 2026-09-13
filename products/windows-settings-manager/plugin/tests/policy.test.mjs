import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("out");

async function manifest(flavor) {
  const file = path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`, "manifest.json");
  return JSON.parse(await readFile(file, "utf8"));
}

test("Lite exposes curated live Windows controls only", async () => {
  const value = await manifest("lite");
  assert.equal(value.Name, "Windows Settings Manager Lite");
  assert.equal(value.UUID, "com.packrat.windows-settings-manager-lite");
  assert.equal(value.Profiles.length, 5);
  const names = value.Actions.map((item) => item.Name);
  assert.deepEqual(names, [
    "System Status",
    "HDR",
    "Power Plan",
    "Display Topology",
    "Screen & Sleep",
    "Keep Awake",
    "Lock PC"
  ]);
  assert.ok(!JSON.stringify(value).includes("apply-mode"));
});

test("Pro owns the PC Mode layer without inventing optimization actions", async () => {
  const value = await manifest("pro");
  const names = value.Actions.map((item) => item.Name);
  for (const expected of ["Apply PC Mode", "Cycle PC Mode", "Current PC Mode", "Save Current Mode"]) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
  assert.ok(!JSON.stringify(value).match(/registry|cloudstore|sendkeys|quick settings/i));
});

test("all five canonical bundled profile device families are generated", async () => {
  for (const flavor of ["lite", "pro"]) {
    const value = await manifest(flavor);
    assert.deepEqual(value.Profiles.map((item) => item.DeviceType).sort((a, b) => a - b), [0, 1, 2, 7, 9]);
    for (const profile of value.Profiles) {
      const stem = profile.Name.replace(/^profiles\//, "");
      const data = await readFile(path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`, "profiles", `${stem}.streamDeckProfile`));
      assert.equal(data.readUInt32LE(0), 0x04034b50);
      const text = data.toString("utf8");
      assert.match(text, /\.sdProfile\/manifest\.json/);
      assert.match(text, /"Version": "2\.0"/);
    }
  }
});

test("every Pro profile keeps two-way Modes / Settings navigation", async () => {
  const profileDir = path.join(root, "com.packrat.windows-settings-manager-pro.sdPlugin", "profiles");
  for (const device of ["standard", "mini", "xl", "plus", "neo"]) {
    const data = (await readFile(path.join(profileDir, `windows-settings-pro-${device}.streamDeckProfile`))).toString("utf8");
    const matches = data.match(/com\.packrat\.windows-settings-manager-pro\.profile-page/g) ?? [];
    assert.equal(matches.length, 2, `${device} should contain one navigation key on each of two pages`);
  }
});

test("Pro profiles ship named mode slots but no preconfigured system changes", async () => {
  const modes = await readFile(path.resolve("src", "modes.ts"), "utf8");
  for (const id of ["gaming", "work", "night", "present", "movie"]) {
    assert.match(modes, new RegExp(`id: "${id}".*settings: \\{\\}`));
  }

  const profileDir = path.join(root, "com.packrat.windows-settings-manager-pro.sdPlugin", "profiles");
  const standard = (await readFile(path.join(profileDir, "windows-settings-pro-standard.streamDeckProfile"))).toString("utf8");
  for (const id of ["gaming", "work", "night", "present", "movie"]) {
    assert.match(standard, new RegExp(`"modeId": "${id}"`));
  }
});

test("backend forbids brittle UI automation and uses supported Windows control surfaces", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  assert.doesNotMatch(backend, /SendKeys|CloudStore|Quick Settings|mouse_event|SetCursorPos/i);
  for (const required of [
    "SetDisplayConfig",
    "DisplayConfigGetDeviceInfo",
    "DisplayConfigSetDeviceInfo",
    "SetThreadExecutionState",
    "LockWorkStation",
    "powercfg.exe"
  ]) assert.match(backend, new RegExp(required));

  assert.doesNotMatch(backend, /Environment\.OSVersion\.Version\.Build/);
  assert.match(backend, /bool got = TryReadNewHdr/);
  assert.match(backend, /got = TryReadLegacyHdr/);
  assert.match(backend, /enabled = info\.activeColorMode == 2;/);
  assert.doesNotMatch(backend, /activeColorMode == 2 \|\|/);
  assert.match(backend, /wideColorEnforced/);
  assert.match(backend, /advancedColorForceDisabled/);
  assert.match(backend, /supported = advancedColorSupported && !wideColorEnforced && !advancedColorForceDisabled;/);
  assert.match(backend, /sourceKeys\.Count == 1/);
  assert.match(backend, /sourceKeys\.Count == paths\.Length/);
  assert.match(backend, /mixed clone \+ extend graph/i);
  assert.match(backend, /WaitForNewHdrState/);
  assert.match(backend, /WaitForLegacyHdrState/);
  assert.match(backend, /attempt < 12/);
});

test("individual set actions fall back to the live value shown by the inspector", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(actions, /guid = snapshot\.powerPlanGuid/);
  assert.match(actions, /values\.includes\(current/);
  assert.match(inspector, /context\.snapshot\?\.topology/);
});

test("mode application explicitly models COMPLETE, PARTIAL and FAILED", async () => {
  const source = await readFile(path.resolve("src", "modes.ts"), "utf8");
  assert.match(source, /"COMPLETE"/);
  assert.match(source, /"PARTIAL"/);
  assert.match(source, /"FAILED"/);
  assert.match(source, /reported === "PARTIAL"/);
  assert.match(source, /hasPartial = steps\.some/);
  assert.match(source, /topology[\s\S]*setTopology[\s\S]*hdr[\s\S]*setHdr[\s\S]*powerPlanGuid[\s\S]*setPowerPlan/);
});

test("state refresh polls Windows and the inspector refresh button forces a real read", async () => {
  const state = await readFile(path.resolve("src", "state.ts"), "utf8");
  const plugin = await readFile(path.resolve("src", "plugin.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(state, /setInterval\(\(\) => void this\.refresh\(\), 2500\)/);
  assert.match(state, /this\.backend\.snapshot\(\)/);
  assert.match(plugin, /payload\?\.type === "refresh"/);
  assert.match(plugin, /runtime\.state\.refresh\(\)\.then\(sendInspectorContext\)/);
  assert.match(inspector, /sendPlugin\(\{ type: "refresh" \}\)/);
});
