import type { SKRSContext2D } from "@napi-rs/canvas";
import type { TeamStanding } from "../api/footballData.js";
import { drawTeamBadge, teamCrestUrl } from "./scoreRenderer.js";

let canvasLib: typeof import("@napi-rs/canvas") | null = null;
async function getCanvas() {
  if (!canvasLib) {
    try { canvasLib = await import("@napi-rs/canvas"); } catch { return null; }
  }
  return canvasLib;
}

const SIZE = 144;

const C = {
  bg:     "#0f0f0f",
  teal:   "#00e5a0",
  orange: "#f5a623",
  red:    "#e53935",
  white:  "#ffffff",
  dim:    "#555555",
  gray:   "#888888",
} as const;

function txt(
  ctx: SKRSContext2D, text: string, x: number, y: number,
  size: number, color: string, align: CanvasTextAlign = "center", bold = false
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}TH`;
  switch (n % 10) {
    case 1: return `${n}ST`;
    case 2: return `${n}ND`;
    case 3: return `${n}RD`;
    default: return `${n}TH`;
  }
}

function positionColor(pos: number, total: number): string {
  if (pos <= 4) return C.teal;
  if (total >= 18 && pos >= total - 2) return C.red;
  if (total >= 12 && pos >= total - 1) return C.red;
  if (pos <= 6) return C.orange;
  return C.white;
}

function drawFormDots(ctx: SKRSContext2D, form: string | null) {
  if (!form) return;
  const results = form.split(",").filter(Boolean).slice(-5);
  const n = results.length;
  if (n === 0) return;
  const r = 6; const gap = 16;
  const total = n * (r * 2) + (n - 1) * (gap - r * 2);
  const startX = SIZE / 2 - total / 2 + r;
  const y = 132;
  results.forEach((res, i) => {
    const cx = startX + i * gap;
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.fillStyle = res === "W" ? C.teal : res === "D" ? C.orange : C.red;
    ctx.fill();
  });
}

export type TableDisplayState =
  | "TABLE"
  | "NO_API_KEY"
  | "NO_TEAM"
  | "NO_COMPETITION"
  | "NOT_IN_TABLE"
  | "ERROR"
  | "BAD_KEY"
  | "PLAN_RESTRICTED";

export interface TableRenderState {
  display: TableDisplayState;
  standing: TeamStanding | null;
  competitionCode: string;
  teamTla?: string;
  teamName?: string;
}

export async function renderTableButton(state: TableRenderState): Promise<string | null> {
  const lib = await getCanvas();
  if (!lib) return null;
  const canvas = lib.createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  switch (state.display) {
    case "TABLE":
      drawTable(ctx, state);
      break;
    case "NO_API_KEY":
      twoLine(ctx, "NO", "API KEY", C.white, C.teal);
      break;
    case "NO_TEAM":
      twoLine(ctx, "PICK", "A TEAM", C.white, C.teal);
      break;
    case "NO_COMPETITION":
      twoLine(ctx, "PICK", "LEAGUE", C.white, C.teal);
      break;
    case "NOT_IN_TABLE":
      txt(ctx, state.competitionCode, SIZE / 2, 38, 20, C.gray, "center", true);
      twoLineAt(ctx, "NOT IN", "TABLE", C.gray, C.dim, 78, 104);
      break;
    case "BAD_KEY":
      twoLine(ctx, "BAD", "API KEY", C.red, C.white);
      break;
    case "PLAN_RESTRICTED":
      twoLine(ctx, "NOT", "FREE TIER", C.orange, C.white);
      break;
    default:
      twoLine(ctx, "ERROR", "see logs", C.red, C.gray);
  }

  const buf = canvas.toBuffer("image/png");
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function twoLine(ctx: SKRSContext2D, top: string, bot: string, c1: string, c2: string) {
  txt(ctx, top, SIZE / 2, 52, 38, c1, "center", true);
  txt(ctx, bot, SIZE / 2, 96, 22, c2, "center", true);
}

function twoLineAt(ctx: SKRSContext2D, top: string, bot: string, c1: string, c2: string, y1: number, y2: number) {
  txt(ctx, top, SIZE / 2, y1, 22, c1, "center", true);
  txt(ctx, bot, SIZE / 2, y2, 18, c2, "center", true);
}

function drawTable(ctx: SKRSContext2D, state: TableRenderState) {
  const s = state.standing!;
  const pColor = positionColor(s.position, s.totalTeams);

  // Competition label top
  const compLabel = s.competitionName.length > 16 ? state.competitionCode : s.competitionName;
  txt(ctx, compLabel.toUpperCase(), SIZE / 2, 10, 9, C.dim, "center", true);

  // Team flag/crest
  drawTeamBadge(ctx, SIZE / 2, 34, 34, 26, s.team.tla, teamCrestUrl(s.team));

  // Position hero — big ordinal (e.g. "3RD")
  txt(ctx, ordinal(s.position), SIZE / 2, 76, 42, pColor, "center", true);

  // Points, clearly labeled
  txt(ctx, `${s.points} PTS`, SIZE / 2, 108, 18, C.white, "center", true);

  // Form dots
  drawFormDots(ctx, s.form);
}
