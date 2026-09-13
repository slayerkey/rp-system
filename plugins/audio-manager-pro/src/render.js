const BG = "#090C12";
const FG = "#F5F7FA";
const MUTED = "#8A93A3";
const ACCENT = "#56F2A5";
const WARN = "#FFCC66";
const DANGER = "#FF6B76";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char]));
}

function truncate(value, max = 18) {
  const chars = Array.from(String(value || ""));
  return chars.length <= max ? chars.join("") : `${chars.slice(0, Math.max(1, max - 1)).join("")}…`;
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
    ? ACCENT
    : status === "PARTIAL" || status === "INACTIVE"
      ? WARN
      : status === "FAILED"
        ? DANGER
        : MUTED;
}

function profileBody(profile, status = "", active = false) {
  const name = truncate(profile?.name || "SELECT PROFILE", 16);
  const color = resultColor(status || (active ? "SUCCESS" : ""));
  const badge = status || (active ? "ACTIVE" : "PROFILE");
  return `${text(72, 58, name, 16)}${text(72, 87, badge, 11, color, 800, 1.1)}<path d="M47 109h50" stroke="${color}" stroke-width="6" stroke-linecap="round"/><circle cx="72" cy="109" r="8" fill="${color}"/>`;
}

export function renderKey(kind, { profile = null, endpoint = null, active = false, status = "", muted = false, missing = false, role = "default" } = {}) {
  if (["apply", "cycle", "status"].includes(kind)) {
    const frameColor = status ? resultColor(status) : (profile?.accent || (active ? ACCENT : MUTED));
    return svgDataUri(frame(profileBody(profile, status, active), frameColor));
  }

  if (kind === "set-output" || kind === "set-input") {
    const isCommunications = role === "communications";
    const label = kind === "set-output"
      ? (isCommunications ? "COMM OUT" : "DEFAULT OUT")
      : (isCommunications ? "COMM IN" : "DEFAULT IN");
    const name = missing ? "REBIND" : truncate(endpoint?.name || "SELECT DEVICE", 15);
    const color = missing ? WARN : ACCENT;
    const glyph = kind === "set-output"
      ? '<path d="M37 60h20l23-18v60L57 84H37z" fill="none" stroke="#F5F7FA" stroke-width="6" stroke-linejoin="round"/><path d="M91 57c8 8 8 22 0 30M100 49c14 14 14 32 0 46" fill="none" stroke="#56F2A5" stroke-width="5" stroke-linecap="round"/>'
      : '<rect x="60" y="35" width="24" height="48" rx="12" fill="none" stroke="#F5F7FA" stroke-width="6"/><path d="M49 72c0 16 9 25 23 25s23-9 23-25M72 97v17M58 115h28" fill="none" stroke="#56F2A5" stroke-width="6" stroke-linecap="round"/>';
    return svgDataUri(frame(`${glyph}${text(72, 122, label, 9, MUTED, 800, 1.3)}${text(72, 138, name, 9, color, 700)}`, color));
  }

  if (kind === "mute-mic") {
    const color = muted ? DANGER : ACCENT;
    return svgDataUri(frame(`<rect x="60" y="31" width="24" height="48" rx="12" fill="none" stroke="${FG}" stroke-width="6"/><path d="M49 69c0 17 9 26 23 26s23-9 23-26M72 95v18M58 114h28" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>${text(72, 134, muted ? "MIC MUTED" : "MIC LIVE", 10, color, 800, 1)}`, color));
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
