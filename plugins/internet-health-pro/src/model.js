export const DEFAULT_GLOBAL_SETTINGS = Object.freeze({
  intervalSeconds: 10,
  diagnosticSeconds: 30,
  httpSeconds: 60,
  targetSeconds: 30,
  historyHours: 24,
  primaryIcmpTarget: "1.1.1.1",
  secondaryIcmpTarget: "8.8.8.8"
});

export const DEFAULT_ACTION_SETTINGS = Object.freeze({
  historyWindow: 30,
  latencyWarn: 80,
  latencyBad: 150,
  jitterWarn: 15,
  jitterBad: 30,
  lossWarn: 3,
  lossBad: 10,
  metric: "jitter",
  outageMode: "uptime",
  target: "1.1.1.1",
  targetMethod: "auto",
  targetPort: 443,
  family: "auto",
  expectedDownloadMbps: 0,
  expectedUploadMbps: 0,
  lowSpeedPercent: 70,
  accent: "#2BE86A"
});

export function clamp(value, min, max, fallback = min) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizeAccent(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(text) ? text : DEFAULT_ACTION_SETTINGS.accent;
}

export function normalizeGlobalSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    intervalSeconds: clamp(source.intervalSeconds, 5, 60, DEFAULT_GLOBAL_SETTINGS.intervalSeconds),
    diagnosticSeconds: clamp(source.diagnosticSeconds, 15, 120, DEFAULT_GLOBAL_SETTINGS.diagnosticSeconds),
    httpSeconds: clamp(source.httpSeconds, 30, 300, DEFAULT_GLOBAL_SETTINGS.httpSeconds),
    targetSeconds: clamp(source.targetSeconds, 15, 300, DEFAULT_GLOBAL_SETTINGS.targetSeconds),
    historyHours: clamp(source.historyHours, 2, 24, DEFAULT_GLOBAL_SETTINGS.historyHours),
    primaryIcmpTarget: String(source.primaryIcmpTarget || DEFAULT_GLOBAL_SETTINGS.primaryIcmpTarget).trim(),
    secondaryIcmpTarget: String(source.secondaryIcmpTarget || DEFAULT_GLOBAL_SETTINGS.secondaryIcmpTarget).trim()
  };
}

export function normalizeActionSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const historyWindow = [5, 30, 120].includes(Number(source.historyWindow)) ? Number(source.historyWindow) : DEFAULT_ACTION_SETTINGS.historyWindow;
  const latencyWarn = clamp(source.latencyWarn, 10, 1000, DEFAULT_ACTION_SETTINGS.latencyWarn);
  const latencyBad = Math.max(latencyWarn, clamp(source.latencyBad, 20, 2000, DEFAULT_ACTION_SETTINGS.latencyBad));
  const jitterWarn = clamp(source.jitterWarn, 1, 500, DEFAULT_ACTION_SETTINGS.jitterWarn);
  const jitterBad = Math.max(jitterWarn, clamp(source.jitterBad, 2, 1000, DEFAULT_ACTION_SETTINGS.jitterBad));
  const lossWarn = clamp(source.lossWarn, 0, 100, DEFAULT_ACTION_SETTINGS.lossWarn);
  const lossBad = Math.max(lossWarn, clamp(source.lossBad, 0, 100, DEFAULT_ACTION_SETTINGS.lossBad));
  return {
    historyWindow,
    latencyWarn,
    latencyBad,
    jitterWarn,
    jitterBad,
    lossWarn,
    lossBad,
    metric: source.metric === "loss" ? "loss" : "jitter",
    outageMode: ["uptime", "last", "count", "current"].includes(source.outageMode) ? source.outageMode : DEFAULT_ACTION_SETTINGS.outageMode,
    target: String(source.target || DEFAULT_ACTION_SETTINGS.target).trim(),
    targetMethod: ["auto", "icmp", "tcp", "dns", "https"].includes(source.targetMethod) ? source.targetMethod : "auto",
    targetPort: Math.round(clamp(source.targetPort, 1, 65535, DEFAULT_ACTION_SETTINGS.targetPort)),
    family: ["auto", "ipv4", "ipv6"].includes(source.family) ? source.family : "auto",
    expectedDownloadMbps: clamp(source.expectedDownloadMbps, 0, 100000, 0),
    expectedUploadMbps: clamp(source.expectedUploadMbps, 0, 100000, 0),
    lowSpeedPercent: clamp(source.lowSpeedPercent, 10, 100, 70),
    accent: normalizeAccent(source.accent)
  };
}

export function windowedSamples(samples = [], minutes = 30, now = Date.now()) {
  const cutoff = Number(now) - Math.max(1, Number(minutes) || 30) * 60_000;
  return (Array.isArray(samples) ? samples : [])
    .filter((sample) => sample && Number(sample.t) >= cutoff)
    .sort((a, b) => Number(a.t) - Number(b.t));
}

