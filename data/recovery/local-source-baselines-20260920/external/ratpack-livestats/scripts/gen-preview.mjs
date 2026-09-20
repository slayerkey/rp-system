#!/usr/bin/env node
/**
 * Generates a marketing preview HTML page for Creator Stats for Stream Deck.
 * Usage: node scripts/gen-preview.mjs
 * Open scripts/output/preview.html in Chrome, screenshot each section.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const YT      = "#FF0000";
const TW      = "#9146FF";
const GREEN   = "#30E27B";
const ORANGE  = "#FF9F0A";
const GOLD    = "#FFD60A";
const LIVE_R  = "#FF453A";
const FONT    = `"SF Pro Display","Segoe UI",Arial,sans-serif`;
const OLED    = "#000000";
const DARK    = "#0D0D14";
const MUTED   = "rgba(255,255,255,0.10)";
const DIM     = "rgba(255,255,255,0.40)";

// ── SVG helpers ───────────────────────────────────────────────────────────────
function txt(x, y, sz, wt, fill, body, anchor = "middle") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${sz}" font-weight="${wt}" fill="${fill}">${body}</text>`;
}

function bar(x, y, w, h, pct, color, rx = 4) {
  const fill = Math.max(0, Math.min(w, pct * w)).toFixed(1);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${MUTED}"/>` +
    `<rect x="${x}" y="${y}" width="${fill}" height="${h}" rx="${rx}" fill="${color}"/>`;
}

function badge(color) {
  return `<circle cx="12" cy="12" r="6" fill="${color}" opacity="0.85"/>`;
}

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.?0+$/, "") + "K";
  return String(n);
}

// ── mode renderers — each returns { inner, bg } ───────────────────────────────

function bigNumber(platform, label, value, milestoneNext) {
  const color = platform === "youtube" ? YT : TW;
  const val   = fmt(value);
  const fs    = val.length <= 3 ? 54 : val.length <= 4 ? 48 : val.length <= 5 ? 40 : 34;
  const pct   = milestoneNext ? value / milestoneNext : null;
  return {
    bg: OLED,
    inner: badge(color)
      + txt(72, 34, 12, 700, DIM, label.toUpperCase())
      + txt(72, 94, fs, 800, color, val)
      + (pct !== null ? bar(12, 110, 120, 8, pct, color) : "")
      + (milestoneNext ? txt(72, 132, 10, 600, "rgba(255,255,255,0.28)", `to ${fmt(milestoneNext)}`) : ""),
  };
}

function milestoneMode(platform, label, current, target, daysEta) {
  const color = platform === "youtube" ? YT : TW;
  const pct   = Math.min(1, current / target);
  const away  = fmt(target - current);
  return {
    bg: OLED,
    inner: badge(color)
      + txt(72, 24, 11, 700, DIM, `TO: ${fmt(target)} ${label.toUpperCase()}`)
      + txt(72, 54, 15, 600, "#fff", fmt(current))
      + bar(12, 64, 120, 16, pct, color, 8)
      + txt(72, 102, 16, 700, color, `${away} away`)
      + txt(72, 124, 12, 600, "rgba(255,255,255,0.38)", daysEta ? `~${daysEta} days` : "Calculating…"),
  };
}

function trendMode(platform, label, delta, series, deltaWindow = "7D") {
  const color    = platform === "youtube" ? YT : TW;
  const positive = delta >= 0;
  const arrowCol = positive ? GREEN : LIVE_R;
  const W = 120, H = 40, ox = 12, oy = 96;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const pts = series.map((v, i) => {
    const x = ox + (i / (series.length - 1)) * W;
    const y = oy + H * (1 - (v - min) / range);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const [lx, ly] = pts.split(" ").pop().split(",");
  const dStr = (delta >= 0 ? "+" : "") + fmt(Math.abs(delta));
  const dFs  = dStr.length <= 4 ? 34 : dStr.length <= 5 ? 28 : 24;
  return {
    bg: DARK,
    inner: badge(color)
      + txt(72, 24, 11, 700, DIM, `${label.toUpperCase()} · ${deltaWindow}`)
      + txt(54, 72, dFs, 800, color, dStr)
      + txt(112, 72, 24, 800, arrowCol, positive ? "↑" : "↓")
      + `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-opacity="0.65" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<circle cx="${lx}" cy="${ly}" r="3.5" fill="${color}"/>`,
  };
}

function liveMode(platform, viewers, duration, peak) {
  const color = platform === "youtube" ? YT : TW;
  const vStr  = fmt(viewers);
  const vFs   = vStr.length <= 3 ? 52 : vStr.length <= 4 ? 44 : 38;
  return {
    bg: OLED,
    inner:
      `<circle cx="14" cy="14" r="6" fill="${LIVE_R}"/>`
      + txt(80, 22, 12, 800, LIVE_R, `● LIVE  ${duration}`)
      + txt(72, 86, vFs, 800, color, vStr)
      + txt(72, 108, 12, 700, DIM, "VIEWERS")
      + txt(72, 132, 11, 600, "rgba(255,255,255,0.28)", `Peak: ${fmt(peak)}`),
  };
}

function platformIconMode(platform) {
  const label = platform === "youtube" ? "YOUTUBE" : "TWITCH";
  // Official brand paths (24×24 viewBox → ×3.75, centered at canvas (72,60))
  const logo = platform === "youtube"
    ? `<g transform="translate(27,15) scale(3.75)">`
      + `<path fill="${YT}" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>`
      + `<path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>`
      + `</g>`
    : `<g transform="translate(27,15) scale(3.75)">`
      + `<path fill="${TW}" fill-rule="evenodd" d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>`
      + `</g>`;
  return {
    bg: OLED,
    inner: logo + txt(72, 132, 13, 800, "rgba(255,255,255,0.45)", label),
  };
}

function streakMode(days, lastAgo) {
  return {
    bg: OLED,
    inner: txt(72, 32, 12, 700, DIM, "UPLOAD STREAK")
      + txt(52, 94, 52, 800, ORANGE, `${days}`)
      + txt(108, 94, 24, 600, ORANGE, "🔥")
      + txt(72, 116, 12, 700, DIM, "DAYS")
      + txt(72, 134, 11, 600, "rgba(255,255,255,0.28)", lastAgo),
  };
}

function multiMode(ytSubs, ytViews, twFollow, twLive) {
  const dividers =
    `<line x1="72" y1="8" x2="72" y2="136" stroke="#1A1A2E" stroke-width="1.5"/>`
    + `<line x1="8" y1="72" x2="136" y2="72" stroke="#1A1A2E" stroke-width="1.5"/>`;
  return {
    bg: OLED,
    inner: dividers
      + txt(36, 46, 9, 700, "rgba(255,255,255,0.35)", "YT SUBS")
      + txt(36, 62, 20, 800, YT, fmt(ytSubs))
      + txt(108, 46, 9, 700, "rgba(255,255,255,0.35)", "YT VIEWS")
      + txt(108, 62, 18, 800, YT, fmt(ytViews))
      + txt(36, 96, 9, 700, "rgba(255,255,255,0.35)", "TW FOLLOW")
      + txt(36, 112, 18, 800, TW, fmt(twFollow))
      + txt(108, 96, 9, 700, "rgba(255,255,255,0.35)", "TW LIVE")
      + txt(108, 112, 18, 800, TW, fmt(twLive)),
  };
}

function achievementMode(value, label) {
  const PIECES = [
    [18, 20, 9, 4, 40, GOLD],   [108, 16, 8, 4, -35, "#FF453A"],
    [14, 58, 7, 4, 20, GREEN],  [118, 52, 8, 3, -55, ORANGE],
    [22, 108, 8, 4, 30, TW],    [112, 104, 7, 4, -40, GOLD],
    [52, 12, 8, 3, 15, "#FF453A"], [88, 14, 9, 3, -25, GREEN],
    [10, 82, 7, 4, 50, GOLD],   [122, 78, 8, 3, -30, "#FF453A"],
    [38, 126, 8, 4, 20, GREEN], [96, 128, 7, 4, -50, TW],
  ];
  const confetti = PIECES.map(([x, y, w, h, r, c]) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="${c}" opacity="0.9" transform="rotate(${r} ${x+w/2} ${y+h/2})"/>`
  ).join("");
  return {
    bg: OLED,
    inner: confetti
      + txt(72, 62, 30, 800, GOLD, "🏆")
      + txt(72, 90, 20, 800, YT, fmt(value))
      + txt(72, 108, 10, 700, "rgba(255,255,255,0.5)", label.toUpperCase())
      + txt(72, 130, 11, 600, "rgba(255,255,255,0.3)", "Just reached!"),
  };
}

function revenueMode(amount) {
  const str = `$${amount.toFixed(2)}`;
  const fs  = str.length <= 5 ? 40 : str.length <= 6 ? 34 : 28;
  return {
    bg: OLED,
    inner: badge(YT)
      + txt(72, 34, 12, 700, DIM, "EST. REVENUE")
      + txt(72, 92, fs, 800, YT, str)
      + txt(72, 112, 11, 600, "rgba(255,255,255,0.28)", "today"),
  };
}

function emptySlot() {
  return { bg: DARK, inner: txt(72, 78, 11, 600, "#252538", "Your key") };
}

// ── standalone SVG ────────────────────────────────────────────────────────────
let _uid = 0;
function asSvg({ inner, bg }) {
  const uid = `kc${_uid++}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">`
    + `<defs><clipPath id="${uid}"><rect width="144" height="144" rx="16"/></clipPath></defs>`
    + `<g clip-path="url(#${uid})"><rect width="144" height="144" fill="${bg}"/>${inner}</g></svg>`;
}

// ── HTML builder ──────────────────────────────────────────────────────────────
function key(mode, caption = "") {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:8px">`
    + `<div style="border-radius:12px;overflow:hidden;box-shadow:0 4px 28px rgba(0,0,0,.7)">${asSvg(mode)}</div>`
    + (caption ? `<div style="font-size:11px;color:#555;font-family:system-ui;text-align:center;line-height:1.4">${caption}</div>` : "")
    + `</div>`;
}

function row(...items) {
  return `<div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">${items.join("")}</div>`;
}

function section(title, subtitle, content) {
  return `<div style="padding:48px 60px;border-bottom:1px solid #1a1a1a">`
    + `<h2 style="margin:0 0 4px;font-size:32px;font-weight:800;letter-spacing:-1px;color:#fff">${title}</h2>`
    + (subtitle ? `<p style="margin:0 0 32px;font-size:14px;color:#555;font-family:system-ui">${subtitle}</p>` : `<div style="margin-bottom:32px"></div>`)
    + content
    + `</div>`;
}

function chip(text, color) {
  return `<span style="font-size:11px;padding:3px 10px;border-radius:20px;border:1px solid ${color}44;color:${color};background:${color}14;font-family:system-ui">${text}</span>`;
}

// ── sample data ───────────────────────────────────────────────────────────────
const YT_SERIES = [1_180_000, 1_195_000, 1_200_000, 1_215_000, 1_218_000, 1_230_000, 1_240_000];
const TW_SERIES = [4_700, 4_730, 4_760, 4_780, 4_795, 4_810, 4_821];

// ── MK2 grid (5×3) ───────────────────────────────────────────────────────────
const MK2 = [
  platformIconMode("youtube"),
  bigNumber("youtube", "SUBS",        1_240_000, 1_500_000),
  bigNumber("youtube", "VIEWS TODAY",    48_200, 100_000),
  milestoneMode("youtube", "SUBS",    1_240_000, 1_500_000, 34),
  trendMode("youtube", "SUBS",           60_000, YT_SERIES, "7D"),

  platformIconMode("twitch"),
  bigNumber("twitch", "FOLLOWERS",     4_821, 5_000),
  liveMode("twitch", 3241, "1:23:47", 4102),
  bigNumber("twitch", "SUBS",            142,   200),
  bigNumber("twitch", "NEW FOLLOWS",      18,  null),

  multiMode(1_240_000, 48_200, 4_821, 3241),
  streakMode(14, "Last: 2h ago"),
  revenueMode(12.40),
  bigNumber("youtube", "COMMENTS",       47,  null),
  emptySlot(),
];

function mk2Grid() {
  const KEY = 144, GAP = 8, CORNER = 12;
  const W   = 5 * KEY + 4 * GAP;
  const H   = 3 * KEY + 2 * GAP;

  const defs = MK2.map((_, i) => {
    const col = i % 5, r = Math.floor(i / 5);
    const ox  = col * (KEY + GAP), oy = r * (KEY + GAP);
    return `<clipPath id="gc_${i}"><rect x="${ox}" y="${oy}" width="${KEY}" height="${KEY}" rx="${CORNER}"/></clipPath>`;
  }).join("");

  const cells = MK2.map(({ inner, bg }, i) => {
    const col = i % 5, r = Math.floor(i / 5);
    const ox  = col * (KEY + GAP), oy = r * (KEY + GAP);
    return `<g clip-path="url(#gc_${i})"><rect x="${ox}" y="${oy}" width="${KEY}" height="${KEY}" fill="${bg}"/>`
      + `<g transform="translate(${ox},${oy})">${inner}</g></g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}">`
    + `<rect width="${W}" height="${H}" fill="#060610" rx="10"/>`
    + `<defs>${defs}</defs>${cells}</svg>`;
}

// ── sections ──────────────────────────────────────────────────────────────────
const S_HERO = section(
  "Creator Stats for Stream Deck",
  "YouTube, Twitch and more — your numbers, on your desk, always.",
  mk2Grid()
  + `<div style="margin-top:14px;font-size:12px;color:#333;font-family:system-ui">`
  + `Default MK2 Profile included — 15 keys pre-configured · Import with one click · $7.99 one-time</div>`
);

const S_MODES = section(
  "8 Display Modes · OLED &amp; Creator Themes",
  "Short-press to cycle mode · Long-press to cycle metric",
  `<div style="display:flex;flex-direction:column;gap:32px">`
  + row(
      key(bigNumber("youtube", "SUBS", 1_240_000, 1_500_000),   "Big Number"),
      key(milestoneMode("youtube", "SUBS", 1_240_000, 1_500_000, 34), "Milestone"),
      key(trendMode("youtube", "SUBS", 60_000, YT_SERIES, "7D"),  "Trend + Sparkline"),
      key(liveMode("twitch", 3241, "1:23:47", 4102),             "Live Mode"),
    )
  + `<div style="margin-top:4px"/>`
  + row(
      key(platformIconMode("youtube"),                            "Platform Icon"),
      key(streakMode(14, "Last: 2h ago"),                        "Upload Streak"),
      key(multiMode(1_240_000, 48_200, 4_821, 3241),             "Multi-Stat"),
      key(achievementMode(1_000_000, "subscribers"),             "Achievement"),
    )
  + `</div>`
);

const S_YOUTUBE = section(
  "YouTube Dashboard",
  "Subscriber count · Today's views · Milestone progress · 7-day growth trend",
  row(
    key(platformIconMode("youtube"),                               "Opens YouTube Studio"),
    key(bigNumber("youtube", "SUBS", 1_240_000, 1_500_000),      "1.24M subscribers"),
    key(bigNumber("youtube", "VIEWS TODAY", 48_200, 100_000),    "48.2K today"),
    key(milestoneMode("youtube", "SUBS", 1_240_000, 1_500_000, 34), "Progress to 1.5M"),
    key(trendMode("youtube", "SUBS", 60_000, YT_SERIES, "7D"),   "+60K this week"),
  )
);

const S_TWITCH = section(
  "Twitch Dashboard",
  "Followers · Live viewers · Subs · Auto-switches to 90s refresh when live",
  `<div style="display:flex;flex-direction:column;gap:28px">`
  + row(
      key(platformIconMode("twitch"),                             "Opens Dashboard"),
      key(bigNumber("twitch", "FOLLOWERS", 4_821, 5_000),        "4,821 followers"),
      key(liveMode("twitch", 3241, "1:23:47", 4102),             "3,241 live viewers"),
      key(bigNumber("twitch", "SUBS", 142, 200),                 "142 subscribers"),
      key(bigNumber("twitch", "NEW FOLLOWS", 18, null),          "+18 today"),
    )
  + `<div style="display:flex;gap:10px;margin-top:12px">`
  + chip("Offline: 5-min polling", TW)
  + chip("Live: 90-second polling", LIVE_R)
  + chip("Auto-detects stream start", GREEN)
  + `</div></div>`
);

const S_MILESTONE = section(
  "Milestone Tracker &amp; Achievements",
  "Auto-detects your next goal · ETA via 7-day regression · 60s celebration overlay",
  `<div style="display:flex;flex-direction:column;gap:28px">`
  + row(
      key(milestoneMode("youtube", "SUBS",     9_650,     10_000,  4), "190 subs to 10K"),
      key(milestoneMode("twitch", "FOLLOWERS", 4_821,      5_000,  7), "179 to Affiliate"),
      key(milestoneMode("youtube", "SUBS",  1_240_000, 1_500_000, 34), "260K to 1.5M"),
      key(achievementMode(10_000, "subscribers"),                       "10K milestone hit!"),
    )
  + `<div style="display:flex;gap:10px;margin-top:10px">`
  + chip("Auto-detects next round number", GOLD)
  + chip("ETA via 7-day linear regression", GOLD)
  + chip("60-second achievement overlay", GOLD)
  + `</div></div>`
);

const S_ADVANCED = section(
  "Advanced Metrics",
  "Upload streak · Revenue estimates · New comments · All-platform snapshot",
  row(
    key(multiMode(1_240_000, 48_200, 4_821, 3241), "All-platform snapshot"),
    key(streakMode(14, "Last: 2h ago"),             "14-day upload streak"),
    key(revenueMode(12.40),                         "Est. $12.40 today"),
    key(bigNumber("youtube", "COMMENTS", 47, null), "+47 comments today"),
  )
);

const S_ALERTS = section(
  "Smart Themes · Zero Config",
  "OLED true-black saves burn-in · Creator dark gives depth · one-time $7.99",
  `<div style="display:flex;flex-direction:column;gap:28px">`
  + row(
      key(bigNumber("youtube", "SUBS", 1_240_000, 1_500_000), "OLED theme"),
      key({ ...bigNumber("youtube", "SUBS", 1_240_000, 1_500_000), bg: DARK }, "Creator theme"),
      key(bigNumber("twitch", "FOLLOWERS", 4_821, 5_000),     "Twitch purple"),
      key(liveMode("youtube", 12_400, "2:14:08", 18_900),     "YouTube Live"),
    )
  + `<div style="display:flex;gap:10px;margin-top:10px">`
  + chip("YouTube · Twitch", "#fff")
  + chip("API Key auth (YouTube)", YT)
  + chip("OAuth PKCE (Twitch)", TW)
  + chip("No subscription · No free tier · $7.99 once", GREEN)
  + `</div></div>`
);

// ── final HTML ────────────────────────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Creator Stats for Stream Deck · Marketing Preview</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d0d;color:#fff;font-family:"SF Pro Display","Segoe UI",Arial,sans-serif}
    svg text{font-family:"SF Pro Display","Segoe UI",Arial,sans-serif}
  </style>
</head>
<body>
  <!-- SCREENSHOT 1: Hero — MK2 grid. Crop tightly. Use as main listing image. -->
  ${S_HERO}
  <!-- SCREENSHOT 2: Display Modes — all 8 modes -->
  ${S_MODES}
  <!-- SCREENSHOT 3: YouTube Dashboard -->
  ${S_YOUTUBE}
  <!-- SCREENSHOT 4: Twitch Dashboard -->
  ${S_TWITCH}
  <!-- SCREENSHOT 5: Milestone Tracker -->
  ${S_MILESTONE}
  <!-- SCREENSHOT 6: Advanced Metrics -->
  ${S_ADVANCED}
  <!-- SCREENSHOT 7: Themes + Pricing -->
  ${S_ALERTS}
</body>
</html>`;

mkdirSync("scripts/output", { recursive: true });
writeFileSync("scripts/output/preview.html", HTML, "utf8");
console.log("\n✔ Saved → scripts/output/preview.html");
console.log("  Open in Chrome and screenshot each section for marketplace uploads.\n");
