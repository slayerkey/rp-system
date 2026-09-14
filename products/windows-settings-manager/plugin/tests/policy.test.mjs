import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("out");

async function manifest(flavor) {
  const file = path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`, "manifest.json");
  return JSON.parse(await readFile(file, "utf8"));
}

const DEVICE_GRIDS = new Map([
  [0, [5, 3]],
  [1, [3, 2]],
  [2, [8, 4]],
  [7, [4, 2]],
  [9, [4, 2]],
  [12, [4, 3]],
  [13, [9, 4]]
]);

function storedZipEntries(buffer) {
  const entries = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    assert.equal(compression, 0, "profile archive entries must be stored without compression");
    assert.equal(compressedSize, uncompressedSize, "stored profile entry size mismatch");

    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const data = buffer.subarray(dataStart, dataStart + uncompressedSize);
    entries.push({ name, data });
    offset = dataStart + compressedSize;
  }
  return entries;
}

test("both editions assemble complete Stream Deck package trees", async () => {
  const sharedRequired = [
    "bin/plugin.js",
    "bin/package.json",
    "bin/windows-settings-backend.ps1",
    "ui/config.html",
    "ui/pi.css",
    "ui/pi.js",
    "ui/packrat-icon.png",
    "imgs/plugin/marketplace.png",
    "imgs/plugin/marketplace@2x.png",
    "imgs/plugin/category-icon.svg",
    "imgs/plugin/category-icon@2x.svg",
    "imgs/actions/common/icon.svg",
    "imgs/actions/common/icon@2x.svg",
    "imgs/actions/common/key.svg",
    "imgs/actions/common/key@2x.svg"
  ];
  const deviceStems = ["standard", "mini", "xl", "plus", "neo", "galleon", "plus-xl"];

  for (const flavor of ["lite", "pro"]) {
    const pluginRoot = path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`);
    for (const relative of sharedRequired) {
      await assert.doesNotReject(
        () => readFile(path.join(pluginRoot, relative)),
        `${flavor} package is missing ${relative}`
      );
    }
    for (const device of deviceStems) {
      await assert.doesNotReject(
        () => readFile(path.join(pluginRoot, "profiles", `windows-settings-${flavor}-${device}.streamDeckProfile`)),
        `${flavor} package is missing ${device} profile`
      );
    }
  }
});

test("Lite exposes curated live Windows controls only", async () => {
  const value = await manifest("lite");
  assert.equal(value.Name, "Windows Settings Manager Lite");
  assert.equal(value.UUID, "com.packrat.windows-settings-manager-lite");
  assert.equal(value.Profiles.length, 7);
  const names = value.Actions.map((item) => item.Name);
  assert.deepEqual(names, [
    "Lock PC",
    "Sleep",
    "Power Plan",
    "Keep Awake",
    "Previous Desktop",
    "Next Desktop"
  ]);
  assert.ok(!JSON.stringify(value).includes("apply-mode"));
  assert.ok(!JSON.stringify(value).includes("wifi"));
  assert.ok(!JSON.stringify(value).includes("bluetooth"));
});

