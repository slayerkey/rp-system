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
  assert.equal(value.Profiles.length, 7);
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

test("manifest targets Stream Deck 7.3 for current profile navigation and device coverage", async () => {
  for (const flavor of ["lite", "pro"]) {
    const value = await manifest(flavor);
    assert.equal(value.Software.MinimumVersion, "7.3");
  }
});

test("Pro owns the PC Mode layer without inventing optimization actions", async () => {
  const value = await manifest("pro");
  const names = value.Actions.map((item) => item.Name);
  for (const expected of ["Apply PC Mode", "Cycle PC Mode", "Current PC Mode", "Save Current Mode"]) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
  assert.ok(!JSON.stringify(value).match(/registry|cloudstore|sendkeys|quick settings/i));
});

test("all seven current bundled profile device families are generated", async () => {
  for (const flavor of ["lite", "pro"]) {
    const value = await manifest(flavor);
    assert.deepEqual(value.Profiles.map((item) => item.DeviceType).sort((a, b) => a - b), [0, 1, 2, 7, 9, 12, 13]);
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
  for (const device of ["standard", "mini", "xl", "plus", "neo", "galleon", "plus-xl"]) {
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
  assert.match(backend, /RtlGetVersion/);
  assert.match(backend, /RuntimeWindowsBuild >= 26100/);
  assert.match(backend, /SupportsSeparatedHdrApi/);
  assert.match(backend, /AssertSize\(typeof\(PathSourceInfo\), 20/);
  assert.match(backend, /AssertSize\(typeof\(PathTargetInfo\), 48/);
  assert.match(backend, /AssertSize\(typeof\(PathInfo\), 72/);
  assert.match(backend, /AssertSize\(typeof\(ModeInfo\), 64/);
  assert.match(backend, /AssertSize\(typeof\(AdvancedColorInfo2\), 36/);
  assert.match(backend, /AssertSize\(typeof\(HdrSet\), 24/);
  assert.match(backend, /AssertSize\(typeof\(RtlOsVersionInfoEx\), 284[\s\S]*RuntimeWindowsBuild = ReadWindowsBuild\(\)/);
  assert.match(backend, /enabled = info\.activeColorMode == 2;/);
  assert.match(backend, /supported = enabled \|\| \(hdrSupported && !limitedByPolicy\);/);
  assert.doesNotMatch(backend, /activeColorMode == 2 \|\|/);
  assert.doesNotMatch(backend, /SET_ADVANCED_COLOR_STATE/);
  assert.doesNotMatch(backend, /TryReadLegacyHdr/);
  assert.match(backend, /Reliable HDR control requires Windows 11 24H2/);
  assert.match(backend, /errors = new string\[0\]/);
  assert.match(backend, /sourceKeys\.Count == 1/);
  assert.match(backend, /sourceKeys\.Count == paths\.Length/);
  assert.match(backend, /mixed clone \+ extend graph/i);
  assert.match(backend, /WaitForNewHdrState/);
  assert.doesNotMatch(backend, /WaitForLegacyHdrState/);
  assert.match(backend, /attempt < 12/);
});

test("timeout settings reject blank, negative and out-of-range values instead of turning them into Never", async () => {
  const store = await readFile(path.resolve("src", "store.ts"), "utf8");
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  const html = await readFile(path.resolve("ui", "config.html"), "utf8");
  assert.match(store, /typeof value === "number"/);
  assert.match(store, /value <= 0xffffffff/);
  assert.match(actions, /number <= 0xffffffff/);
  assert.match(inspector, /if \(raw === ""\) return null/);
  assert.match(inspector, /value <= 0xffffffff \? value : null/);
  assert.match(html, /max="4294967295"/);
});

test("power-plan cycling never guesses when the active plan cannot be confirmed", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(actions, /const activeGuid = snapshot\.powerPlanGuid\?\.toLowerCase\(\)/);
  assert.match(actions, /plan\.active \|\| \(activeGuid && plan\.guid\.toLowerCase\(\) === activeGuid\)/);
  assert.match(actions, /if \(index < 0\) return ev\.action\.showAlert\(\)/);
});

test("display cycling never guesses from an unknown mixed topology", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  const html = await readFile(path.resolve("ui", "config.html"), "utf8");
  assert.match(actions, /if \(index < 0\) return ev\.action\.showAlert\(\)/);
  assert.match(inspector, /liveTopology\) \? liveTopology : ""/);
  assert.match(html, /<option value="">Choose topology<\/option>/);
});

test("Property Inspector does not present cached Windows values as live while backend is offline", async () => {
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(inspector, /const offline = Boolean\(snapshot && !snapshot\.backendOnline\)/);
  assert.match(inspector, /\["HDR", offline \? "Offline"/);
  assert.match(inspector, /\["Display", offline \? "Offline"/);
  assert.match(inspector, /\["Power", offline \? "Offline"/);
  assert.match(inspector, /\["Screen AC", offline \? "Offline"/);
  assert.match(inspector, /\["Sleep AC", offline \? "Offline"/);
  assert.match(inspector, /\["Keep Awake", offline \? "Offline"/);
});

test("Property Inspector re-renders action defaults when live Windows context arrives", async () => {
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(inspector, /const liveTimeout = context\.snapshot\?\.timeout/);
  assert.match(inspector, /settings\[id\] \?\? liveTimeout\?\.\[id\] \?\? ""/);
  assert.match(inspector, /renderActionSettings\(\);[\s\S]*if \(!modeDirty\) populateModeEditor\(\)/);
});

test("individual set actions fall back to the live value shown by the inspector", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(actions, /guid = snapshot\.powerPlanGuid/);
  assert.match(actions, /values\.includes\(current/);
  assert.match(inspector, /context\.snapshot\?\.topology/);
});

test("state-derived actions refresh Windows before calculating their target", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(actions, /async function freshSnapshot\(\): Promise<SystemSnapshot \| null>[\s\S]*await runtime\.state\.refresh\(\)/);
  for (const className of ["HdrBase", "PowerBase", "TopologyBase", "TimeoutBase", "AwakeBase", "CycleModeBase", "SaveModeBase"]) {
    assert.match(actions, new RegExp(`class ${className}[\\s\\S]*?await freshSnapshot\\(\\)`), `missing fresh snapshot in ${className}`);
  }
});

test("HDR Toggle refuses an uncertain display read instead of guessing", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(actions, /operation === "toggle" && snapshot\.hdr\.errors\.length > 0/);
});

test("HDR read uncertainty blocks mode matching and Save Current HDR capture", async () => {
  const source = await readFile(path.resolve("src", "modes.ts"), "utf8");
  const render = await readFile(path.resolve("src", "render.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(source, /snapshot\.hdr\.errors\.length > 0/);
  assert.match(source, /snapshot\.hdr\.errors\.length === 0/);
  assert.match(render, /!snapshot\.hdr\.available\) return "HDR\\nN\/A"[\s\S]*snapshot\.hdr\.errors\.length > 0\) return "HDR\\nCHECK"[\s\S]*snapshot\.hdr\.supportedCount === 0/);
  assert.match(inspector, /snapshot\.hdr\.errors\?\.length/);
  assert.match(inspector, /return "Check"/);
});

test("HDR mode matching requires a genuinely controllable HDR display", async () => {
  const source = await readFile(path.resolve("src", "modes.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(source, /snapshot\.hdr\.supportedCount === 0/);
  assert.match(source, /snapshot\.hdr\.enabledCount === snapshot\.hdr\.supportedCount/);
  assert.match(inspector, /const hdrUsable = Boolean/);
  assert.match(inspector, /option\.disabled = !hdrUsable/);
});

test("PowerShell backend does not shadow the automatic args variable", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  assert.doesNotMatch(backend, /\$args\s*=\s*\$request\.args/i);
  assert.doesNotMatch(backend, /param\(\$Args\)/i);
  assert.match(backend, /\$requestArgs = \$request\.args/);
  assert.match(backend, /param\(\$InputArgs\)/);
});

test("Windows smoke enforces the safe HDR API boundary", async () => {
  const smoke = await readFile(path.resolve("scripts", "backend-smoke.ps1"), "utf8");
  assert.match(smoke, /osBuild -lt 26100[\s\S]*hdr\.api -ne "unavailable"/);
  assert.match(smoke, /osBuild -ge 26100[\s\S]*hdr\.api -ne "hdr-state"/);
});

test("HDR transactions cannot report COMPLETE when an active display is unreadable", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  assert.match(backend, /int unreadable = 0/);
  assert.match(backend, /if \(!readable\)[\s\S]*unreadable\+\+/);
  assert.match(backend, /bool uncertain = unreadable > 0 \|\| \(state\.errors != null && state\.errors\.Length > 0\)/);
  assert.match(backend, /verified && succeeded == supported && !uncertain \? "COMPLETE"/);
  assert.match(backend, /\$errors\.Add\("HDR: \$hdrError"\)/);
});

test("timeout writes preserve PARTIAL instead of collapsing it into FAILED", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(backend, /Invoke-PowerCfg @commandArgs/);
  assert.match(backend, /\$matched -eq \$checks\.Count -and \$activationOk/);
  assert.match(backend, /elseif \(\$matched -gt 0\)[\s\S]*"PARTIAL"/);
  assert.match(backend, /Write-Reply \$id \(\$result\.status -ne "FAILED"\) \$result \$result\.error/);
  assert.match(actions, /setTimeout[\s\S]*reply\.result\?\.status !== "COMPLETE"/);
});

test("dependent mode settings are skipped when their prerequisite was not confirmed", async () => {
  const source = await readFile(path.resolve("src", "modes.ts"), "utf8");
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  assert.match(source, /Skipped HDR because the requested display topology was not confirmed/);
  assert.match(source, /Skipped timeouts because the requested power plan was not confirmed/);
  assert.match(source, /key === "hdr" && settings\.topology/);
  assert.match(source, /key === "timeout" && settings\.powerPlanGuid/);
  assert.match(backend, /string\.Equals\(GetTopology\(\), topology/);
  assert.match(backend, /if \(current == enabled\) return true;/);
});

test("Cycle PC Mode advances past a failed target without ignoring later live mode changes", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(actions, /advancePastFailedAttempt && this\.cursorId[\s\S]*\? this\.cursorId[\s\S]*matching\?\.id \|\| this\.cursorId/);
  assert.match(actions, /this\.cursorId = mode\.id/);
  assert.match(actions, /this\.advancePastFailedAttempt = result\.status !== "COMPLETE"/);
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

test("Save Current Mode forces a fresh Windows read and refuses offline capture", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const plugin = await readFile(path.resolve("src", "plugin.ts"), "utf8");
  assert.match(actions, /SaveModeBase[\s\S]*await runtime\.state\.refresh\(\)[\s\S]*if \(!snapshot\.backendOnline\)/);
  assert.match(plugin, /payload\?\.type === "capture-mode"[\s\S]*await runtime\.state\.refresh\(\)[\s\S]*if \(!snapshot\.backendOnline\)/);
  assert.match(plugin, /settings: captureModeSettings\(snapshot\)/);
});

test("background action repaints tolerate keys disappearing during profile changes", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(actions, /for \(const instance of this\.actions\)[\s\S]*try \{[\s\S]*await this\.paint/);
  assert.match(actions, /this\.paint\(ev\.action, ev\.payload\.settings \?\? \{\}\)\.catch/);
});

test("backend timeouts and failed startup force a clean PowerShell restart", async () => {
  const backend = await readFile(path.resolve("src", "backend.ts"), "utf8");
  assert.match(backend, /this\.dispose\(error\)[\s\S]*reject\(error\)/);
  assert.match(backend, /this\.process\.exitCode === null/);
  assert.match(backend, /catch \(error\)[\s\S]*this\.dispose\(failure\)[\s\S]*throw failure/);
  assert.match(backend, /child && child\.exitCode === null\) child\.kill\(\)/);
});

test("backend loss clears Keep Awake and stateful keys stop showing stale values", async () => {
  const state = await readFile(path.resolve("src", "state.ts"), "utf8");
  const render = await readFile(path.resolve("src", "render.ts"), "utf8");
  assert.match(state, /backendOnline: false,[\s\S]*keepAwake: false/);
  assert.match(render, /timeoutTitle[\s\S]*!snapshot\.backendOnline\) return "TIMEOUT\\nOFFLINE"/);
  assert.match(render, /awakeTitle[\s\S]*!snapshot\.backendOnline\) return "AWAKE\\nOFFLINE"/);
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
