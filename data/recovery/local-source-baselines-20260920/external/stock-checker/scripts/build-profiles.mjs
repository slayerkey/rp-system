import path from "node:path";
import { fileURLToPath } from "node:url";

import { profileAction, writeProfiles } from "./profile-builder.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_DIR = path.join(ROOT, "com.ratpack.marketcommandcenter.sdPlugin", "profiles");
const UUID = "com.ratpack.marketcommandcenter";

const ACTIONS = {
	stock: [`${UUID}.ticker`, "Stock / Index", {
		preset: "SPY", displayStyle: "price", timeframe: "1D", showName: true,
		showSparkline: true, theme: "dark", rotateSeconds: "6",
	}],
	crypto: [`${UUID}.crypto`, "Crypto", {
		preset: "BTC", displayStyle: "price", timeframe: "1D",
		showSparkline: true, theme: "dark", rotateSeconds: "6",
	}],
	heatmap: [`${UUID}.heatmap`, "Watchlist Heatmap", {
		market: "stocks", symbols: "AAPL, MSFT, NVDA, AMZN, GOOGL, TSLA", theme: "dark",
	}],
	fear: [`${UUID}.feargreed`, "Fear & Greed Gauge", { theme: "dark" }],
	earnings: [`${UUID}.earnings`, "Earnings Countdown", { preset: "AAPL", theme: "dark" }],
	clock: [`${UUID}.clock`, "Market Clock", { exchange: "US", candleMinutes: "0", theme: "dark" }],
};

function layout(file, entries) {
	return Object.fromEntries(
		entries.map(([coordinate, key]) => {
			const [uuid, name, settings] = ACTIONS[key];
			return [coordinate, profileAction(`${UUID}:${file}:${coordinate}:${uuid}`, name, uuid, settings)];
		}),
	);
}

const profiles = [
	{
		file: "market-command-center-standard",
		name: "Market Command Center",
		actions: layout("standard", [
			["0,0", "stock"], ["1,0", "crypto"], ["2,0", "heatmap"], ["3,0", "fear"], ["4,0", "earnings"],
			["0,1", "clock"],
		]),
	},
	{
		file: "market-command-center-mini",
		name: "Market Command Center Mini",
		actions: layout("mini", [
			["0,0", "stock"], ["1,0", "crypto"], ["2,0", "heatmap"],
			["0,1", "fear"], ["1,1", "earnings"], ["2,1", "clock"],
		]),
	},
	{
		file: "market-command-center-xl",
		name: "Market Command Center XL",
		actions: layout("xl", [
			["0,0", "stock"], ["1,0", "crypto"], ["2,0", "heatmap"],
			["3,0", "fear"], ["4,0", "earnings"], ["5,0", "clock"],
		]),
	},
	{
		file: "market-command-center-plus",
		name: "Market Command Center +",
		actions: layout("plus", [
			["0,0", "stock"], ["1,0", "crypto"], ["2,0", "heatmap"], ["3,0", "fear"],
			["0,1", "earnings"], ["1,1", "clock"],
		]),
	},
	{
		file: "market-command-center-neo",
		name: "Market Command Center Neo",
		actions: layout("neo", [
			["0,0", "stock"], ["1,0", "crypto"], ["2,0", "heatmap"], ["3,0", "fear"],
			["0,1", "earnings"], ["1,1", "clock"],
		]),
	},
];

export async function buildProfiles() {
	await writeProfiles({ profileDir: PROFILE_DIR, seedPrefix: UUID, profiles });
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
	await buildProfiles();
	console.log(`Built ${profiles.length} bundled Market Command Center profiles.`);
}
