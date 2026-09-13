import dns from "node:dns";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function timeoutPromise(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(label || "timeout")), ms));
}

async function withTimeout(promise, ms, label) {
  return Promise.race([promise, timeoutPromise(ms, label)]);
}

export function parsePingOutput(output) {
  const text = String(output || "");
  const match = text.match(/time[=<]\s*([0-9.]+)\s*ms/i) || text.match(/time\s*([0-9.]+)\s*ms/i);
  if (!match) return null;
  const ms = Number(match[1]);
  return Number.isFinite(ms) ? ms : null;
}

export function pingInvocation(platform, host, family = "auto") {
  let command = "ping";
  const args = [];
  const target = String(host);

  if (platform === "win32") {
    if (family === "ipv4") args.push("-4");
    if (family === "ipv6") args.push("-6");
    args.push("-n", "1", target);
    return { command, args };
  }

  if (platform === "darwin") {
    if (family === "ipv6") command = "ping6";
    args.push("-c", "1", target);
    return { command, args };
  }

  if (family === "ipv4") args.push("-4");
  if (family === "ipv6") args.push("-6");
  args.push("-c", "1", target);
  return { command, args };
}

export async function pingHost(host, { timeoutMs = 1600, family = "auto" } = {}) {
  const { command, args } = pingInvocation(process.platform, host, family);

  const started = performance.now();
  try {
    const { stdout = "", stderr = "" } = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: Math.max(500, Number(timeoutMs) || 1600) + 500,
      maxBuffer: 64 * 1024
    });
    const parsed = parsePingOutput(stdout + "\n" + stderr);
    const elapsed = performance.now() - started;
    return { ok: true, ms: parsed ?? elapsed, method: "icmp", error: null };
  } catch (error) {
    return { ok: false, ms: null, method: "icmp", error: error?.code || error?.message || "ping failed" };
  }
}

export async function dnsLookup(hostname, { timeoutMs = 1800, family = "auto" } = {}) {
  const started = performance.now();
  const familyNumber = family === "ipv4" ? 4 : family === "ipv6" ? 6 : 0;
  try {
    const result = await withTimeout(
      dns.promises.lookup(String(hostname), { family: familyNumber, all: false, verbatim: true }),
      timeoutMs,
      "dns timeout"
    );
    return {
      ok: true,
      ms: performance.now() - started,
      method: "dns",
      address: result?.address || null,
      family: result?.family || null,
      error: null
    };
  } catch (error) {
    return { ok: false, ms: null, method: "dns", address: null, family: null, error: error?.code || error?.message || "dns failed" };
  }
}

export async function tcpConnect(host, port = 443, { timeoutMs = 1800, family = "auto" } = {}) {
  const started = performance.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true, ms: performance.now() - started, method: "tcp", error: null }));
    socket.once("timeout", () => finish({ ok: false, ms: null, method: "tcp", error: "timeout" }));
    socket.once("error", (error) => finish({ ok: false, ms: null, method: "tcp", error: error?.code || error?.message || "tcp failed" }));
    const options = { host: String(host), port: Number(port) || 443 };
    if (family === "ipv4") options.family = 4;
    if (family === "ipv6") options.family = 6;
    socket.connect(options);
  });
}

export async function httpsTiming(url, { timeoutMs = 3000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(String(url), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "PackRat Internet Health Pro/1.0" }
    });
    const elapsed = performance.now() - started;
    try { await response.body?.cancel?.(); } catch {}
    return {
      ok: Boolean(response),
      ms: elapsed,
      method: "https",
      status: Number(response?.status || 0),
      error: null
    };
  } catch (error) {
    return { ok: false, ms: null, method: "https", status: 0, error: error?.name || error?.message || "https failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fullConnectivityDiagnostic({
  secondaryIcmpTarget = "8.8.8.8",
  timeoutMs = 1800
} = {}) {
  const [secondaryPing, cloudflareTcp, googleTcp, cloudflareDns, googleDns, googleHttps] = await Promise.all([
    pingHost(secondaryIcmpTarget, { timeoutMs }),
    tcpConnect("1.1.1.1", 443, { timeoutMs }),
    tcpConnect("8.8.8.8", 443, { timeoutMs }),
    dnsLookup("one.one.one.one", { timeoutMs }),
    dnsLookup("dns.google", { timeoutMs }),
    httpsTiming("https://www.google.com/generate_204", { timeoutMs: Math.max(2500, timeoutMs) })
  ]);

  const ipReachable = secondaryPing.ok || cloudflareTcp.ok || googleTcp.ok || googleHttps.ok;
  const dnsWorks = cloudflareDns.ok || googleDns.ok;
  const fallbackLatency = [secondaryPing, cloudflareTcp, googleTcp, googleHttps].find((result) => result.ok && Number.isFinite(result.ms)) || null;

  return {
    ipReachable,
    dnsWorks,
    secondaryPing,
    cloudflareTcp,
    googleTcp,
    cloudflareDns,
    googleDns,
    googleHttps,
    fallbackLatency
  };
}

