import assert from "node:assert/strict";
import test from "node:test";

import { factionAccent, majorOrderProgress, makeSnapshot, parseFronts } from "./model";

test("major order progress follows value type 3 target counts", () => {
	const percent = majorOrderProgress({
		progress: [4, 1],
		tasks: [
			{ values: [10, 2, 0, 0], valueTypes: [3, 1, 11, 12] },
			{ values: [2, 1, 194], valueTypes: [3, 11, 12] }
		]
	});
	assert.equal(percent, 45);
});

test("fronts use full planet data and sort closest first", () => {
	const fronts = parseFronts(
		[
			{ id: 1, faction: "Terminids", planet: { index: 10, name: "Old" } },
			{ id: 2, faction: "Automatons", planet: { index: 20, name: "Other" } }
		],
		[
			{ index: 10, name: "Fenrir III", health: 20, maxHealth: 100 },
			{ index: 20, name: "Menkent", health: 60, maxHealth: 100 }
		]
	);
	assert.deepEqual(
		fronts.map((front) => [front.planet, front.liberationPercent]),
		[
			["Fenrir III", 80],
			["Menkent", 40]
		]
	);
});

test("snapshot reports active fronts, divers, and human-held planets", () => {
	const snapshot = makeSnapshot(
		{ statistics: { playerCount: 12345 } },
		[{ id: 1, faction: "Illuminate", planet: { index: 2, name: "Meridia" } }],
		[],
		[
			{ index: 1, name: "Mars", currentOwner: "Humans", health: 0, maxHealth: 100 },
			{ index: 2, name: "Meridia", currentOwner: "Illuminate", health: 50, maxHealth: 100 }
		],
		1000
	);
	assert.equal(snapshot.war.activeCampaigns, 1);
	assert.equal(snapshot.war.playerCount, 12345);
	assert.equal(snapshot.war.overallLiberation, 50);
	assert.equal(factionAccent("Illuminate"), "#4b91e8");
});

