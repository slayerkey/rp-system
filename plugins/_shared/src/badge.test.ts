/** Key-face renderer checks. Pure string work, no Stream Deck needed. Run: npm test */
import assert from "node:assert/strict";

import {
	displayColor,
	entryBadge,
	escapeXml,
	eventBadge,
	fitStatus,
	keyImage,
	lift,
	measure,
	messageBadge,
	nextGameBadge,
	readableOn,
	scoreBadge,
	standingsBadge
} from "./badge";

/** The content box every face lays out inside: the left margin to the right edge. */
const BOX = 136 - 18;

// --- contrast -------------------------------------------------------------

assert.equal(readableOn("#ffffff"), "#0b0d12", "white ground gets dark text");
assert.equal(readableOn("#000000"), "#f5faf8", "black ground gets light text");
assert.equal(readableOn("#fdb927"), "#0b0d12", "bright gold would swallow white text");
assert.equal(readableOn("#c8102e"), "#f5faf8", "deep red keeps light text");
assert.equal(readableOn("garbage"), "#f5faf8", "unparseable colour still yields readable text");

// Near-black official palettes (Brooklyn, San Antonio) would vanish against the key ground.
assert.equal(displayColor("#c8102e", "#fdb927"), "#c8102e", "a visible primary is kept");
assert.equal(displayColor("#000000", "#ffffff"), "#ffffff", "black primary falls back to the alternate");
assert.equal(displayColor("#000000", "#0a0a0a"), "#2a2f3a", "two dark colours fall back to neutral slate");
assert.equal(displayColor("nonsense"), "#2a2f3a");

// --- helpers --------------------------------------------------------------

assert.equal(escapeXml('A&B<C>"D"'), "A&amp;B&lt;C&gt;&quot;D&quot;");
assert.equal(fitStatus("Q3 - 5:32"), "Q3 5:32", "ESPN's padded separator is collapsed");
assert.equal(fitStatus("Final"), "Final");
assert.equal(fitStatus("Final/OT"), "Final/OT");
assert.ok(fitStatus("10/5 - 7:00 PM EDT").length <= 14, "a long status is clipped to the key width");

// --- score badge ----------------------------------------------------------

const score = scoreBadge({
	teamColor: "#c8102e",
	teamAbbr: "ATL",
	teamScore: 78,
	oppAbbr: "MEM",
	oppScore: 81,
	status: "Q3 - 5:32",
	live: true
});
assert.ok(score.startsWith("<svg xmlns=") && score.endsWith("</svg>"), "well formed SVG document");
assert.ok(score.includes("width=\"144\" height=\"144\""), "144px key face");
assert.ok(score.includes(">ATL<") && score.includes(">78<"), "tracked team and its score");
assert.ok(score.includes(">MEM<") && score.includes(">81<"), "opponent and its score");
assert.ok(score.includes("Q3 5:32"));
assert.ok(score.includes("#c8102e"), "team colour is on the key");
assert.ok(score.includes("#2be86a"), "a live game uses the accent status colour");
assert.ok(!score.includes("#f2b33d"), "no stale marker on fresh data");

const staleScore = scoreBadge({
	teamColor: "#c8102e",
	teamAbbr: "ATL",
	teamScore: 78,
	oppAbbr: "MEM",
	oppScore: 81,
	status: "Final",
	stale: true
});
assert.ok(staleScore.includes("#f2b33d"), "stale data is marked, not hidden");
assert.ok(staleScore.includes('y="139"'), "the marker is the bottom edge bar, clear of the score");
assert.ok(!staleScore.includes("#2be86a"), "a finished game does not use the live colour");

// No logo, crest or image ever reaches a key face.
for (const svg of [score, staleScore]) {
	assert.ok(!/<image/i.test(svg) && !/xlink:href/i.test(svg), "badges are text and colour only");
}

// --- a fixture that has not started ---------------------------------------
// A bare clock time was the bug here: ESPN's default scoreboard returns the next match day when
// nothing is on, so out of season this key showed October fixtures reading as "4:00 PM" today.

const scheduled = scoreBadge({
	teamColor: "#98002e",
	teamAbbr: "MIA",
	teamScore: "",
	oppAbbr: "TOR",
	oppScore: "",
	status: "",
	when: { day: "FRI OCT 3", time: "4:00 PM" },
	index: [1, 12]
});
assert.ok(scheduled.includes(">FRI OCT 3<"), "a scheduled game states its day, not just a time");
assert.ok(scheduled.includes(">4:00 PM<"));
assert.ok(!scheduled.includes(">0<"), "and never invents a zero score for a game nobody has played");
assert.ok(scheduled.includes("1/12"), "its place in the slate still shows");

