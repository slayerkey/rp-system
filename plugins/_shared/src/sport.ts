/**
 * The one thing that differs between the sport trackers.
 *
 * Originally a single module-scope config, because a per-sport plugin process only ever served
 * one sport. That is still exactly how the six standalone trackers use it: configureSport() sets
 * the default and every shared action reads it with sport(). Nothing about those call sites moved.
 *
 * What changed is that the registry underneath now holds more than one sport at a time, so a
 * single plugin can serve every league at once. The rule that makes that safe: an ESPN team id is
 * only unique inside its league (id "1" is a different team in the NFL and the NBA), so anything
 * stored against a favourite in a multi-sport process must carry the sport with it. That is what
 * qualify() / unqualify() are for. A bare id still resolves against the default sport, which is
 * why the shipped trackers' saved settings keep working untouched.
 *
 * Most sports are a single league. Soccer is not: a team belongs to a competition, and someone
 * following Arsenal and Real Madrid is following two different ESPN leagues from the same deck.
 * That is why a team can carry its own league id.
 */
import type { EspnLeague } from "./espn";
import type { TeamOption } from "./pi-protocol";

export type SportId = string;

export type SportTeam = {
	id: string;
	abbr: string;
	name: string;
	color: string;
	altColor: string;
	/** Grouping used by the picker and the standings key: conference, tour, competition. */
	conference: string;
	division: string;
	/** ESPN league path segment, for sports whose teams span competitions. */
	leagueId?: string;
};

export type SportConfig = {
	/**
	 * Stable key for this sport inside a multi-sport process. Derived from the league when absent,
	 * which is what keeps the single-sport trackers from having to declare one.
	 */
	id?: SportId;
	/** Human label for the sport picker. Falls back to the id. */
	label?: string;
	league: EspnLeague;
	teams: SportTeam[];
	/**
	 * "team" is a game between two sides with a score. "fights" and "race" are events with a
	 * field: a card of bouts, or a grid of drivers. The model decides which parser the poll uses
	 * and which actions the plugin registers.
	 */
	model?: "team" | "fights" | "race";
	/** Set when the sport's table is one flat list per competition, as in soccer. */
	flatTable?: boolean;
};

/** Separator for qualified team references. Neither sport ids nor ESPN team ids contain it. */
const SEP = "::";

const registry = new Map<SportId, SportConfig>();
/** O(1) lookup for the paint hot path, rebuilt whenever a sport is registered. */
const teamIndex = new Map<string, { team: SportTeam; cfg: SportConfig }>();
let defaultId: SportId | null = null;

/** A sport's key. Explicit when given, otherwise the ESPN path, which is already unique. */
export function sportIdOf(cfg: SportConfig): SportId {
	return cfg.id ?? `${cfg.league.sport}/${cfg.league.league}`;
}

export function sportLabel(cfg: SportConfig): string {
	return cfg.label ?? sportIdOf(cfg);
}

/** "nba::13". Team ids repeat across leagues, so a multi-sport favourite must carry both. */
export function qualify(sportId: SportId, teamId: string): string {
	return `${sportId}${SEP}${teamId}`;
}

export function unqualify(ref: string): { sportId?: SportId; teamId: string } {
	const at = ref.indexOf(SEP);
	return at < 0 ? { teamId: ref } : { sportId: ref.slice(0, at), teamId: ref.slice(at + SEP.length) };
}

function indexSport(cfg: SportConfig): void {
	const id = sportIdOf(cfg);
	for (const team of cfg.teams) teamIndex.set(qualify(id, team.id), { team, cfg });
}

/**
 * Registers one sport and makes it the default.
 *
 * This is the entry point the six standalone trackers call, and its behaviour is unchanged:
 * after it runs, sport() returns this config and a bare team id resolves against it.
 */
export function configureSport(next: SportConfig): void {
	const id = sportIdOf(next);
	registry.set(id, next);
	indexSport(next);
	defaultId = id;
}

/**
 * Registers several sports at once, for a plugin that serves all of them.
 *
 * The first entry becomes the default so that sport() still answers, which keeps every shared
 * action that reads a league-wide default working without a special case.
 */
export function registerSports(list: SportConfig[]): void {
	for (const cfg of list) {
		registry.set(sportIdOf(cfg), cfg);
		indexSport(cfg);
	}
	if (defaultId === null && list.length > 0) defaultId = sportIdOf(list[0]);
}

export function sport(): SportConfig {
	if (defaultId === null) throw new Error("configureSport() must run before any action paints");
	return registry.get(defaultId) as SportConfig;
}

export function sportById(id: SportId | undefined): SportConfig | undefined {
	return id === undefined ? undefined : registry.get(id);
}

export function allSports(): SportConfig[] {
	return [...registry.values()];
}

/** True once more than one sport is registered, i.e. this is the combined plugin. */
export function isMultiSport(): boolean {
	return registry.size > 1;
}

/** Test seam: drops every registered sport. */
export function resetSports(): void {
	registry.clear();
	teamIndex.clear();
	defaultId = null;
}

/** Resolves a team reference, qualified or bare, to its team and the sport that owns it. */
function lookup(ref: string): { team: SportTeam; cfg: SportConfig } | undefined {
	const { sportId, teamId } = unqualify(ref);
	if (sportId !== undefined) return teamIndex.get(qualify(sportId, teamId));
	return defaultId === null ? undefined : teamIndex.get(qualify(defaultId, teamId));
}

export function teamById(ref: string | undefined): SportTeam | undefined {
	return ref ? lookup(ref)?.team : undefined;
}

