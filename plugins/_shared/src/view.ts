/**
 * Deciding what a key should say, given cached data. Pure functions, no SDK, no network, so
 * every tracker can share them and every one of them can be tested directly.
 */
import { type Game, rankWithin, type StandingsRow } from "./espn";

/** How long after tip-off a game still counts as "current" if ESPN never marked it live. */
const GRACE_MS = 4 * 60 * 60_000;

/** Earliest game this team has not finished yet, out of a wider date range. */
export function nextGameFor(games: Game[], teamId: string, nowMs: number): Game | undefined {
	return games
		.filter((g) => (g.home.teamId === teamId || g.away.teamId === teamId) && g.state !== "post")
		.filter((g) => g.state === "in" || Date.parse(g.startIso) >= nowMs - GRACE_MS)
		.sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso))[0];
}

/**
 * Reading order for the league scoreboard key: games in progress first, then what has not
 * started, then finals, each group by start time. Someone cycling the key wants the live one
 * first, not whatever ESPN happens to list first.
 */
export function sortForBoard(games: Game[]): Game[] {
	const rank: Record<Game["state"], number> = { in: 0, pre: 1, post: 2 };
	return [...games].sort((a, b) => rank[a.state] - rank[b.state] || Date.parse(a.startIso) - Date.parse(b.startIso));
}

/** True when a team has a game worth showing inside this set, so the poller knows to refresh. */
export function hasCurrentGame(games: Game[], teamId: string, nowMs: number): boolean {
	return nextGameFor(games, teamId, nowMs) !== undefined;
}

/** Splits a start time into the two short lines a key has room for, in the viewer's local time. */
export function startLines(startIso: string, now = new Date()): { day: string; time: string } {
	const start = new Date(Date.parse(startIso));
	if (Number.isNaN(start.getTime())) return { day: "TBD", time: "" };
	const day =
		start.toDateString() === now.toDateString()
			? "TODAY"
			: start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
	return { day, time: start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
}

/**
 * Countdown for a start time inside the next couple of days, or null when it is far enough out
 * that a date reads better than "61H". Fans watching for tip-off want the countdown; fans checking
 * next week's schedule want the day.
 *
 * No "IN" prefix: on a key that already shows the kick-off time underneath, the extra word read
 * as part of the time at a glance rather than as a preposition. A bare duration is unambiguous.
 */
export function countdown(startIso: string, nowMs: number): string | null {
	const startMs = Date.parse(startIso);
	if (!Number.isFinite(startMs)) return null;
	const ms = startMs - nowMs;
	if (ms <= 0 || ms > 48 * 60 * 60_000) return null;
	const mins = Math.round(ms / 60_000);
	if (mins < 60) return `${mins}M`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}H ${mins % 60}M`;
	return `${Math.floor(hours / 24)}D ${hours % 24}H`;
}

/** Compact age of cached data for the stale marker: "40s", "12m", "3h", "2d". */
export function ageLabel(fetchedAt: number, nowMs: number): string {
	if (!fetchedAt) return "";
	const secs = Math.max(0, Math.round((nowMs - fetchedAt) / 1000));
	if (secs < 90) return `${secs}s`;
	const mins = Math.round(secs / 60);
	if (mins < 90) return `${mins}m`;
	const hours = Math.round(mins / 60);
	return hours < 36 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

export type StandingsView = "conference" | "division";

/**
 * Conference view uses ESPN's own seed and games behind, which already carry the league's
 * tiebreakers. Division view is not published anywhere, so it is worked out from the rows.
 */
export function placeIn(
	rows: StandingsRow[],
	row: StandingsRow,
	view: StandingsView
): { label: string; rank: number; gamesBehind: string } {
	if (view === "conference") {
		return { label: row.confAbbr, rank: row.seed, gamesBehind: row.gamesBehind };
	}
	const division = rows.filter((r) => r.division === row.division && r.conference === row.conference);
	const { rank, gamesBehind } = rankWithin(division, row.teamId);
	return { label: row.division, rank, gamesBehind };
}
