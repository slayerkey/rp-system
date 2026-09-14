export type KeyVisualKind =
  | "status"
  | "lock"
  | "sleep"
  | "hibernate"
  | "restart"
  | "shutdown"
  | "wifi"
  | "bluetooth"
  | "power"
  | "awake"
  | "theme"
  | "desktop-previous"
  | "desktop-next"
  | "desktop-new"
  | "desktop-close"
  | "desktop-current"
  | "hdr"
  | "display"
  | "timeout"
  | "mode"
  | "save"
  | "profile";

export type KeyVisualTone = "brand" | "danger" | "success" | "neutral";

const COLORS = {
  bg: "#080A0E",
  border: "#303640",
  text: "#F5F7FB",
  muted: "#9AA2AF",
  accent: "#FFB21E",
  danger: "#FF5D6C",
  success: "#2BE86A",
  neutral: "#8B93A1"
} as const;

const GLYPHS: Record<KeyVisualKind, string> = {
  status: `
    <rect x="50" y="34" width="18" height="18" rx="3"/>
    <rect x="76" y="34" width="18" height="18" rx="3"/>
    <rect x="50" y="60" width="18" height="18" rx="3"/>
    <rect x="76" y="60" width="18" height="18" rx="3"/>
  `,
  lock: `
    <rect x="51" y="50" width="42" height="31" rx="6"/>
    <path d="M59 50v-8c0-9 5-15 13-15s13 6 13 15v8"/>
    <path d="M72 61v9"/>
  `,
  sleep: `
    <path d="M83 31c-17 4-26 21-19 37 5 11 17 16 29 12-6 8-17 13-28 10-17-4-27-21-23-38 4-17 21-27 41-21z"/>
  `,
  hibernate: `
    <path d="M80 31c-15 4-24 18-20 33 3 11 13 19 25 19-7 6-17 9-27 5-16-6-24-24-18-40 6-15 23-23 40-17z"/>
    <path d="M92 43v31M82 52l20 13M102 52 82 65"/>
  `,
  restart: `
    <path d="M91 45a28 28 0 1 0 6 25"/>
    <path d="M91 31v14H77"/>
  `,
  shutdown: `
    <path d="M72 30v29"/>
    <path d="M54 40a29 29 0 1 0 36 0"/>
  `,
  wifi: `
    <path d="M38 50c19-17 49-17 68 0"/>
    <path d="M49 62c13-11 33-11 46 0"/>
    <path d="M61 74c7-5 15-5 22 0"/>
    <circle cx="72" cy="84" r="2.5" fill="#F5F7FB" stroke="none"/>
  `,
  bluetooth: `
    <path d="M64 29v56l24-20-24-18 20-17-20-15v70"/>
  `,
  power: `
    <path d="M76 25 52 59h18l-5 28 27-38H74l2-24z"/>
  `,
  awake: `
    <path d="M37 59c10-16 21-24 35-24s25 8 35 24c-10 16-21 24-35 24S47 75 37 59z"/>
    <circle cx="72" cy="59" r="10"/>
  `,
  theme: `
    <circle cx="72" cy="57" r="27"/>
    <path d="M72 30v54"/>
    <path d="M72 30a27 27 0 0 1 0 54z" fill="#F5F7FB" stroke="none"/>
  `,
  "desktop-previous": `
    <rect x="55" y="35" width="43" height="35" rx="4"/>
    <rect x="45" y="45" width="43" height="35" rx="4"/>
    <path d="M48 88 36 76l12-12"/>
  `,
  "desktop-next": `
    <rect x="46" y="35" width="43" height="35" rx="4"/>
    <rect x="56" y="45" width="43" height="35" rx="4"/>
    <path d="m96 64 12 12-12 12"/>
  `,
  "desktop-new": `
    <rect x="42" y="39" width="60" height="42" rx="5"/>
    <path d="M72 48v24M60 60h24"/>
  `,
  "desktop-close": `
    <rect x="42" y="39" width="60" height="42" rx="5"/>
    <path d="m61 49 22 22M83 49 61 71"/>
  `,
  "desktop-current": `
    <rect x="43" y="38" width="44" height="33" rx="4"/>
    <rect x="57" y="49" width="44" height="33" rx="4"/>
    <path d="M49 87h46"/>
  `,
  hdr: `
    <circle cx="72" cy="57" r="16"/>
    <path d="M72 29v9M72 76v9M44 57h10M90 57h10M52 37l7 7M85 70l7 7M92 37l-7 7M59 70l-7 7"/>
  `,
  display: `
    <rect x="40" y="34" width="64" height="43" rx="5"/>
    <path d="M62 86h20M72 77v9"/>
  `,
  timeout: `
    <circle cx="72" cy="57" r="27"/>
    <path d="M72 42v17l13 8"/>
  `,
  mode: `
    <path d="M42 40h60M42 57h60M42 74h60"/>
    <circle cx="62" cy="40" r="5" fill="#080A0E"/>
    <circle cx="85" cy="57" r="5" fill="#080A0E"/>
    <circle cx="55" cy="74" r="5" fill="#080A0E"/>
  `,
  save: `
    <path d="M46 33h52l8 8v43H38V33z"/>
    <path d="M52 33v20h39V33M55 66h34v18H55z"/>
  `,
  profile: `
    <rect x="43" y="33" width="26" height="20" rx="3"/>
    <rect x="75" y="33" width="26" height="20" rx="3"/>
    <rect x="43" y="59" width="26" height="20" rx="3"/>
    <rect x="75" y="59" width="26" height="20" rx="3"/>
  `
};

export function renderKeyImage(
  kind: KeyVisualKind,
  title: string,
  preferredTone: KeyVisualTone = "brand"
): string {
  const lines = String(title || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);

  const resolvedLines = lines.length ? lines : ["N/A"];
  const tone = resolveTone(resolvedLines.join(" "), preferredTone);
  const accent = tone === "danger"
    ? COLORS.danger
    : tone === "success"
      ? COLORS.success
      : tone === "neutral"
        ? COLORS.neutral
        : COLORS.accent;

  const longest = Math.max(...resolvedLines.map((line) => line.length));
  const fontSize = longest <= 5 ? 23 : longest <= 8 ? 20 : longest <= 11 ? 17 : 15;
  const text = resolvedLines.length === 1
    ? textLine(resolvedLines[0], 124, fontSize)
    : `${textLine(resolvedLines[0], 111, fontSize)}${textLine(resolvedLines[1], 133, fontSize)}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="24" fill="${COLORS.bg}"/>
    <rect x="4" y="4" width="136" height="136" rx="21" fill="none" stroke="${COLORS.border}" stroke-width="3"/>
    <path d="M22 12h100" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>
    <g fill="none" stroke="${COLORS.text}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      ${GLYPHS[kind]}
    </g>
    ${text}
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function textLine(value: string, y: number, size: number): string {
  return `<text x="72" y="${y}" text-anchor="middle" fill="${COLORS.text}" font-family="Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="800" letter-spacing=".2">${escapeXml(value)}</text>`;
}

function resolveTone(title: string, preferred: KeyVisualTone): KeyVisualTone {
  const value = title.toUpperCase();
  if (/FAILED|ERROR|CHECK/.test(value)) return "danger";
  if (/OFFLINE|N\/A|UNKNOWN|EMPTY/.test(value)) return "neutral";
  if (/\bREADY\b/.test(value)) return "success";
  return preferred;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
