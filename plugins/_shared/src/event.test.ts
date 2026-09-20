/** Fight card and race field parsing, against recorded ESPN payloads. Run: npm test */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { currentEvent, parseFightCard, parseRaceField, parseRankings, type SportEvent } from "./event";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures");
const fixture = (name: string): unknown => JSON.parse(readFileSync(path.join(FIXTURES, name), "utf-8"));

// --- fight card -----------------------------------------------------------

const cards = parseFightCard(fixture("ufc-scoreboard.json"));
assert.equal(cards.length, 1, "one card on the board");
const card = cards[0];
assert.ok(card.name.startsWith("UFC"), "the event names itself");
assert.equal(card.state, "pre");
assert.ok(card.entries.length > 5, "a card is a dozen or so bouts");
assert.ok(card.entries.every((e) => e.primary.includes(" vs ") || e.primary === "TBA"), "every bout is a matchup");
assert.ok(card.link.startsWith("http"), "the event page comes from ESPN's own links");

// ESPN lists the main event last; a key showing one bout at a time should open on it.
const raw = fixture("ufc-scoreboard.json") as { events: { competitions: unknown[] }[] };
const lastBout = raw.events[0].competitions[raw.events[0].competitions.length - 1] as {
	competitors: { athlete: { shortName: string } }[];
};
assert.equal(
	card.entries[0].primary,
	lastBout.competitors.map((c) => c.athlete.shortName).join(" vs "),
	"the main event leads the card"
);

// A decided bout reads as a result, not a start time.
const settled = parseFightCard({
	events: [
		{
			id: "1",
			name: "UFC 999",
			date: "2026-01-01T00:00Z",
			status: { type: { state: "post", shortDetail: "Final" } },
			competitions: [
				{
					id: "b1",
					status: { type: { state: "post", shortDetail: "Final" } },
					competitors: [
						{ winner: true, athlete: { displayName: "Alex Winner", shortName: "A. Winner" } },
						{ winner: false, athlete: { displayName: "Bo Loser", shortName: "B. Loser" } }
					]
				}
			]
		}
	]
});
assert.equal(settled[0].entries[0].primary, "A. Winner vs B. Loser");
assert.equal(settled[0].entries[0].secondary, "A. Winner won");
assert.equal(settled[0].entries[0].settled, true);

assert.deepEqual(parseFightCard(null), []);
assert.deepEqual(parseFightCard({ events: [{}] }), [], "an event with no id is dropped");

// --- race field -----------------------------------------------------------

const finished = parseRaceField(fixture("nascar-race-post.json"));
assert.equal(finished.length, 1);
assert.equal(finished[0].state, "post");
assert.ok(finished[0].entries.length > 30, "a Cup field is around forty cars");
assert.equal(finished[0].entries[0].secondary, "P1", "the field reads in finishing order");
assert.equal(finished[0].entries[0].settled, true, "the winner is marked");
assert.equal(finished[0].entries[1].secondary, "P2");

// Before the green flag ESPN publishes the race with no field at all. That is a real state.
const upcoming = parseRaceField(fixture("nascar-scoreboard.json"));
assert.equal(upcoming.length, 1);
assert.equal(upcoming[0].entries.length, 0, "no field before the race");
assert.ok(upcoming[0].name.length > 0, "the race still names itself");

assert.deepEqual(parseRaceField(null), []);

// --- championship table ---------------------------------------------------

const drivers = parseRankings(fixture("nascar-standings.json"));
assert.ok(drivers.length > 30, "the Cup table is the full field");
assert.equal(drivers[0].rank, 1, "sorted by rank, leader first");
assert.ok(drivers[0].points > 0, "championship points come through");
assert.ok(drivers[0].shortName.length > 0);
assert.ok(
	drivers.every((d, i) => i === 0 || drivers[i - 1].rank <= d.rank),
	"rank never goes backwards"
);
assert.deepEqual(parseRankings(null), []);

// --- which event a key should show ----------------------------------------

function ev(id: string, state: SportEvent["state"], startsInMs: number): SportEvent {
	return {
		id,
		name: id,
		shortName: id,
		startIso: new Date(Date.now() + startsInMs).toISOString(),
		state,
		statusShort: "",
		link: "",
		entries: []
	};
}

const HOUR = 60 * 60_000;
assert.equal(currentEvent([ev("done", "post", -48 * HOUR), ev("next", "pre", 30 * HOUR)], Date.now())?.id, "next");
assert.equal(
	currentEvent([ev("live", "in", -HOUR), ev("next", "pre", 30 * HOUR)], Date.now())?.id,
	"live",
	"a card in progress beats the next one"
);
assert.equal(
	currentEvent([ev("older", "post", -72 * HOUR), ev("recent", "post", -24 * HOUR)], Date.now())?.id,
	"recent",
	"with nothing upcoming, the most recent event stands"
);
assert.equal(currentEvent([], Date.now()), undefined);

console.log("event.test.ts: all assertions passed");