test("canonical PackRat key ownership disables host title overlays", async () => {
  for (const flavor of ["lite", "pro"]) {
    const value = await manifest(flavor);
    for (const action of value.Actions) {
      for (const state of action.States ?? []) {
        assert.equal(state.ShowTitle, false, `${flavor} ${action.UUID} must disable host title rendering`);
      }
    }

    for (const registration of value.Profiles) {
      const stem = registration.Name.replace(/^profiles\//, "");
      const data = await readFile(
        path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`, "profiles", `${stem}.streamDeckProfile`)
      );
      const entries = storedZipEntries(data);
      for (const entry of entries.filter((item) => /\/Profiles\/[^/]+\/manifest\.json$/.test(item.name))) {
        const page = JSON.parse(entry.data.toString("utf8"));
        for (const item of Object.values(page.Controllers?.[0]?.Actions ?? {})) {
          for (const state of item.States ?? []) {
            assert.equal(state.ShowTitle, false, `${stem} profile action must disable host title rendering`);
          }
        }
      }
    }
  }
});

test("canonical PackRat inspector tokens, glow, logo and maker link are bundled", async () => {
  const css = await readFile(path.resolve("ui", "pi.css"), "utf8");
  const html = await readFile(path.resolve("ui", "config.html"), "utf8");
  const js = await readFile(path.resolve("ui", "pi.js"), "utf8");

  for (const token of [
    "#080A0E",
    "#151920",
    "#0D1015",
    "#15191E",
    "#181C21",
    "#22272E",
    "#303640",
    "#F5F7FB",
    "#9AA2AF",
    "#FFB21E",
    "#FFC44D",
    "rgba(255,178,30,.16)",
    "rgba(255,178,30,.28)",
    "#FF5D6C",
    "#2BE86A",
    "#8B93A1"
  ]) {
    assert.ok(css.includes(token), `missing canonical PackRat token ${token}`);
  }

  assert.match(css, /body::before[\s\S]*top: -130px[\s\S]*right: -110px[\s\S]*width: 330px[\s\S]*height: 330px/);
  assert.match(css, /rgba\(255,178,30,\.12\)[\s\S]*rgba\(255,178,30,\.055\)[\s\S]*rgba\(255,178,30,0\)/);
  assert.match(html, /id="packratMaker"[\s\S]*src="packrat-icon\.png"[\s\S]*PackRat ↗/);
  assert.match(js, /https:\/\/marketplace\.elgato\.com\/maker\/packrat/);

  for (const flavor of ["lite", "pro"]) {
    await assert.doesNotReject(() =>
      readFile(path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`, "ui", "packrat-icon.png"))
    );
  }
});

