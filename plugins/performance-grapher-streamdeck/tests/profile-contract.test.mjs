import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const plugin = resolve(root, "com.packrat.performance-grapher.sdPlugin");
const profileDir = resolve(plugin, "profiles");

const EXPECTED = [
  { file: "performance-dashboard-mk2", deviceType: 0, width: 5, height: 3, keys: 15 },
  { file: "performance-dashboard-xl", deviceType: 2, width: 8, height: 4, keys: 32 },
  { file: "performance-dashboard-plus", deviceType: 7, width: 4, height: 2, keys: 8 },
  { file: "performance-dashboard-neo", deviceType: 9, width: 4, height: 2, keys: 8 },
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function unzipLocal(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = buffer.subarray(dataStart, dataEnd);
    const raw = method === 8 ? inflateRawSync(compressed) : method === 0 ? compressed : null;
    assert.ok(raw, "Unsupported ZIP compression method " + method + " for " + name);
    entries.set(name, raw);
    offset = dataEnd;
  }
  return entries;
}

async function readProfile(spec) {
  const archive = await readFile(resolve(profileDir, spec.file + ".streamDeckProfile"));
  const entries = unzipLocal(archive);
  const rootManifest = [...entries.keys()].find((name) =>
    /\.sdProfile\/manifest\.json$/i.test(name) && !/\/Profiles\//i.test(name)
  );
  const pageManifest = [...entries.keys()].find((name) => /\.sdProfile\/Profiles\/[^/]+\/manifest\.json$/i.test(name));
  assert.ok(rootManifest, spec.file + " missing root profile manifest");
  assert.ok(pageManifest, spec.file + " missing page manifest");
  return {
    archive,
    entries,
    root: JSON.parse(entries.get(rootManifest).toString("utf8")),
    page: JSON.parse(entries.get(pageManifest).toString("utf8")),
  };
}

test("manifest registers the four generated PackRat performance dashboards", async () => {
  const manifest = JSON.parse(await readFile(resolve(plugin, "manifest.json"), "utf8"));
  assert.equal(manifest.Profiles?.length, EXPECTED.length);

  for (const spec of EXPECTED) {
    const profile = manifest.Profiles.find((item) => item.Name === "profiles/" + spec.file);
    assert.ok(profile, "Missing manifest profile " + spec.file);
    assert.equal(profile.DeviceType, spec.deviceType);
    assert.equal(profile.AutoInstall, true);
    assert.equal(profile.DontAutoSwitchWhenInstalled, true);
    assert.equal(profile.Readonly, false);
  }
});

test("generated profiles contain valid bounded keypad layouts and only Performance Grapher actions", async () => {
  const manifest = JSON.parse(await readFile(resolve(plugin, "manifest.json"), "utf8"));
  const allowedUuids = new Set(manifest.Actions.map((action) => action.UUID));
  const allowedWindows = new Set([0, 60_000, 300_000, 900_000]);

  for (const spec of EXPECTED) {
    const profile = await readProfile(spec);
    assert.equal(profile.entries.size, 2, spec.file + " should contain one root manifest and one page manifest");
    assert.equal(profile.root.Version, "2.0");
    assert.equal(profile.root.Pages.Pages.length, 1);
    assert.equal(profile.root.Pages.Current, profile.root.Pages.Pages[0]);

    assert.equal(profile.page.Controllers.length, 1);
    const controller = profile.page.Controllers[0];
    assert.equal(controller.Type, "Keypad");
    const actions = controller.Actions || {};
    assert.equal(Object.keys(actions).length, spec.keys, spec.file + " key count");

    const seenActionIds = new Set();
    const seenPluginActions = new Set();
    for (const [position, action] of Object.entries(actions)) {
      const match = /^(\d+),(\d+)$/.exec(position);
      assert.ok(match, "Invalid profile position " + position);
      const x = Number(match[1]);
      const y = Number(match[2]);
      assert.ok(x >= 0 && x < spec.width, position + " outside " + spec.file + " width");
      assert.ok(y >= 0 && y < spec.height, position + " outside " + spec.file + " height");
      assert.ok(allowedUuids.has(action.UUID), "Unknown action UUID " + action.UUID);
      assert.ok(!seenActionIds.has(action.ActionID), "Duplicate ActionID " + action.ActionID);
      seenActionIds.add(action.ActionID);
      seenPluginActions.add(action.UUID);
      assert.equal(action.State, 0);
      assert.equal(action.States?.[0]?.ShowTitle, false);

      const settings = action.Settings || {};
      if (settings.windowMs !== undefined) assert.ok(allowedWindows.has(Number(settings.windowMs)));
      if (settings.threshold !== undefined) assert.ok(Number.isFinite(Number(settings.threshold)));
      if (settings.thresholdDirection !== undefined) assert.ok(["above", "below"].includes(settings.thresholdDirection));
      if (settings.fpsMode !== undefined) assert.ok(["fps", "frametime"].includes(settings.fpsMode));
      if (settings.lowMode !== undefined) assert.ok(["one", "pointOne"].includes(settings.lowMode));
      if (settings.metricId !== undefined) assert.ok(String(settings.metricId).length > 0);
    }

    assert.deepEqual(seenPluginActions, allowedUuids, spec.file + " should demonstrate all five plugin actions");
  }
});

test("Performance Grapher profile archives rebuild byte-for-byte deterministically", async () => {
  const before = new Map();
  for (const spec of EXPECTED) {
    const bytes = await readFile(resolve(profileDir, spec.file + ".streamDeckProfile"));
    before.set(spec.file, sha256(bytes));
  }

  const result = spawnSync(process.execPath, [resolve(root, "scripts", "build-profiles.mjs")], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || "profile rebuild failed");

  for (const spec of EXPECTED) {
    const bytes = await readFile(resolve(profileDir, spec.file + ".streamDeckProfile"));
    assert.equal(sha256(bytes), before.get(spec.file), spec.file + " is not deterministic");
  }
});
