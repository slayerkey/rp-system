import path from "node:path";
import { fileURLToPath } from "node:url";

import { profileAction, writeProfiles } from "../../tools/profile-builder.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = path.join(ROOT, "com.ratpack.lollivecompanion.sdPlugin", "profiles");
const UUID = "com.ratpack.lollivecompanion";

const ACTIONS = {
	gold: [`${UUID}.gold`, "Gold Tracker"],
	health: [`${UUID}.health`, "Health Display"],
	afford: [`${UUID}.afford`, "Item Afford Alert"],
	kda: [`${UUID}.kda`, "KDA Display"],
	level: [`${UUID}.level`, "Level"],
	cs: [`${UUID}.cs`, "CS"],
};

function layout(file, entries) {
	return Object.fromEntries(
		entries.map(([coordinate, key, settings = {}]) => {
			const [uuid, name] = ACTIONS[key];
			return [coordinate, profileAction(`${UUID}:${file}:${coordinate}:${uuid}`, name, uuid, settings)];
		}),
	);
}

const fullEntries = [
	["0,0", "gold"], ["1,0", "health", { mode: "hp" }], ["2,0", "health", { mode: "mana" }],
	["3,0", "afford", { itemName: "ITEM", target: 3000 }], ["4,0", "kda", { showCs: false }],
	["0,1", "level"], ["1,1", "cs"],
];

const profiles = [
	{
		file: "lol-live-stats-standard",
		name: "LoL Live Stats",
		actions: layout("standard", fullEntries),
	},
	{
		file: "lol-live-stats-mini",
		name: "LoL Live Stats Mini",
		actions: layout("mini", [
			["0,0", "gold"], ["1,0", "health", { mode: "both" }],
			["2,0", "afford", { itemName: "ITEM", target: 3000 }],
			["0,1", "kda", { showCs: false }], ["1,1", "level"], ["2,1", "cs"],
		]),
	},
	{
		file: "lol-live-stats-xl",
		name: "LoL Live Stats XL",
		actions: layout("xl", [
			["0,0", "gold"], ["1,0", "health", { mode: "hp" }], ["2,0", "health", { mode: "mana" }],
			["3,0", "afford", { itemName: "ITEM", target: 3000 }], ["4,0", "kda", { showCs: false }],
			["5,0", "level"], ["6,0", "cs"],
		]),
	},
	{
		file: "lol-live-stats-plus",
		name: "LoL Live Stats +",
		actions: layout("plus", [
			["0,0", "gold"], ["1,0", "health", { mode: "hp" }], ["2,0", "health", { mode: "mana" }],
			["3,0", "afford", { itemName: "ITEM", target: 3000 }],
			["0,1", "kda", { showCs: false }], ["1,1", "level"], ["2,1", "cs"],
		]),
	},
	{
		file: "lol-live-stats-neo",
		name: "LoL Live Stats Neo",
		actions: layout("neo", [
			["0,0", "gold"], ["1,0", "health", { mode: "hp" }], ["2,0", "health", { mode: "mana" }],
			["3,0", "afford", { itemName: "ITEM", target: 3000 }],
			["0,1", "kda", { showCs: false }], ["1,1", "level"], ["2,1", "cs"],
		]),
	},
];

export async function buildProfiles() {
	await writeProfiles({ profileDir: PROFILE_DIR, seedPrefix: UUID, profiles });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
	await buildProfiles();
	console.log(`Built ${profiles.length} bundled LoL Live Stats profiles.`);
}
