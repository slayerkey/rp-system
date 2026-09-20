/** What a key should show, given cached data. Pure functions, no Stream Deck. Run: npm test */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type Game, parseStandings } from "./espn";
import { ageLabel, countdown, hasCurrentGame, nextGameFor, placeIn, sortForBoard, startLines } from "./view";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures");
const NOW = Date.parse("2026-10-05T23:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

function game(id: string, state: Game["state"], startsInMs: number, home = "1", away = "2"): Game {
	return {
		id,
		state,
		startIso: new Date(NOW + startsInMs).toISOString(),
		statusShort: "",
		link: "",
		home: { teamId: home, abbr: `H${home}`, score: 0, homeAway: "home" },
		away: { teamId: away, abbr: `A${away}`, score: 0, homeAway: "away" }
	};
}

// --- next game ------------------------------------------------------------

const schedule = [
	game("later", "pre", 5 * 24 * HOUR),
	game("done", "post", -2 * 24 * HOUR),
	game("soon", "pre", 2 * HOUR),
	game("other-team", "pre", HOUR, "9", "8")
];

assert.equal(nextGameFor(schedule, "1", NOW)?.id, "soon", "the nearest unfinished game wins");
assert.equal(nextGameFor(schedule, "2", NOW)?.id, "soon", "works for the away side too");
assert.equal(nextGameFor(schedule, "404", NOW), undefined, "a team with nothing scheduled gets nothing");
assert.equal(nextGameFor([game("done", "post", -HOUR)], "1", NOW), undefined, "a finished game is not 'next'");
assert.equal(
	nextGameFor([game("running-long", "in", -3 * HOUR)], "1", NOW)?.id,
	"running-long",
	"a game in progress stays current however long it has run"
);
assert.equal(
	nextGameFor([game("stuck", "pre", -6 * HOUR)], "1", NOW),
	undefined,
	"a stale 'pre' from hours ago is dropped rather than shown as upcoming"
);
assert.equal(hasCurrentGame(schedule, "1", NOW), true);
assert.equal(hasCurrentGame(schedule, "404", NOW), false);

// --- start lines ----------------------------------------------------------

const today = startLines(new Date(NOW + 3 * HOUR).toISOString(), new Date(NOW));
assert.equal(today.day, "TODAY", "a game later today reads TODAY, not a date");
assert.ok(/\d/.test(today.time), "a time is always rendered");

const nextWeek = startLines(new Date(NOW + 4 * 24 * HOUR).toISOString(), new Date(NOW));
assert.notEqual(nextWeek.day, "TODAY");
assert.equal(nextWeek.day, nextWeek.day.toUpperCase(), "dates are upper cased for the key");
assert.deepEqual(startLines("who knows"), { day: "TBD", time: "" }, "an unparseable time never renders NaN");

// --- standings placement --------------------------------------------------

const rows = parseStandings(JSON.parse(readFileSync(path.join(FIXTURES, "nba-standings-div.json"), "utf-8")));
const bos = rows.find((r) => r.abbr === "BOS");
assert.ok(bos);

const conference = placeIn(rows, bos, "conference");
assert.equal(conference.label, "East", "conference view is labelled by ESPN's own abbreviation");
assert.equal(conference.rank, bos.seed, "conference rank is ESPN's seed, tiebreakers included");
assert.equal(conference.gamesBehind, bos.gamesBehind);

const division = placeIn(rows, bos, "division");
assert.equal(division.label, "Atlantic");
assert.equal(division.rank, 1, "Boston led the Atlantic in the recorded season");
assert.equal(division.gamesBehind, "-");

const phi = rows.find((r) => r.abbr === "PHI");
assert.ok(phi);
const phiDivision = placeIn(rows, phi, "division");
assert.equal(phiDivision.label, "Atlantic");
assert.ok(phiDivision.rank > 1 && phiDivision.rank <= 5, "division rank stays inside the division");
assert.notEqual(phiDivision.rank, phi.seed, "division rank is not the conference seed");

console.log("view.test.ts: all assertions passed");

// --- countdown, age, board order ------------------------------------------

const MIN2 = 60_000;
assert.equal(countdown(new Date(NOW + 45 * MIN2).toISOString(), NOW), "45M", "no IN prefix: it read as part of the time");
assert.equal(countdown(new Date(NOW + 2 * HOUR + 15 * MIN2).toISOString(), NOW), "2H 15M");
assert.equal(countdown(new Date(NOW + 30 * HOUR).toISOString(), NOW), "1D 6H");
assert.equal(countdown(new Date(NOW + 5 * 24 * HOUR).toISOString(), NOW), null, "a date reads better than 120H");
assert.equal(countdown(new Date(NOW - MIN2).toISOString(), NOW), null, "a start time in the past is not a countdown");
assert.equal(countdown("nonsense", NOW), null);

assert.equal(ageLabel(0, NOW), "", "never fetched has no age to show");
assert.equal(ageLabel(NOW - 40_000, NOW), "40s");
assert.equal(ageLabel(NOW - 12 * MIN2, NOW), "12m");
assert.equal(ageLabel(NOW - 3 * HOUR, NOW), "3h");
assert.equal(ageLabel(NOW - 3 * 24 * HOUR, NOW), "3d");

const board = sortForBoard([
	game("final", "post", -3 * HOUR),
	game("later", "pre", 3 * HOUR),
	game("running", "in", -HOUR),
	game("sooner", "pre", HOUR)
]);
assert.deepEqual(
	board.map((g) => g.id),
	["running", "sooner", "later", "final"],
	"live first, then upcoming by start time, finals last"
);
assert.deepEqual(sortForBoard([]), []);

console.log("view.test.ts: countdown, age and board order passed");
