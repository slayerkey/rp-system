/** Cadence and staleness rules. Pure functions, no timers started. Run: npm test */
import assert from "node:assert/strict";

import type { Game } from "./espn";
import { isDue, isStale, TIER_MS, tierFor } from "./poller";

const NOW = Date.parse("2026-10-05T23:00:00Z");

function game(state: Game["state"], startsInMs: number): Game {
	return {
		id: `g${startsInMs}`,
		state,
		startIso: new Date(NOW + startsInMs).toISOString(),
		statusShort: "",
		link: "",
		home: { teamId: "1", abbr: "ATL", score: 0, homeAway: "home" },
		away: { teamId: "2", abbr: "MEM", score: 0, homeAway: "away" }
	};
}

const MIN = 60_000;
const HOUR = 60 * MIN;

// --- tiers ----------------------------------------------------------------

assert.equal(tierFor([], NOW), "idle", "nothing tracked means one poll an hour");
assert.equal(tierFor([game("in", -30 * MIN)], NOW), "live");
assert.equal(tierFor([game("post", -3 * HOUR)], NOW), "idle", "a finished game needs no more polling");
assert.equal(tierFor([game("pre", 5 * MIN)], NOW), "live", "tip-off inside the lead window counts as live");
assert.equal(tierFor([game("pre", 2 * HOUR)], NOW), "soon");
assert.equal(tierFor([game("pre", 20 * HOUR)], NOW), "idle", "tomorrow's game does not deserve a ten minute poll");
assert.equal(tierFor([game("post", -3 * HOUR), game("pre", 2 * HOUR)], NOW), "soon", "the most urgent game wins");
assert.equal(tierFor([game("pre", 4 * HOUR), game("in", -10 * MIN)], NOW), "live");
assert.equal(
	tierFor([{ ...game("pre", HOUR), startIso: "not a date" }], NOW),
	"idle",
	"an unparseable start time is ignored rather than crashing the ticker"
);

assert.ok(TIER_MS.live < TIER_MS.soon && TIER_MS.soon < TIER_MS.idle, "tiers get slower, never faster");
assert.equal(TIER_MS.live, 45_000, "45s during a live game stays well clear of hammering an unofficial API");

// --- staleness ------------------------------------------------------------

assert.equal(isStale(0, NOW, "live"), true, "never fetched is stale");
assert.equal(isStale(NOW - 10_000, NOW, "live"), false);
assert.equal(isStale(NOW - 2 * TIER_MS.live, NOW, "live"), false, "one missed poll is not worth a warning");
assert.equal(isStale(NOW - 4 * TIER_MS.live, NOW, "live"), true, "three missed polls marks the key stale");
assert.equal(isStale(NOW - 30 * MIN, NOW, "idle"), false, "half an hour old is fine when nothing is happening");

// --- per-league due clock -------------------------------------------------
// Each league carries its own timestamp, which is what stops a deck spanning many sports from
// polling every league at the cadence of its most urgent one.

assert.equal(isDue(0, [], NOW), true, "a league never polled is always due, so a cold start fills in");
assert.equal(isDue(NOW - 10_000, [game("in", -MIN)], NOW), false, "a live league polled 10s ago is not due yet");
assert.equal(isDue(NOW - 50_000, [game("in", -MIN)], NOW), true, "past the live interval it is due");
assert.equal(isDue(NOW - 50_000, [], NOW), false, "an idle league is not due just because a live one would be");
assert.equal(isDue(NOW - 2 * HOUR, [], NOW), true, "an idle league still polls once an hour");
assert.equal(
	isDue(NOW - 20 * MIN, [game("pre", 2 * HOUR)], NOW),
	true,
	"a league with a game a couple of hours out polls on the soon cadence"
);

console.log("poller.test.ts: all assertions passed");
