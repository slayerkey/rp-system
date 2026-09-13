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

function graphPath(samples, minutes = 30, width = 116, height = 29, x = 14, y = 92) {
  const now = Date.now();
  const cutoff = now - minutes * 60_000;
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
    const px = x + ((Number(sample.t) - cutoff) / (minutes * 60_000)) * width;
    const py = y + height - ((Number(sample.ms) - min) / (max - min)) * height;
    return (index ? "L" : "M") + px.toFixed(1) + " " + py.toFixed(1);
  }).join(" ");
}

function baseSvg({ label, primary, secondary = "", status = "CHECK", accent = "#2BE86A", samples = [], minutes = 30, footer = "" }) {
  const color = stateColor(status, accent);
  const path = graphPath(samples, minutes);
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="#07090D"/>
    <rect x="0" y="0" width="4" height="144" rx="2" fill="${color}"/>
    <text x="14" y="23" fill="#AEB4BF" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing=".7">${escapeXml(label)}</text>
    <text x="14" y="58" fill="#F4F6F8" font-family="Arial,sans-serif" font-size="26" font-weight="800">${escapeXml(primary)}</text>
    <text x="14" y="78" fill="${color}" font-family="Arial,sans-serif" font-size="10.5" font-weight="700">${escapeXml(secondary)}</text>
    <line x1="14" y1="92" x2="130" y2="92" stroke="#20242B" stroke-width="1"/>
    ${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    <text x="14" y="134" fill="#747B87" font-family="Arial,sans-serif" font-size="9">${escapeXml(footer)}</text>
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
  const footer = minutes + " MIN HISTORY";

  if (kind === "health") {
    const latency = Number.isFinite(metrics.current) ? Math.round(metrics.current) + " ms" : health.state === "OFFLINE" ? "NO CONNECTION" : "-- ms";
    return baseSvg({
      label: "INTERNET HEALTH",
      primary: health.state,
      secondary: latency,
      status: health.state,
      accent: settings.accent,
      samples: snapshot.samples,
      minutes,
      footer: health.reason
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
      footer
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
      secondary: useLoss ? metrics.attempts + " OBSERVED PROBES" : metrics.adjacentPairs + " VALID PAIRS",
      status: selectedState,
      accent: settings.accent,
      samples: snapshot.samples,
      minutes,
      footer
    });
  }

  if (kind === "outage") {
    const summary = outageSummary(snapshot.outages, Date.now(), snapshot.onlineSince);
    let primary = "UP " + formatDuration(summary.uptimeMs);
    let secondary = summary.count24h + " OUTAGES / 24H";
    let state = "UP";
    if (summary.current) {
      primary = "DOWN " + formatDuration(summary.currentDurationMs);
      secondary = "OUTAGE IN PROGRESS";
      state = "DOWN";
    } else if (settings.outageMode === "last") {
      primary = summary.last ? formatDuration(summary.last.durationMs) : "NONE";
      secondary = summary.last ? "LAST OUTAGE" : "NO RECORDED OUTAGE";
    } else if (settings.outageMode === "count") {
      primary = String(summary.count24h);
      secondary = "OUTAGES / 24H";
    } else if (settings.outageMode === "current") {
      primary = "ONLINE";
      secondary = "NO CURRENT OUTAGE";
    }
    return baseSvg({
      label: "OUTAGE",
      primary,
      secondary,
      status: state,
      accent: settings.accent,
      samples: snapshot.samples,
      minutes,
      footer: "LOCAL HISTORY"
    });
  }

  if (kind === "target") {
    const reading = target?.reading || null;
    const targetMetrics = computeMetrics(target?.history || [], 120);
    const state = !reading ? "CHECK" : reading.ok ? "UP" : "DOWN";
    const timing = reading?.ok && Number.isFinite(Number(reading.ms)) ? Math.round(reading.ms) + " ms" : state === "DOWN" ? "UNREACHABLE" : "WAITING";
    const host = String(target?.target || settings.target || "TARGET").replace(/^https?:\/\//i, "").split("/")[0].slice(0, 20);
    return baseSvg({
      label: "TARGET HEALTH",
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
        label: "SPEED TEST",
        primary: "TESTING",
        secondary: "MANUAL TEST RUNNING",
        status: "CHECK",
        accent: settings.accent,
        footer: "MAX ~10 MB"
      });
    }
    if (speed?.ok) {
      const factor = settings.lowSpeedPercent / 100;
      const lowDownload = settings.expectedDownloadMbps > 0 && Number(speed.downloadMbps) < settings.expectedDownloadMbps * factor;
      const lowUpload = settings.expectedUploadMbps > 0 && Number(speed.uploadMbps) < settings.expectedUploadMbps * factor;
      const low = lowDownload || lowUpload;
      return baseSvg({
        label: "SPEED TEST",
        primary: low ? "LOW" : "↓ " + Math.round(speed.downloadMbps),
        secondary: "↓ " + Math.round(speed.downloadMbps) + "  ↑ " + Math.round(speed.uploadMbps) + " Mbps",
        status: low ? "BAD" : "GOOD",
        accent: settings.accent,
        footer: (settings.expectedDownloadMbps > 0 || settings.expectedUploadMbps > 0)
          ? (low ? "BELOW " + settings.lowSpeedPercent + "% EXPECTED" : "WITHIN EXPECTED RANGE")
          : "PRESS TO RETEST"
      });
    }
    return baseSvg({
      label: "SPEED TEST",
      primary: "PRESS",
      secondary: "RUN MANUAL TEST",
      status: "CHECK",
      accent: settings.accent,
      footer: "MAX ~10 MB"
    });
  }

  const summary = outageSummary(snapshot.outages, Date.now(), snapshot.onlineSince);
  const color = stateColor(health.state, settings.accent);
  return dataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
    <rect width="144" height="144" rx="18" fill="#07090D"/>
    <rect x="0" y="0" width="4" height="144" rx="2" fill="${color}"/>
    <text x="14" y="22" fill="#AEB4BF" font-family="Arial,sans-serif" font-size="10.5" font-weight="700">HEALTH SUMMARY</text>
    <text x="14" y="47" fill="${color}" font-family="Arial,sans-serif" font-size="17" font-weight="800">${escapeXml(health.state)}</text>
    <text x="14" y="69" fill="#F4F6F8" font-family="Arial,sans-serif" font-size="12">LAT ${Number.isFinite(metrics.current) ? Math.round(metrics.current) + " ms" : "--"}</text>
    <text x="14" y="88" fill="#F4F6F8" font-family="Arial,sans-serif" font-size="12">JIT ${Number.isFinite(metrics.jitter) ? metrics.jitter.toFixed(1) + " ms" : "--"}</text>
    <text x="14" y="107" fill="#F4F6F8" font-family="Arial,sans-serif" font-size="12">LOSS ${Number.isFinite(metrics.loss) ? metrics.loss.toFixed(1) + "%" : "--"}</text>
    <text x="14" y="126" fill="#F4F6F8" font-family="Arial,sans-serif" font-size="12">${summary.current ? "DOWN " + formatDuration(summary.currentDurationMs) : "UP " + formatDuration(summary.uptimeMs)}</text>
  </svg>`);
}
