import http from "node:http";
import crypto from "node:crypto";

const PROTOCOL = 1;
const MAX_MESSAGE_BYTES = 64 * 1024;

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store"
  });
  res.end(body);
}

function setupHtml(pairingKey, pluginVersion) {
  const escaped = String(pairingKey).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  return `<!doctype html><meta charset="utf-8"><title>Window Manager Lite - XENEON Setup</title>
<style>body{font:15px system-ui;background:#111;color:#eee;max-width:720px;margin:48px auto;padding:0 22px}code{display:block;padding:14px;background:#222;border:1px solid #444;border-radius:8px;word-break:break-all}button{margin-top:12px;padding:10px 14px;border-radius:7px;border:0;background:#e8791a;color:#111;font-weight:700;cursor:pointer}.muted{color:#aaa}</style>
<h1>Window Manager Lite - XENEON Setup</h1><p>Copy this local pairing key into <b>Window Manager for XENEON</b> in iCUE.</p><code id="key">${escaped}</code><button onclick="navigator.clipboard.writeText(document.getElementById('key').textContent).then(()=>this.textContent='Copied')">Copy pairing key</button><p class="muted">Service version ${pluginVersion}. Runs only on 127.0.0.1. No PackRat cloud connection.</p>`;
}

function allowedOrigin(origin, port) {
  if (!origin) return true;
  const raw = String(origin).trim();
  const lower = raw.toLowerCase();
  if (lower === "null" || lower.startsWith("file://") || lower.startsWith("qrc://")) return true;
  try {
    const url = new URL(raw);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]") &&
      Number(url.port) === Number(port);
  } catch {
    return false;
  }
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function encodeFrame(payload, opcode = 1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
  if (body.length < 126) return Buffer.concat([Buffer.from([0x80 | opcode, body.length]), body]);
  if (body.length <= 0xffff) {
    const head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(body.length, 2);
    return Buffer.concat([head, body]);
  }
  const head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(body.length), 2);
  return Buffer.concat([head, body]);
}

function makePeer(socket, onMessage, onClose) {
  let buffer = Buffer.alloc(0);
  let closed = false;
  const send = value => { if (!closed && !socket.destroyed) socket.write(encodeFrame(JSON.stringify(value))); };
  const close = () => {
    if (closed) return;
    closed = true;
    try { socket.write(encodeFrame(Buffer.alloc(0), 8)); } catch {}
    try { socket.end(); } catch {}
    onClose?.();
  };
  socket.on("data", chunk => {
    if (closed) return;
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > MAX_MESSAGE_BYTES + 32) return close();
    while (buffer.length >= 2) {
      const b0 = buffer[0], b1 = buffer[1];
      const fin = Boolean(b0 & 0x80);
      const opcode = b0 & 0x0f;
      const masked = Boolean(b1 & 0x80);
      if (!fin || (b0 & 0x70) !== 0) return close();
      let len = b1 & 0x7f, offset = 2;
      if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); offset = 4; }
      else if (len === 127) {
        if (buffer.length < 10) return;
        const n = Number(buffer.readBigUInt64BE(2));
        if (!Number.isSafeInteger(n)) return close();
        len = n; offset = 10;
      }
      if (!masked || len > MAX_MESSAGE_BYTES) return close();
      if (buffer.length < offset + 4 + len) return;
      const mask = buffer.subarray(offset, offset + 4); offset += 4;
      const payload = Buffer.from(buffer.subarray(offset, offset + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buffer = buffer.subarray(offset + len);
      if (opcode === 8) return close();
      if (opcode === 9) { socket.write(encodeFrame(payload, 10)); continue; }
      if (opcode !== 1) continue;
      let parsed;
      try { parsed = JSON.parse(payload.toString("utf8")); } catch { continue; }
      onMessage(parsed, {send, close});
    }
  });
  socket.on("error", close);
  socket.on("close", () => { if (!closed) { closed = true; onClose?.(); } });
  return {send, close};
}

