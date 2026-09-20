import type { LineupRenderState } from "../rendering/lineupRenderer.js";

// Synthetic states used by Preview Mode so the visual design can be checked
// on demand instead of waiting for a real confirmed lineup to happen.

function demoPlayers(): LineupRenderState["players"] {
  return [
    { id: 1, name: "David Raya", position: "Goalkeeper", shirtNumber: 1 },
    { id: 2, name: "William Saliba", position: "Defender", shirtNumber: 2 },
    { id: 3, name: "Declan Rice", position: "Midfielder", shirtNumber: 4 },
    { id: 4, name: "Bukayo Saka", position: "Attacker", shirtNumber: 7 },
  ];
}

export const LINEUP_DEMO_STATES: LineupRenderState[] = [
  // 1. Confirmed, pre-match
  { display: "LINEUP_CONFIRMED", ownTeamTla: "ARS", formation: "4-3-3", matchStatus: "TIMED", opponent: "Chelsea", isHome: true, minute: null, players: demoPlayers() },
  // 2. Confirmed, live
  { display: "LINEUP_CONFIRMED", ownTeamTla: "ARS", formation: "4-2-3-1", matchStatus: "IN_PLAY", opponent: "Liverpool", isHome: false, minute: 34, players: demoPlayers() },
  // 3. Pending — announced kickoff, lineup not out yet
  { display: "LINEUP_PENDING", ownTeamTla: "ARS", formation: null, matchStatus: "TIMED", opponent: "Man City", isHome: true, minute: null, players: [] },
  // 4. No match scheduled
  { display: "NO_MATCH", ownTeamTla: "ARS", formation: null, matchStatus: null, opponent: null, isHome: false, minute: null, players: [] },
  // 5. Bad API key
  { display: "BAD_KEY", ownTeamTla: "ARS", formation: null, matchStatus: null, opponent: null, isHome: false, minute: null, players: [] },
];
