import { request } from "node:https";
import { URL } from "node:url";

export interface Team {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export interface Goal {
  minute: number | null;
  injuryTime: number | null;
  scorer: { name: string } | null;
  team: { id: number; name: string };
}

export interface Match {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string;
  minute: number | null;
  injuryTime: number | null;
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  homeTeam: Team;
  awayTeam: Team;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: Score;
    halfTime: Score;
    regularTime: Score | null;
    extraTime: Score | null;
    penalties: Score | null;
  };
  goals: Goal[];
}

export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELLED";

export interface TeamSearchResult {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  area: { name: string; flag?: string };
  runningCompetitions: Array<{ id: number; name: string; code: string }>;
}

export interface LineupPlayer {
  id: number;
  name: string;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Attacker";
  shirtNumber: number;
}

export interface TeamLineup {
  formation: string | null;
  lineup: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchDetail {
  id: number;
  status: MatchStatus;
  minute: number | null;
  homeTeam: Team & { lineup: LineupPlayer[]; bench: LineupPlayer[]; formation: string | null };
  awayTeam: Team & { lineup: LineupPlayer[]; bench: LineupPlayer[]; formation: string | null };
  score: {
    fullTime: Score;
    halfTime: Score;
  };
  statistics: Array<{
    home: number | null;
    away: number | null;
    type: string; // "CORNER_KICKS", "SHOTS", "SHOTS_ON_GOAL", "POSSESSION", "FOULS", "YELLOW_CARDS", "RED_CARDS"
  }> | null;
}

export interface ScorerEntry {
  player: { id: number; name: string };
  team: { id: number; name: string; tla: string };
  goals: number;
  assists: number | null;
  penalties: number | null;
}

export interface StandingEntry {
  position: number;
  team: { id: number; name: string; tla: string; crest: string };
  playedGames: number;
  form: string | null; // "W,W,D,L,W" oldest→newest, may be null
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface TeamStanding extends StandingEntry {
  group: string | null;   // null for league, "GROUP_A" etc for cups
  totalTeams: number;     // total entries in this standings group
  competitionName: string;
}

const BASE_URL = "api.football-data.org";

function httpsGet(path: string, apiKey: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: BASE_URL,
        path,
        method: "GET",
        headers: {
          "X-Auth-Token": apiKey,
          "User-Agent": "MatchCenter-StreamDeck/1.0",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          if (status === 429) return reject(new Error("RATE_LIMIT"));
          if (status === 403) {
            let apiMsg = "";
            try { apiMsg = (JSON.parse(body) as { message?: string }).message ?? ""; } catch {}
            // Distinguish "bad key" from "resource restricted to higher plan"
            const isRestricted = apiMsg.toLowerCase().includes("restricted") ||
              apiMsg.toLowerCase().includes("permissions") ||
              apiMsg.toLowerCase().includes("subscription");
            return reject(new Error(isRestricted ? "PLAN_RESTRICTED" : "INVALID_API_KEY"));
          }
          if (status === 404) return reject(new Error("NOT_FOUND"));
          if (status < 200 || status >= 300) return reject(new Error(`HTTP_${status}`));
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("PARSE_ERROR"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10_000, () => { req.destroy(); reject(new Error("TIMEOUT")); });
    req.end();
  });
}

export class FootballDataClient {
  private apiKey: string;
  private cache = new Map<string, { data: unknown; expires: number }>();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async get<T>(path: string, cacheTtlMs = 30_000): Promise<T> {
    const cached = this.cache.get(path);
    if (cached && Date.now() < cached.expires) {
      return cached.data as T;
    }
    const data = await httpsGet(path, this.apiKey);
    this.cache.set(path, { data, expires: Date.now() + cacheTtlMs });
    return data as T;
  }

  async getTeamMatches(teamId: number): Promise<Match[]> {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 5);
    const to = new Date(today);
    to.setDate(to.getDate() + 21);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const data = await this.get<{ matches: Match[] }>(
      `/v4/teams/${teamId}/matches?dateFrom=${fmt(from)}&dateTo=${fmt(to)}`,
      30_000
    );
    return data.matches ?? [];
  }

  async getTeam(teamId: number): Promise<TeamSearchResult> {
    return this.get<TeamSearchResult>(`/v4/teams/${teamId}`, 60_000 * 60);
  }

  async getStandings(competitionCode: string, teamId: number): Promise<TeamStanding | null> {
    const data = await this.get<{
      competition: { name: string };
      standings: Array<{
        stage: string;
        type: string;
        group: string | null;
        table: StandingEntry[];
      }>;
    }>(`/v4/competitions/${competitionCode}/standings`, 5 * 60_000);

    const competitionName = data.competition?.name ?? competitionCode;
    // Prefer TOTAL type; fall back to whatever exists
    const groups = data.standings.filter(s => s.type === "TOTAL");
    const all = groups.length > 0 ? groups : data.standings;

    for (const group of all) {
      const entry = group.table.find(e => e.team.id === teamId);
      if (entry) {
        return { ...entry, group: group.group, totalTeams: group.table.length, competitionName };
      }
    }
    return null;
  }

  async getMatchDetail(matchId: number): Promise<MatchDetail> {
    return this.get<MatchDetail>(`/v4/matches/${matchId}`, 60_000);
  }

  async getTopScorers(competitionCode: string): Promise<ScorerEntry[]> {
    const data = await this.get<{ scorers: ScorerEntry[] }>(
      `/v4/competitions/${competitionCode}/scorers?limit=10`,
      5 * 60_000
    );
    return data.scorers ?? [];
  }

  clearCache(): void {
    this.cache.clear();
  }
}