// A game later the same day needs no date: the time already says it, and a "TODAY" label was
// just noise next to it. With nothing stacked above, the time gets the bigger size.
const today = scoreBadge({
	teamColor: "#98002e",
	teamAbbr: "MIA",
	teamScore: "",
	oppAbbr: "TOR",
	oppScore: "",
	status: "",
	when: { time: "7:30 PM" }
});
assert.ok(today.includes(">7:30 PM<"));
assert.ok(!today.includes("TODAY"), "no redundant day label when the game is today");
assert.ok(today.includes('font-size="21"'), "and the time takes the space the date would have used");

// --- the wire format setImage() actually accepts ---------------------------

const encoded = keyImage(score);
assert.ok(encoded.startsWith("data:image/svg+xml;base64,"), "keys take a base64 data URI, not raw markup");
assert.equal(
	Buffer.from(encoded.slice("data:image/svg+xml;base64,".length), "base64").toString("utf-8"),
	score,
	"the badge survives the round trip intact"
);
assert.ok(!encoded.includes("#"), "no bare '#' survives, which a URI parser would read as a fragment");

// --- next game badge ------------------------------------------------------

const home = nextGameBadge({
	teamColor: "#006bb6",
	teamAbbr: "NY",
	oppAbbr: "SA",
	homeAway: "home",
	when: "WED OCT 7",
	whenDetail: "7:30 PM"
});
assert.ok(home.includes("vs SA"), "home games read 'vs'");
assert.ok(home.includes("WED OCT 7") && home.includes("7:30 PM"));

const away = nextGameBadge({ teamColor: "#006bb6", teamAbbr: "NY", oppAbbr: "SA", homeAway: "away", when: "WED OCT 7" });
assert.ok(away.includes("@ SA"), "road games read '@'");

// --- standings badge ------------------------------------------------------

const seeded = standingsBadge({
	teamColor: "#007a33",
	teamAbbr: "BOS",
	groupLabel: "Atlantic",
	seed: 2,
	wins: 56,
	losses: 26,
	gamesBehind: "4.0"
});
assert.ok(seeded.includes(">#2<"), "seed reads as a rank");
assert.ok(seeded.includes("ATLANTIC"), "group label is upper cased for the key");
assert.ok(seeded.includes("56-26"));
assert.ok(seeded.includes("GB 4.0"));

const leader = standingsBadge({
	teamColor: "#007a33",
	teamAbbr: "BOS",
	groupLabel: "East",
	seed: 1,
	wins: 56,
	losses: 26,
	gamesBehind: "-"
});
assert.ok(leader.includes("LEADER"), "ESPN's '-' games behind reads as LEADER, not a stray dash");

const unseeded = standingsBadge({
	teamColor: "#007a33",
	teamAbbr: "BOS",
	groupLabel: "East",
	seed: 0,
	wins: 0,
	losses: 0,
	gamesBehind: ""
});
assert.ok(unseeded.includes(">--<"), "preseason has no seed yet");

// --- message badge --------------------------------------------------------

const msg = messageBadge({ title: "PICK TEAM", detail: "in settings" });
assert.ok(msg.includes("PICK TEAM") && msg.includes("in settings"));
assert.ok(messageBadge({ title: "OFFLINE", stale: true }).includes("#f2b33d"));

// --- lifting a team colour into readable text -----------------------------

assert.equal(lift("#ffffff"), "#ffffff", "white cannot be lifted further");
assert.equal(lift("#000000", 0.5), "#808080", "black lifts to the midpoint");
assert.equal(lift("garbage"), "#c4cee0", "an unusable colour falls back to plain muted text");
assert.ok(
	(luminanceOf(lift("#1d428a")) ?? 0) > (luminanceOf("#1d428a") ?? 1),
	"a deep navy is lifted clear of the key ground so it can be read as text"
);

