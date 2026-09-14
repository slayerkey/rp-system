import { classifyHealth, computeMetrics, formatDuration, normalizeActionSettings, outageSummary } from "./model.js";

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[char]));
}

function dataUri(svg) {
  return "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");
}

function stateColor(state, accent) {
  if (state === "GOOD" || state === "UP") return accent;
  if (state === "DEGRADED" || state === "CHECK") return "#FFB34D";
  if (state === "BAD" || state === "OFFLINE" || state === "DOWN") return "#FF5D6C";
  return "#8B93A1";
}

function metricState(value, warn, bad, connectivityStatus) {
  if (connectivityStatus === "offline") return "OFFLINE";
  if (!Number.isFinite(Number(value))) return connectivityStatus === "online" ? "CHECK" : "DEGRADED";
  if (Number(value) >= Number(bad)) return "BAD";
  if (Number(value) >= Number(warn)) return "DEGRADED";
  return "GOOD";
}

const KEY_GRAPH_SECONDS = 30;

function graphPath(samples, seconds = KEY_GRAPH_SECONDS, width = 116, height = 32, x = 14, y = 94) {
  const now = Date.now();
  const windowMs = seconds * 1000;
  const cutoff = now - windowMs;
  const list = (samples || []).filter((sample) =>
    sample && sample.ok === true && Number(sample.t) >= cutoff && Number.isFinite(Number(sample.ms))
  );
  if (list.length < 2) return "";
  const values = list.map((sample) => Number(sample.ms));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 5) {
    min -= 2.5;
    max += 2.5;
  }
  return list.map((sample, index) => {
    const px = x + ((Number(sample.t) - cutoff) / windowMs) * width;
    const py = y + height - ((Number(sample.ms) - min) / (max - min)) * height;
    return (index ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
  }).join(" ");
}

function fitFont(value, large, medium, small) {
  const length = String(value || "").length;
  if (length <= 8) return large;
  if (length <= 13) return medium;
  return small;
}

function baseSvg({ label, primary, secondary = "", status = "CHECK", accent = "#2BE86A", samples = [], minutes = 30, footer = "" }) {
  const color = stateColor(status, accent);
  const hasFooter = Boolean(String(footer || "").trim());
  const path = graphPath(samples, KEY_GRAPH_SECONDS, 116, hasFooter ? 29 : 40, 14, 94);
  const primarySize = fitFont(primary, 38, 32, 25);
  const secondarySize = fitFont(secondary, 16, 14.5, 13);
  const footerSize = fitFont(footer, 12.5, 11.5, 10.5);
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="#07090D"/>
    <rect x="0" y="0" width="5" height="144" rx="2.5" fill="${color}"/>
    <text x="14" y="23" fill="#C9CED6" font-family="Arial,sans-serif" font-size="16.5" font-weight="800" letter-spacing=".15">${escapeXml(label)}</text>
    <text x="14" y="61" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="${primarySize}" font-weight="800">${escapeXml(primary)}</text>
    <text x="14" y="84" fill="${color}" font-family="Arial,sans-serif" font-size="${secondarySize}" font-weight="800">${escapeXml(secondary)}</text>
    <line x1="14" y1="91" x2="130" y2="91" stroke="#252A32" stroke-width="1"/>
    ${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${hasFooter ? `<text x="14" y="139" fill="#AAB1BC" font-family="Arial,sans-serif" font-size="${footerSize}" font-weight="700">${escapeXml(footer)}</text>` : ""}
  </svg>`);
}

function outageSvg(primary, secondary, state, accent, samples = []) {
  const color = stateColor(state, accent);
  const primarySize = fitFont(primary, 34, 30, 26);
  const secondarySize = fitFont(secondary, 14, 12.5, 11);
  const path = graphPath(samples, KEY_GRAPH_SECONDS, 116, 40, 14, 94);
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="#07090D"/>
    <rect x="0" y="0" width="5" height="144" rx="2.5" fill="${color}"/>
    <text x="14" y="23" fill="#C9CED6" font-family="Arial,sans-serif" font-size="15.5" font-weight="800">OUTAGE</text>
    <text x="14" y="61" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="${primarySize}" font-weight="800">${escapeXml(primary)}</text>
    <text x="14" y="84" fill="${color}" font-family="Arial,sans-serif" font-size="${secondarySize}" font-weight="800">${escapeXml(secondary)}</text>
    <line x1="14" y1="91" x2="130" y2="91" stroke="#252A32" stroke-width="1"/>
    ${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
  </svg>`);
}

