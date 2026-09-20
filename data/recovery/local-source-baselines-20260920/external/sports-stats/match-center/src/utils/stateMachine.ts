import type { Match, MatchStatus } from "../api/footballData.js";

export type DisplayState =
  | "NO_MATCH"
  | "PRE_MATCH"
  | "KICKOFF_IMMINENT"
  | "LIVE"
  | "HALF_TIME"
  | "EXTRA_TIME"
  | "PENALTIES"
  | "FULL_TIME"
  | "POSTPONED"
  | "ERROR"
  | "BAD_KEY"
  | "PLAN_RESTRICTED"
  | "NO_TEAM"
  | "NO_API_KEY"
  | "FLAG_ONLY";

export interface MatchState {
  display: DisplayState;
  match: Match | null;
  nextMatch: Match | null;
  minutesUntilKickoff: number | null;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  injuryTime: number | null;
  lastGoalScorer: string | null;
  lastGoalTeamId: number | null;
  goalFlashActive: boolean;
  isHomeTeam: boolean;
}

export function deriveMatchState(
  matches: Match[],
  teamId: number,
  options: { skipPastResult?: boolean } = {}
): MatchState {
  const now = new Date();

  // Find live match first
  const liveMatch = matches.find(
    (m) => m.status === "IN_PLAY" || m.status === "PAUSED"
  );

  if (liveMatch) {
    const isHome = liveMatch.homeTeam.id === teamId;
    const score = liveMatch.score.fullTime;
    const goals = liveMatch.goals ?? [];
    const lastGoal = goals[goals.length - 1] ?? null;

    return {
      display: liveMatch.status === "PAUSED" ? "HALF_TIME" : "LIVE",
      match: liveMatch,
      nextMatch: null,
      minutesUntilKickoff: null,
      homeScore: score.home ?? 0,
      awayScore: score.away ?? 0,
      minute: liveMatch.minute,
      injuryTime: liveMatch.injuryTime,
      lastGoalScorer: lastGoal?.scorer?.name ?? null,
      lastGoalTeamId: lastGoal?.team.id ?? null,
      goalFlashActive: false,
      isHomeTeam: isHome,
    };
  }

  // Find scheduled match happening very soon or today
  const upcoming = matches
    .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
    .sort(
      (a, b) =>
        new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );

  const nextMatch = upcoming[0] ?? null;

  if (nextMatch) {
    const kickoff = new Date(nextMatch.utcDate);
    const msUntil = kickoff.getTime() - now.getTime();
    const minutesUntil = Math.round(msUntil / 60_000);

    const display: DisplayState =
      minutesUntil <= 5 && minutesUntil >= -5
        ? "KICKOFF_IMMINENT"
        : "PRE_MATCH";

    return {
      display,
      match: null,
      nextMatch,
      minutesUntilKickoff: minutesUntil,
      homeScore: 0,
      awayScore: 0,
      minute: null,
      injuryTime: null,
      lastGoalScorer: null,
      lastGoalTeamId: null,
      goalFlashActive: false,
      isHomeTeam: nextMatch.homeTeam.id === teamId,
    };
  }

  // No live or upcoming match: fall back to the most recent finished result
  // (regardless of how long ago), since fans want to see the last score
  // rather than a blank "no match" card. Skipped in "always show next match"
  // mode, which prefers NO_MATCH over a past result.
  if (!options.skipPastResult) {
    const recentFinished = matches
      .filter((m) => m.status === "FINISHED")
      .sort(
        (a, b) =>
          new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime()
      )[0];

    if (recentFinished) {
      const score = recentFinished.score.fullTime;
      return {
        display: "FULL_TIME",
        match: recentFinished,
        nextMatch: null,
        minutesUntilKickoff: null,
        homeScore: score.home ?? 0,
        awayScore: score.away ?? 0,
        minute: 90,
        injuryTime: null,
        lastGoalScorer: null,
        lastGoalTeamId: null,
        goalFlashActive: false,
        isHomeTeam: recentFinished.homeTeam.id === teamId,
      };
    }
  }

  // Check postponed
  const postponed = matches.find((m) => m.status === "POSTPONED");
  if (postponed) {
    return {
      display: "POSTPONED",
      match: postponed,
      nextMatch: null,
      minutesUntilKickoff: null,
      homeScore: 0,
      awayScore: 0,
      minute: null,
      injuryTime: null,
      lastGoalScorer: null,
      lastGoalTeamId: null,
      goalFlashActive: false,
      isHomeTeam: postponed.homeTeam.id === teamId,
    };
  }

  return {
    display: "NO_MATCH",
    match: null,
    nextMatch: null,
    minutesUntilKickoff: null,
    homeScore: 0,
    awayScore: 0,
    minute: null,
    injuryTime: null,
    lastGoalScorer: null,
    lastGoalTeamId: null,
    goalFlashActive: false,
    isHomeTeam: false,
  };
}

export function getPollIntervalMs(state: MatchState): number {
  switch (state.display) {
    case "LIVE":
      // Poll faster near end of match or penalties
      if (state.minute !== null && state.minute >= 80) return 15_000;
      return 30_000;
    case "HALF_TIME":
      return 30_000;
    case "EXTRA_TIME":
      return 15_000;
    case "PENALTIES":
      return 10_000;
    case "KICKOFF_IMMINENT":
      return 15_000;
    case "PRE_MATCH":
      if (state.minutesUntilKickoff !== null && state.minutesUntilKickoff < 60)
        return 60_000;
      return 5 * 60_000;
    case "FULL_TIME":
      return 2 * 60_000;
    default:
      return 10 * 60_000;
  }
}
