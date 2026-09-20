import type { SKRSContext2D } from "@napi-rs/canvas";
import type { MatchDetail } from "../api/footballData.js";
import { drawTeamBadge } from "./scoreRenderer.js";

let canvasLib: typeof import("@napi-rs/canvas") | null = null;
async function getCanvas() {
  if (!canvasLib) {
    try { canvasLib = await import("@napi-rs/canvas"); } catch { return null; }
  }
  return canvasLib;
}

const SIZE = 144;
const C = {
  bg: "#0f0f0f", teal: "#00e5a0", orange: "#f5a623",
  red: "#e53935", white: "#ffffff", label: "#aaaaaa", dim: "#555555", gray: "#888888",
} as const;

function txt(
  ctx: SKRSContext2D, text: string, x: number, y: number,
  size: number, color: string, align: CanvasTextAlign = "center", bold = false
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

export type StatsDisplayState =
  | "STATS"
  | "NO_LIVE"
  | "NO_API_KEY"
  | "NO_TEAM"
  | "ERROR"
  | "BAD_KEY"
  | "NO_STATS";

export interface StatsRenderState {
  display: StatsDisplayState;
  homeTeam: string;
  awayTeam: string;
  homeCrestUrl?: string;
  awayCrestUrl?: string;
  isHome: boolean;
  minute: number | null;
  homeScore: number;
  awayScore: number;
  stats: { label: string; home: number | null; away: number | null }[];
}

export async function renderStatsButton(state: StatsRenderState): Promise<string | null> {
  const lib = await getCanvas();
  if (!lib) return null;
  const canvas = lib.createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  switch (state.display) {
    case "STATS":      drawStats(ctx, state); break;
    case "NO_STATS":   drawNoStats(ctx, state); break;
    case "NO_LIVE":    twoLine(ctx, "NO LIVE", "MATCH", C.gray, C.dim); break;
    case "NO_API_KEY": twoLine(ctx, "NO", "API KEY", C.white, C.teal); break;
    case "NO_TEAM":    twoLine(ctx, "PICK", "A TEAM", C.white, C.teal); break;
    case "BAD_KEY":    twoLine(ctx, "BAD", "API KEY", C.red, C.white); break;
    default:           twoLine(ctx, "ERROR", "see logs", C.red, C.gray); break;
  }

  const buf = canvas.toBuffer("image/png");
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function twoLine(ctx: SKRSContext2D, top: string, bot: string, c1: string, c2: string) {
  txt(ctx, top, SIZE / 2, 52, 38, c1, "center", true);
  txt(ctx, bot, SIZE / 2, 96, 22, c2, "center", true);
}

function drawNoStats(ctx: SKRSContext2D, state: StatsRenderState) {
  drawTeamBadge(ctx, 26, 16, 26, 18, state.homeTeam, state.homeCrestUrl);
  drawTeamBadge(ctx, SIZE - 26, 16, 26, 18, state.awayTeam, state.awayCrestUrl);
  txt(ctx, `${state.homeScore}`, 36, 62, 36, C.teal, "center", true);
  txt(ctx, `${state.awayScore}`, SIZE - 36, 62, 36, state.isHome ? C.white : C.teal, "center", true);
  txt(ctx, state.minute !== null ? `${state.minute}'` : "LIVE", SIZE / 2, 62, 13, C.orange, "center", true);
  txt(ctx, "No stats yet", SIZE / 2, 104, 12, C.label, "center");
  txt(ctx, "(free API tier)", SIZE / 2, 120, 11, C.gray, "center");
}

// Only the 3 stats fans actually check mid-match. Each row is one clean
// "home – away" number pair — a thin bar communicated nothing readable at
// button size, so the numbers themselves are now the primary visual.
function drawStats(ctx: SKRSContext2D, state: StatsRenderState) {
  // Header: flags identify the teams, score + minute sit between them
  drawTeamBadge(ctx, 24, 14, 24, 17, state.homeTeam, state.homeCrestUrl);
  drawTeamBadge(ctx, SIZE - 24, 14, 24, 17, state.awayTeam, state.awayCrestUrl);
  txt(ctx, `${state.homeScore}-${state.awayScore}`, SIZE / 2, 11, 13, C.orange, "center", true);
  if (state.minute !== null) {
    txt(ctx, `${state.minute}'`, SIZE / 2, 24, 10, C.gray, "center");
  }

  ctx.fillStyle = "#242424";
  ctx.fillRect(10, 32, SIZE - 20, 1);

  const rows = state.stats.slice(0, 3);
  const rowH = 33;
  const startY = 46;
  const homeColor = state.isHome ? C.teal : C.white;
  const awayColor = !state.isHome ? C.teal : C.white;

  rows.forEach((row, i) => {
    const y = startY + i * rowH;
    const home = row.home ?? 0;
    const away = row.away ?? 0;

    // Big numbers, well separated — this IS the information.
    txt(ctx, String(home), SIZE / 2 - 20, y, 24, homeColor, "right", true);
    txt(ctx, "–", SIZE / 2, y, 16, C.gray, "center");
    txt(ctx, String(away), SIZE / 2 + 20, y, 24, awayColor, "left", true);

    // Label below, bright enough to actually read
    txt(ctx, row.label, SIZE / 2, y + 15, 10, C.label, "center", true);
  });
}

export function extractStats(detail: MatchDetail): { label: string; home: number | null; away: number | null }[] {
  if (!detail.statistics?.length) return [];

  // Priority order: possession is the #1 stat fans check, then shot quality, then corners.
  const want = [
    { type: "POSSESSION", label: "POSSESSION %" },
    { type: "SHOTS_ON_GOAL", label: "SHOTS ON TARGET" },
    { type: "CORNER_KICKS", label: "CORNERS" },
    { type: "SHOTS", label: "TOTAL SHOTS" },
    { type: "FOULS", label: "FOULS" },
  ];

  const result: { label: string; home: number | null; away: number | null }[] = [];
  for (const w of want) {
    const stat = detail.statistics.find(s => s.type === w.type);
    if (stat) result.push({ label: w.label, home: stat.home, away: stat.away });
    if (result.length === 3) break;
  }
  return result;
}