async function listenLoopbackWithRetry(server, port, logger, attempts = 12, delayMs = 500) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const onError = error => { server.off("listening", onListening); reject(error); };
        const onListening = () => { server.off("error", onError); resolve(); };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "127.0.0.1");
      });
      return;
    } catch (error) {
      lastError = error;
      if (error?.code !== "EADDRINUSE" || attempt === attempts) throw error;
      logger?.warn?.(`XENEON service port ${port} is busy; retrying (${attempt}/${attempts}).`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error("Could not start XENEON service.");
}

export async function startWindowManagerXeneonService({backend, pairingKey, pluginVersion = "unknown", port = 17487, logger = console}) {
  if (!backend || typeof backend.snapshot !== "function" || typeof backend.execute !== "function") throw new Error("XENEON backend requires snapshot() and execute().");
  const clients = new Set();
  let lastSnapshot = "";

  const broadcastSnapshot = () => {
    let snap;
    try { snap = backend.snapshot(); } catch (error) { logger?.warn?.("XENEON snapshot failed", error); return; }
    const payload = JSON.stringify({type:"snapshot", ...snap});
    if (payload === lastSnapshot) return;
    lastSnapshot = payload;
    for (const client of clients) client.send(JSON.parse(payload));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") return json(res, 200, {ok:true, protocol:PROTOCOL, pluginVersion});
    if (req.method === "GET" && url.pathname === "/") {
      const body = setupHtml(pairingKey, pluginVersion);
      res.writeHead(200, {
        "content-type":"text/html; charset=utf-8",
        "content-length":Buffer.byteLength(body),
        "cache-control":"no-store",
        "x-content-type-options":"nosniff",
        "content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
      });
      return res.end(body);
    }
    json(res, 404, {ok:false, error:"not_found"});
  });

  server.on("upgrade", (req, socket) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname !== "/widget" || !allowedOrigin(req.headers.origin, port)) return socket.destroy();
      const key = req.headers["sec-websocket-key"];
      if (!key || String(req.headers.upgrade || "").toLowerCase() !== "websocket") return socket.destroy();
      const accept = crypto.createHash("sha1").update(String(key) + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
      socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
      let authenticated = false;
      let peer;
      peer = makePeer(socket, async message => {
        if (!authenticated) {
          if (!message || message.type !== "hello") return peer.close();
          if (Number(message.protocol) !== PROTOCOL) { peer.send({type:"protocol_mismatch", expected:PROTOCOL}); return peer.close(); }
          if (!safeEqual(message.key, pairingKey)) { peer.send({type:"pairing_required", reason:"invalid_key"}); return peer.close(); }
          authenticated = true;
          clients.add(peer);
          peer.send({type:"auth_ok", protocol:PROTOCOL, pluginVersion});
          peer.send({type:"snapshot", ...backend.snapshot()});
          return;
        }
        if (!message || message.type !== "command") return;
        const allowed = new Set(["focus","minimize","maximize_restore","snap_left","snap_right","move_monitor","close"]);
        if (!allowed.has(message.command)) return peer.send({type:"command_result", ok:false, error:"unsupported_command"});
        try {
          const result = await backend.execute(message);
          peer.send({type:"command_result", command:message.command, ...(result || {ok:true})});
          setTimeout(broadcastSnapshot, 75);
        } catch (error) {
          peer.send({type:"command_result", command:message.command, ok:false, error:String(error?.message || error)});
        }
      }, () => clients.delete(peer));
    } catch { socket.destroy(); }
  });

  await listenLoopbackWithRetry(server, port, logger);
  const timer = setInterval(broadcastSnapshot, 1000);
  timer.unref?.();
  logger?.info?.(`Window Manager Lite XENEON service listening on 127.0.0.1:${port}.`);
  return {
    port,
    close: async () => {
      clearInterval(timer);
      for (const c of clients) c.close();
      await new Promise(resolve => server.close(resolve));
    }
  };
}
