import type { Canvas, Image, SKRSContext2D } from "@napi-rs/canvas";
import type { MatchState } from "../utils/stateMachine.js";

let canvasLib: typeof import("@napi-rs/canvas") | null = null;

async function getCanvas() {
  if (!canvasLib) {
    try {
      canvasLib = await import("@napi-rs/canvas");
    } catch {
      return null;
    }
  }
  return canvasLib;
}

// Real team crests/flags from football-data.org's CDN. Not every team has
// one (smaller federations like Canada/USA/Curaçao 404), so callers always
// fall back to the hand-drawn FLAG_SPECS colors below when this isn't cached.
// Loading is fire-and-forget: a draw call never blocks on the network, it
// just upgrades to the real image once the background fetch completes.
const crestCache = new Map<string, Image | null>();
const crestLoading = new Set<string>();

export function crestUrlForId(id: number | undefined): string | undefined {
  return id ? `https://crests.football-data.org/${id}.svg` : undefined;
}

export function teamCrestUrl(t: { id: number; crest?: string }): string | undefined {
  return t.crest || crestUrlForId(t.id);
}

function ensureCrestLoading(url: string | undefined): void {
  if (!url || crestCache.has(url) || crestLoading.has(url)) return;
  crestLoading.add(url);
  void (async () => {
    try {
      const lib = await getCanvas();
      if (!lib) {
        crestCache.set(url, null);
        return;
      }
      const img = await lib.loadImage(url, { maxRedirects: 3 });
      crestCache.set(url, img);
    } catch {
      crestCache.set(url, null);
    } finally {
      crestLoading.delete(url);
    }
  })();
}

function peekCrest(url: string | undefined): Image | null | undefined {
  if (!url) return undefined;
  return crestCache.get(url);
}

const SIZE = 144;

const C = {
  bg: "#0f0f0f",
  live: "#00e5a0",
  halfTime: "#f5a623",
  fullTime: "#888888",
  imminent: "#f5a623",
  score: "#ffffff",
  dim: "#555555",
  red: "#e53935",
  goalFlash1: "#ffffff",
  goalFlash2: "#00e5a0",
} as const;

// Flags drawn from shapes (not emoji glyphs) — emoji flag glyphs don't render
// reliably through @napi-rs/canvas's font stack on every system, so we draw
// each national flag's colors/pattern directly, which always works.
type FlagSpec =
  | { kind: "h"; colors: string[] }
  | { kind: "v"; colors: string[] }
  | { kind: "cross"; bg: string; cross: string }
  | { kind: "circle"; bg: string; circle: string }
  | { kind: "solid"; color: string };

