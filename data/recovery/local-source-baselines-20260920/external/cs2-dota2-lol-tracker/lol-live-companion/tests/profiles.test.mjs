import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertBundledProfiles, assertCoordinates, readProfile } from "../../tools/profile-test-helpers.mjs";
import { buildProfiles } from "../scripts/build-profiles.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = path.join(ROOT, "com.ratpack.lollivecompanion.sdPlugin", "profiles");
const MANIFEST = path.join(ROOT, "com.ratpack.lollivecompanion.sdPlugin", "manifest.json");

const profiles = [
	{ file: "lol-live-stats-standard", deviceType: 0, width: 5, height: 3 },
	{ file: "lol-live-stats-mini", deviceType: 1, width: 3, height: 2 },
	{ file: "lol-live-stats-xl", deviceType: 2, width: 8, height: 4 },
	{ file: "lol-live-stats-plus", deviceType: 7, width: 4, height: 2 },
	{ file: "lol-live-stats-neo", deviceType: 9, width: 4, height: 2 },
];

const allActions = new Set([
	"com.ratpack.lollivecompanion.gold",
	"com.ratpack.lollivecompanion.health",
	"com.ratpack.lollivecompanion.afford",
	"com.ratpack.lollivecompanion.kda",
	"com.ratpack.lollivecompanion.level",
	"com.ratpack.lollivecompanion.cs",
]);

await buildProfiles();

test("plugin manifest exposes five editable auto-installed profiles", async () => {
	const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
	assert.equal(manifest.Version, "1.0.1.0");
	assertBundledProfiles(manifest, profiles);
});

for (const profile of profiles) {
	test(`${profile.file} contains the expected configured dashboard`, async () => {
		const manifest = await readProfile(path.join(PROFILE_DIR, `${profile.file}.streamDeckProfile`));
		assert.equal(manifest.Version, "1.0");
		assertCoordinates(manifest.Actions, profile.width, profile.height);
		const actions = Object.values(manifest.Actions);
		assert.deepEqual(new Set(actions.map((action) => action.UUID)), allActions);
		const healthModes = actions
			.filter((action) => action.UUID === "com.ratpack.lollivecompanion.health")
			.map((action) => action.Settings.mode)
			.sort();
		assert.deepEqual(healthModes, profile.deviceType === 1 ? ["both"] : ["hp", "mana"]);
		const afford = actions.find((action) => action.UUID === "com.ratpack.lollivecompanion.afford");
		assert.deepEqual(afford.Settings, { itemName: "ITEM", target: 3000 });
		const kda = actions.find((action) => action.UUID === "com.ratpack.lollivecompanion.kda");
		assert.equal(kda.Settings.showCs, false);
	});
}

test("profile generation is byte-for-byte deterministic", async () => {
	const file = path.join(PROFILE_DIR, "lol-live-stats-standard.streamDeckProfile");
	const before = createHash("sha256").update(await readFile(file)).digest("hex");
	await buildProfiles();
	const after = createHash("sha256").update(await readFile(file)).digest("hex");
	assert.equal(after, before);
});
