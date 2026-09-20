import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assertBundledProfiles, assertCoordinates, readProfile } from "../../tools/profile-test-helpers.mjs";
import { buildProfiles } from "../scripts/build-profiles.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = path.join(ROOT, "com.ratpack.cs2reactivedeck.sdPlugin", "profiles");
const MANIFEST = path.join(ROOT, "com.ratpack.cs2reactivedeck.sdPlugin", "manifest.json");

const profiles = [
	{ file: "cs2-live-stats-standard", deviceType: 0, width: 5, height: 3 },
	{ file: "cs2-live-stats-mini", deviceType: 1, width: 3, height: 2 },
	{ file: "cs2-live-stats-xl", deviceType: 2, width: 8, height: 4 },
	{ file: "cs2-live-stats-plus", deviceType: 7, width: 4, height: 2 },
	{ file: "cs2-live-stats-neo", deviceType: 9, width: 4, height: 2 },
];

const allActions = new Set([
	"com.ratpack.cs2reactivedeck.health",
	"com.ratpack.cs2reactivedeck.ammo",
	"com.ratpack.cs2reactivedeck.killfeed",
	"com.ratpack.cs2reactivedeck.phase",
	"com.ratpack.cs2reactivedeck.money",
	"com.ratpack.cs2reactivedeck.kda",
	"com.ratpack.cs2reactivedeck.score",
]);

await buildProfiles();

test("plugin manifest exposes five editable auto-installed profiles", async () => {
	const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
	assert.equal(manifest.Version, "1.0.1.0");
	assertBundledProfiles(manifest, profiles);
});

for (const profile of profiles) {
	test(`${profile.file} contains the expected bounded dashboard`, async () => {
		const manifest = await readProfile(path.join(PROFILE_DIR, `${profile.file}.streamDeckProfile`));
		assert.equal(manifest.Version, "1.0");
		assertCoordinates(manifest.Actions, profile.width, profile.height);
		const uuids = new Set(Object.values(manifest.Actions).map((action) => action.UUID));
		if (profile.deviceType === 1) {
			assert.equal(manifest.Actions["2,1"].UUID, "com.ratpack.cs2reactivedeck.score");
			assert.equal(uuids.has("com.ratpack.cs2reactivedeck.kda"), false);
			assert.equal(uuids.size, 6);
		} else {
			assert.deepEqual(uuids, allActions);
		}
	});
}

test("profile generation is byte-for-byte deterministic", async () => {
	const file = path.join(PROFILE_DIR, "cs2-live-stats-standard.streamDeckProfile");
	const before = createHash("sha256").update(await readFile(file)).digest("hex");
	await buildProfiles();
	const after = createHash("sha256").update(await readFile(file)).digest("hex");
	assert.equal(after, before);
});