const FLAG_SPECS: Record<string, FlagSpec> = {
  URU: { kind: "h", colors: ["#0038A8", "#FFFFFF"] },
  GER: { kind: "h", colors: ["#000000", "#DD0000", "#FFCE00"] },
  ESP: { kind: "h", colors: ["#AA151B", "#F1BF00", "#AA151B"] },
  PAR: { kind: "h", colors: ["#D52B1E", "#FFFFFF", "#0038A8"] },
  ARG: { kind: "h", colors: ["#74ACDF", "#FFFFFF", "#74ACDF"] },
  GHA: { kind: "h", colors: ["#CE1126", "#FCD116", "#006B3F"] },
  BRA: { kind: "h", colors: ["#009739", "#FEDD00", "#009739"] },
  POR: { kind: "v", colors: ["#046A38", "#DA291C"] },
  JPN: { kind: "circle", bg: "#FFFFFF", circle: "#BC002D" },
  MEX: { kind: "v", colors: ["#006847", "#FFFFFF", "#CE1126"] },
  ENG: { kind: "cross", bg: "#FFFFFF", cross: "#CE1124" },
  USA: { kind: "h", colors: ["#B22234", "#FFFFFF", "#3C3B6E"] },
  KOR: { kind: "circle", bg: "#FFFFFF", circle: "#CD2E3A" },
  FRA: { kind: "v", colors: ["#0055A4", "#FFFFFF", "#EF4135"] },
  RSA: { kind: "h", colors: ["#007A4D", "#FFB81C", "#000000"] },
  ALG: { kind: "v", colors: ["#006233", "#FFFFFF"] },
  AUS: { kind: "solid", color: "#00247D" },
  NZL: { kind: "solid", color: "#0033A0" },
  SUI: { kind: "cross", bg: "#FF0000", cross: "#FFFFFF" },
  UKR: { kind: "h", colors: ["#0057B7", "#FFD700"] },
  ECU: { kind: "h", colors: ["#FFD100", "#034EA2", "#EF3340"] },
  SWE: { kind: "cross", bg: "#006AA7", cross: "#FECC02" },
  POL: { kind: "h", colors: ["#FFFFFF", "#DC143C"] },
  CZE: { kind: "h", colors: ["#FFFFFF", "#D7141A"] },
  CRO: { kind: "h", colors: ["#FF0000", "#FFFFFF", "#0093DD"] },
  KSA: { kind: "solid", color: "#006C35" },
  TUN: { kind: "solid", color: "#E70013" },
  TUR: { kind: "solid", color: "#E30A17" },
  SEN: { kind: "v", colors: ["#00853F", "#FDEF42", "#E31B23"] },
  BEL: { kind: "v", colors: ["#000000", "#FAE042", "#ED2939"] },
  ROU: { kind: "v", colors: ["#002B7F", "#FCD116", "#CE1126"] },
  MAR: { kind: "solid", color: "#C1272D" },
  AUT: { kind: "h", colors: ["#ED2939", "#FFFFFF", "#ED2939"] },
  COL: { kind: "h", colors: ["#FCD116", "#003893", "#CE1126"] },
  EGY: { kind: "h", colors: ["#CE1126", "#FFFFFF", "#000000"] },
  HUN: { kind: "h", colors: ["#CD2A3E", "#FFFFFF", "#436F4D"] },
  CAN: { kind: "v", colors: ["#FF0000", "#FFFFFF", "#FF0000"] },
  HAI: { kind: "h", colors: ["#00209F", "#D21034"] },
  IRN: { kind: "h", colors: ["#239F40", "#FFFFFF", "#DA0000"] },
  SVK: { kind: "h", colors: ["#FFFFFF", "#0B4EA2", "#EE1C25"] },
  SVN: { kind: "h", colors: ["#FFFFFF", "#005CE6", "#ED1C24"] },
  SRB: { kind: "h", colors: ["#C6363C", "#0C4076", "#FFFFFF"] },
  DEN: { kind: "cross", bg: "#C8102E", cross: "#FFFFFF" },
  ITA: { kind: "v", colors: ["#009246", "#FFFFFF", "#CE2B37"] },
  BIH: { kind: "solid", color: "#002395" },
  ALB: { kind: "solid", color: "#E41E20" },
  PAN: { kind: "h", colors: ["#DA121A", "#FFFFFF", "#072357"] },
  CPV: { kind: "h", colors: ["#003893", "#FFFFFF", "#CF2027"] },
  COD: { kind: "h", colors: ["#007FFF", "#F7D618", "#CE1021"] },
  CIV: { kind: "v", colors: ["#FF8200", "#FFFFFF", "#009E60"] },
  GEO: { kind: "cross", bg: "#FFFFFF", cross: "#FF0000" },
  QAT: { kind: "solid", color: "#8D1B3D" },
  JOR: { kind: "h", colors: ["#000000", "#FFFFFF", "#007A3D"] },
  IRQ: { kind: "h", colors: ["#CE1126", "#FFFFFF", "#000000"] },
  UZB: { kind: "h", colors: ["#0099B5", "#FFFFFF", "#1EB53A"] },
  NED: { kind: "h", colors: ["#AE1C28", "#FFFFFF", "#21468B"] },
  NOR: { kind: "cross", bg: "#BA0C2F", cross: "#FFFFFF" },
  SCO: { kind: "cross", bg: "#0065BD", cross: "#FFFFFF" },
  CUW: { kind: "h", colors: ["#002B7F", "#FFD100"] },
  WAL: { kind: "h", colors: ["#FFFFFF", "#00B140"] },
};

