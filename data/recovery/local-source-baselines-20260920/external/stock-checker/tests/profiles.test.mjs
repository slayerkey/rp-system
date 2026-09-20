import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildProfiles } from "../scripts/build-profiles.mjs";
import { assertBundledProfiles, assertCoordinates, readProfile } from "./profile-test-helpers.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = path.join(ROOT, "com.ratpack.marketcommandcenter.sdPlugin", "profiles");
const MANIFEST = path.join(ROOT, "com.ratpack.marketcommandcenter.sdPlugin", "manifest.json");

const profiles = [
	{ file: "market-command-center-standard", deviceType: 0, width: 5, height: 3 },
	{ file: "market-command-center-mini", deviceType: 1, width: 3, height: 2 },
	{ file: "market-command-center-xl", deviceType: 2, width: 8, height: 4 },
	{ file: "market-command-center-plus", deviceType: 7, width: 4, height: 2 },
	{ file: "market-command-center-neo", deviceType: 9, width: 4, height: 2 },
];

const allActions = new Set([
	"com.ratpack.marketcommandcenter.ticker",
	"com.ratpack.marketcommandcenter.crypto",
	"com.ratpack.marketcommandcenter.heatmap",
	"com.ratpack.marketcommandcenter.feargreed",
	"com.ratpack.marketcommandcenter.earnings",
	"com.ratpack.marketcommandcenter.clock",
]);

await buildProfiles();

test("plugin manifest exposes five editable auto-installed profiles", async () => {
	const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
	assert.equal(manifest.Version, "0.1.1.0");
	assertBundledProfiles(manifest, profiles);
});

for (const profile of profiles) {
	test(`${profile.file} contains all six market actions and safe defaults`, async () => {
		const manifest = await readProfile(path.join(PROFILE_DIR, `${profile.file}.streamDeckProfile`));
		assert.equal(manifest.Version, "1.0");
		assertCoordinates(manifest.Actions, profile.width, profile.height);
		const actions = Object.values(manifest.Actions);
		assert.deepEqual(new Set(actions.map((action) => action.UUID)), allActions);
		const byUuid = Object.fromEntries(actions.map((action) => [action.UUID, action.Settings]));
		assert.equal(byUuid["com.ratpack.marketcommandcenter.ticker"].preset, "SPY");
		assert.equal(byUuid["com.ratpack.marketcommandcenter.crypto"].preset, "BTC");
		assert.equal(byUuid["com.ratpack.marketcommandcenter.earnings"].preset, "AAPL");
		assert.equal(byUuid["com.ratpack.marketcommandcenter.clock"].exchange, "US");
		assert.equal(byUuid["com.ratpack.marketcommandcenter.heatmap"].symbols, "AAPL, MSFT, NVDA, AMZN, GOOGL, TSLA");
		const serialized = JSON.stringify(manifest.Actions);
		assert.doesNotMatch(serialized, /finnhubApiKey|shares|avgCost|alertAbove|alertBelow/i);
	});
}

test("profile generation is byte-for-byte deterministic", async () => {
	const file = path.join(PROFILE_DIR, "market-command-center-standard.streamDeckProfile");
	const before = createHash("sha256").update(await readFile(file)).digest("hex");
	await buildProfiles();
	const after = createHash("sha256").update(await readFile(file)).digest("hex");
	assert.equal(after, before);
});
