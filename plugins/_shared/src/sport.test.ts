/**
 * The sport registry: single-sport behaviour, and the multi-sport fan-out built on top of it.
 *
 * The first half is a regression guard. Six trackers are already published against the original
 * module-scope config, so every one of those call shapes has to keep answering identically after
 * the registry went in underneath. The second half covers what the registry newly makes possible.
 *
 * Run: npm test
 */
import assert from "node:assert/strict";

import {
	allSports,
	allTeamOptions,
	configureSport,
	isMultiSport,
	leagueFor,
	leagueForRef,
	leaguesFor,
	qualify,
	registerSports,
	resetSports,
	sport,
	sportById,
	sportForLeague,
	sportIdOf,
	sportOf,
	type SportConfig,
	type SportTeam,
	targetsFor,
	teamById,
	teamOptions,
	trackedIn,
	unqualify
} from "./sport";

function team(id: string, abbr: string, conference: string, leagueId?: string): SportTeam {
	return { id, abbr, name: abbr, color: "#101010", altColor: "#f0f0f0", conference, division: conference, leagueId };
}

const NBA: SportConfig = {
	id: "nba",
	label: "NBA",
	league: { sport: "basketball", league: "nba" },
	teams: [team("1", "ATL", "Eastern"), team("13", "LAL", "Western")]
};

const NFL: SportConfig = {
	id: "nfl",
	label: "NFL",
	league: { sport: "football", league: "nfl" },
	// Deliberately reuses id "1": ESPN team ids are only unique inside a league, and that is the
	// whole reason a multi-sport favourite has to be stored qualified.
	teams: [team("1", "ATL", "NFC"), team("12", "KC", "AFC")]
};

const SOCCER: SportConfig = {
	id: "soccer",
	label: "Soccer",
	league: { sport: "soccer", league: "eng.1" },
	flatTable: true,
	teams: [team("359", "ARS", "Premier League"), team("86", "RMA", "La Liga", "esp.1")]
};

const UFC: SportConfig = {
	id: "ufc",
	label: "UFC",
	league: { sport: "mma", league: "ufc" },
	teams: [],
	model: "fights"
};

const key = (l: { sport: string; league: string }): string => `${l.sport}/${l.league}`;

// --- ids and references ---------------------------------------------------

assert.equal(sportIdOf(NBA), "nba");
assert.equal(
	sportIdOf({ league: { sport: "basketball", league: "wnba" }, teams: [] }),
	"basketball/wnba",
	"a sport that declares no id falls back to its ESPN path, which is already unique"
);
assert.equal(qualify("nba", "13"), "nba::13");
assert.deepEqual(unqualify("nba::13"), { sportId: "nba", teamId: "13" });
assert.deepEqual(unqualify("13"), { teamId: "13" }, "a bare id carries no sport and resolves against the default");

// --- single sport: every call shape the six published trackers already make ---

resetSports();
configureSport({ league: NBA.league, teams: NBA.teams });

assert.equal(sport().league.league, "nba", "configureSport still sets the process default");
assert.equal(isMultiSport(), false);
assert.equal(teamById("13")?.abbr, "LAL", "a bare id resolves against the default sport, as saved settings hold it");
assert.equal(teamById(undefined), undefined);
assert.equal(teamById("nope"), undefined);
assert.deepEqual(leagueFor(teamById("13")), NBA.league, "a team with no league of its own uses the sport's league");
assert.deepEqual(leaguesFor(["1", "13"]), [NBA.league], "two teams in one league dedupe to one poll target");
assert.deepEqual(
	leagueForRef("unknown"),
	NBA.league,
	"an unrecognised id in a single-sport process still means this plugin's league, as before"
);
assert.deepEqual(
	teamOptions().map((o) => [o.id, o.group]),
	[
		["1", "Eastern"],
		["13", "Western"]
	],
	"the single-sport picker still emits bare ids grouped by conference"
);

// Soccer is the case that already spanned leagues before any of this existed.
resetSports();
configureSport(SOCCER);
assert.deepEqual(leagueFor(teamById("86")), { sport: "soccer", league: "esp.1" }, "a club carries its own competition");
assert.deepEqual(leagueFor(teamById("359")), SOCCER.league);
assert.equal(leaguesFor(["359", "86"]).length, 2, "following two competitions polls both");

// An event sport has no teams at all, and its league still has to be polled.
resetSports();
configureSport(UFC);
assert.deepEqual(
	targetsFor([], []).map((t) => key(t.league)),
	["mma/ufc"],
	"an event sport's league is active without any team or board key to nominate it"
);

