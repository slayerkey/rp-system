import { formatDuration } from "./stats.js";

const ACCENT = "#2BE86A";
const WARNING = "#FFB34D";
const DANGER = "#FF5D6C";
const BG = "#090B10";
const TEXT = "#F4F6F8";
const MUTED = "#9CA6B4";

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compactText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + "…" : text;
}

function formatNumber(value, unit = "") {
  const n = finite(value);
  if (n === null) return "--";
  if (unit === "FPS") return Math.round(n).toString();
  if (unit === "ms") return (n < 10 ? n.toFixed(1) : Math.round(n).toString());
  if (unit === "%") return Math.round(n).toString();
  if (unit === "°C") return Math.round(n).toString();
  if (Math.abs(n) >= 1000) return Math.round(n).toString();
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  if (Math.abs(n) >= 10) return n.toFixed(1).replace(/\.0$/, "");
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function labelFor(descriptor, fallback = "METRIC") {
  const id = String(descriptor?.id || fallback || "");
  const common = {
    "cpu.load": "CPU LOAD",
    "ram.load": "RAM USED",
    "cpu.temperature": "CPU TEMP",
    "gpu.temperature": "GPU TEMP",
    "gpu.fan": "GPU FAN",
    "gpu.load": "GPU LOAD",
    "gpu.power": "GPU POWER",
    "cpu.power": "CPU POWER",
    "game.fps": "GAME FPS",
    "game.frametime": "FRAMETIME",
  };
  if (common[id]) return common[id];

  const raw = String(descriptor?.name || fallback).replace(/\s+/g, " ").trim();
  return raw.length > 14 ? raw.slice(0, 13) + "…" : raw;
}

function shortHardwareName(value) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  text = text
    .replace(/^Advanced Micro Devices,? Inc\.?\s*/i, "")
    .replace(/^AMD\s+/i, "")
    .replace(/^NVIDIA\s+/i, "")
    .replace(/^Intel\(R\)\s*/i, "")
    .replace(/^Intel\s+/i, "")
    .replace(/^GeForce\s+/i, "");

  const useful = text.match(/\b(?:RTX|GTX|RX|ARC|RYZEN|CORE)\b.*$/i);
  if (useful?.[0]) text = useful[0];
  return compactText(text, 18);
}

function fittedFontSize(text, base, comfortableChars, minimumFactor = 0.68) {
  const length = Math.max(1, String(text || "").length);
  const factor = Math.min(1, Math.max(minimumFactor, comfortableChars / length));
  return base * factor;
}

function compactPoints(points, maxPoints = 44, mode = "max") {
  const clean = (Array.isArray(points) ? points : [])
    .map((point) => [Number(point?.[0]), Number(point?.[1])])
    .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (clean.length <= maxPoints) return clean;
  const bucket = clean.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const start = Math.floor(i * bucket);
    const end = Math.min(clean.length, Math.max(start + 1, Math.floor((i + 1) * bucket)));
    let chosen = clean[start];
    for (let j = start + 1; j < end; j += 1) {
      if ((mode === "min" && clean[j][1] < chosen[1]) || (mode !== "min" && clean[j][1] > chosen[1])) chosen = clean[j];
    }
    out.push(chosen);
  }
  return out;
}

function pathFor(points, x, y, width, height, scaleMin = null, scaleMax = null, mode = "max") {
  const data = compactPoints(points, 44, mode);
  if (data.length < 2) return "";
  const values = data.map((p) => p[1]);
  let min = finite(scaleMin);
  let max = finite(scaleMax);
  if (min === null) min = Math.min(...values);
  if (max === null) max = Math.max(...values);
  if (max <= min) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;
  return data.map((point, index) => {
    const px = x + (index / Math.max(1, data.length - 1)) * width;
    const py = y + height - ((point[1] - min) / (max - min)) * height;
    return (index ? "L" : "M") + px.toFixed(1) + " " + Math.max(y, Math.min(y + height, py)).toFixed(1);
  }).join(" ");
}

function graphMode(metricId, settings) {
  const id = String(metricId || "");
  if (id === "game.fps") return "min";
  if (id === "game.frametime") return "max";
  return settings?.thresholdDirection === "below" ? "min" : "max";
}

