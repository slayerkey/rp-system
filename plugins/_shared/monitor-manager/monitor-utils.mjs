export const SAFE_VCP = Object.freeze({
  INPUT_SOURCE: 0x60,
  AUDIO_VOLUME: 0x62,
  POWER_MODE: 0xd6
});

export const SUPPORT = Object.freeze({
  SUPPORTED: "SUPPORTED",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  UNKNOWN: "UNKNOWN"
});

function balancedBody(text, token) {
  const lower = text.toLowerCase();
  const start = lower.indexOf(token.toLowerCase() + "(");
  if (start < 0) return null;
  let depth = 0;
  const bodyStart = start + token.length + 1;
  for (let i = bodyStart; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    if (text[i] === ")") {
      if (depth === 0) return text.slice(bodyStart, i);
      depth -= 1;
    }
  }
  return null;
}

export function parseVcpCapabilities(capabilities) {
  if (!capabilities || typeof capabilities !== "string") return null;
  const body = balancedBody(capabilities, "vcp");
  if (body === null) return new Map();

  const result = new Map();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i += 1;
    const codeMatch = body.slice(i).match(/^([0-9a-fA-F]{2})\b/);
    if (!codeMatch) { i += 1; continue; }
    const code = Number.parseInt(codeMatch[1], 16);
    i += codeMatch[1].length;
    while (i < body.length && /\s/.test(body[i])) i += 1;
    const values = [];
    if (body[i] === "(") {
      let depth = 1;
      const start = ++i;
      while (i < body.length && depth > 0) {
        if (body[i] === "(") depth += 1;
        if (body[i] === ")") depth -= 1;
        i += 1;
      }
      const raw = body.slice(start, Math.max(start, i - 1));
      for (const token of raw.match(/[0-9a-fA-F]{2,4}/g) ?? []) {
        values.push(Number.parseInt(token, 16));
      }
    }
    result.set(code, values);
  }
  return result;
}

export function vcpSupport(capabilities, code) {
  const parsed = parseVcpCapabilities(capabilities);
  if (parsed === null) return { state: SUPPORT.UNKNOWN, values: [] };
  if (!parsed.has(code)) return { state: SUPPORT.NOT_SUPPORTED, values: [] };
  return { state: SUPPORT.SUPPORTED, values: parsed.get(code) ?? [] };
}

export function normalizeMonitorKey(monitor) {
  const path = String(monitor?.monitorDevicePath ?? "").trim().toLowerCase();
  if (path) return "path:" + path;
  const desc = String(monitor?.description ?? "").trim().toLowerCase();
  const device = String(monitor?.deviceName ?? "").trim().toLowerCase();
  return "fallback:" + desc + "|" + device;
}

export function modeSupported(modes, request) {
  const width = Number(request?.width);
  const height = Number(request?.height);
  const frequency = Number(request?.frequency);
  const orientation = Number(request?.orientation ?? 0);
  return (modes ?? []).some((mode) =>
    Number(mode.width) === width &&
    Number(mode.height) === height &&
    Number(mode.frequency) === frequency &&
    Number(mode.orientation ?? 0) === orientation
  );
}

export function classifyProfileResult(results) {
  if (!Array.isArray(results) || results.length === 0) return "FAILED";
  const failed = results.filter((x) => x.status === "FAILED").length;
  const skipped = results.filter((x) => x.status === "SKIPPED").length;
  const complete = results.filter((x) => x.status === "COMPLETE").length;
  if (failed > 0) return "FAILED";
  if (skipped === 0 && complete > 0) return "COMPLETE";
  if (complete > 0 || skipped > 0) return "PARTIAL";
  return "FAILED";
}

export function matchSavedMonitor(saved, current) {
  const rows = Array.isArray(current) ? current : [];
  const key = String(saved?.monitorKey ?? "").trim();
  if (key) {
    const exact = rows.filter((monitor) => String(monitor?.monitorKey ?? "") === key);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
  }

  const description = String(saved?.description ?? "").trim().toLowerCase();
  if (!description) return null;
  const byDescription = rows.filter(
    (monitor) => String(monitor?.description ?? "").trim().toLowerCase() === description
  );
  return byDescription.length === 1 ? byDescription[0] : null;
}

export function boundedPercent(value, label = "Value") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error(label + " must be a finite number.");
  return Math.max(0, Math.min(100, Math.round(numeric)));
}
