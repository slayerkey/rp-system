/**
 * ESPN data client, shared by every Packrat sport tracker.
 *
 * ESPN's site API is undocumented and carries no ToS or SLA, so everything here is written
 * defensively: a fetch that fails, times out, or comes back in an unexpected shape returns
 * null instead of throwing, and the caller keeps showing its last known good data. Nothing
 * in this file is sport specific; a league is just the two path segments ESPN uses, so NFL
 * is { sport: "football", league: "nfl" } and nothing else changes.
 */

export type EspnLeague = { sport: string; league: string };

/** The tri-state ESPN reports for every event, and the only game state anything here cares about. */
export type GameState = "pre" | "in" | "post";

export type TeamRef = {
	id: string;
	abbr: string;
	name: string;
	/** Primary team colour as a hex string with the leading hash, e.g. "#c8102e". */
	color: string;
	altColor: string;
};

export type GameSide = {
	teamId: string;
	abbr: string;
	score: number;
	homeAway: "home" | "away";
};

export type Game = {
	id: string;
	state: GameState;
	/** ISO start time, straight from ESPN. */
	startIso: string;
	/** ESPN's own short status line: "10/5 - 7:00 PM EDT", "Q3 - 5:32", "Final". */
	statusShort: string;
	/** Public ESPN page for the game, for the "open on press" setting. Empty when absent. */
	link: string;
	home: GameSide;
	away: GameSide;
};

export type StandingsRow = {
	teamId: string;
	abbr: string;
	/** "Eastern Conference" */
	conference: string;
	/** "East" */
	confAbbr: string;
	/** "Atlantic" */
	division: string;
	/** Conference playoff seed, 0 when ESPN has not published one yet. */
	seed: number;
	wins: number;
	losses: number;
	/** Games behind, as ESPN displays it: "-" for the leader. */
	gamesBehind: string;
	streak: string;
	/** Table points, for the leagues that rank on points rather than win percentage. */
	points: number;
};

const SITE = "https://site.api.espn.com/apis/site/v2/sports";
/** Standings live under a different API root than everything else. Not a typo. */
const CORE = "https://site.api.espn.com/apis/v2/sports";

const TIMEOUT_MS = 8_000;

/**
 * Two things this client deliberately does NOT do, both checked against the live endpoints on
 * 2026-08-18 rather than assumed:
 *
 * 1. It sends no User-Agent. Identifying the caller is the polite instinct and it is wrong here:
 *    ESPN's edge answers 403 to any request carrying a custom User-Agent, while the same request
 *    without one returns 200.
 * 2. It makes no conditional requests. Scoreboard, teams and standings all come back with no
 *    ETag and no Last-Modified, so there is no validator to echo and If-None-Match has nothing
 *    to act on. What they do carry is Cache-Control: max-age (26s on a scoreboard, 109s on
 *    teams), which the poll cadence already sits above.
 *
 * The request rate is therefore held down by the caller instead: one call per league per tier,
 * each league on its own clock, plus the backoff below.
 */

/**
 * Rate-limit backoff, shared by every league in the process.
 *
 * A 429 is a statement about the client, not about one URL, so backing off per URL would keep
 * hammering with the other nine. Every fetch returns null while the window is open, and callers
 * already treat null as "keep showing last known good".
 */
const BACKOFF_BASE_MS = 60_000;
const BACKOFF_MAX_MS = 15 * 60_000;
let backoffUntil = 0;
let backoffStep = 0;

function enterBackoff(retryAfter: string | null): void {
	backoffStep = Math.min(backoffStep + 1, 5);
	const doubling = Math.min(BACKOFF_BASE_MS * 2 ** (backoffStep - 1), BACKOFF_MAX_MS);
	// Retry-After is authoritative when ESPN sends one, but never shorter than our own floor.
	const seconds = Number(retryAfter);
	const asked = Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : 0;
	backoffUntil = Date.now() + Math.max(doubling, Math.min(asked, BACKOFF_MAX_MS));
}

/** True while the client is refusing to call out because ESPN asked it to stop. */
export function isBackingOff(nowMs: number = Date.now()): boolean {
	return nowMs < backoffUntil;
}

/** Test seam: clears any open backoff window. */
export function resetHttpState(): void {
	backoffUntil = 0;
	backoffStep = 0;
}

export function scoreboardUrl(lg: EspnLeague, dates?: string): string {
	const base = `${SITE}/${lg.sport}/${lg.league}/scoreboard`;
	return dates ? `${base}?dates=${dates}` : base;
}

/**
 * The team list. The limit is load bearing: ESPN pages this endpoint at 50 by default, which is
 * fine for a 32 team league and silently truncates the college ones. Division I basketball alone
 * returns 365 teams, so the ceiling is set well clear of it rather than just above football.
 * This endpoint is only called by the probe and the table generator, never in the poll loop.
 */