export function computeMetrics(samples = [], minutes = 30, now = Date.now()) {
  const list = windowedSamples(samples, minutes, now).filter((sample) => sample.observed !== false && sample.gap !== true);
  let attempts = 0;
  let failures = 0;
  let adjacentTotal = 0;
  let adjacentPairs = 0;
  let previousSuccess = null;
  let previousMethod = null;

  for (const sample of list) {
    if (sample.lossCounted === true) {
      attempts += 1;
      if (sample.lossOk !== true) failures += 1;
    } else if (sample.lossCounted !== false && sample.counted !== false) {
      attempts += 1;
      if (sample.ok !== true) failures += 1;
    }

    if (sample.ok !== true) {
      previousSuccess = null;
      previousMethod = null;
      continue;
    }
    const ms = Number(sample.ms);
    const method = String(sample.method || "");
    if (Number.isFinite(ms) && previousSuccess !== null && method === previousMethod) {
      adjacentTotal += Math.abs(ms - previousSuccess);
      adjacentPairs += 1;
    }
    previousSuccess = Number.isFinite(ms) ? ms : null;
    previousMethod = method;
  }

  const latest = list.length ? list[list.length - 1] : null;
  const successful = [...list].reverse().find((sample) => sample && sample.ok === true && Number.isFinite(Number(sample.ms)));
  return {
    attempts,
    failures,
    loss: attempts ? failures / attempts * 100 : null,
    jitter: adjacentPairs ? adjacentTotal / adjacentPairs : null,
    current: latest?.ok === true && Number.isFinite(Number(latest.ms)) ? Number(latest.ms) : null,
    lastGood: successful ? Number(successful.ms) : null,
    latestFailed: Boolean(latest && latest.ok !== true),
    method: latest?.method || successful?.method || null,
    adjacentPairs
  };
}

function thresholdBand(value, warn, bad) {
  if (!Number.isFinite(Number(value))) return 0;
  if (Number(value) >= Number(bad)) return 2;
  if (Number(value) >= Number(warn)) return 1;
  return 0;
}

export function classifyHealth(connectivity = {}, metrics = {}, settings = {}) {
  const cfg = normalizeActionSettings(settings);
  if (connectivity.status === "offline") return { state: "OFFLINE", reason: "INTERNET OFFLINE", severity: 3 };
  if (connectivity.status === "dns-failure") return { state: "BAD", reason: "DNS FAILURE", severity: 2 };
  if (connectivity.status === "suspected-offline") return { state: "DEGRADED", reason: "CHECKING CONNECTION", severity: 1 };

  const latency = thresholdBand(metrics.current ?? metrics.lastGood, cfg.latencyWarn, cfg.latencyBad);
  const jitter = thresholdBand(metrics.jitter, cfg.jitterWarn, cfg.jitterBad);
  const loss = thresholdBand(metrics.loss, cfg.lossWarn, cfg.lossBad);
  const worst = Math.max(latency, jitter, loss);

  if (worst >= 2) {
    const reason = loss >= 2 ? "HIGH PROBE LOSS" : jitter >= 2 ? "HIGH JITTER" : "HIGH LATENCY";
    return { state: "BAD", reason, severity: 2 };
  }
  if (worst === 1 || connectivity.status === "degraded") {
    const reason = loss === 1 ? "PROBE LOSS" : jitter === 1 ? "HIGH JITTER" : latency === 1 ? "HIGH LATENCY" : "DEGRADED";
    return { state: "DEGRADED", reason, severity: 1 };
  }
  if (connectivity.status === "online") return { state: "GOOD", reason: "CONNECTION HEALTHY", severity: 0 };
  return { state: "DEGRADED", reason: "WAITING FOR DATA", severity: 1 };
}

export function outageSummary(outages = [], now = Date.now(), onlineSince = null) {
  const list = Array.isArray(outages) ? outages : [];
  const current = [...list].reverse().find((item) => item && !item.end) || null;
  const completed = list.filter((item) => item && item.end);
  const last = completed.length ? completed[completed.length - 1] : null;
  const dayAgo = Number(now) - 24 * 60 * 60 * 1000;
  const count24h = list.filter((item) => item && Number(item.start) >= dayAgo).length;
  return {
    current,
    last,
    count24h,
    currentDurationMs: current ? Math.max(0, Number(now) - Number(current.start)) : 0,
    uptimeMs: current ? 0 : onlineSince ? Math.max(0, Number(now) - Number(onlineSince)) : null
  };
}

export function formatDuration(ms, compact = true) {
  if (!Number.isFinite(Number(ms)) || Number(ms) < 0) return "--";
  const seconds = Math.floor(Number(ms) / 1000);
  if (seconds < 60) return compact ? seconds + "s" : seconds + " sec";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return compact ? minutes + "m" : minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return compact ? hours + "h" : hours + " hr";
  const days = Math.floor(hours / 24);
  return compact ? days + "d" : days + " days";
}

export function targetKind(target, method = "auto") {
  if (method !== "auto") return method;
  try {
    const url = new URL(String(target || ""));
    if (url.protocol === "https:" || url.protocol === "http:") return "https";
  } catch {}
  return "icmp";
}
