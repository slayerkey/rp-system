import type { StatsRenderState } from "../rendering/statsRenderer.js";

// Synthetic states used by Preview Mode so the stats layout can be checked
// on demand instead of waiting for a real live match to happen. Crest URLs
// point at real football-data.org team IDs (not fake ones) so Preview Mode
// exercises the exact same network fetch + cache path as a real match,
// instead of just showing the drawn-flag fallback.
const crest = (id: number) => `https://crests.football-data.org/${id}.svg`;

export const STATS_DEMO_STATES: StatsRenderState[] = [
  // 1. Comfortably ahead, mid-second-half — Arsenal (57) vs Chelsea (61)
  {
    display: "STATS", homeTeam: "ARS", awayTeam: "CHE",
    homeCrestUrl: crest(57), awayCrestUrl: crest(61),
    isHome: true, minute: 55,
    homeScore: 1, awayScore: 0,
    stats: [
      { label: "POSSESSION %", home: 62, away: 38 },
      { label: "SHOTS ON TARGET", home: 6, away: 2 },
      { label: "CORNERS", home: 7, away: 3 },
    ],
  },
  // 2. Tight, late game — Liverpool (64) vs Man City (65)
  {
    display: "STATS", homeTeam: "LIV", awayTeam: "MCI",
    homeCrestUrl: crest(64), awayCrestUrl: crest(65),
    isHome: false, minute: 78,
    homeScore: 2, awayScore: 2,
    stats: [
      { label: "POSSESSION %", home: 48, away: 52 },
      { label: "SHOTS ON TARGET", home: 4, away: 5 },
      { label: "CORNERS", home: 3, away: 6 },
    ],
  },
  // 3. Live but free tier hasn't returned stats yet — Spurs (73) vs Newcastle (67)
  {
    display: "NO_STATS", homeTeam: "TOT", awayTeam: "NEW",
    homeCrestUrl: crest(73), awayCrestUrl: crest(67),
    isHome: true, minute: 10,
    homeScore: 0, awayScore: 0, stats: [],
  },
  // 4. No live match right now
  { display: "NO_LIVE", homeTeam: "", awayTeam: "", isHome: false, minute: null, homeScore: 0, awayScore: 0, stats: [] },
  // 5. Bad API key
  { display: "BAD_KEY", homeTeam: "", awayTeam: "", isHome: false, minute: null, homeScore: 0, awayScore: 0, stats: [] },
];