export async function renderButton(
  state: MatchState,
  teamId: number,
  flashPhase: number,
  teamLabel?: { name?: string; tla?: string }
): Promise<string | null> {
  const lib = await getCanvas();
  if (!lib) return null;

  const canvas = lib.createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  // Background
  let bgColor: string = C.bg;
  if (state.goalFlashActive) {
    bgColor = flashPhase % 2 === 0 ? C.goalFlash1 : C.goalFlash2;
  } else if (state.display === "KICKOFF_IMMINENT" && flashPhase % 2 === 1) {
    bgColor = "#111f0a";
  }
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, SIZE, SIZE);

  switch (state.display) {
    case "NO_API_KEY":
      drawNoApiKey(ctx);
      break;

    case "BAD_KEY":
      drawBadKey(ctx);
      break;

    case "PLAN_RESTRICTED":
      drawPlanRestricted(ctx);
      break;

    case "NO_TEAM":
      drawNoTeam(ctx);
      break;

    case "NO_MATCH":
      drawNoMatch(ctx, teamLabel, crestUrlForId(teamId));
      break;

    case "PRE_MATCH":
    case "KICKOFF_IMMINENT":
      drawPreMatch(ctx, state);
      break;

    case "LIVE":
    case "HALF_TIME":
    case "EXTRA_TIME":
    case "PENALTIES":
      drawLiveMatch(ctx, state, teamId, flashPhase);
      break;

    case "FULL_TIME":
      drawFullTime(ctx, state, teamId);
      break;

    case "POSTPONED":
      drawPostponed(ctx, state);
      break;

    case "FLAG_ONLY":
      drawFlagOnly(ctx, teamLabel, crestUrlForId(teamId));
      break;

    case "ERROR":
      drawCenteredLines(ctx, ["ERROR", "see logs"], C.red, "#888", 28, 18);
      break;
  }

  return toBase64(canvas);
}

function toBase64(canvas: Canvas): string {
  const buf = canvas.toBuffer("image/png");
  return `data:image/png;base64,${buf.toString("base64")}`;
}

function txt(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "center",
  bold = false
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function roundRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draws a small flag icon centered at (cx, cy) with given width/height.
function drawFlagIcon(ctx: SKRSContext2D, cx: number, cy: number, w: number, h: number, tla: string) {
  const spec = FLAG_SPECS[tla];
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = 3;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  if (!spec) {
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, w, h);
  } else if (spec.kind === "h") {
    const n = spec.colors.length;
    const sh = h / n;
    spec.colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y + i * sh, w, sh + 1);
    });
  } else if (spec.kind === "v") {
    const n = spec.colors.length;
    const sw = w / n;
    spec.colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(x + i * sw, y, sw + 1, h);
    });
  } else if (spec.kind === "cross") {
    ctx.fillStyle = spec.bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = spec.cross;
    const barH = h * 0.26;
    const barW = w * 0.2;
    ctx.fillRect(x, y + h / 2 - barH / 2, w, barH);
    ctx.fillRect(x + w * 0.32 - barW / 2, y, barW, h);
  } else if (spec.kind === "circle") {
    ctx.fillStyle = spec.bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = spec.circle;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = spec.color;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
  ctx.restore();
}

// Draws the team's real crest/flag if it's loaded (cached), kicking off a
// background fetch if not, and falling back to the drawn FLAG_SPECS icon
// (or a plain badge for unknown clubs) until/unless the real image arrives.
export function drawTeamBadge(ctx: SKRSContext2D, cx: number, cy: number, w: number, h: number, tla: string, crestUrl: string | undefined) {
  ensureCrestLoading(crestUrl);
  const img = peekCrest(crestUrl);
  if (img) {
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    return;
  }
  drawFlagIcon(ctx, cx, cy, w, h, tla);
}

function trunc(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

function competitionLabel(m: { competition: { name?: string; code?: string } }): string {
  return m.competition?.name || m.competition?.code || "";
}

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: "Group Stage",
  LEAGUE_STAGE: "League Stage",
  LAST_16: "Round of 16",
  ROUND_16: "Round of 16",
  ROUND_OF_16: "Round of 16",
  ROUND_OF_32: "Round of 32",
  QUARTER_FINALS: "Quarter Final",
  SEMI_FINALS: "Semi Final",
  FINAL: "Final",
  THIRD_PLACE: "3rd Place",
  PRELIMINARY_ROUND: "Qualifying",
  PLAYOFFS: "Play-offs",
};

function stageLabel(m: { stage?: string; competition: { name?: string; code?: string } }): string {
  const raw = m.stage;
  if (!raw || raw === "REGULAR_SEASON") return competitionLabel(m);
  return STAGE_LABELS[raw] ?? raw.replace(/_/g, " ");
}