/** The sport a reference belongs to: its own in a qualified ref, otherwise the default. */
export function sportOf(ref: string | undefined): SportConfig | undefined {
	if (!ref) return undefined;
	return lookup(ref)?.cfg ?? sportById(unqualify(ref).sportId);
}

/**
 * The league a team's data comes from: its own competition, or the sport's base league.
 *
 * The config argument exists for the multi-sport process, where "the sport" is whichever one the
 * team belongs to rather than a process-wide default. Omitting it keeps the original behaviour.
 */
export function leagueFor(team: Pick<SportTeam, "leagueId"> | undefined, cfg: SportConfig = sport()): EspnLeague {
	const base = cfg.league;
	return team?.leagueId ? { sport: base.sport, league: team.leagueId } : base;
}

/** The league behind one team reference, resolving the sport from the reference itself. */
export function leagueForRef(ref: string): EspnLeague | undefined {
	const hit = lookup(ref);
	if (hit) return leagueFor(hit.team, hit.cfg);
	// An unrecognised id in a single-sport process still means "this plugin's league", which is
	// what the tracker relied on before the registry existed. In a multi-sport process there is
	// no such default to fall back to, so the reference is simply skipped.
	return isMultiSport() ? undefined : sport().league;
}

/** Every league the placed keys need data for, deduplicated. */
export function leaguesFor(refs: string[]): EspnLeague[] {
	const seen = new Map<string, EspnLeague>();
	for (const ref of refs) {
		const league = leagueForRef(ref);
		if (league) seen.set(`${league.sport}/${league.league}`, league);
	}
	return [...seen.values()];
}

/**
 * The registered sport that owns a league, including a soccer club's own competition.
 *
 * The third case matters for a scoreboard key: it can be pointed at any competition the sport
 * offers, including one no team in the bundled table happens to play in. When only a single
 * registered sport uses that ESPN sport segment the attribution is unambiguous, so use it. When
 * more than one does (basketball is NBA, WNBA and college) it is not, and the caller falls back.
 */
export function sportForLeague(league: EspnLeague): SportConfig | undefined {
	const all = [...registry.values()];
	const exact = all.find(
		(cfg) =>
			cfg.league.sport === league.sport &&
			(cfg.league.league === league.league || cfg.teams.some((t) => t.leagueId === league.league))
	);
	if (exact) return exact;
	const sameSport = all.filter((cfg) => cfg.league.sport === league.sport);
	return sameSport.length === 1 ? sameSport[0] : undefined;
}

/** A league that has a key pointing at it, and the sport whose rules govern it. */
export type LeagueTarget = { league: EspnLeague; cfg: SportConfig };

/**
 * Every league that needs polling, given what the placed keys asked for.
 *
 * Pure and registry-backed so the multi-sport fan-out can be tested without the Stream Deck SDK:
 * the tracker gathers `refs` and `boards` from its surfaces and hands them straight in.
 */
export function targetsFor(refs: string[], boards: EspnLeague[]): LeagueTarget[] {
	const seen = new Map<string, LeagueTarget>();
	const add = (league: EspnLeague, cfg: SportConfig | undefined): void => {
		seen.set(`${league.sport}/${league.league}`, { league, cfg: cfg ?? sport() });
	};

	for (const ref of refs) {
		const league = leagueForRef(ref);
		if (league) add(league, sportOf(ref) ?? sportForLeague(league));
	}
	for (const league of boards) add(league, sportForLeague(league));
	// An event sport has no teams and no board key, so nothing above can nominate it. Its own
	// league is always active, which is what the single-sport UFC and NASCAR trackers already did.
	for (const cfg of registry.values()) {
		if (cfg.model === "fights" || cfg.model === "race") add(cfg.league, cfg);
	}
	// A tracker with nothing placed still shows its own league, so a fresh install has data.
	if (seen.size === 0) add(sport().league, sport());
	return [...seen.values()];
}

/** The bare ESPN team ids a league is followed for, unwrapped from any sport prefix. */
export function trackedIn(refs: string[], leagueKeyWanted: string): string[] {
	const out: string[] = [];
	for (const ref of refs) {
		const league = leagueForRef(ref);
		if (league && `${league.sport}/${league.league}` === leagueKeyWanted) out.push(unqualify(ref).teamId);
	}
	return out;
}

/**
 * The team list the property inspector should offer.
 *
 * One sport means bare ids grouped by conference, exactly as the standalone trackers have always
 * saved them. More than one means qualified ids grouped by sport, because an id alone is ambiguous
 * the moment two leagues are registered.
 */
export function pickerOptions(): TeamOption[] {
	return isMultiSport() ? allTeamOptions() : teamOptions();
}

/** Picker options, grouped by conference and already in the order the list should read. */
export function teamOptions(): TeamOption[] {
	return sport().teams.map((t) => ({ id: t.id, abbr: t.abbr, name: t.name, group: t.conference }));
}

/**
 * Picker options across every registered sport, with qualified ids.
 *
 * Grouped by sport rather than by conference: in a list spanning eleven leagues, "which sport"
 * is the cut the user is actually scanning for, and the conference is noise at that level.
 */
export function allTeamOptions(): TeamOption[] {
	const out: TeamOption[] = [];
	for (const cfg of registry.values()) {
		const id = sportIdOf(cfg);
		const group = sportLabel(cfg);
		for (const t of cfg.teams) out.push({ id: qualify(id, t.id), abbr: t.abbr, name: t.name, group });
	}
	return out;
}
