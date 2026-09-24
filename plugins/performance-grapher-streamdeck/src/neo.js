const OVERVIEW_LAYOUT = "layouts/neo-overview.json";
const METRIC_LAYOUT = "layouts/neo-metric.json";
const REFRESH_INTERVALS = new Set([1000, 2000, 5000]);
const ROTATION_INTERVALS = new Set([3000, 5000, 10000]);

const SHORT_LABELS = new Map([
  ["cpu.load", "CPU"],
  ["ram.load", "RAM"],
  ["cpu.temperature", "CPU TEMP"],
  ["gpu.temperature", "GPU TEMP"],
  ["gpu.fan", "GPU FAN"],
  ["gpu.load", "GPU"],
  ["gpu.power", "GPU POWER"],
  ["cpu.power", "CPU POWER"],
  ["game.fps", "GAME FPS"],
  ["game.frametime", "FRAMETIME"],
]);

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanSetting(value, fallback) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

function compactNumber(value) {
  const number = finite(value);
  if (number === null) return "--";
  const abs = Math.abs(number);
  if (abs >= 100) return String(Math.round(number));
  if (abs >= 10) return number.toFixed(1).replace(/\.0$/, "");
  return number.toFixed(1).replace(/\.0$/, "");
}

function compactUnit(unit) {
  const raw = String(unit || "").trim();
  if (!raw) return "";
  if (/^(?:°?c|celsius)$/i.test(raw)) return "°C";
  if (/^fps$/i.test(raw)) return " FPS";
  if (/^ms$/i.test(raw)) return "ms";
  if (/^rpm$/i.test(raw)) return " RPM";
  if (/^w$/i.test(raw)) return "W";
  if (/^%$/.test(raw)) return "%";
  return " " + raw;
}

function metricValueText(telemetry, id) {
  const descriptor = telemetry.metricDescriptor(id);
  const value = telemetry.metricValue(id);
  if (finite(value) === null) return "--";
  return compactNumber(value) + compactUnit(descriptor?.unit);
}

function compactLabel(telemetry, id) {
  if (SHORT_LABELS.has(id)) return SHORT_LABELS.get(id);
  const descriptor = telemetry.metricDescriptor(id);
  const name = String(descriptor?.name || id || "METRIC").trim().toUpperCase();
  return name.length > 16 ? name.slice(0, 15) + "…" : name;
}

function companionMetric(id) {
  if (id === "gpu.load") return "gpu.temperature";
  if (id === "gpu.temperature") return "gpu.load";
  if (id === "cpu.load") return "cpu.temperature";
  if (id === "cpu.temperature") return "cpu.load";
  if (id === "game.fps") return "game.frametime";
  if (id === "game.frametime") return "game.fps";
  if (id === "ram.load") return "cpu.load";
  return null;
}

function fallbackSecondary(telemetry, id) {
  const companion = companionMetric(id);
  if (companion && finite(telemetry.metricValue(companion)) !== null) {
    return compactLabel(telemetry, companion) + " " + metricValueText(telemetry, companion);
  }
  const descriptor = telemetry.metricDescriptor(id);
  const source = String(descriptor?.hardwareName || descriptor?.source || "").replace(/\s+/g, " ").trim();
  if (!source) return "";
  return source.length > 18 ? source.slice(0, 17) + "…" : source;
}

function sparklineSvg(points, accent = "#FFB21E", width = 116, height = 27) {
  const clean = (Array.isArray(points) ? points : [])
    .map((point) => [finite(point?.[0]), finite(point?.[1])])
    .filter(([at, value]) => at !== null && value !== null);
  if (clean.length < 2) return "";

  const minAt = clean[0][0];
  const maxAt = clean[clean.length - 1][0];
  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const [, value] of clean) {
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
  }
  const timeSpan = Math.max(1, maxAt - minAt);
  const valueSpan = Math.max(0.0001, maxValue - minValue);
  const pad = 2;
  const drawW = width - pad * 2;
  const drawH = height - pad * 2;
  const d = clean.map(([at, value], index) => {
    const x = pad + ((at - minAt) / timeSpan) * drawW;
    const y = pad + (1 - (value - minValue) / valueSpan) * drawH;
    return (index ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }).join(" ");
  const color = /^#[0-9A-Fa-f]{6}$/.test(String(accent || "")) ? String(accent) : "#FFB21E";
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + " " + height + '"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

export function normalizeNeoSettings(source = {}) {
  const mode = ["overview", "single", "rotate"].includes(String(source.neoMode)) ? String(source.neoMode) : "overview";
  const refresh = Number(source.neoRefreshMs);
  const rotation = Number(source.neoRotationMs);
  return {
    neoMode: mode,
    neoMetric2: String(source.neoMetric2 || "cpu.load"),
    neoMetric3: String(source.neoMetric3 || "ram.load"),
    neoRefreshMs: REFRESH_INTERVALS.has(refresh) ? refresh : 1000,
    neoRotationMs: ROTATION_INTERVALS.has(rotation) ? rotation : 5000,
    neoShowLabels: booleanSetting(source.neoShowLabels, true),
    neoShowHistory: booleanSetting(source.neoShowHistory, true),
  };
}

export function neoLayoutFor(settings = {}) {
  return settings.neoMode === "overview" ? OVERVIEW_LAYOUT : METRIC_LAYOUT;
}

export function neoMetricIds(settings = {}) {
  const values = [
    String(settings.metricId || "gpu.load"),
    String(settings.neoMetric2 || "cpu.load"),
    String(settings.neoMetric3 || "ram.load"),
  ].filter(Boolean);
  return [...new Set(values)];
}

export function makeNeoOverviewFeedback(telemetry, settings = {}) {
  const labels = settings.neoShowLabels !== false;
  return {
    cpuLabel: labels ? "CPU" : "",
    cpuValue: metricValueText(telemetry, "cpu.load"),
    gpuLabel: labels ? "GPU" : "",
    gpuValue: metricValueText(telemetry, "gpu.load"),
    ramLabel: labels ? "RAM" : "",
    ramValue: metricValueText(telemetry, "ram.load"),
  };
}

export function makeNeoMetricFeedback(telemetry, settings = {}, metricId = null) {
  const id = String(metricId || settings.metricId || "gpu.load");
  const points = settings.neoShowHistory === false ? [] : telemetry.metricSeries(id, 60_000);
  return {
    label: settings.neoShowLabels === false ? "" : compactLabel(telemetry, id),
    value: metricValueText(telemetry, id),
    secondary: fallbackSecondary(telemetry, id),
    sparkline: sparklineSvg(points, settings.accent),
  };
}

export function makeNeoFeedback(telemetry, settings = {}, metricId = null) {
  return settings.neoMode === "overview"
    ? makeNeoOverviewFeedback(telemetry, settings)
    : makeNeoMetricFeedback(telemetry, settings, metricId);
}
