import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

export async function readProfile(file) {
	const buffer = await readFile(file);
	assert.equal(buffer.readUInt32LE(0), 0x04034b50, `${file} is not a ZIP archive`);
	assert.equal(buffer.readUInt16LE(8), 0, `${file} must use deterministic stored ZIP entries`);
	const size = buffer.readUInt32LE(18);
	const nameLength = buffer.readUInt16LE(26);
	const extraLength = buffer.readUInt16LE(28);
	const nameStart = 30;
	const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
	assert.match(name, /^[A-F0-9-]+\.sdProfile\/manifest\.json$/);
	const dataStart = nameStart + nameLength + extraLength;
	return JSON.parse(buffer.subarray(dataStart, dataStart + size).toString("utf8"));
}

export function assertCoordinates(actions, width, height) {
	for (const coordinate of Object.keys(actions)) {
		assert.match(coordinate, /^\d+,\d+$/);
		const [x, y] = coordinate.split(",").map(Number);
		assert.ok(x >= 0 && x < width, `${coordinate} exceeds width ${width}`);
		assert.ok(y >= 0 && y < height, `${coordinate} exceeds height ${height}`);
	}
	const ids = Object.values(actions).map((action) => action.ActionID);
	assert.equal(new Set(ids).size, ids.length, "ActionIDs must be unique within a profile");
}

export function assertBundledProfiles(pluginManifest, expected) {
	assert.equal(pluginManifest.Profiles.length, expected.length);
	for (const profile of expected) {
		const actual = pluginManifest.Profiles.find((entry) => entry.DeviceType === profile.deviceType);
		assert.ok(actual, `missing DeviceType ${profile.deviceType}`);
		assert.equal(actual.Name, `profiles/${profile.file}`);
		assert.equal(actual.AutoInstall, true);
		assert.equal(actual.DontAutoSwitchWhenInstalled, true);
		assert.equal(actual.Readonly, false);
	}
}
