import type { Match, Team } from "../api/footballData.js";
import type { MatchState } from "./stateMachine.js";

// Synthetic states used by Preview Mode so the visual design can be verified
// on demand instead of waiting for a real goal/half-time/etc to happen.

const competition = { id: 2000, name: "FIFA World Cup", code: "WC", emblem: "" };

const GER: Team = { id: 759, name: "Germany", shortName: "Germany", tla: "GER", crest: "" };
const POR: Team = { id: 765, name: "Portugal", shortName: "Portugal", tla: "POR", crest: "" };

function baseMatch(overrides: Partial<Match>): Match {
  return {
    id: 999001,
    utcDate: new Date().toISOString(),
    status: "IN_PLAY",
    matchday: 3,
    stage: "GROUP_STAGE",
    minute: 12,
    injuryTime: null,
    competition,
    homeTeam: GER,
    awayTeam: POR,
    score: {
      winner: null,
      duration: "REGULAR",
      fullTime: { home: 0, away: 0 },
      halfTime: { home: 0, away: 0 },
      regularTime: null,
      extraTime: null,
      penalties: null,
    },
    goals: [],
    ...overrides,
  };
}

function baseState(display: MatchState["display"], overrides: Partial<MatchState>): MatchState {
  return {
    display,
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
    isHomeTeam: true,
    ...overrides,
  };
}

export const DEMO_STATES: MatchState[] = [
  // 1. Live, early, scoreless
  (() => {
    const m = baseMatch({ minute: 12 });
    return baseState("LIVE", { match: m, minute: 12, homeScore: 0, awayScore: 0 });
  })(),

  // 2. Goal flash
  (() => {
    const m = baseMatch({
      minute: 23,
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: 1, away: 0 },
        halfTime: { home: 0, away: 0 },
        regularTime: null,
        extraTime: null,
        penalties: null,
      },
      goals: [{ minute: 23, injuryTime: null, scorer: { name: "Jamal Musiala" }, team: { id: GER.id, name: GER.name } }],
    });
    return baseState("LIVE", {
      match: m,
      minute: 23,
      homeScore: 1,
      awayScore: 0,
      goalFlashActive: true,
      lastGoalScorer: "Jamal Musiala",
      lastGoalTeamId: GER.id,
    });
  })(),

  // 3. Half time
  (() => {
    const m = baseMatch({
      status: "PAUSED",
      minute: 45,
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: 1, away: 0 },
        halfTime: { home: 1, away: 0 },
        regularTime: null,
        extraTime: null,
        penalties: null,
      },
    });
    return baseState("HALF_TIME", { match: m, minute: 45, homeScore: 1, awayScore: 0 });
  })(),

  // 4. Second half, equalized
  (() => {
    const m = baseMatch({
      minute: 67,
      score: {
        winner: null,
        duration: "REGULAR",
        fullTime: { home: 1, away: 1 },
        halfTime: { home: 1, away: 0 },
        regularTime: null,
        extraTime: null,
        penalties: null,
      },
    });
    return baseState("LIVE", { match: m, minute: 67, homeScore: 1, awayScore: 1 });
  })(),

  // 5. Extra time
  (() => {
    const m = baseMatch({
      stage: "LAST_16",
      minute: 105,
      injuryTime: 2,
      score: {
        winner: null,
        duration: "EXTRA_TIME",
        fullTime: { home: 1, away: 1 },
        halfTime: { home: 1, away: 0 },
        regularTime: { home: 1, away: 1 },
        extraTime: null,
        penalties: null,
      },
    });
    return baseState("EXTRA_TIME", { match: m, minute: 105, injuryTime: 2, homeScore: 1, awayScore: 1 });
  })(),

  // 6. Penalties
  (() => {
    const m = baseMatch({
      stage: "LAST_16",
      score: {
        winner: null,
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 1, away: 1 },
        halfTime: { home: 1, away: 0 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 1, away: 1 },
        penalties: { home: 4, away: 3 },
      },
    });
    return baseState("PENALTIES", { match: m, homeScore: 1, awayScore: 1 });
  })(),

  // 7. Full time win
  (() => {
    const m = baseMatch({
      status: "FINISHED",
      stage: "SEMI_FINALS",
      score: {
        winner: "HOME_TEAM",
        duration: "REGULAR",
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 0 },
        regularTime: null,
        extraTime: null,
        penalties: null,
      },
    });
    return baseState("FULL_TIME", { match: m, homeScore: 2, awayScore: 1 });
  })(),

  // 8. Pre-match, kickoff soon
  (() => {
    const kickoff = new Date(Date.now() + 35 * 60_000);
    const m = baseMatch({ status: "TIMED", utcDate: kickoff.toISOString(), stage: "FINAL", minute: null });
    return baseState("PRE_MATCH", { nextMatch: m, minutesUntilKickoff: 35 });
  })(),

  // 9. Pre-match, days away
  (() => {
    const kickoff = new Date(Date.now() + 3 * 24 * 60 * 60_000);
    const m = baseMatch({ status: "SCHEDULED", utcDate: kickoff.toISOString(), stage: "GROUP_STAGE", minute: null });
    return baseState("PRE_MATCH", { nextMatch: m, minutesUntilKickoff: 3 * 24 * 60 });
  })(),

  // 10. Kickoff imminent
  (() => {
    const kickoff = new Date(Date.now() + 3 * 60_000);
    const m = baseMatch({ status: "TIMED", utcDate: kickoff.toISOString(), stage: "FINAL", minute: null });
    return baseState("KICKOFF_IMMINENT", { nextMatch: m, minutesUntilKickoff: 3 });
  })(),

  // 11. No match scheduled
  baseState("NO_MATCH", {}),
];