test("canonical PackRat key visuals are rendered by one image renderer", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const visuals = await readFile(path.resolve("src", "key-visuals.ts"), "utf8");
  const assemble = await readFile(path.resolve("scripts", "assemble.mjs"), "utf8");

  assert.match(actions, /renderKeyImage/);
  assert.match(actions, /\.setImage\(/);
  assert.doesNotMatch(actions, /\.setTitle\(/);
  assert.match(visuals, /const GLYPHS: Record<KeyVisualKind, string>/);
  assert.match(visuals, /bg: "#080A0E"/);
  assert.match(visuals, /border: "#303640"/);
  assert.match(visuals, /text: "#F5F7FB"/);
  assert.match(visuals, /accent: "#FFB21E"/);
  assert.match(visuals, /danger: "#FF5D6C"/);
  assert.match(visuals, /success: "#2BE86A"/);
  assert.match(visuals, /neutral: "#8B93A1"/);
  assert.match(visuals, /font-size="\$\{size\}"/);
  assert.match(assemble, /ShowTitle: false/);
  assert.match(assemble, /stroke="#FFB21E"/);
});

test("manifest targets Stream Deck 7.3 for current profile navigation and device coverage", async () => {
  for (const flavor of ["lite", "pro"]) {
    const value = await manifest(flavor);
    assert.equal(value.Software.MinimumVersion, "7.3");
  }
});

test("Lite and Pro have collision-free catalog, plugin and action identities", async () => {
  const catalog = JSON.parse(await readFile(path.resolve("..", "..", "index.json"), "utf8"));
  for (const id of ["windows-settings-manager-lite", "windows-settings-manager-pro"]) {
    assert.equal(catalog.products.filter((item) => item.id === id).length, 1, `${id} must appear exactly once in products/index.json`);
  }

  const lite = await manifest("lite");
  const pro = await manifest("pro");
  assert.notEqual(lite.UUID, pro.UUID);

  const liteActions = lite.Actions.map((item) => item.UUID);
  const proActions = pro.Actions.map((item) => item.UUID);
  assert.equal(new Set(liteActions).size, liteActions.length, "Lite action UUID collision");
  assert.equal(new Set(proActions).size, proActions.length, "Pro action UUID collision");
  assert.deepEqual(liteActions.filter((uuid) => proActions.includes(uuid)), []);
});

test("Pro exposes the 15-key Windows Control Center and keeps PC Modes secondary", async () => {
  const value = await manifest("pro");
  const names = value.Actions.map((item) => item.Name);
  const core = [
    "Lock PC", "Sleep", "Hibernate", "Restart", "Shutdown",
    "Wi-Fi", "Bluetooth", "Power Plan", "Keep Awake", "Light / Dark Theme",
    "Previous Desktop", "Next Desktop", "New Desktop", "Close Desktop", "Current Desktop"
  ];
  assert.deepEqual(names.slice(0, 15), core);
  for (const expected of ["Apply PC Mode", "Cycle PC Mode", "Current PC Mode", "Save Current Mode"]) {
    assert.ok(names.includes(expected), `missing advanced ${expected}`);
  }
  assert.ok(!JSON.stringify(value).match(/cloudstore|sendkeys|quick settings/i));
});

test("Marketplace cover key grids fail closed instead of clipping outside the safe frame", async () => {
  const art = await readFile(path.resolve("scripts", "rat-art.py"), "utf8");
  assert.match(art, /available_top = 340/);
  assert.match(art, /available_bottom = 920/);
  assert.match(art, /if total_h > available_h:[\s\S]*key = \(available_h - \(rows - 1\) \* gap\) \/\/ rows/);
  assert.match(art, /if oy \+ total_h > available_bottom:[\s\S]*Marketplace key grid exceeds safe cover bounds/);
});

test("Rat Art PowerShell wrapper keeps colon-adjacent variables parse-safe", async () => {
  const wrapper = await readFile(path.resolve("rat-art.ps1"), "utf8");
  assert.match(wrapper, /wrong dimensions for \$\{file\}:/);
  assert.doesNotMatch(wrapper, /wrong dimensions for \$file:/);
});

test("Rat Art resolves the exact Lite or Pro ship destination instead of guessing", async () => {
  const script = await readFile(path.resolve("rat-art.ps1"), "utf8");
  assert.match(script, /"windows-settings-manager-lite" \{ "lite" \}/);
  assert.match(script, /"windows-settings-manager-pro" \{ "pro" \}/);
  assert.match(script, /cannot infer edition from destination/);
  assert.doesNotMatch(script, /Destination -match 'lite'/);
  assert.match(script, /Get-Command python/);
  assert.match(script, /PIL\.__version__ == '12\.3\.0'/);
  assert.match(script, /pip install --disable-pip-version-check Pillow==12\.3\.0/);
  assert.match(script, /01_search_icon\.png/);
  assert.match(script, /expectedWidth = if \(\$file -eq "01_search_icon\.png"\) \{ 288 \} else \{ 1920 \}/);
  assert.match(script, /expectedHeight = if \(\$file -eq "01_search_icon\.png"\) \{ 288 \} else \{ 960 \}/);
});

test("generated profile names and Marketplace copy avoid long dashes", async () => {
  const assemble = await readFile(path.resolve("scripts", "assemble.mjs"), "utf8");
  const art = await readFile(path.resolve("scripts", "rat-art.py"), "utf8");
  assert.doesNotMatch(assemble, /—|–/);
  assert.doesNotMatch(art, /—|–/);
  assert.doesNotMatch(art, /STANDARD \+ XL \+ \+ XL/);
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

test("every bundled profile page references only registered actions and valid navigation", async () => {
  const validModeIds = new Set(["gaming", "work", "night", "present", "movie"]);

  for (const flavor of ["lite", "pro"]) {
    const value = await manifest(flavor);
    const registeredActions = new Set(value.Actions.map((item) => item.UUID));

    for (const registration of value.Profiles) {
      const grid = DEVICE_GRIDS.get(registration.DeviceType);
      assert.ok(grid, `missing grid definition for DeviceType ${registration.DeviceType}`);
      const [columns, rows] = grid;
      const stem = registration.Name.replace(/^profiles\//, "");
      const data = await readFile(
        path.join(root, `com.packrat.windows-settings-manager-${flavor}.sdPlugin`, "profiles", `${stem}.streamDeckProfile`)
      );
      const entries = storedZipEntries(data);
      const rootEntry = entries.find((entry) =>
        entry.name.endsWith(".sdProfile/manifest.json") && !entry.name.includes("/Profiles/")
      );
      assert.ok(rootEntry, `${stem} is missing its root profile manifest`);

      const rootManifest = JSON.parse(rootEntry.data.toString("utf8"));
      const pageEntries = entries.filter((entry) => /\/Profiles\/[^/]+\/manifest\.json$/.test(entry.name));
      const expectedPages = 1;
      assert.equal(pageEntries.length, expectedPages, `${stem} page count mismatch`);
      assert.equal(rootManifest.Pages.Pages.length, expectedPages, `${stem} root page list mismatch`);
      assert.equal(rootManifest.Pages.Current, rootManifest.Pages.Pages[0], `${stem} current page must be first page`);

      const actionIds = new Set();
      let navigationCount = 0;
      for (const pageEntry of pageEntries) {
        const page = JSON.parse(pageEntry.data.toString("utf8"));
        assert.equal(page.Controllers?.length, 1, `${stem} should have one keypad controller`);
        const actions = page.Controllers[0].Actions ?? {};

        for (const [coordinate, item] of Object.entries(actions)) {
          const [x, y] = coordinate.split(",").map(Number);
          assert.ok(Number.isInteger(x) && x >= 0 && x < columns, `${stem} invalid x coordinate ${coordinate}`);
          assert.ok(Number.isInteger(y) && y >= 0 && y < rows, `${stem} invalid y coordinate ${coordinate}`);
          assert.ok(registeredActions.has(item.UUID), `${stem} references unregistered action ${item.UUID}`);
          assert.ok(
            item.UUID.startsWith(`com.packrat.windows-settings-manager-${flavor}.`),
            `${stem} leaks an action from another edition`
          );
          assert.ok(item.ActionID && !actionIds.has(item.ActionID), `${stem} duplicate or missing ActionID`);
          actionIds.add(item.ActionID);

          if (item.Settings?.modeId !== undefined) {
            assert.ok(validModeIds.has(item.Settings.modeId), `${stem} invalid modeId ${item.Settings.modeId}`);
          }

          if (item.UUID.endsWith(".profile-page")) {
            navigationCount++;
            assert.equal(item.Settings?.profileName, registration.Name, `${stem} navigation profile mismatch`);
            assert.ok(Number.isInteger(item.Settings?.page), `${stem} navigation page must be an integer`);
            assert.ok(item.Settings.page >= 0 && item.Settings.page < expectedPages, `${stem} navigation page is out of range`);
          }
        }
      }

      assert.equal(navigationCount, 0, `${stem} should not require profile navigation for the primary control surface`);
    }
  }
});

test("Lite upsell is injected only from a verified direct Pro Marketplace URL", async () => {
  const sourcePi = await readFile(path.resolve("ui", "pi.js"), "utf8");
  const html = await readFile(path.resolve("ui", "config.html"), "utf8");
  const assembler = await readFile(path.resolve("scripts", "assemble.mjs"), "utf8");
  const builtPi = await readFile(
    path.join(root, "com.packrat.windows-settings-manager-lite.sdPlugin", "ui", "pi.js"),
    "utf8"
  );
  const relationship = JSON.parse(
    await readFile(path.resolve("..", "..", "lite-pro-map.json"), "utf8")
  ).pairs.find((item) => item.lite_id === "windows-settings-manager-lite");

  assert.match(sourcePi, /const PRO_MARKETPLACE_URL = "";/);
  assert.match(html, /id="liteUpsell"/);
  assert.match(html, /id="proUpgrade"/);
  assert.match(sourcePi, /event: "openUrl"/);
  assert.match(assembler, /resolveProMarketplaceUrl/);
  assert.match(assembler, /Property Inspector Pro URL injection marker is missing/);

  const url = relationship?.pro_marketplace_url ?? "";
  if (url) {
    assert.match(url, /^https:\/\/marketplace\.elgato\.com\/product\/[a-z0-9][a-z0-9-]*-[0-9a-f-]{36}\/?$/i);
    assert.ok(builtPi.includes(url), "built Lite Property Inspector is missing the verified Pro URL");
  } else {
    assert.match(builtPi, /const PRO_MARKETPLACE_URL = "";/);
  }

  assert.doesNotMatch(builtPi, /marketplace\.elgato\.com\/(?:search|\?search|@packrat|icue)/i);
});

test("standard Pro profile is the exact 15-key Windows Control Center", async () => {
  const profileDir = path.join(root, "com.packrat.windows-settings-manager-pro.sdPlugin", "profiles");
  const standard = (await readFile(path.join(profileDir, "windows-settings-pro-standard.streamDeckProfile"))).toString("utf8");
  const expected = [
    ".lock", ".sleep", ".hibernate", ".restart", ".shutdown",
    ".wifi", ".bluetooth", ".power", ".awake", ".theme",
    ".desktop-previous", ".desktop-next", ".desktop-new", ".desktop-close", ".desktop-current"
  ];
  for (const suffix of expected) {
    assert.ok(standard.includes(`com.packrat.windows-settings-manager-pro${suffix}`), `standard profile missing ${suffix}`);
  }
  assert.equal((standard.match(/com\.packrat\.windows-settings-manager-pro\./g) ?? []).length, 15);
  assert.doesNotMatch(standard, /"modeId":/);
});

test("PC Modes remain empty optional advanced slots instead of the default profile", async () => {
  const modes = await readFile(path.resolve("src", "modes.ts"), "utf8");
  for (const id of ["gaming", "work", "night", "present", "movie"]) {
    assert.match(modes, new RegExp(`id: "${id}".*settings: \\\{\\\}`));
  }

  const profileDir = path.join(root, "com.packrat.windows-settings-manager-pro.sdPlugin", "profiles");
  const xl = (await readFile(path.join(profileDir, "windows-settings-pro-xl.streamDeckProfile"))).toString("utf8");
  assert.match(xl, /"modeId": "gaming"/);
});

test("Elgato validation invokes the installed CLI through Node on every OS", async () => {
  const validator = await readFile(path.resolve("scripts", "validate.mjs"), "utf8");
  assert.match(validator, /@elgato", "cli", "bin", "streamdeck\.mjs"/);
  assert.match(validator, /spawnSync\(process\.execPath/);
  assert.match(validator, /if \(result\.error\)/);
  assert.doesNotMatch(validator, /npx\.cmd|process\.platform === "win32"/);
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
  assert.equal((backend.match(/static PackRatWindowsNative\(\)/g) ?? []).length, 1);
  assert.equal((backend.match(/private static extern int RtlGetVersion/g) ?? []).length, 1);
  assert.equal((backend.match(/private static void AssertSize/g) ?? []).length, 1);
  assert.equal((backend.match(/private static int ReadWindowsBuild/g) ?? []).length, 1);
  assert.equal((backend.match(/private static bool SupportsSeparatedHdrApi/g) ?? []).length, 1);
  assert.equal((backend.match(/private struct RtlOsVersionInfoEx/g) ?? []).length, 1);
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

test("ModeStore caches persisted global settings without sharing mutable caller state", async () => {
  const store = await readFile(path.resolve("src", "store.ts"), "utf8");
  assert.match(store, /private cache: GlobalSettings \| null = null/);
  assert.match(store, /if \(this\.cache\) return sanitizeSettings\(this\.cache\)/);
  assert.match(store, /this\.cache = parsed;[\s\S]*return sanitizeSettings\(parsed\)/);
  assert.match(store, /const clean = sanitizeSettings\(settings\)[\s\S]*setGlobalSettings\(clean\)[\s\S]*this\.cache = clean/);
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
  assert.match(inspector, /\["Wi-Fi", offline \? "Offline"/);
  assert.match(inspector, /\["Bluetooth", offline \? "Offline"/);
  assert.match(inspector, /\["Power", offline \? "Offline"/);
  assert.match(inspector, /\["Keep Awake", offline \? "Offline"/);
  assert.match(inspector, /\["Theme", offline \? "Offline"/);
  assert.match(inspector, /\["Desktop", offline \? "Offline"/);
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
  for (const className of ["HdrBase", "PowerBase", "TopologyBase", "TimeoutBase", "AwakeBase", "RadioBase", "ThemeBase", "DesktopCommandBase", "CycleModeBase", "SaveModeBase"]) {
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
  assert.match(inspector, /const hdrUsable = Boolean/);
});

test("HDR mode matching requires a genuinely controllable HDR display", async () => {
  const source = await readFile(path.resolve("src", "modes.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(source, /snapshot\.hdr\.supportedCount === 0/);
  assert.match(source, /snapshot\.hdr\.enabledCount === snapshot\.hdr\.supportedCount/);
  assert.match(inspector, /const hdrUsable = Boolean/);
  assert.match(inspector, /option\.disabled = !hdrUsable/);
});

test("Wi-Fi and Bluetooth use the Windows radio API and verify readback", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(backend, /Windows\.Devices\.Radios\.Radio/);
  assert.match(backend, /RequestAccessAsync\(\)/);
  assert.match(backend, /SetStateAsync\(\$target\)/);
  assert.match(backend, /Get-RadioState \$Kind/);
  assert.match(actions, /class RadioBase[\s\S]*radio\.state === "on"[\s\S]*radio\.state === "off"/);
  assert.match(actions, /setRadio/);
});

test("theme control reads and verifies app and system theme state", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(backend, /AppsUseLightTheme/);
  assert.match(backend, /SystemUsesLightTheme/);
  assert.match(backend, /BroadcastThemeChanged/);
  assert.match(backend, /Windows did not confirm the requested theme/);
  assert.match(actions, /class ThemeBase/);
  assert.match(actions, /current === "dark"[\s\S]*current === "light"[\s\S]*return ev\.action\.showAlert\(\)/);
});

test("virtual desktops verify current index and count after shell commands", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const render = await readFile(path.resolve("src", "render.ts"), "utf8");
  assert.match(backend, /VirtualDesktopIDs/);
  assert.match(backend, /CurrentVirtualDesktop/);
  assert.match(backend, /SendVirtualDesktopCommand/);
  assert.match(backend, /Windows did not confirm the virtual desktop change/);
  assert.match(backend, /currentIndex -eq \(\$before\.currentIndex - 1\)/);
  assert.match(backend, /currentIndex -eq \(\$before\.currentIndex \+ 1\)/);
  assert.match(render, /DESKTOP\\n\$\{desktop\.currentIndex\} \/ \$\{desktop\.count\}/);
});

test("restart and shutdown are protected by default and power actions stay distinct", async () => {
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const assemble = await readFile(path.resolve("scripts", "assemble.mjs"), "utf8");
  assert.match(actions, /settings\.confirmation \?\? "double"/);
  assert.match(actions, /PRESS\\nAGAIN/);
  assert.match(actions, /3000/);
  assert.match(actions, /command = "sleep"/);
  assert.match(actions, /command = "hibernate"/);
  assert.match(assemble, /confirmation: "double"/);
});

test("unsupported hibernation fails closed", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  assert.match(backend, /Get-HibernateAvailability/);
  assert.match(backend, /Hibernate is not available on this PC/);
  assert.match(actions, /this\.command === "hibernate" && !snapshot\.hibernateAvailable/);
});

test("background state polling avoids redundant active-power-plan process launches", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const plansStart = backend.indexOf("function Get-PowerPlans");
  const plansEnd = backend.indexOf("function Get-SettingSeconds", plansStart);
  const plansBody = backend.slice(plansStart, plansEnd);
  const snapshotStart = backend.indexOf("function Get-Snapshot");
  const snapshotEnd = backend.indexOf("function Write-Reply", snapshotStart);
  const snapshotBody = backend.slice(snapshotStart, snapshotEnd);
  assert.match(plansBody, /Invoke-PowerCfg \/list/);
  assert.match(plansBody, /Groups\[3\]\.Value -match '\\\*'/);
  assert.match(plansBody, /if \(-not \(\$plans \| Where-Object/);
  assert.doesNotMatch(snapshotBody, /Get-ActivePowerPlan/);
  assert.match(snapshotBody, /\$power = \$plans \| Where-Object \{ \$_\.active \}/);
});

test("PowerShell backend does not shadow the automatic args variable", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  assert.doesNotMatch(backend, /\$args\s*=\s*\$request\.args/i);
  assert.doesNotMatch(backend, /param\(\$Args\)/i);
  assert.match(backend, /\$requestArgs = \$request\.args/);
  assert.match(backend, /param\(\$InputArgs\)/);
});

test("Windows backend pins console JSON transport to UTF8 before reading requests", async () => {
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  const addType = backend.indexOf("Add-Type -TypeDefinition");
  const inputEncoding = backend.indexOf("[Console]::InputEncoding = $script:utf8NoBom");
  const outputEncoding = backend.indexOf("[Console]::OutputEncoding = $script:utf8NoBom");
  assert.ok(inputEncoding >= 0 && inputEncoding < addType, "stdin encoding must be set before backend initialization");
  assert.ok(outputEncoding >= 0 && outputEncoding < addType, "stdout encoding must be set before backend initialization");
  assert.match(backend, /New-Object System\.Text\.UTF8Encoding\(\$false\)/);
});

test("Windows JSON-line smoke transport avoids PowerShell args/BOM corruption", async () => {
  const smoke = await readFile(path.resolve("scripts", "backend-smoke.ps1"), "utf8");
  const backend = await readFile(path.resolve("scripts", "windows-settings-backend.ps1"), "utf8");
  assert.doesNotMatch(smoke, /StandardInputEncoding/);
  assert.match(smoke, /function Request\(\[int\]\$Id, \[string\]\$Op, \$RequestArgs = @\{\}\)/);
  assert.doesNotMatch(smoke, /function Request\([^\n]*\$Args/);
  assert.match(smoke, /ConvertTo-Json -Depth 6 -Compress/);
  assert.match(smoke, /UTF8Encoding\]::new\(\$false\)/);
  assert.match(smoke, /StandardInput\.BaseStream\.Write\(\$bytes, 0, \$bytes\.Length\)/);
  assert.match(smoke, /Smoke request JSON failed local round-trip validation/);
  assert.doesNotMatch(smoke, /StandardInput\.WriteLine/);
  assert.match(backend, /\$line = \$line\.TrimStart\(\[char\]0xFEFF\)/);
  assert.match(backend, /Invalid request JSON \(length=\$\(\$line\.Length\), prefixCodes=\$prefixCodes\)/);
  assert.match(backend, /Select-Object -First 12/);
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
  assert.match(backend, /supported && current == enabled/);
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
  assert.match(actions, /SaveModeBase[\s\S]*const snapshot = await freshSnapshot\(\)[\s\S]*if \(!snapshot\)/);
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
  assert.match(render, /timeoutTitle[\s\S]*!snapshot\.backendOnline\) return "SCREEN\\nOFFLINE"/);
  assert.match(render, /awakeTitle[\s\S]*!snapshot\.backendOnline\) return "SLEEP\\nOFFLINE"/);
});

test("hardware keys own the full visual face and explain safe states", async () => {
  const assemble = await readFile(path.resolve("scripts", "assemble.mjs"), "utf8");
  const render = await readFile(path.resolve("src", "render.ts"), "utf8");
  const actions = await readFile(path.resolve("src", "actions.ts"), "utf8");
  const visuals = await readFile(path.resolve("src", "key-visuals.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "config.html"), "utf8");

  assert.match(assemble, /ShowTitle: false/);
  assert.match(assemble, /fill="#080A0E"/);
  assert.match(assemble, /stroke="#303640"/);
  assert.match(assemble, /stroke="#FFB21E"/);
  assert.match(visuals, /one-line|data:image\/svg\+xml;base64|Buffer\.from/);
  assert.match(render, /statusTitle[\s\S]*"PC\\nREADY"/);
  assert.match(render, /awakeTitle[\s\S]*"STAY\\nAWAKE"[\s\S]*"SLEEP\\nNORMAL"/);
  assert.match(actions, /SETUP\\n\$\{modeTitle\(mode\)\}/);
  assert.match(inspector, /Modes start empty/);
  assert.match(inspector, /does not immediately put the PC to sleep/);
});

test("clean rebuild preserves a live linked plugin root on Windows", async () => {
  const clean = await readFile(path.resolve("scripts", "clean.mjs"), "utf8");
  assert.match(clean, /entry\.name\.endsWith\("\.sdPlugin"\)/);
  assert.match(clean, /for \(const child of await readdir\(target/);
  assert.doesNotMatch(clean, /rm\(new URL\("\.\.\/out\//);
});

test("state refresh polls Windows and the inspector refresh button forces a real read", async () => {
  const state = await readFile(path.resolve("src", "state.ts"), "utf8");
  const plugin = await readFile(path.resolve("src", "plugin.ts"), "utf8");
  const inspector = await readFile(path.resolve("ui", "pi.js"), "utf8");
  assert.match(state, /const POLL_INTERVAL_MS = 5000/);
  assert.match(state, /setInterval\(\(\) => void this\.refresh\(\), POLL_INTERVAL_MS\)/);
  assert.match(state, /this\.backend\.snapshot\(\)/);
  assert.match(plugin, /payload\?\.type === "refresh"/);
  assert.match(plugin, /runtime\.state\.refresh\(\)\.then\(sendInspectorContext\)/);
  assert.match(inspector, /sendPlugin\(\{ type: "refresh" \}\)/);
});
