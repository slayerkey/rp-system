import path from "node:path";
import { fileURLToPath } from "node:url";

import { profileAction, writeProfiles } from "../../tools/profile-builder.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = path.join(ROOT, "com.ratpack.cs2reactivedeck.sdPlugin", "profiles");
const UUID = "com.ratpack.cs2reactivedeck";

const ACTIONS = {
	health: [`${UUID}.health`, "Health Monitor"],
	ammo: [`${UUID}.ammo`, "Ammo Counter"],
	kills: [`${UUID}.killfeed`, "Kill Feed"],
	phase: [`${UUID}.phase`, "Round Phase"],
	economy: [`${UUID}.money`, "Economy"],
	kda: [`${UUID}.kda`, "Match KDA"],
	score: [`${UUID}.score`, "Round Score"],
};

function layout(file, entries) {
	return Object.fromEntries(
		entries.map(([coordinate, key]) => {
			const [uuid, name] = ACTIONS[key];
			return [coordinate, profileAction(`${UUID}:${file}:${coordinate}:${uuid}`, name, uuid)];
		}),
	);
}

const profiles = [
	{
		file: "cs2-live-stats-standard",
		name: "CS2 Live Stats",
		actions: layout("standard", [
			["0,0", "health"], ["1,0", "ammo"], ["2,0", "kills"], ["3,0", "phase"], ["4,0", "economy"],
			["0,1", "kda"], ["1,1", "score"],
		]),
	},
	{
		file: "cs2-live-stats-mini",
		name: "CS2 Live Stats Mini",
		actions: layout("mini", [
			["0,0", "health"], ["1,0", "ammo"], ["2,0", "kills"],
			["0,1", "phase"], ["1,1", "economy"], ["2,1", "score"],
		]),
	},
	{
		file: "cs2-live-stats-xl",
		name: "CS2 Live Stats XL",
		actions: layout("xl", [
			["0,0", "health"], ["1,0", "ammo"], ["2,0", "kills"], ["3,0", "phase"],
			["4,0", "economy"], ["5,0", "kda"], ["6,0", "score"],
		]),
	},
	{
		file: "cs2-live-stats-plus",
		name: "CS2 Live Stats +",
		actions: layout("plus", [
			["0,0", "health"], ["1,0", "ammo"], ["2,0", "kills"], ["3,0", "phase"],
			["0,1", "economy"], ["1,1", "kda"], ["2,1", "score"],
		]),
	},
	{
		file: "cs2-live-stats-neo",
		name: "CS2 Live Stats Neo",
		actions: layout("neo", [
			["0,0", "health"], ["1,0", "ammo"], ["2,0", "kills"], ["3,0", "phase"],
			["0,1", "economy"], ["1,1", "kda"], ["2,1", "score"],
		]),
	},
];

export async function buildProfiles() {
	await writeProfiles({ profileDir: PROFILE_DIR, seedPrefix: UUID, profiles });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
	await buildProfiles();
	console.log(`Built ${profiles.length} bundled CS2 Live Stats profiles.`);
}