function drawCenteredLines(
  ctx: SKRSContext2D,
  lines: string[],
  color1: string,
  color2: string,
  size1: number,
  size2: number
) {
  const mid = SIZE / 2;
  const total = lines.length;
  if (total === 1) {
    txt(ctx, lines[0], mid, mid, size1, color1, "center", true);
  } else {
    const gap = 10;
    const startY = mid - (size1 + size2 + gap) / 2;
    txt(ctx, lines[0], mid, startY + size1 / 2, size1, color1, "center", true);
    txt(ctx, lines[1], mid, startY + size1 + gap + size2 / 2, size2, color2, "center");
  }
}

function drawNoApiKey(ctx: SKRSContext2D) {
  txt(ctx, "NO", SIZE / 2, 42, 44, "#ffffff", "center", true);
  txt(ctx, "API KEY", SIZE / 2, 86, 26, C.live, "center", true);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(24, 104, 96, 1);
  txt(ctx, "Open Settings", SIZE / 2, 120, 16, "#888888", "center", true);
  txt(ctx, "to enter key", SIZE / 2, 136, 13, "#555555", "center", true);
}

function drawBadKey(ctx: SKRSContext2D) {
  txt(ctx, "BAD", SIZE / 2, 38, 44, C.red, "center", true);
  txt(ctx, "API KEY", SIZE / 2, 82, 26, "#ffffff", "center", true);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(24, 100, 96, 1);
  txt(ctx, "Verify email or", SIZE / 2, 116, 15, "#999999", "center", true);
  txt(ctx, "re-enter key", SIZE / 2, 133, 15, "#999999", "center", true);
}

function drawPlanRestricted(ctx: SKRSContext2D) {
  txt(ctx, "TEAM", SIZE / 2, 32, 36, C.halfTime, "center", true);
  txt(ctx, "NOT IN", SIZE / 2, 68, 26, "#ffffff", "center", true);
  txt(ctx, "FREE TIER", SIZE / 2, 98, 20, C.halfTime, "center", true);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(20, 114, 104, 1);
  txt(ctx, "Pick PL/CL/WC/EC", SIZE / 2, 126, 13, "#888888", "center", true);
  txt(ctx, "team in Settings", SIZE / 2, 139, 13, "#888888", "center", true);
}

function drawNoTeam(ctx: SKRSContext2D) {
  txt(ctx, "PICK", SIZE / 2, 42, 40, "#ffffff", "center", true);
  txt(ctx, "A TEAM", SIZE / 2, 84, 26, C.live, "center", true);
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(24, 102, 96, 1);
  txt(ctx, "Open Settings", SIZE / 2, 118, 15, "#888888", "center", true);
  txt(ctx, "to choose team", SIZE / 2, 134, 13, "#555555", "center", true);
}

function drawNoMatch(ctx: SKRSContext2D, teamLabel?: { name?: string; tla?: string }, crestUrl?: string) {
  const label = teamLabel?.name || teamLabel?.tla || "";
  if (label) {
    drawTeamBadge(ctx, SIZE / 2, 30, 30, 30, teamLabel?.tla ?? "", crestUrl);
    txt(ctx, trunc(label.toUpperCase(), 16), SIZE / 2, 56, 16, "#999999", "center", true);
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(24, 70, 96, 1);
    txt(ctx, "NO MATCH", SIZE / 2, 92, 22, "#666666", "center", true);
    txt(ctx, "scheduled", SIZE / 2, 116, 14, "#444444", "center", true);
  } else {
    txt(ctx, "NO", SIZE / 2, 50, 40, "#666666", "center", true);
    txt(ctx, "MATCH", SIZE / 2, 92, 26, "#555555", "center", true);
  }
}

