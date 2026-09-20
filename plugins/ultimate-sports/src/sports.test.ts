/**
 * The eleven sports and their generated team tables.
 *
 * These tables are machine written from ESPN and never hand edited, which is exactly why they
 * need checking: a regeneration that silently returns a truncated or empty payload produces a
 * plugin that builds, validates, ships, and then cannot find anybody's team. The assertions below
 * are the ones that would have caught the two real problems already hit while building this:
 * ESPN paging the team list at 50, and college football's endpoint returning every division.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";

import {
	allTeamOptions,
	leagueForRef,
	registerSports,
	resetSports,
	sportById,
	targetsFor,
	teamById,
	unqualify
} from "../../_shared/src/sport";

import { competitionsFor, EVENT_SPORTS, SPORTS, TEAM_SPORTS } from "./sports";

// --- the slate -------------------------------------------------------------

assert.equal(SPORTS.length, 11, "eleven sports ship in v1");
assert.equal(TEAM_SPORTS.length, 8);
assert.equal(EVENT_SPORTS.length, 3, "UFC, NASCAR and Formula 1 use the event model");

const ids = SPORTS.map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, "sport ids are unique, since every saved key references one");
for (const s of SPORTS) {
	assert.ok(s.id, "every sport declares an explicit id rather than falling back to its ESPN path");
	assert.ok(s.label, `${s.id} needs a label for the picker`);
	assert.ok(s.league.sport && s.league.league, `${s.id} needs both ESPN path segments`);
}

// Formula 1 rides NASCAR's race model on ESPN's own path, which is what removed the plan's
// dependency on a provider whose terms forbid commercial use.
const f1 = SPORTS.find((s) => s.id === "f1");
assert.deepEqual(f1?.league, { sport: "racing", league: "f1" });
assert.equal(f1?.model, "race");

// --- team tables -----------------------------------------------------------

for (const cfg of EVENT_SPORTS) {
	assert.equal(cfg.teams.length, 0, `${cfg.id} is an event sport and carries no team table`);
}

/** Rough floors, well under the real counts, so a truncated regeneration fails loudly. */
const FLOOR: Record<string, number> = { nfl: 32, nba: 30, nhl: 32, mlb: 30, wnba: 12, cfb: 100, cbb: 300, soccer: 150 };

for (const cfg of TEAM_SPORTS) {
	const id = cfg.id as string;
	assert.ok(
		cfg.teams.length >= FLOOR[id],
		`${id} has ${cfg.teams.length} teams, fewer than the ${FLOOR[id]} it should carry: check for a paged or filtered payload`
	);

	const seen = new Set<string>();
	for (const t of cfg.teams) {
		assert.ok(t.id, `${id} has a team with no id`);
		assert.ok(t.abbr, `${id} team ${t.id} has no abbreviation, which is all the key can draw`);
		assert.ok(t.name, `${id} team ${t.id} has no name for the picker`);
		assert.match(t.color, /^#[0-9a-f]{6}$/, `${id} team ${t.abbr} has an unusable colour`);
		assert.match(t.altColor, /^#[0-9a-f]{6}$/, `${id} team ${t.abbr} has an unusable alternate colour`);
		assert.ok(!seen.has(t.id), `${id} lists team id ${t.id} twice`);
		seen.add(t.id);
	}
}

// College football's /teams returns every division while its standings cover only FBS. Anything
// the standings could not place is dropped, so every remaining row must carry a conference.
const cfb = sportByIdLocal("cfb");
for (const t of cfb.teams) assert.ok(t.conference, `cfb kept ${t.abbr} with no conference`);
assert.ok(cfb.teams.length < 200, "cfb should be FBS only, not every division ESPN publishes");
const tennessee = cfb.teams.find((t) => t.id === "2633");
assert.ok(tennessee, "Tennessee Volunteers must remain available in the College Football team picker");
assert.equal(tennessee.name, "Tennessee Volunteers");
assert.equal(tennessee.abbr, "TENN");
assert.equal(tennessee.conference.toLowerCase(), "sec");

// Soccer is the one sport whose clubs span leagues, so each row carries its own competition.
const soccer = sportByIdLocal("soccer");
for (const t of soccer.teams) assert.ok(t.leagueId, `soccer club ${t.abbr} has no competition of its own`);
assert.equal(competitionsFor("soccer").length, 9, "nine competitions ship");
assert.equal(competitionsFor("nfl").length, 1, "a single league sport reports itself, so the picker is uniform");
assert.equal(competitionsFor("nope").length, 0);

function sportByIdLocal(id: string) {
	const hit = SPORTS.find((s) => s.id === id);
	assert.ok(hit, `${id} is missing from the slate`);
	return hit;
}

// --- registered behaviour --------------------------------------------------

resetSports();
registerSports(SPORTS);

assert.equal(sportById("cbb")?.label, "College Basketball");

// The reason favourites are stored qualified: ids repeat across leagues.
const collisions = new Map<string, string[]>();
for (const cfg of TEAM_SPORTS) {
	for (const t of cfg.teams) {
		const list = collisions.get(t.id) ?? [];
		list.push(cfg.id as string);
		collisions.set(t.id, list);
	}
}
const shared = [...collisions.entries()].filter(([, sportsWithIt]) => sportsWithIt.length > 1);
assert.ok(shared.length > 0, "ESPN team ids really do repeat across leagues, which is what qualifying solves");
for (const [teamId, sportsWithIt] of shared.slice(0, 5)) {
	const a = teamById(`${sportsWithIt[0]}::${teamId}`);
	const b = teamById(`${sportsWithIt[1]}::${teamId}`);
	assert.ok(a && b, `both sports resolve id ${teamId}`);
	assert.equal(unqualify(`${sportsWithIt[0]}::${teamId}`).teamId, teamId);
}

// Every option the picker offers must resolve back to exactly one team.
const options = allTeamOptions();
assert.equal(new Set(options.map((o) => o.id)).size, options.length, "qualifying makes every option unique");
for (const o of options.slice(0, 50)) assert.ok(teamById(o.id), `${o.id} does not resolve`);

// A favourite in each sport pulls in that sport's league, and the event sports stay active.
const someone = TEAM_SPORTS.map((cfg) => `${cfg.id}::${cfg.teams[0].id}`);
const targets = targetsFor(someone, []);
const keys = new Set(targets.map((t) => `${t.league.sport}/${t.league.league}`));
for (const cfg of EVENT_SPORTS) {
	assert.ok(keys.has(`${cfg.league.sport}/${cfg.league.league}`), `${cfg.id} is always polled`);
}
assert.ok(targets.length >= 11, `following one team per sport polls at least eleven leagues, got ${targets.length}`);

// A soccer club resolves to its own competition, not the sport's default entry point.
const spanish = soccer.teams.find((t) => t.leagueId === "esp.1");
assert.ok(spanish, "the table covers LaLiga");
assert.deepEqual(leagueForRef(`soccer::${spanish.id}`), { sport: "soccer", league: "esp.1" });

console.log("sports.test.ts: all assertions passed");