function thresholdState(value, settings) {
  const current = finite(value);
  const threshold = finite(settings?.threshold);
  if (current === null || threshold === null) return false;
  return settings?.thresholdDirection === "below" ? current <= threshold : current >= threshold;
}

function sessionPage(summary, page) {
  if (!summary) return { label: "SESSION", value: "--", unit: "", secondary: "START A GAME" };
  const pages = [
    { label: "AVG FPS", value: summary.averageFps, unit: "FPS", secondary: summary.process || "SESSION" },
    { label: "1% LOW", value: summary.onePercentLow, unit: "FPS", secondary: "SESSION LOW" },
    { label: "0.1% LOW", value: summary.pointOnePercentLow, unit: "FPS", secondary: "SESSION LOW" },
    { label: "WORST FRAME", value: summary.worstFrametimeMs, unit: "ms", secondary: "SPIKE" },
    { label: "PEAK GPU", value: summary.peakGpuTemperature, unit: "°C", secondary: "TEMPERATURE" },
    { label: "PEAK CPU", value: summary.peakCpuTemperature, unit: "°C", secondary: "TEMPERATURE" },
    { label: "PEAK GPU", value: summary.peakGpuLoad, unit: "%", secondary: "LOAD" },
    { label: "SESSION", value: formatDuration(summary.durationMs), unit: "", secondary: summary.process || "" },
    { label: "PRESSURE", value: summary.pressure || "--", unit: "", secondary: "SIGNAL, NOT PROOF" },
  ];
  return pages[Math.max(0, Number(page) || 0) % pages.length];
}

export function makeView(telemetry, kind, settings = {}) {
  if (kind === "fps") {
    const fps = telemetry.metricValue("game.fps");
    const frametime = telemetry.metricValue("game.frametime");
    const session = telemetry.session.snapshot();
    const isFrame = settings.fpsMode === "frametime";
    const low = settings.lowMode === "pointOne" ? session.current?.pointOnePercentLow : session.current?.onePercentLow;
    return {
      label: session.process ? session.process.replace(/\.exe$/i, "") : "GAME FPS",
      value: isFrame ? frametime : fps,
      unit: isFrame ? "ms" : "FPS",
      secondary: session.active
        ? (settings.lowMode === "pointOne" ? "0.1% " : "1% ") + formatNumber(low, "FPS")
        : "START A GAME",
      points: telemetry.metricSeries(isFrame ? "game.frametime" : "game.fps", Number.isFinite(Number(settings.windowMs)) ? Number(settings.windowMs) : 60_000),
      state: telemetry.safeStatus().fps.state,
      mode: isFrame ? "max" : "min",
    };
  }

  if (kind === "session") {
    const snap = telemetry.session.snapshot();
    const summary = snap.current || snap.lastCompleted;
    return { ...sessionPage(summary, settings.summaryPage), points: [], state: summary ? "ready" : telemetry.safeStatus().fps.state };
  }

  const id = String(settings.metricId || (kind === "graph" || kind === "alert" ? "gpu.temperature" : "cpu.load"));
  telemetry.watchMetric(id);
  const descriptor = telemetry.metricDescriptor(id);
  const value = telemetry.metricValue(id);
  const unit = descriptor?.unit || "";
  const points = telemetry.metricSeries(id, Number.isFinite(Number(settings.windowMs)) ? Number(settings.windowMs) : 60_000);
  const breached = thresholdState(value, settings);

  if (kind === "alert") {
    return {
      label: labelFor(descriptor, id),
      value,
      unit,
      secondary: breached ? "ALERT" : "NORMAL",
      points,
      breached,
      state: value === null ? "unavailable" : "ready",
      mode: settings.thresholdDirection === "below" ? "min" : "max",
    };
  }

  if (kind === "metric") {
    return {
      label: labelFor(descriptor, id),
      value,
      unit,
      secondary: shortHardwareName(descriptor?.hardwareName) || descriptor?.source || "LOCAL",
      points: [],
      state: value === null ? "unavailable" : "ready",
    };
  }

  const windowLabel = Number(settings.windowMs) === 300_000 ? "5 MIN" :
    Number(settings.windowMs) === 900_000 ? "15 MIN" :
    Number(settings.windowMs) === 0 ? "SESSION" : "60 SEC";
  return {
    label: labelFor(descriptor, id),
    value,
    unit,
    secondary: windowLabel,
    points,
    breached,
    state: value === null ? "unavailable" : "ready",
    mode: graphMode(id, settings),
  };
}