// ── LIVE / HT / ET / PENS ────────────────────────────────────────────────────
// Top: stage/competition context. Middle: flags + teams. Score is the hero.
// Bottom-middle: the running clock, replacing the old top-left blinking dot.
function drawLiveMatch(
  ctx: SKRSContext2D,
  state: MatchState,
  teamId: number,
  flashPhase: number
) {
  if (!state.match) return;

  const m = state.match;
  const isHome = m.homeTeam.id === teamId;

  let statusColor: string = C.live;
  let statusText: string;

  if (state.display === "HALF_TIME") {
    statusColor = C.halfTime;
    statusText = "HALF TIME";
  } else if (state.display === "EXTRA_TIME") {
    statusText = `ET ${state.minute ?? ""}'`;
  } else if (state.display === "PENALTIES") {
    statusText = "PENALTIES";
    statusColor = "#ff6b6b";
  } else {
    const inj = state.injuryTime ? `+${state.injuryTime}` : "";
    statusText = state.minute != null ? `${state.minute}'${inj}` : "LIVE";
  }

  // Goal flash overlay takes over the whole face briefly
  if (state.goalFlashActive && state.lastGoalScorer) {
    const isYours = state.lastGoalTeamId === teamId;
    const bgIsLight = flashPhase % 2 === 0;
    const textColor = bgIsLight ? "#000000" : "#ffffff";
    txt(ctx, "GOOOAL!", SIZE / 2, 46, 25, bgIsLight ? C.goalFlash2 : "#ffffff", "center", true);
    txt(ctx, trunc(state.lastGoalScorer, 14), SIZE / 2, 80, 16, textColor, "center", true);
    txt(ctx, isYours ? "Your team" : "Opponent", SIZE / 2, 104, 16, isYours ? C.live : C.red, "center", true);
    txt(ctx, `${state.homeScore} - ${state.awayScore}`, SIZE / 2, 128, 22, textColor, "center", true);
    return;
  }

  txt(ctx, trunc(stageLabel(m), 22), SIZE / 2, 11, 11, C.dim, "center", true);

  const homeColor = isHome ? C.live : C.fullTime;
  const awayColor = !isHome ? C.live : C.fullTime;

  drawTeamBadge(ctx, 28, 42, 34, 28, m.homeTeam.tla, teamCrestUrl(m.homeTeam));
  drawTeamBadge(ctx, SIZE - 28, 42, 34, 28, m.awayTeam.tla, teamCrestUrl(m.awayTeam));
  txt(ctx, trunc(m.homeTeam.tla, 3), 28, 66, 12, homeColor, "center", true);
  txt(ctx, trunc(m.awayTeam.tla, 3), SIZE - 28, 66, 12, awayColor, "center", true);

  // SCORE — the hero element
  txt(ctx, `${state.homeScore}`, SIZE / 2 - 14, 100, 46, C.score, "right", true);
  txt(ctx, "-", SIZE / 2, 100, 24, C.dim, "center");
  txt(ctx, `${state.awayScore}`, SIZE / 2 + 14, 100, 46, C.score, "left", true);

  // TIME — bottom middle, prominent
  txt(ctx, statusText, SIZE / 2, 134, 16, statusColor, "center", true);
}

function drawPreMatch(ctx: SKRSContext2D, state: MatchState) {
  const m = state.nextMatch;
  if (!m) return;

  const kickoff = new Date(m.utcDate);
  const mins = state.minutesUntilKickoff ?? 0;
  const daysAway = Math.floor(mins / (60 * 24));
  const isImminent = state.display === "KICKOFF_IMMINENT";

  txt(ctx, trunc(stageLabel(m), 22), SIZE / 2, 12, 11, C.dim, "center", true);

  drawTeamBadge(ctx, 28, 44, 32, 26, m.homeTeam.tla, teamCrestUrl(m.homeTeam));
  drawTeamBadge(ctx, SIZE - 28, 44, 32, 26, m.awayTeam.tla, teamCrestUrl(m.awayTeam));
  txt(ctx, trunc(m.homeTeam.tla, 3), 28, 64, 12, C.fullTime, "center", true);
  txt(ctx, "vs", SIZE / 2, 44, 13, C.dim, "center");
  txt(ctx, trunc(m.awayTeam.tla, 3), SIZE - 28, 64, 12, C.fullTime, "center", true);

  const yBase = 90;

  if (isImminent) {
    txt(ctx, "KICK OFF", SIZE / 2, yBase, 20, C.live, "center", true);
    txt(ctx, "SOON!", SIZE / 2, yBase + 22, 18, C.live, "center", true);
  } else if (daysAway >= 2) {
    const dayName = kickoff.toLocaleDateString([], { weekday: "short" });
    const dateStr = kickoff.toLocaleDateString([], { day: "numeric", month: "short" });
    txt(ctx, `${dayName} ${dateStr}`, SIZE / 2, yBase, 17, C.imminent, "center", true);
    const localTime = kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    txt(ctx, localTime, SIZE / 2, yBase + 20, 15, C.fullTime, "center", true);
    txt(ctx, `in ${daysAway} days`, SIZE / 2, yBase + 38, 13, C.dim, "center", true);
  } else {
    const localTime = kickoff.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const localDate = kickoff.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    txt(ctx, localTime, SIZE / 2, yBase, 26, C.imminent, "center", true);
    txt(ctx, localDate, SIZE / 2, yBase + 22, 13, C.fullTime, "center", true);
    let label: string;
    if (mins <= 0) label = "Kick Off!";
    else if (mins < 60) label = `in ${mins}m`;
    else {
      const h = Math.floor(mins / 60);
      const m2 = mins % 60;
      label = m2 > 0 ? `in ${h}h ${m2}m` : `in ${h}h`;
    }
    txt(ctx, label, SIZE / 2, yBase + 42, 13, mins <= 15 ? C.live : C.imminent, "center", true);
  }
}

