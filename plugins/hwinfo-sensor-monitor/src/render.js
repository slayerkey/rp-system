import { finite, formatReading, statusCopy } from "./sensor-model.js";

const BG = "#090B10", TEXT = "#F4F6F8", MUTED = "#9CA6B4", WARNING = "#FFB21E", DANGER = "#FF5D6C", NORMAL = "#2BE86A";

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function clip(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text;
}
function fitted(text, base, chars, min = .62) {
  const len = Math.max(1, String(text || "").length);
  return base * Math.min(1, Math.max(min, chars / len));
}
function pointsPath(points, x, y, w, h) {
  const clean = (Array.isArray(points) ? points : []).map((p) => [Number(p?.[0]), Number(p?.[1])]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (clean.length < 2) return "";
  const sampled = clean.length <= 48 ? clean : Array.from({ length: 48 }, (_, i) => clean[Math.min(clean.length - 1, Math.floor(i * (clean.length - 1) / 47))]);
  const values = sampled.map((p) => p[1]);
  let min = Math.min(...values), max = Math.max(...values);
  if (max <= min) { min -= 1; max += 1; }
  const pad = (max - min) * .08; min -= pad; max += pad;
  return sampled.map((p, i) => {
    const px = x + (i / Math.max(1, sampled.length - 1)) * w;
    const py = y + h - ((p[1] - min) / (max - min)) * h;
    return (i ? "L" : "M") + px.toFixed(1) + " " + Math.max(y, Math.min(y + h, py)).toFixed(1);
  }).join(" ");
}
export function severity(value, settings = {}) {
  const n = finite(value), warn = finite(settings.warningThreshold), critical = finite(settings.criticalThreshold);
  if (n === null || warn === null || critical === null) return "normal";
  if (settings.thresholdDirection === "below") {
    if (n <= Math.min(warn, critical)) return "critical";
    if (n <= Math.max(warn, critical)) return "warning";
  } else {
    if (n >= Math.max(warn, critical)) return "critical";
    if (n >= Math.min(warn, critical)) return "warning";
  }
  return "normal";
}
export function stateToken(status, selectedMissing = false) {
  if (selectedMissing && status?.state === "ready") return { primary: "SENSOR GONE", secondary: "RESELECT SENSOR" };
  const state = String(status?.state || "starting");
  const map = {
    not_running: ["START HWiNFO", "LOCAL APP REQUIRED"],
    sensors_inactive: ["OPEN SENSORS", "HWiNFO SENSOR MODE"],
    shared_memory_disabled: ["ENABLE SHM", "HWiNFO SETTINGS"],
    shared_memory_expired: ["SHM EXPIRED", "RE-ENABLE MANUALLY"],
    shared_memory_unavailable: ["NO SHM", "CHECK HWiNFO"],
    incompatible: ["SHM ERROR", "UPDATE HWiNFO"],
    starting: ["CONNECTING", "WAITING FOR HWiNFO"]
  };
  const pair = map[state] || ["NO DATA", "CHECK HWiNFO"];
  return { primary: pair[0], secondary: pair[1] };
}
function sensorLabel(sensor, settings) {
  return clip(settings.customLabel || sensor?.name || "HWiNFO SENSOR", 18).toUpperCase();
}
export function makeSensorView(service, settings, kind = "sensor") {
  const sensor = service.sensor(settings.sensorId);
  const missing = !sensor;
  if (service.status?.state !== "ready" || missing) {
    const token = stateToken(service.status, missing);
    return { state: "unavailable", label: sensorLabel(sensor, settings), valueText: token.primary, unit: "", secondary: token.secondary, points: [], severity: "warning" };
  }
  const value = finite(sensor.value);
  if (value === null) return { state: "unavailable", label: sensorLabel(sensor, settings), valueText: "NO DATA", unit: "", secondary: "SOURCE UNAVAILABLE", points: [], severity: "warning" };
  const sev = kind === "alert" ? severity(value, settings) : "normal";
  const points = settings.historyEnabled || kind === "graph" ? service.history(settings.sensorId, settings.historyWindowMs) : [];
  let secondary = sensor.deviceName || "HWiNFO";
  if (settings.showMinMax) secondary = "MIN " + formatReading(sensor.min, settings.precision) + " · MAX " + formatReading(sensor.max, settings.precision);
  if (kind === "graph") secondary = settings.historyWindowMs === 300000 ? "5 MIN HISTORY" : settings.historyWindowMs === 30000 ? "30 SEC HISTORY" : "1 MIN HISTORY";
  if (kind === "alert") secondary = sev === "critical" ? "CRITICAL" : sev === "warning" ? "WARNING" : "NORMAL";
  return {
    state: "ready", label: sensorLabel(sensor, settings), value, valueText: formatReading(value, settings.precision),
    unit: String(sensor.unit || ""), secondary, points, severity: sev
  };
}
export function makeDashboardView(service, settings) {
  const refs = settings.sensorIds || [];
  service.watchMany(refs);
  const resolved = refs.map((ref) => ({ ref, sensor: service.sensor(ref) }));
  const pageCount = Math.max(1, Math.ceil(resolved.length / 3));
  const page = Math.max(0, Number(settings.dashboardPage) || 0) % pageCount;
  const rows = resolved.slice(page * 3, page * 3 + 3).map(({ ref, sensor }) => ({
    ref, sensor, label: clip(sensor?.name || ref.replace(/^auto:/, ""), 13).toUpperCase(),
    value: sensor ? formatReading(sensor.value, settings.precision) + (sensor.unit ? " " + sensor.unit : "") : "--"
  }));
  return { state: service.status?.state === "ready" ? "ready" : "unavailable", rows, page, pageCount, status: service.status };
}
export function renderSpark(points, width = 112, height = 48, color = NORMAL) {
  const path = pointsPath(points, 3, 4, width - 6, height - 8);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect width="' + width + '" height="' + height + '" rx="8" fill="#0D1015"/>' + (path ? '<path d="' + path + '" fill="none" stroke="' + color + '" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>' : '') + '</svg>';
  return "data:image/svg+xml;charset=utf8," + encodeURIComponent(svg);
}
export function renderKey(view, settings = {}, size = 144) {
  const s = Math.max(36, Number(size) || 144);
  if (Array.isArray(view?.rows)) return renderDashboardKey(view, settings, s);
  const sev = view?.severity || "normal";
  const accent = sev === "critical" ? DANGER : sev === "warning" ? WARNING : (/^#[0-9A-Fa-f]{6}$/.test(settings.accent || "") ? settings.accent : NORMAL);
  const healthy = view?.state === "ready";
  const label = xml(clip(view?.label || "HWiNFO", 18));
  const valueText = String(view?.valueText || "--");
  const unit = healthy && view?.unit ? " " + view.unit : "";
  const secondary = xml(clip(view?.secondary || "", 23).toUpperCase());
  const path = pointsPath(view?.points || [], s*.10, s*.66, s*.80, s*.20);
  const valueSize = healthy ? fitted(valueText, s*.31, 6, .68) : fitted(valueText, s*.22, 10, .60);
  const labelSize = fitted(label, s*.095, 13, .66);
  const secondarySize = fitted(secondary, s*.075, 18, .62);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 '+s+' '+s+'">',
    '<defs><clipPath id="topText"><rect x="'+(s*.09)+'" y="'+(s*.04)+'" width="'+(s*.82)+'" height="'+(s*.14)+'"/></clipPath><clipPath id="primaryText"><rect x="'+(s*.06)+'" y="'+(s*.20)+'" width="'+(s*.88)+'" height="'+(s*.37)+'"/></clipPath><clipPath id="bottomText"><rect x="'+(s*.06)+'" y="'+(s*.88)+'" width="'+(s*.88)+'" height="'+(s*.10)+'"/></clipPath></defs>',
    '<rect width="'+s+'" height="'+s+'" rx="'+(s*.16)+'" fill="'+BG+'"/>',
    '<circle cx="'+(s*.085)+'" cy="'+(s*.105)+'" r="'+Math.max(2,s*.022)+'" fill="'+accent+'"/>',
    '<text clip-path="url(#topText)" x="'+(s*.13)+'" y="'+(s*.13)+'" fill="'+MUTED+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+labelSize+'" font-weight="700">'+label+'</text>',
    '<text clip-path="url(#primaryText)" x="'+(s*.50)+'" y="'+(s*.52)+'" text-anchor="middle" fill="'+TEXT+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+valueSize+'" font-weight="750">'+xml(valueText)+'<tspan fill="'+MUTED+'" font-size="'+(valueSize*.36)+'">'+xml(unit)+'</tspan></text>'
  ];
  if (path) svg.push('<path d="'+path+'" fill="none" stroke="'+accent+'" stroke-width="'+Math.max(1.5,s*.017)+'" stroke-linecap="round" stroke-linejoin="round"/>');
  svg.push('<text clip-path="url(#bottomText)" x="'+(s*.5)+'" y="'+(s*.955)+'" text-anchor="middle" fill="'+(sev==="critical"?DANGER:sev==="warning"?WARNING:MUTED)+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+secondarySize+'" font-weight="700">'+secondary+'</text>');
  svg.push("</svg>");
  return "data:image/svg+xml;charset=utf8," + encodeURIComponent(svg.join(""));
}
function renderDashboardKey(view, settings, s) {
  const accent = /^#[0-9A-Fa-f]{6}$/.test(settings.accent || "") ? settings.accent : NORMAL;
  const rows = view.rows || [];
  const status = view.state === "ready" ? "PAGE " + (view.page + 1) + "/" + view.pageCount : stateToken(view.status).primary;
  const parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="'+s+'" height="'+s+'" viewBox="0 0 '+s+' '+s+'"><rect width="'+s+'" height="'+s+'" rx="'+(s*.16)+'" fill="'+BG+'"/><text x="'+(s*.08)+'" y="'+(s*.13)+'" fill="'+MUTED+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+(s*.09)+'" font-weight="700">HWiNFO DASH</text>'];
  rows.forEach((row, index) => {
    const y = s*(.33 + index*.205);
    parts.push('<text x="'+(s*.08)+'" y="'+y+'" fill="'+TEXT+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+(s*.085)+'" font-weight="650">'+xml(row.label)+'</text>');
    parts.push('<text x="'+(s*.92)+'" y="'+y+'" text-anchor="end" fill="'+accent+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+(s*.10)+'" font-weight="750">'+xml(clip(row.value,12))+'</text>');
  });
  parts.push('<text x="'+(s*.5)+'" y="'+(s*.94)+'" text-anchor="middle" fill="'+WARNING+'" font-family="Segoe UI,Arial,sans-serif" font-size="'+(s*.07)+'" font-weight="700">'+xml(status)+'</text></svg>');
  return "data:image/svg+xml;charset=utf8," + encodeURIComponent(parts.join(""));
}
export function inspectorStatus(status) {
  const [title, detail] = statusCopy(status);
  return { title, detail, state: status?.state || "starting" };
}