export async function probeTarget(target, {
  method = "auto",
  port = 443,
  family = "auto",
  timeoutMs = 2500
} = {}) {
  const text = String(target || "").trim();
  if (!text) return { ok: false, ms: null, method: "none", error: "No target configured" };

  let selected = method;
  if (selected === "auto") {
    try {
      const url = new URL(text);
      selected = ["http:", "https:"].includes(url.protocol) ? "https" : "icmp";
    } catch {
      selected = "icmp";
    }
  }

  if (selected === "https") {
    let url = text;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    return httpsTiming(url, { timeoutMs });
  }
  if (selected === "dns") return dnsLookup(text.replace(/^https?:\/\//i, "").split("/")[0], { timeoutMs, family });
  if (selected === "tcp") return tcpConnect(text.replace(/^https?:\/\//i, "").split("/")[0], port, { timeoutMs, family });

  const ping = await pingHost(text.replace(/^https?:\/\//i, "").split("/")[0], { timeoutMs, family });
  if (method === "auto" && !ping.ok) {
    const fallback = await tcpConnect(text.replace(/^https?:\/\//i, "").split("/")[0], port, { timeoutMs, family });
    if (fallback.ok) return { ...fallback, fallbackFrom: "icmp" };
  }
  return ping;
}

async function readResponseBytes(response) {
  if (!response?.ok) throw new Error("HTTP " + Number(response?.status || 0));
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value?.byteLength || 0;
    }
    return bytes;
  }
  const buffer = await response.arrayBuffer();
  return buffer.byteLength;
}

export function chooseMeasuredDownloadBytes(probeMbps, maxBytes = 64_000_000) {
  const cap = Math.min(64_000_000, Math.max(8_000_000, Number(maxBytes) || 64_000_000));
  const speed = Number(probeMbps);
  let target = 8_000_000;
  if (Number.isFinite(speed) && speed >= 500) target = 64_000_000;
  else if (Number.isFinite(speed) && speed >= 250) target = 40_000_000;
  else if (Number.isFinite(speed) && speed >= 100) target = 24_000_000;
  else if (Number.isFinite(speed) && speed >= 40) target = 16_000_000;
  return Math.min(cap, target);
}

async function measureDownload(bytes, signal, parallel = 1) {
  const count = Math.max(1, Math.min(4, Number(parallel) || 1));
  const perRequest = Math.max(1, Math.ceil(Number(bytes) / count));
  const started = performance.now();
  const transfers = Array.from({ length: count }, async (_, index) => {
    const response = await fetch(
      "https://speed.cloudflare.com/__down?bytes=" + perRequest + "&r=" + Date.now() + "-" + index + "-" + Math.random(),
      { cache: "no-store", signal }
    );
    return readResponseBytes(response);
  });
  const received = (await Promise.all(transfers)).reduce((sum, value) => sum + value, 0);
  const elapsedMs = Math.max(1, performance.now() - started);
  return {
    bytes: received,
    elapsedMs,
    mbps: received * 8 / (elapsedMs / 1000) / 1_000_000
  };
}

async function measureUpload(bytes, signal, parallel = 2) {
  const count = Math.max(1, Math.min(2, Number(parallel) || 1));
  const perRequest = Math.max(1, Math.ceil(Number(bytes) / count));
  const started = performance.now();
  await Promise.all(Array.from({ length: count }, async () => {
    const body = Buffer.alloc(perRequest, 0x61);
    const response = await fetch("https://speed.cloudflare.com/__up", {
      method: "POST",
      body,
      cache: "no-store",
      signal,
      headers: { "content-type": "application/octet-stream" }
    });
    if (!response.ok) throw new Error("Upload HTTP " + response.status);
    try { await response.body?.cancel?.(); } catch {}
  }));
  const elapsedMs = Math.max(1, performance.now() - started);
  const sent = perRequest * count;
  return {
    bytes: sent,
    elapsedMs,
    mbps: sent * 8 / (elapsedMs / 1000) / 1_000_000
  };
}

export async function runCloudflareSpeedTest({
  downloadBytes = 64_000_000,
  uploadBytes = 4_000_000,
  warmupBytes = 1_000_000,
  probeBytes = 4_000_000,
  timeoutMs = 45_000
} = {}) {
  const safeDownload = Math.min(64_000_000, Math.max(8_000_000, Number(downloadBytes) || 64_000_000));
  const safeUpload = Math.min(4_000_000, Math.max(1_000_000, Number(uploadBytes) || 4_000_000));
  const safeWarmup = Math.min(1_000_000, Math.max(250_000, Number(warmupBytes) || 1_000_000));
  const safeProbe = Math.min(4_000_000, Math.max(1_000_000, Number(probeBytes) || 4_000_000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const warmup = await measureDownload(safeWarmup, controller.signal, 1);
    const probe = await measureDownload(safeProbe, controller.signal, 1);
    const measuredBytes = chooseMeasuredDownloadBytes(probe.mbps, safeDownload);
    const download = await measureDownload(measuredBytes, controller.signal, 4);
    const upload = await measureUpload(safeUpload, controller.signal, 2);
    const totalDownloadBytes = warmup.bytes + probe.bytes + download.bytes;

    return {
      ok: true,
      downloadMbps: download.mbps,
      uploadMbps: upload.mbps,
      downloadBytes: totalDownloadBytes,
      measurementDownloadBytes: download.bytes,
      uploadBytes: upload.bytes,
      totalBytes: totalDownloadBytes + upload.bytes,
      completedAt: Date.now(),
      provider: "Cloudflare",
      mode: "warmed-adaptive"
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.name || error?.message || "speed test failed",
      totalBytes: 0,
      completedAt: Date.now(),
      provider: "Cloudflare",
      mode: "warmed-adaptive"
    };
  } finally {
    clearTimeout(timer);
  }
}