function drawFullTime(ctx: SKRSContext2D, state: MatchState, teamId: number) {
  const m = state.match;
  if (!m) return;

  const isHome = m.homeTeam.id === teamId;
  const yourScore = isHome ? state.homeScore : state.awayScore;
  const oppScore = isHome ? state.awayScore : state.homeScore;

  const won = yourScore > oppScore;
  const drew = yourScore === oppScore;
  const resultColor = won ? C.live : drew ? C.halfTime : C.red;
  const result = won ? "WIN" : drew ? "DRAW" : "LOSS";

  const finishedAt = new Date(m.utcDate);
  const hoursSince = (Date.now() - finishedAt.getTime()) / 3_600_000;
  const topLabel =
    hoursSince < 6
      ? "FULL TIME"
      : hoursSince < 48
      ? `${Math.max(1, Math.round(hoursSince))}H AGO`
      : `${Math.round(hoursSince / 24)}D AGO`;

  txt(ctx, topLabel, SIZE / 2, 11, 13, C.fullTime, "center", true);
  txt(ctx, result, SIZE / 2, 33, 26, resultColor, "center", true);
  txt(ctx, `${state.homeScore} - ${state.awayScore}`, SIZE / 2, 70, 44, C.score, "center", true);

  const homeColor = isHome ? C.live : C.fullTime;
  const awayColor = !isHome ? C.live : C.fullTime;

  drawTeamBadge(ctx, 28, 106, 28, 22, m.homeTeam.tla, teamCrestUrl(m.homeTeam));
  drawTeamBadge(ctx, SIZE - 28, 106, 28, 22, m.awayTeam.tla, teamCrestUrl(m.awayTeam));
  txt(ctx, trunc(m.homeTeam.tla, 3), 28, 128, 11, homeColor, "center", true);
  txt(ctx, trunc(m.awayTeam.tla, 3), SIZE - 28, 128, 11, awayColor, "center", true);
}

function drawFlagOnly(ctx: SKRSContext2D, teamLabel?: { name?: string; tla?: string }, crestUrl?: string) {
  const tla = teamLabel?.tla ?? "";
  const name = teamLabel?.name || tla || "";

  if (peekCrest(crestUrl) || FLAG_SPECS[tla]) {
    drawTeamBadge(ctx, SIZE / 2, 60, 104, 68, tla, crestUrl);
  } else {
    ensureCrestLoading(crestUrl);
    ctx.save();
    ctx.fillStyle = "#1a1a1a";
    roundRectPath(ctx, SIZE / 2 - 52, 26, 104, 68, 8);
    ctx.fill();
    ctx.restore();
    txt(ctx, trunc(tla, 4), SIZE / 2, 60, 34, C.live, "center", true);
  }

  txt(ctx, trunc(name.toUpperCase(), 18), SIZE / 2, 116, 16, "#ffffff", "center", true);
  if (tla && name.toUpperCase() !== tla) {
    txt(ctx, tla, SIZE / 2, 134, 12, C.dim, "center", true);
  }
}

function drawPostponed(ctx: SKRSContext2D, state: MatchState) {
  const m = state.match;
  txt(ctx, "PPD", SIZE / 2, SIZE / 2 - 28, 40, C.halfTime, "center", true);
  txt(ctx, "Postponed", SIZE / 2, SIZE / 2 + 14, 18, C.fullTime, "center", true);
  if (m) {
    txt(ctx, `${trunc(m.homeTeam.tla, 3)} v ${trunc(m.awayTeam.tla, 3)}`, SIZE / 2, SIZE / 2 + 36, 15, C.dim, "center", true);
  }
}
