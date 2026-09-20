/** Parser checks against recorded ESPN payloads. No network. Run: npm test */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	gameForTeam,
	parseScoreboard,
	parseStandings,
	parseTeams,
	rankWithin,
	scoreboardUrl,
	sidesFor,
	standingsUrl,
	teamsUrl
} from "./espn";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures");
const fixture = (name: string): unknown => JSON.parse(readFileSync(path.join(FIXTURES, name), "utf-8"));

const NBA = { sport: "basketball", league: "nba" };

// --- urls -----------------------------------------------------------------

assert.equal(
	scoreboardUrl(NBA),
	"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
);
assert.ok(scoreboardUrl(NBA, "20260610").endsWith("?dates=20260610"));
// The limit is not cosmetic: ESPN pages this at 50, which silently truncates the college leagues
// (Division I basketball alone returns 362 teams).
assert.equal(teamsUrl({ sport: "football", league: "nfl" }),
	"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams?limit=500");
// Standings sit under a different API root, and at level=3 so divisions come back too.
assert.ok(standingsUrl(NBA).includes("/apis/v2/sports/basketball/nba/standings?level=3"));

// --- teams ----------------------------------------------------------------

const teams = parseTeams(fixture("nba-teams.json"));
assert.equal(teams.length, 30, "NBA has 30 teams");
const atl = teams.find((t) => t.abbr === "ATL");
assert.ok(atl);
assert.equal(atl.name, "Atlanta Hawks");
assert.equal(atl.color, "#c8102e", "colour normalised with a leading hash");
assert.ok(teams.every((t) => /^#[0-9a-f]{6}$/.test(t.color)), "every colour is usable in an SVG fill");

// Bad or missing colours fall back instead of producing broken SVG.
const patched = parseTeams({
	sports: [{ leagues: [{ teams: [{ team: { id: "99", abbreviation: "ZZZ", color: "not-a-colour" } }] }] }]
});
assert.equal(patched[0].color, "#1b1f27");
assert.equal(patched[0].name, "ZZZ", "name falls back to the abbreviation");

// --- scoreboard: the three game states ------------------------------------

const post = parseScoreboard(fixture("nba-scoreboard-post.json"));
assert.equal(post.length, 1);
assert.equal(post[0].state, "post");
assert.equal(post[0].statusShort, "Final");
assert.equal(post[0].home.abbr, "NY");
assert.equal(post[0].home.score, 107);
assert.equal(post[0].away.abbr, "SA");
assert.equal(post[0].away.score, 106);
assert.ok(post[0].link.startsWith("https://www.espn.com/nba/game/"), "the game page comes from ESPN's own links");
assert.equal(parseScoreboard({ events: [{ id: "1", competitions: [{ competitors: [
	{ homeAway: "home", team: { id: "1", abbreviation: "AAA" } },
	{ homeAway: "away", team: { id: "2", abbreviation: "BBB" } }
] }] }] })[0].link, "", "an event with no links yields an empty link, never undefined");

const live = parseScoreboard(fixture("nba-scoreboard-in.json"));
assert.equal(live[0].state, "in");
assert.equal(live[0].statusShort, "Q3 - 5:32");
assert.equal(live[0].home.score, 78);
assert.equal(live[0].away.score, 81);

const pre = parseScoreboard(fixture("nba-scoreboard-pre.json"));
assert.ok(pre.length > 0, "the offseason scoreboard still lists upcoming games");
assert.ok(pre.every((g) => g.state === "pre"));
assert.ok(pre.every((g) => Number.isFinite(Date.parse(g.startIso))), "start times parse");

// --- scoreboard: malformed input is skipped, never thrown ------------------

assert.deepEqual(parseScoreboard(null), []);
assert.deepEqual(parseScoreboard({}), []);
assert.deepEqual(parseScoreboard({ events: "nope" }), []);
assert.deepEqual(parseScoreboard({ events: [{}] }), [], "an event with no competitors is dropped");
assert.deepEqual(
	parseScoreboard({ events: [{ id: "1", competitions: [{ competitors: [{ homeAway: "home", team: { id: "1", abbreviation: "AAA" } }] }] }] }),
	[],
	"a half-populated game is dropped rather than rendered with a missing side"
);

// --- team lookup ----------------------------------------------------------

const nyGame = gameForTeam(post, post[0].home.teamId);
assert.ok(nyGame);
assert.equal(gameForTeam(post, "does-not-play-today"), undefined);

const sides = sidesFor(post[0], post[0].away.teamId);
assert.ok(sides);
assert.equal(sides.own.abbr, "SA", "the tracked team is always 'own', home or away");
assert.equal(sides.opp.abbr, "NY");
assert.equal(sidesFor(post[0], "0"), null);

// --- standings ------------------------------------------------------------

const rows = parseStandings(fixture("nba-standings-div.json"));
assert.equal(rows.length, 30, "six divisions of five teams");
const bos = rows.find((r) => r.abbr === "BOS");
assert.ok(bos);
assert.equal(bos.conference, "Eastern Conference");
assert.equal(bos.confAbbr, "East");
assert.equal(bos.division, "Atlantic");
assert.equal(bos.seed, 2);
assert.equal(bos.wins, 56);
assert.equal(bos.losses, 26);
assert.equal(bos.seed, 2, "a league with a playoff seed keeps using it");
assert.ok(rows.every((r) => r.division !== ""), "division comes from the level=3 tree");
// Division rank: ESPN publishes a conference seed but never a division rank.
const atlantic = rows.filter((r) => r.division === "Atlantic");
assert.equal(atlantic.length, 5);
const bosRank = rankWithin(atlantic, bos.teamId);
assert.equal(bosRank.rank, 1, "Boston led the Atlantic in the recorded season");
assert.equal(bosRank.gamesBehind, "-", "the leader is not behind anyone");
const philly = rows.find((r) => r.abbr === "PHI");
assert.ok(philly);
const phiRank = rankWithin(atlantic, philly.teamId);
assert.ok(phiRank.rank > 1);
assert.equal(phiRank.gamesBehind, "11.0", "56-26 over 45-37 is eleven games");
assert.deepEqual(rankWithin(atlantic, "not-in-this-division"), { rank: 0, gamesBehind: "" });
assert.deepEqual(rankWithin([], "1"), { rank: 0, gamesBehind: "" });

assert.deepEqual(parseStandings(null), []);
assert.deepEqual(parseStandings({ children: [{ name: "East" }] }), [], "a group with no entries yields nothing");

// Soccer publishes one flat table per competition: no divisions, ranked on points.
const flat = parseStandings({
	children: [
		{
			name: "English Premier League",
			abbreviation: "EPL",
			standings: {
				entries: [
					{
						team: { id: "359", abbreviation: "ARS" },
						stats: [
							{ name: "rank", value: 1, displayValue: "1" },
							{ name: "points", value: 42, displayValue: "42" },
							{ name: "wins", value: 13, displayValue: "13" },
							{ name: "losses", value: 2, displayValue: "2" }
						]
					}
				]
			}
		}
	]
});
assert.equal(flat.length, 1, "a competition node with entries and no children is its own table");
assert.equal(flat[0].abbr, "ARS");
assert.equal(flat[0].seed, 1, "table rank stands in for a playoff seed");
assert.equal(flat[0].points, 42);
assert.equal(flat[0].division, "English Premier League", "the competition names itself");

console.log("espn.test.ts: all assertions passed");
