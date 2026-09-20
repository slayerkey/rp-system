import type { SKRSContext2D } from "@napi-rs/canvas";
import type { ScorerEntry } from "../api/footballData.js";

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
  red: "#e53935", white: "#ffffff", dim: "#555555", gray: "#888888",
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

export type ScorersDisplayState =
  | "SCORERS"
  | "NO_API_KEY"
  | "NO_COMPETITION"
  | "ERROR"
  | "BAD_KEY"
  | "PLAN_RESTRICTED"
  | "EMPTY";

export interface ScorersRenderState {
  display: ScorersDisplayState;
  competitionCode: string;
  competitionName: string;
  scorers: ScorerEntry[]; // already the 3-item slice for the current page
  startRank: number;      // true leaderboard rank of scorers[0], e.g. 4 on page 2
  page: number;           // 0-indexed
  totalPages: number;
}

export async function renderScorersButton(state: ScorersRenderState): Promise<string | null> {
  const lib = await getCanvas();
  if (!lib) return null;
  const canvas = lib.createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  switch (state.display) {
    case "SCORERS":          drawScorers(ctx, state); break;
    case "NO_API_KEY":       twoLine(ctx, "NO", "API KEY", C.white, C.teal); break;
    case "NO_COMPETITION":   twoLine(ctx, "PICK", "LEAGUE", C.white, C.teal); break;
    case "BAD_KEY":          twoLine(ctx, "BAD", "API KEY", C.red, C.white); break;
    case "PLAN_RESTRICTED":  twoLine(ctx, "NOT", "FREE TIER", C.orange, C.white); break;
    case "EMPTY":            twoLine(ctx, "NO", "DATA YET", C.gray, C.dim); break;
    default:                 twoLine(ctx, "ERROR", "see logs", C.red, C.gray); break;
  }

  const buf = canvas.toBuffer("image/png");
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function twoLine(ctx: SKRSContext2D, top: string, bot: string, c1: string, c2: string) {
  txt(ctx, top, SIZE / 2, 52, 38, c1, "center", true);
  txt(ctx, bot, SIZE / 2, 96, 22, c2, "center", true);
}

// Names are the whole point of this button — everything else (team code,
// header label, page dots) is squeezed down to give the name the most
// space and the biggest font the face can hold.
function drawScorers(ctx: SKRSContext2D, state: ScorersRenderState) {
  const label = state.competitionName.length > 16 ? state.competitionCode : state.competitionName;
  txt(ctx, label.toUpperCase(), SIZE / 2, 8, 8, C.dim, "center");

  ctx.fillStyle = "#222";
  ctx.fillRect(8, 15, SIZE - 16, 1);

  const rowH = 34;
  const startY = 30;
  const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];

  state.scorers.forEach((s, i) => {
    const y = startY + i * rowH;
    const trueRank = state.startRank + i;
    const rankColor = trueRank <= 3 ? medals[trueRank - 1] : C.dim;

    txt(ctx, String(trueRank), 15, y, 14, rankColor, "center", true);

    const parts = s.player.name.split(" ");
    const lastName = parts.length > 1 ? parts[parts.length - 1] : s.player.name;
    const name = lastName.length > 11 ? lastName.slice(0, 10) + "…" : lastName;
    txt(ctx, name, 27, y, 17, C.white, "left", true);

    txt(ctx, String(s.goals), 137, y, 13, trueRank === 1 ? C.teal : C.gray, "right", true);
  });

  if (state.totalPages > 1) {
    const n = state.totalPages;
    const r = 2; const gap = 9;
    const total = n * (r * 2) + (n - 1) * (gap - r * 2);
    const startX = SIZE / 2 - total / 2 + r;
    const y = startY + 3 * rowH + 6;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * gap, y, r, 0, Math.PI * 2);
      ctx.fillStyle = i === state.page ? C.teal : "#3a3a3a";
      ctx.fill();
    }
  }
}