export function teamsUrl(lg: EspnLeague): string {
	return `${SITE}/${lg.sport}/${lg.league}/teams?limit=500`;
}

/** level=3 nests divisions under conferences and still carries the conference playoff seed. */
export function standingsUrl(lg: EspnLeague): string {
	return `${CORE}/${lg.sport}/${lg.league}/standings?level=3`;
}

async function fetchJson(url: string): Promise<unknown | null> {
	if (isBackingOff()) return null;
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { accept: "application/json" }
		});

		// 429 is the documented rate limit; 503 is what a hidden API returns when it is shedding
		// load, and treating it the same is the difference between backing off and making it worse.
		if (res.status === 429 || res.status === 503) {
			enterBackoff(res.headers.get("retry-after"));
			return null;
		}

		if (!res.ok) return null;
		backoffStep = 0;
		return await res.json();
	} catch {
		return null;
	}
}

// --- parsers ---------------------------------------------------------------
// Split out from the fetches so they can be tested against recorded fixtures
// without touching the network.

function asArray(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function hex(raw: unknown, fallback: string): string {
	const s = typeof raw === "string" ? raw.trim().replace(/^#/, "") : "";
	return /^[0-9a-fA-F]{6}$/.test(s) ? `#${s.toLowerCase()}` : fallback;
}

function num(raw: unknown): number {
	const n = Number(raw);
	return Number.isFinite(n) ? n : 0;
}

function side(raw: unknown): GameSide | null {
	const c = raw as { homeAway?: string; score?: unknown; team?: { id?: string; abbreviation?: string } };
	const id = c?.team?.id;
	const abbr = c?.team?.abbreviation;
	if (!id || !abbr) return null;
	return {
		teamId: String(id),
		abbr: String(abbr),
		score: num(c.score),
		homeAway: c.homeAway === "away" ? "away" : "home"
	};
}

function gameState(raw: unknown): GameState {
	return raw === "in" || raw === "post" ? raw : "pre";
}

/** The public game page ESPN links from its own scoreboard, preferring the summary view. */
function summaryLink(links: unknown): string {
	const all = asArray(links) as { rel?: unknown[]; href?: string }[];
	const summary = all.find((l) => asArray(l?.rel).includes("summary"));
	const href = (summary ?? all[0])?.href;
	return typeof href === "string" && href.startsWith("http") ? href : "";
}

/** Flattens ESPN's scoreboard payload. Events it cannot read are skipped, never fatal. */
export function parseScoreboard(json: unknown): Game[] {
	const games: Game[] = [];
	for (const raw of asArray((json as { events?: unknown })?.events)) {
		const ev = raw as {
			id?: string;
			date?: string;
			status?: { type?: { state?: string; shortDetail?: string } };
			competitions?: unknown[];
			links?: unknown[];
		};
		const comp = asArray(ev.competitions)[0] as { competitors?: unknown[] } | undefined;
		const sides = asArray(comp?.competitors).map(side).filter((s): s is GameSide => s !== null);
		const home = sides.find((s) => s.homeAway === "home");
		const away = sides.find((s) => s.homeAway === "away");
		if (!ev.id || !home || !away) continue;
		games.push({
			id: String(ev.id),
			state: gameState(ev.status?.type?.state),
			startIso: String(ev.date ?? ""),
			statusShort: String(ev.status?.type?.shortDetail ?? ""),
			link: summaryLink(ev.links),
			home,
			away
		});
	}
	return games;
}

export function parseTeams(json: unknown): TeamRef[] {
	const league = asArray((json as { sports?: unknown[] })?.sports)[0] as { leagues?: unknown[] } | undefined;
	const entries = asArray((asArray(league?.leagues)[0] as { teams?: unknown[] } | undefined)?.teams);
	const teams: TeamRef[] = [];
	for (const raw of entries) {
		const t = (raw as { team?: Record<string, unknown> })?.team;
		if (!t?.id || !t?.abbreviation) continue;
		teams.push({
			id: String(t.id),
			abbr: String(t.abbreviation),
			name: String(t.displayName ?? t.shortDisplayName ?? t.abbreviation),
			color: hex(t.color, "#1b1f27"),
			altColor: hex(t.alternateColor, "#f5faf8")
		});
	}
	return teams;
}

function stat(entry: unknown, name: string): { display: string; value: number } {
	const stats = asArray((entry as { stats?: unknown[] })?.stats);
	const hit = stats.find((s) => (s as { name?: string })?.name === name) as
		| { displayValue?: unknown; value?: unknown }
		| undefined;
	return { display: hit?.displayValue === undefined ? "" : String(hit.displayValue), value: num(hit?.value) };
}

/**
 * Walks the conference -> division -> entries tree of a level=3 standings payload.
 *
 * A soccer competition has no such tree: its one node carries the whole table and no children,
 * and it ranks on points rather than a playoff seed. Both shapes come out as the same rows.
 */
export function parseStandings(json: unknown): StandingsRow[] {
	const rows: StandingsRow[] = [];
	for (const rawConf of asArray((json as { children?: unknown[] })?.children)) {
		const conf = rawConf as {
			name?: string;
			abbreviation?: string;
			children?: unknown[];
			standings?: { entries?: unknown[] };
		};
		const divisions = asArray(conf.children);
		const groups = divisions.length > 0 ? divisions : [conf];
		for (const rawDiv of groups) {
			const div = rawDiv as { name?: string; standings?: { entries?: unknown[] } };
			for (const entry of asArray(div.standings?.entries)) {
				const team = (entry as { team?: { id?: string; abbreviation?: string } })?.team;
				if (!team?.id || !team?.abbreviation) continue;
				const seed = stat(entry, "playoffSeed");
				rows.push({
					teamId: String(team.id),
					abbr: String(team.abbreviation),
					conference: String(conf.name ?? ""),
					confAbbr: String(conf.abbreviation ?? conf.name ?? ""),
					division: String(div.name ?? conf.name ?? ""),
					// Leagues without a playoff seed publish a plain table rank instead.
					seed: seed.value || stat(entry, "rank").value,
					wins: stat(entry, "wins").value,
					losses: stat(entry, "losses").value,
					gamesBehind: stat(entry, "gamesBehind").display,
					streak: stat(entry, "streak").display,
					points: stat(entry, "points").value
				});
			}
		}
	}
	return rows;
}

// --- client ----------------------------------------------------------------

/** Raw scoreboard payload, for the event sports whose parsers live in event.ts. */
export async function fetchScoreboardJson(lg: EspnLeague, dates?: string): Promise<unknown | null> {
	return fetchJson(scoreboardUrl(lg, dates));
}

/** Raw standings payload, used by parseRankings for the championship tables. */
export async function fetchStandingsJson(lg: EspnLeague): Promise<unknown | null> {
	return fetchJson(`${CORE}/${lg.sport}/${lg.league}/standings`);
}

export type EspnClient = {
	scoreboard(dates?: string): Promise<Game[] | null>;
	teams(): Promise<TeamRef[] | null>;
	standings(): Promise<StandingsRow[] | null>;
};

/** Every call resolves to null on any failure; nothing here throws. */
export function createEspnClient(lg: EspnLeague): EspnClient {
	return {
		async scoreboard(dates?: string) {
			const json = await fetchJson(scoreboardUrl(lg, dates));
			return json === null ? null : parseScoreboard(json);
		},
		async teams() {
			const json = await fetchJson(teamsUrl(lg));
			return json === null ? null : parseTeams(json);
		},
		async standings() {
			const json = await fetchJson(standingsUrl(lg));
			return json === null ? null : parseStandings(json);
		}
	};
}

/** Finds the game a team is playing in the given day's scoreboard. */
export function gameForTeam(games: Game[], teamId: string): Game | undefined {
	return games.find((g) => g.home.teamId === teamId || g.away.teamId === teamId);
}

/**
 * Rank and games behind inside an arbitrary slice of the standings, which is how a division
 * table gets built: ESPN publishes a conference playoff seed but no division rank, and its
 * gamesBehind stat is conference wide. Ordering is win percentage, the ordering every league
 * uses for a division table.
 */
export function rankWithin(rows: StandingsRow[], teamId: string): { rank: number; gamesBehind: string } {
	const pct = (r: StandingsRow): number => (r.wins + r.losses === 0 ? 0 : r.wins / (r.wins + r.losses));
	const sorted = [...rows].sort((a, b) => pct(b) - pct(a) || b.wins - a.wins);
	const index = sorted.findIndex((r) => r.teamId === teamId);
	if (index < 0) return { rank: 0, gamesBehind: "" };
	const leader = sorted[0];
	const row = sorted[index];
	const behind = (leader.wins - row.wins + (row.losses - leader.losses)) / 2;
	return { rank: index + 1, gamesBehind: behind <= 0 ? "-" : behind.toFixed(1) };
}

/** Splits a game into the tracked team's side and its opponent's side. */
export function sidesFor(game: Game, teamId: string): { own: GameSide; opp: GameSide } | null {
	if (game.home.teamId === teamId) return { own: game.home, opp: game.away };
	if (game.away.teamId === teamId) return { own: game.away, opp: game.home };
	return null;
}
