/**
 * Opt-in live check against the real ESPN endpoints. Deliberately not part of npm test, which
 * must stay offline and deterministic. Run this when a tracker starts behaving oddly: if ESPN
 * changes a field name, the parsed output below goes empty or blank while the raw fetch still
 * returns 200, which points straight at the parser rather than the network.
 *
 *   npm run probe            (defaults to the NBA)
 *   npm run probe football nfl
 *   npm run probe mma ufc fights      (event sports need their model, or they report a false zero)
 *   npm run probe racing f1 race
 */
import { createEspnClient, fetchScoreboardJson, fetchStandingsJson, scoreboardUrl, standingsUrl, teamsUrl } from "../src/espn";
import { parseFightCard, parseRaceField, parseRankings } from "../src/event";

const [sport = "basketball", league = "nba", model = "team"] = process.argv.slice(2);
const lg = { sport, league };
const client = createEspnClient(lg);

console.log(`league: ${sport}/${league}`);
console.log(`  scoreboard: ${scoreboardUrl(lg)}`);
console.log(`  teams:      ${teamsUrl(lg)}`);
console.log(`  standings:  ${standingsUrl(lg)}`);

// Event sports are parsed by event.ts, not by the team parsers, so probing them with the team
// path would report a misleading zero for a feed that is working perfectly.
if (model === "fights" || model === "race") {
	const json = await fetchScoreboardJson(lg);
	const events = json === null ? null : model === "race" ? parseRaceField(json) : parseFightCard(json);
	console.log(`
events: ${events === null ? "FETCH FAILED" : events.length}`);
	for (const e of (events ?? []).slice(0, 3)) {
		console.log(`  [${e.state}] ${e.shortName || e.name} - ${e.entries.length} entr(ies) (${e.statusShort})`);
		for (const entry of e.entries.slice(0, 2)) console.log(`      ${entry.primary} | ${entry.secondary}`);
	}
	const rankJson = await fetchStandingsJson(lg);
	const ranks = rankJson === null ? null : parseRankings(rankJson);
	console.log(`
rankings rows: ${ranks === null ? "FETCH FAILED" : ranks.length}`);
	for (const r of (ranks ?? []).slice(0, 3)) console.log(`  P${r.rank} ${r.shortName || r.name} ${r.points} pts`);
	process.exit(0);
}

const teams = await client.teams();
console.log(`\nteams: ${teams === null ? "FETCH FAILED" : teams.length}`);
for (const t of (teams ?? []).slice(0, 3)) console.log(`  ${t.abbr} ${t.name} ${t.color}`);

const games = await client.scoreboard();
console.log(`\nscoreboard today: ${games === null ? "FETCH FAILED" : games.length} game(s)`);
for (const g of games ?? []) {
	console.log(`  [${g.state}] ${g.away.abbr} ${g.away.score} at ${g.home.abbr} ${g.home.score} (${g.statusShort})`);
}

const rows = await client.standings();
console.log(`\nstandings rows: ${rows === null ? "FETCH FAILED" : rows.length}`);
for (const r of (rows ?? []).slice(0, 3)) {
	console.log(`  ${r.abbr} ${r.confAbbr}/${r.division} seed ${r.seed} ${r.wins}-${r.losses}`);
}