// Nothing placed at all still polls the plugin's own league, so a fresh install shows data.
resetSports();
configureSport(NBA);
assert.deepEqual(
	targetsFor([], []).map((t) => key(t.league)),
	["basketball/nba"]
);

// --- multi sport ----------------------------------------------------------

resetSports();
registerSports([NBA, NFL, SOCCER, UFC]);

assert.equal(isMultiSport(), true);
assert.equal(allSports().length, 4);
assert.equal(sportById("nfl")?.label, "NFL");
assert.equal(sportById("nope"), undefined);

// The collision that forces qualified references.
assert.equal(teamById("nba::1")?.conference, "Eastern");
assert.equal(teamById("nfl::1")?.conference, "NFC", "the same ESPN id is a different team in another league");
assert.equal(sportOf("nfl::1")?.id, "nfl");
assert.equal(
	leagueForRef("nowhere::9"),
	undefined,
	"an unresolvable reference is skipped in a multi-sport process rather than defaulting somewhere wrong"
);

assert.equal(sportForLeague({ sport: "soccer", league: "esp.1" })?.id, "soccer", "a club's competition maps back to soccer");
assert.equal(sportForLeague({ sport: "football", league: "nfl" })?.id, "nfl");
assert.equal(sportForLeague({ sport: "cricket", league: "ipl" }), undefined);
assert.equal(
	sportForLeague({ sport: "soccer", league: "ger.1" })?.id,
	"soccer",
	"a competition no bundled club plays in still resolves while soccer is the only sport claiming that segment"
);

// The fan-out itself: favourites across three sports, each resolved to its own league and config.
const targets = targetsFor(["nba::13", "nfl::12", "soccer::86"], []);
const byKey = new Map(targets.map((t) => [key(t.league), t.cfg.id]));
assert.equal(byKey.get("basketball/nba"), "nba");
assert.equal(byKey.get("football/nfl"), "nfl");
assert.equal(byKey.get("soccer/esp.1"), "soccer", "the Spanish club pulls in La Liga, not the English default");
assert.equal(byKey.get("mma/ufc"), "ufc", "the event sport stays active alongside the team sports");
assert.equal(targets.length, 4);

// A board key nominates a league nobody follows a team in.
const withBoard = targetsFor([], [{ sport: "soccer", league: "ger.1" }]);
assert.ok(
	withBoard.some((t) => key(t.league) === "soccer/ger.1" && t.cfg.id === "soccer"),
	"a scoreboard key's competition is polled and attributed to the right sport"
);

// Duplicates collapse, so two keys on the same league cost one poll.
assert.equal(
	targetsFor(["nba::1", "nba::13"], [{ sport: "basketball", league: "nba" }]).filter(
		(t) => key(t.league) === "basketball/nba"
	).length,
	1
);

// Two sports sharing an ESPN segment make the shortcut ambiguous, so it must not guess.
resetSports();
registerSports([NBA, { id: "wnba", label: "WNBA", league: { sport: "basketball", league: "wnba" }, teams: [] }]);
assert.equal(sportForLeague({ sport: "basketball", league: "nba" })?.id, "nba", "an exact league match is never ambiguous");
assert.equal(
	sportForLeague({ sport: "basketball", league: "mens-college-basketball" }),
	undefined,
	"with NBA and WNBA both registered, an unknown basketball league cannot be attributed to either"
);

resetSports();
registerSports([NBA, NFL, SOCCER, UFC]);

// --- unwrapping references for the poll -----------------------------------

assert.deepEqual(
	trackedIn(["nba::1", "nba::13", "nfl::12"], "basketball/nba"),
	["1", "13"],
	"the poll gets bare ESPN ids back, because that is what the scoreboard payload carries"
);
assert.deepEqual(trackedIn(["nba::1", "nfl::1"], "football/nfl"), ["1"], "the colliding id is attributed to one league only");
assert.deepEqual(trackedIn(["soccer::86"], "soccer/esp.1"), ["86"]);
assert.deepEqual(trackedIn([], "basketball/nba"), []);

// --- the multi-sport picker ------------------------------------------------

const options = allTeamOptions();
assert.equal(options.length, 6, "every team from every registered sport, event sports contributing none");
assert.ok(
	options.some((o) => o.id === "nfl::12" && o.group === "NFL"),
	"options are qualified and grouped by sport, which is the cut that matters across eleven leagues"
);
assert.equal(new Set(options.map((o) => o.id)).size, options.length, "qualifying makes every option id unique");

resetSports();
assert.throws(() => sport(), /configureSport/, "reading the default before anything is registered is a clear error");

console.log("sport.test.ts: all assertions passed");
