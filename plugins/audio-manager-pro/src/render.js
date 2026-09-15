const BG = "#090C12";
const FG = "#F5F7FA";
const MUTED = "#9AA2AF";
const ACCENT = "#FFB21E";
const SUCCESS = "#2BE86A";
const WARN = "#FFC44D";
const DANGER = "#FF5D6C";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char]));
}

function truncate(value, max = 18) {
  const chars = Array.from(String(value || ""));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
}

function compactDeviceName(value) {
  const cleaned = String(value || "")
    .replace(/\s+\([^)]*\)\s*$/u, "")
    .replace(/\s+-\s+this one\s*$/iu, "")
    .replace(/\s+/gu, " ")
    .trim();
  return truncate(cleaned || "SELECT DEVICE", 13);
}

function deviceTextSize(value) {
  const length = Array.from(String(value || "")).length;
  if (length <= 8) return 18;
  if (length <= 11) return 16;
  return 14;
}

function profileTextSize(value) {
  const length = Array.from(String(value || "")).length;
  if (length <= 10) return 19;
  if (length <= 13) return 17;
  return 15;
}

function svgDataUri(body) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${body}</svg>`)}`;
}

function text(x, y, value, size, fill = FG, weight = 700, spacing = 0) {
  return `<text x="${x}" y="${y}" text-anchor="middle" fill="${fill}" font-family="Arial,Segoe UI,sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${esc(value)}</text>`;
}

function frame(body, color = ACCENT) {
  return `<rect width="144" height="144" rx="24" fill="${BG}"/><rect x="6" y="6" width="132" height="132" rx="19" fill="none" stroke="${color}" stroke-width="3" opacity=".62"/>${body}`;
}

function resultColor(status) {
  return status === "SUCCESS" || status === "ACTIVE"
    ? SUCCESS
    : status === "PARTIAL" || status === "INACTIVE"
      ? WARN
      : status === "FAILED" || status === "OFFLINE"
        ? DANGER
        : MUTED;
}

function profileBody(profile, status = "", active = false) {
  const name = truncate(profile?.name || "SELECT PROFILE", 16);
  const color = resultColor(status || (active ? "ACTIVE" : ""));
  const badge = status || (active ? "ACTIVE" : "PROFILE");
  return `${text(72, 55, name, profileTextSize(name))}${text(72, 82, badge, 13, color, 850, .8)}<path d="M47 108h50" stroke="${color}" stroke-width="6" stroke-linecap="round"/><circle cx="72" cy="108" r="8" fill="${color}"/>`;
}

export function renderKey(kind, { profile = null, endpoint = null, active = false, status = "", muted = false, missing = false, offline = false, role = "default" } = {}) {
  if (["apply", "cycle", "status"].includes(kind)) {
    const frameColor = status ? resultColor(status) : (profile?.accent || ACCENT);
    return svgDataUri(frame(profileBody(profile, status, active), frameColor));
  }

  if (kind === "set-output" || kind === "set-input") {
    const isCommunications = role === "communications";
    const label = kind === "set-output"
      ? (isCommunications ? "COMM OUT" : "DEFAULT OUT")
      : (isCommunications ? "COMM IN" : "DEFAULT IN");
    const rawName = offline ? "AUDIO OFFLINE" : missing ? "REBIND" : endpoint?.name || "SELECT DEVICE";
    const name = offline || missing ? rawName : compactDeviceName(rawName);
    const color = offline ? DANGER : missing ? WARN : ACCENT;
    const glyph = kind === "set-output"
      ? `<path d="M35 43h21l22-17v57L56 66H35z" fill="none" stroke="${FG}" stroke-width="6" stroke-linejoin="round"/><path d="M89 40c8 8 8 21 0 29M99 31c14 14 14 31 0 45" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`
      : `<rect x="60" y="20" width="24" height="45" rx="12" fill="none" stroke="${FG}" stroke-width="6"/><path d="M49 55c0 16 9 25 23 25s23-9 23-25M72 80v14M58 95h28" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
    return svgDataUri(frame(`${glyph}${text(72, 109, label, 14, MUTED, 850, .55)}${text(72, 131, name, deviceTextSize(name), color, 800)}`, color));
  }

  if (kind === "mute-mic") {
    const color = offline ? DANGER : missing ? WARN : muted ? DANGER : SUCCESS;
    const label = offline ? "AUDIO OFFLINE" : missing ? "NO DEFAULT MIC" : muted ? "MIC MUTED" : "MIC LIVE";
    return svgDataUri(frame(`<rect x="60" y="20" width="24" height="45" rx="12" fill="none" stroke="${FG}" stroke-width="6"/><path d="M49 55c0 16 9 25 23 25s23-9 23-25M72 80v14M58 95h28" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>${text(72, 126, label, label.length > 10 ? 13 : 16, color, 850, .35)}`, color));
  }

  return svgDataUri(frame(`${text(72, 67, "AUDIO", 19, ACCENT)}${text(72, 93, "MANAGER", 17)}`));
}

export function dialFeedback(profile, endpoint, note = "") {
  const volume = endpoint?.volumeAvailable ? Math.round(Number(endpoint.volume || 0)) : null;
  return {
    title: truncate(profile?.name || "PROFILE VOLUME", 20),
    value: note || (volume === null ? "Volume unavailable" : `${volume}% · ${truncate(endpoint?.name || "output", 15)}`),
    indicator: volume === null ? undefined : { value: volume },
  };
}
