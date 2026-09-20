import type { SKRSContext2D } from "@napi-rs/canvas";
import type { LineupPlayer } from "../api/footballData.js";

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

export type LineupDisplayState =
  | "LINEUP_CONFIRMED"
  | "LINEUP_PENDING"
  | "NO_MATCH"
  | "NO_API_KEY"
  | "NO_TEAM"
  | "ERROR"
  | "BAD_KEY";

export interface LineupRenderState {
  display: LineupDisplayState;
  ownTeamTla: string | null;
  formation: string | null;
  matchStatus: string | null;
  opponent: string | null;
  isHome: boolean;
  minute: number | null;
  players: LineupPlayer[];
}

export async function renderLineupButton(state: LineupRenderState): Promise<string | null> {
  const lib = await getCanvas();
  if (!lib) return null;
  const canvas = lib.createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  switch (state.display) {
    case "LINEUP_CONFIRMED": drawConfirmed(ctx, state); break;
    case "LINEUP_PENDING":   drawPending(ctx, state);   break;
    case "NO_MATCH":   twoLine(ctx, "NO", "MATCH", C.gray, C.dim); break;
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

function drawConfirmed(ctx: SKRSContext2D, state: LineupRenderState) {
  // Own team, so it's clear whose formation this is
  txt(ctx, state.ownTeamTla ?? "", SIZE / 2, 11, 12, C.white, "center", true);

  // Label the number so it reads as a formation, not a mystery code
  txt(ctx, "FORMATION", SIZE / 2, 24, 8, C.dim, "center", true);
  const formation = state.formation ?? "?";
  txt(ctx, formation, SIZE / 2, 58, 36, C.teal, "center", true);

  // "CONFIRMED" badge
  ctx.fillStyle = "#1a2e22";
  ctx.beginPath();
  ctx.roundRect(SIZE / 2 - 38, 78, 76, 17, 4);
  ctx.fill();
  txt(ctx, "CONFIRMED", SIZE / 2, 86, 10, C.teal, "center", true);

  // Opponent line
  const vs = state.isHome ? `vs ${state.opponent ?? "?"}` : `@ ${state.opponent ?? "?"}`;
  const opp = vs.length > 16 ? vs.slice(0, 15) + "…" : vs;
  txt(ctx, opp, SIZE / 2, 112, 13, C.gray, "center", true);

  // Minute if live
  if (state.minute !== null) {
    txt(ctx, `${state.minute}'`, SIZE - 6, 11, 10, C.orange, "right");
  }
}

function drawPending(ctx: SKRSContext2D, state: LineupRenderState) {
  txt(ctx, state.ownTeamTla ?? "", SIZE / 2, 11, 12, C.gray, "center", true);

  // Big TBC
  txt(ctx, "TBC", SIZE / 2, 54, 44, C.white, "center", true);

  // Opponent
  const vs = state.isHome ? `vs ${state.opponent ?? "?"}` : `@ ${state.opponent ?? "?"}`;
  const opp = vs.length > 16 ? vs.slice(0, 15) + "…" : vs;
  txt(ctx, opp, SIZE / 2, 92, 11, C.gray, "center");

  // Status
  const statusText = state.matchStatus === "SCHEDULED" || state.matchStatus === "TIMED"
    ? "Lineup ~1h before KO"
    : (state.matchStatus ?? "");
  txt(ctx, statusText, SIZE / 2, 114, 9, C.dim, "center");
}