export function renderKey(view, settings = {}, size = 144) {
  const s = Math.max(72, Number(size) || 144);
  const accent = view?.breached ? DANGER : /^#[0-9A-Fa-f]{6}$/.test(String(settings.accent || "")) ? String(settings.accent) : ACCENT;
  const state = String(view?.state || "ready");
  const unavailable = ["unavailable", "offline", "permission_required"].includes(state) && finite(view?.value) === null && !String(view?.value || "").length;
  const top = xml(compactText(String(view?.label || "PERFORMANCE").toUpperCase(), 17));
  const unit = String(view?.unit || "");
  let valueText = typeof view?.value === "string" ? view.value : formatNumber(view?.value, unit);
  if (unavailable) valueText = state === "permission_required" ? "SETUP" : "--";
  const secondary = compactText(
    unavailable
      ? (state === "permission_required" ? "ENABLE FPS" : "NO DATA")
      : String(view?.secondary || ""),
    22,
  );

  const graphX = s * 0.12;
  const graphY = s * 0.69;
  const graphW = s * 0.76;
  const graphH = s * 0.19;
  const path = pathFor(view?.points || [], graphX, graphY, graphW, graphH, settings.scaleMin, settings.scaleMax, view?.mode || "max");
  const labelSize = fittedFontSize(top, s * 0.105, 11, 0.72);
  const valueSize = valueText.length > 9 ? s * 0.19 : valueText.length > 6 ? s * 0.23 : s * 0.30;
  const secondarySize = fittedFontSize(secondary, s * 0.085, 14, 0.68);
  const unitText = unit && valueText !== "--" ? " " + unit : "";
  const statusColor = unavailable ? WARNING : accent;

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">',
    '<defs><clipPath id="topText"><rect x="' + (s * 0.12) + '" y="' + (s * 0.02) + '" width="' + (s * 0.80) + '" height="' + (s * 0.14) + '"/></clipPath><clipPath id="bottomText"><rect x="' + (s * 0.07) + '" y="' + (s * 0.88) + '" width="' + (s * 0.86) + '" height="' + (s * 0.11) + '"/></clipPath></defs>',
    '<rect width="' + s + '" height="' + s + '" rx="' + (s * 0.16) + '" fill="' + BG + '"/>',
    '<rect x="' + (s * 0.075) + '" y="' + (s * 0.075) + '" width="' + (s * 0.035) + '" height="' + (s * 0.035) + '" rx="' + (s * 0.018) + '" fill="' + statusColor + '"/>',
    '<text clip-path="url(#topText)" x="' + (s * 0.13) + '" y="' + (s * 0.12) + '" fill="' + MUTED + '" font-family="Segoe UI,Arial,sans-serif" font-size="' + labelSize + '" font-weight="700">' + top + '</text>',
    '<text x="' + (s * 0.50) + '" y="' + (s * 0.53) + '" text-anchor="middle" fill="' + TEXT + '" font-family="Segoe UI,Arial,sans-serif" font-size="' + valueSize + '" font-weight="750">' + xml(valueText) + '<tspan fill="' + MUTED + '" font-size="' + (valueSize * 0.38) + '">' + xml(unitText) + '</tspan></text>',
  ];
  if (path) {
    svg.push('<path d="' + path + '" fill="none" stroke="' + accent + '" stroke-width="' + Math.max(1.8, s * 0.018) + '" stroke-linecap="round" stroke-linejoin="round"/>');
    svg.push('<line x1="' + graphX + '" y1="' + (graphY + graphH) + '" x2="' + (graphX + graphW) + '" y2="' + (graphY + graphH) + '" stroke="#27303A" stroke-width="1"/>');
  }
  svg.push('<text clip-path="url(#bottomText)" x="' + (s * 0.5) + '" y="' + (s * 0.955) + '" text-anchor="middle" fill="' + (view?.breached ? DANGER : MUTED) + '" font-family="Segoe UI,Arial,sans-serif" font-size="' + secondarySize + '" font-weight="700">' + xml(secondary.toUpperCase()) + '</text>');
  svg.push("</svg>");
  return "data:image/svg+xml;charset=utf8," + encodeURIComponent(svg.join(""));
}