function luminanceOf(color: string): number | null {
	const m = /^#([0-9a-f]{6})$/i.exec(color);
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// --- measuring, which is what keeps names inside the key ------------------
// Counting characters is not enough here: these two strings are nearly the same length and
// nowhere near the same width, and the wide one used to run off the edge of the key.

assert.ok(measure("William Byron", 19) > BOX, "a wide 13 character name does not fit on one line");
assert.ok(measure("Gaethje vs", 19) <= BOX, "a narrower 10 character name does");
assert.ok(measure("IIIIIIIIII", 19) < measure("MMMMMMMMMM", 19), "narrow and wide glyphs measure differently");
assert.equal(measure("", 19), 0);

// --- event and entry faces ------------------------------------------------

const wideName = entryBadge({ accent: "#e4a11b", kicker: "Cup", primary: "William Byron", secondary: "P3", index: [3, 37] });
assert.ok(wideName.includes(">William<") && wideName.includes(">Byron<"), "a name too wide for one line wraps instead of clipping");
assert.ok(wideName.includes("3/37"));

// A one-line name earns the bigger size; a name that needs two lines keeps the smaller one.
// This is what stopped a driver's name sitting small above half an empty key.
const shortName = entryBadge({ accent: "#e10600", kicker: "DRV #5", primary: "L. Norris", secondary: "128 PTS" });
assert.ok(shortName.includes('font-size="27"'), "a short name gets the largest size");
assert.ok(shortName.includes(">L. Norris<"), "and is not wrapped");

// The in-between case: too wide for 27 but fine on one line a little smaller. This used to drop
// straight to the two-line size and leave the bottom half of the key empty.
const midName = entryBadge({ accent: "#e4a11b", kicker: "Cup", primary: "Kyle Larson", secondary: "P3" });
assert.ok(midName.includes(">Kyle Larson<"), "a medium name still takes one line");
const midSize = Number(/font-size="(\d+)"[^>]*>Kyle Larson</.exec(midName)?.[1]);
assert.ok(midSize > 19 && midSize < 27, `a medium name lands between the extremes, got ${midSize}`);
assert.ok(measureFits("Kyle Larson", midSize), "and the size it picked genuinely fits");

const longName = entryBadge({ accent: "#b7202e", kicker: "UFC", primary: "Gaethje vs Pimblett", secondary: "R1" });
assert.ok(longName.includes('font-size="19"'), "a name that cannot fit on one line drops to the wrapping size");
assert.ok(longName.includes(">Gaethje vs<") && longName.includes(">Pimblett<"), "and wraps on a word boundary");

const eventSize = Number(
	/font-size="(\d+)"[^>]*>Daytona 500</.exec(
		eventBadge({ accent: "#e4a11b", kicker: "Next", title: "Daytona 500", when: "45M" })
	)?.[1]
);
assert.ok(eventSize >= 20, `the event face sizes to its content the same way, got ${eventSize}`);

function measureFits(value: string, size: number): boolean {
	return measure(value, size) <= BOX;
}

const runOn = eventBadge({
	accent: "#b7202e",
	kicker: "UFC",
	title: "Supercalifragilisticexpialidocious",
	when: "SAT 10:00 PM"
});
assert.ok(runOn.includes("…"), "a single unbreakable word is cut and marked rather than overflowing the key");

const liveEvent = eventBadge({ accent: "#b7202e", kicker: "UFC", title: "Main Card", when: "LIVE NOW", live: true });
assert.ok(liveEvent.includes("#2be86a"), "a live event uses the accent colour");
assert.ok(!eventBadge({ accent: "#b7202e", kicker: "UFC", title: "Main Card", when: "SAT" }).includes("#2be86a"));

// --- who is winning reads before the numbers do ---------------------------

const behind = scoreBadge({ teamColor: "#1d428a", teamAbbr: "NY", teamScore: 98, oppAbbr: "SA", oppScore: 101, status: "Q4" });
assert.ok(/>98</.test(behind) && /#78849c/.test(behind), "the trailing side is dimmed");
const ahead = scoreBadge({ teamColor: "#1d428a", teamAbbr: "NY", teamScore: 101, oppAbbr: "SA", oppScore: 98, status: "Q4" });
assert.ok(ahead.includes("#78849c"), "whichever side trails is the dimmed one");
const level = scoreBadge({ teamColor: "#1d428a", teamAbbr: "NY", teamScore: 99, oppAbbr: "SA", oppScore: 99, status: "Q4" });
assert.ok(!level.includes("#78849c"), "a tied game dims neither side");
const notStarted = scoreBadge({ teamColor: "#1d428a", teamAbbr: "NY", teamScore: "", oppAbbr: "SA", oppScore: "", status: "7:30 PM" });
assert.ok(!notStarted.includes("#78849c"), "before tip-off there is no side to dim");

console.log("badge.test.ts: all assertions passed");