function speedResultSvg(speed, settings, low) {
  const color = low ? "#FF5D6C" : settings.accent;
  const down = "↓" + Math.round(Number(speed.downloadMbps) || 0);
  const up = "↑" + Math.round(Number(speed.uploadMbps) || 0);
  const downSize = fitFont(down, 36, 33, 29);
  const upSize = fitFont(up, 36, 33, 29);
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="#07090D"/>
    <rect x="0" y="0" width="5" height="144" rx="2.5" fill="${color}"/>
    <text x="14" y="22" fill="#C9CED6" font-family="Arial,sans-serif" font-size="16.5" font-weight="800">SPEED</text>
    ${low ? `<text x="128" y="22" text-anchor="end" fill="#FF5D6C" font-family="Arial,sans-serif" font-size="13" font-weight="800">LOW</text>` : ""}
    <text x="14" y="61" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="${downSize}" font-weight="800">${escapeXml(down)}</text>
    <text x="14" y="103" fill="${color}" font-family="Arial,sans-serif" font-size="${upSize}" font-weight="800">${escapeXml(up)}</text>
    <text x="14" y="132" fill="#AAB1BC" font-family="Arial,sans-serif" font-size="14" font-weight="700">Mbps</text>
  </svg>`);
}

function metricForWindow(snapshot, minutes) {
  if (minutes === 5) return snapshot.metrics5 || computeMetrics(snapshot.samples, 5);
  if (minutes === 120) return snapshot.metrics120 || computeMetrics(snapshot.samples, 120);
  return snapshot.metrics30 || computeMetrics(snapshot.samples, 30);
}

function methodLabel(method) {
  if (method === "icmp") return "ICMP";
  if (method === "tcp") return "TCP CONNECT";
  if (method === "dns") return "DNS LOOKUP";
  if (method === "https") return "HTTPS RESPONSE";
  return "WAITING";
}

export function renderKey(kind, snapshot = {}, rawSettings = {}, target = null) {
  const settings = normalizeActionSettings(rawSettings);
  const metrics = metricForWindow(snapshot, settings.historyWindow);
  const health = classifyHealth(snapshot.connectivity || {}, metrics, settings);
  const minutes = settings.historyWindow;
  const footer = minutes + " MIN";

  if (kind === "health") {
    const latency = Number.isFinite(metrics.current) ? Math.round(metrics.current) + " ms" : health.state === "OFFLINE" ? "NO CONNECTION" : "-- ms";
    return baseSvg({
      label: "INTERNET",
      primary: health.state,
      secondary: latency,
      status: health.state,
      accent: settings.accent,
      samples: snapshot.samples,
      minutes,
      footer: ""
    });
  }

  if (kind === "latency") {
    const latencyValue = metrics.current ?? metrics.lastGood;
    const latencyState = metricState(latencyValue, settings.latencyWarn, settings.latencyBad, snapshot.connectivity?.status);
    return baseSvg({
      label: "LATENCY",
      primary: Number.isFinite(metrics.current) ? Math.round(metrics.current) + " ms" : "-- ms",
      secondary: methodLabel(metrics.method),
      status: latencyState,
      accent: settings.accent,
      samples: snapshot.samples,
      minutes,
      footer: ""
    });
  }

  if (kind === "jitter-loss") {
    const useLoss = settings.metric === "loss";
    const primary = useLoss
      ? (Number.isFinite(metrics.loss) ? metrics.loss.toFixed(1) + "%" : "--%")
      : (Number.isFinite(metrics.jitter) ? metrics.jitter.toFixed(1) + " ms" : "-- ms");
    const metricValue = useLoss ? metrics.loss : metrics.jitter;
    const selectedState = useLoss
      ? metricState(metricValue, settings.lossWarn, settings.lossBad, snapshot.connectivity?.status)
      : metricState(metricValue, settings.jitterWarn, settings.jitterBad, snapshot.connectivity?.status);
    return baseSvg({
      label: useLoss ? "PROBE LOSS" : "JITTER",
      primary,
      secondary: useLoss ? metrics.attempts + " PROBES" : metrics.adjacentPairs + " PAIRS",
      status: selectedState,
      accent: settings.accent,
      samples: snapshot.samples,
      minutes,
      footer: ""
    });
  }

  if (kind === "outage") {
    const summary = outageSummary(snapshot.outages, Date.now(), snapshot.onlineSince);
    let primary = "UP " + formatDuration(summary.uptimeMs);
    let secondary = summary.count24h + " / 24H";
    let state = "UP";
    if (summary.current) {
      primary = "DOWN " + formatDuration(summary.currentDurationMs);
      secondary = "ACTIVE";
      state = "DOWN";
    } else if (settings.outageMode === "last") {
      primary = summary.last ? formatDuration(summary.last.durationMs) : "NONE";
      secondary = summary.last ? "LAST OUTAGE" : "NONE";
    } else if (settings.outageMode === "count") {
      primary = String(summary.count24h);
      secondary = "LAST 24H";
    } else if (settings.outageMode === "current") {
      primary = "ONLINE";
      secondary = "NONE";
    }
    return outageSvg(primary, secondary, state, settings.accent, snapshot.samples);
  }

  if (kind === "target") {
    const reading = target?.reading || null;
    const targetMetrics = computeMetrics(target?.history || [], 120);
    const state = !reading ? "CHECK" : reading.ok ? "UP" : "DOWN";
    const timing = reading?.ok && Number.isFinite(Number(reading.ms)) ? Math.round(reading.ms) + " ms" : state === "DOWN" ? "UNREACHABLE" : "WAITING";
    const host = String(target?.target || settings.target || "TARGET").replace(/^https?:\/\//i, "").split("/")[0].slice(0, 20);
    return baseSvg({
      label: "TARGET",
      primary: state,
      secondary: timing + " • " + methodLabel(reading?.method || targetMetrics.method || target?.expectedMethod || target?.configuredMethod),
      status: state,
      accent: settings.accent,
      samples: target?.history || [],
      minutes: 120,
      footer: host
    });
  }

  if (kind === "speed-test") {
    const speed = snapshot.latestSpeed;
    if (snapshot.speedRunning) {
      return baseSvg({
        label: "SPEED",
        primary: "TESTING",
        secondary: "PLEASE WAIT",
        status: "CHECK",
        accent: settings.accent,
        footer: "MANUAL TEST"
      });
    }
    if (speed?.ok) {
      const factor = settings.lowSpeedPercent / 100;
      const lowDownload = settings.expectedDownloadMbps > 0 && Number(speed.downloadMbps) < settings.expectedDownloadMbps * factor;
      const lowUpload = settings.expectedUploadMbps > 0 && Number(speed.uploadMbps) < settings.expectedUploadMbps * factor;
      const low = lowDownload || lowUpload;
      return speedResultSvg(speed, settings, low);
    }
    return baseSvg({
      label: "SPEED",
      primary: "PRESS",
      secondary: "RUN TEST",
      status: "CHECK",
      accent: settings.accent,
      footer: "MANUAL • Mbps"
    });
  }

  const summary = outageSummary(snapshot.outages, Date.now(), snapshot.onlineSince);
  const color = stateColor(health.state, settings.accent);
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="#07090D"/>
    <rect x="0" y="0" width="4" height="144" rx="2" fill="${color}"/>
    <text x="14" y="23" fill="#C9CED6" font-family="Arial,sans-serif" font-size="16.5" font-weight="800">SUMMARY</text>
    <text x="14" y="52" fill="${color}" font-family="Arial,sans-serif" font-size="27" font-weight="800">${escapeXml(health.state)}</text>
    <text x="14" y="76" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="15.5" font-weight="700">LAT ${Number.isFinite(metrics.current) ? Math.round(metrics.current) + " ms" : "--"}</text>
    <text x="14" y="97" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="15.5" font-weight="700">JIT ${Number.isFinite(metrics.jitter) ? metrics.jitter.toFixed(1) + " ms" : "--"}</text>
    <text x="14" y="118" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="15.5" font-weight="700">LOSS ${Number.isFinite(metrics.loss) ? metrics.loss.toFixed(1) + "%" : "--"}</text>
    <text x="14" y="139" fill="#F7F8FA" font-family="Arial,sans-serif" font-size="15.5" font-weight="700">${summary.current ? "DOWN " + formatDuration(summary.currentDurationMs) : "UP " + formatDuration(summary.uptimeMs)}</text>
  </svg>`);
}
