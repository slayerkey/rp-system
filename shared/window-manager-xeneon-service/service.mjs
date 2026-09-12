import crypto from "node:crypto";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

export const DEFAULT_PORT = 17487;
export const PROTOCOL_VERSION = 1;
export const ALLOWED_COMMANDS = new Set([
  "focus",
  "minimize",
  "maximize_restore",
  "snap_left",
  "snap_right",
  "move_monitor",
  "close",
]);

function json(value) {
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? ""), "utf8").digest();
}

export function fixedTimeKeyEquals(supplied, expected) {
  if (!supplied || !expected) return false;
  const left = sha256(supplied);
  const right = sha256(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function isAllowedOrigin(origin, port = DEFAULT_PORT) {
  if (!origin) return true;
  const raw = String(origin).trim();
  const value = raw.toLowerCase();
  if (value === "null" || value.startsWith("file://") || value.startsWith("qrc://")) return true;
  try {
    const url = new URL(raw);
    return (url.protocol === "http:" || url.protocol === "https:")
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && (!url.port || Number(url.port) === Number(port));
  } catch {
    return false;
  }
}

export function normalizeSnapshot(value, protocol = PROTOCOL_VERSION) {
  const source = value && typeof value === "object" ? value : {};
  const windows = Array.isArray(source.windows)
    ? source.windows.filter((entry) => entry && entry.id != null).map((entry) => ({
        ...entry,
        id: String(entry.id),
        monitorId: entry.monitorId == null ? "" : String(entry.monitorId),
      }))
    : [];
  const monitors = Array.isArray(source.monitors)
    ? source.monitors.filter((entry) => entry && entry.id != null).map((entry, index) => ({
        name: `Monitor ${index + 1}`,
        ...entry,
        id: String(entry.id),
      }))
    : [];

  return {
    type: "snapshot",
    protocol,
    activeWindowId: source.activeWindowId == null ? null : String(source.activeWindowId),
    monitors,
    windows,
  };
}

export function validateCommand(message, snapshot) {
  if (!message || message.type !== "command") throw new Error("Unsupported message type.");
  const command = String(message.command || "");
  const windowId = String(message.windowId || "");
  if (!ALLOWED_COMMANDS.has(command)) throw new Error("Unknown window command.");
  if (!windowId || !snapshot.windows.some((window) => window.id === windowId)) {
    throw new Error("Window is no longer available.");
  }

  let monitorId = null;
  if (command === "move_monitor") {
    monitorId = String(message.monitorId || "");
    if (!monitorId || !snapshot.monitors.some((monitor) => monitor.id === monitorId)) {
      throw new Error("Monitor is no longer available.");
    }
  }
  return { command, windowId, monitorId };
}

function setupHtml({ port, pairingKey }) {
  const escaped = String(pairingKey || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Window Manager Lite · XENEON Setup</title>
<style>
:root{font-family:Inter,Segoe UI,Arial,sans-serif;color:#f6f8fa;background:#080b0f}*{box-sizing:border-box}
body{margin:0;padding:32px}.wrap{max-width:760px;margin:auto}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#7f8a96}
.card{margin-top:22px;padding:24px;border:1px solid #ffffff18;border-radius:20px;background:#11161d}h1{font-size:32px;margin:7px 0 8px}
p{color:#aeb8c2;line-height:1.55}.key{font:800 17px ui-monospace,Consolas,monospace;word-break:break-all;background:#07090c;border:1px solid #ffffff1c;border-radius:12px;padding:15px;margin:12px 0}
button{min-height:46px;padding:0 18px;border:0;border-radius:12px;background:#2be86a;color:#041008;font-weight:900;cursor:pointer}.muted{font-size:12px;color:#8996a3}
</style></head><body><div class="wrap">
<div class="eyebrow">PACKRAT · WINDOW MANAGER LITE</div><h1>XENEON setup</h1>
<p>Window Manager Lite is providing the local Windows engine for Window Manager for XENEON. Desktop data stays on this PC.</p>
<div class="card"><div class="eyebrow">XENEON PAIRING KEY</div><div id="key" class="key">${escaped}</div>
<button type="button" onclick="navigator.clipboard.writeText(document.getElementById('key').textContent)">Copy pairing key</button>
<p>Paste this value into <b>Window Manager Pairing Key</b> in the XENEON widget settings.</p>
<p class="muted">Local service: 127.0.0.1:${port}. This service is not a Window Manager Pro entitlement and does not add Pro actions to Stream Deck.</p>
</div></div></body></html>`;
}

async function readJsonText(socket, data) {
  if (typeof data === "string") return JSON.parse(data);
  if (Buffer.isBuffer(data)) return JSON.parse(data.toString("utf8"));
  if (Array.isArray(data)) return JSON.parse(Buffer.concat(data).toString("utf8"));
  if (data instanceof ArrayBuffer) return JSON.parse(Buffer.from(data).toString("utf8"));
  throw new Error("Unsupported message payload.");
}

function sanitizeError(error) {
  const text = String(error?.message || "Window action failed.");
  return text.length > 180 ? text.slice(0, 180) : text;
}

/**
 * Start the hidden XENEON service from inside the existing Window Manager Lite
 * plugin process. No Stream Deck actions are registered by this module.
 *
 * backend contract:
 *   snapshot(): Promise|object -> { windows, monitors, activeWindowId }
 *   execute({ command, windowId, monitorId }): Promise|void
 *   subscribe?(callback): optional -> unsubscribe function
 */
export async function startWindowManagerXeneonService({
  backend,
  pairingKey,
  pluginVersion = "unknown",
  port = DEFAULT_PORT,
  protocol = PROTOCOL_VERSION,
  host = "127.0.0.1",
  reconcileMs = 5000,
  debounceMs = 150,
} = {}) {
  if (!backend || typeof backend.snapshot !== "function" || typeof backend.execute !== "function") {
    throw new TypeError("Window Manager Lite XENEON service requires snapshot() and execute().");
  }
  if (!pairingKey || String(pairingKey).length < 24) {
    throw new TypeError("XENEON pairing key must be at least 24 characters.");
  }

  let current = normalizeSnapshot(await backend.snapshot(), protocol);
  let serialized = json(current);
  const clients = new Set();
  let debounceTimer = null;
  let unsubscribe = null;
  let stopped = false;

  const server = http.createServer(async (request, response) => {
    const remote = request.socket.remoteAddress || "";
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)) {
      response.writeHead(403, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(json({ ok: false, error: "loopback only" }));
      return;
    }

    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin, port)) {
      response.writeHead(403, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(json({ ok: false, error: "origin not allowed" }));
      return;
    }

    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(json({
        ok: true,
        product: "PackRat Window Manager Lite",
        service: "xeneon-window-manager",
        version: pluginVersion,
        protocol,
        port,
        clients: clients.size,
      }));
      return;
    }

    if (request.url === "/") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      });
      response.end(setupHtml({ port, pairingKey }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(json({ ok: false, error: "not found" }));
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    const remote = request.socket.remoteAddress || "";
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote)
        || request.url !== "/widget"
        || !isAllowedOrigin(request.headers.origin, port)) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
  });

  async function refreshAndBroadcast(force = false) {
    if (stopped) return;
    const next = normalizeSnapshot(await backend.snapshot(), protocol);
    const nextSerialized = json(next);
    if (!force && nextSerialized === serialized) return;
    current = next;
    serialized = nextSerialized;
    for (const socket of [...clients]) {
      if (socket.readyState !== WebSocket.OPEN) {
        clients.delete(socket);
        continue;
      }
      try { socket.send(nextSerialized); } catch { clients.delete(socket); }
    }
  }

  function scheduleRefresh() {
    if (stopped) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refreshAndBroadcast().catch(() => {});
    }, debounceMs);
  }

  if (typeof backend.subscribe === "function") {
    unsubscribe = backend.subscribe(scheduleRefresh);
  }

  wss.on("connection", (socket) => {
    let authenticated = false;
    const helloTimer = setTimeout(() => {
      if (!authenticated && socket.readyState === WebSocket.OPEN) socket.close(1008, "hello required");
    }, 4000);

    socket.on("message", async (data) => {
      try {
        const message = await readJsonText(socket, data);

        if (!authenticated) {
          if (message?.type !== "hello") {
            socket.send(json({ type: "pairing_required", reason: "hello_required" }));
            socket.close(1008, "hello required");
            return;
          }
          if (Number(message.protocol || 0) !== protocol) {
            socket.send(json({
              type: "protocol_mismatch",
              expectedProtocol: protocol,
              companionVersion: pluginVersion,
            }));
            socket.close(1008, "protocol mismatch");
            return;
          }
          if (!fixedTimeKeyEquals(message.key, pairingKey)) {
            socket.send(json({ type: "pairing_required", reason: "invalid_key" }));
            socket.close(1008, "pairing");
            return;
          }

          authenticated = true;
          clearTimeout(helloTimer);
          clients.add(socket);
          socket.send(json({
            type: "auth_ok",
            protocol,
            companionVersion: pluginVersion,
            product: "PackRat Window Manager Lite",
          }));
          socket.send(serialized);
          return;
        }

        const command = validateCommand(message, current);
        await backend.execute(command);
        await refreshAndBroadcast(true);
        socket.send(json({ type: "command_result", ok: true, command: command.command }));
      } catch (error) {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(json({ type: "command_result", ok: false, error: sanitizeError(error) }));
        }
      }
    });

    socket.on("close", () => {
      clearTimeout(helloTimer);
      clients.delete(socket);
    });
    socket.on("error", () => {
      clearTimeout(helloTimer);
      clients.delete(socket);
    });
  });

  const reconcileTimer = setInterval(() => {
    refreshAndBroadcast().catch(() => {});
  }, reconcileMs);
  reconcileTimer.unref?.();

  let listenError = null;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, host);
      });
      listenError = null;
      break;
    } catch (error) {
      listenError = error;
      if (error?.code !== "EADDRINUSE" || attempt === 12) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (listenError) throw listenError;

  const address = server.address();
  const actualPort = address && typeof address === "object" ? address.port : port;

  return {
    host,
    port: actualPort,
    protocol,
    pairingKey,
    async close() {
      if (stopped) return;
      stopped = true;
      clearInterval(reconcileTimer);
      clearTimeout(debounceTimer);
      try { unsubscribe?.(); } catch {}
      for (const socket of [...clients]) {
        try { socket.close(1001, "service stopping"); } catch {}
      }
      clients.clear();
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
