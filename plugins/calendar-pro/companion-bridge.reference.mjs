// Calendar Sync Pro 1.1.1.0 companion bridge reference implementation.
// The packaged build appends equivalent code to the plugin runtime.
// Local-only ICS proxy used by XENEON Edge Calendar Panel.
import http from "node:http";

export const CALENDAR_BRIDGE_HOST = "127.0.0.1";
export const CALENDAR_BRIDGE_PORT = 38765;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function normalizeCalendarUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/^webcal:/i, "https:");
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function startCalendarPanelBridge({ logger = console } = {}) {
  const server = http.createServer(async (req, res) => {
    cors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    let requestUrl;
    try {
      requestUrl = new URL(req.url || "/", `http://${CALENDAR_BRIDGE_HOST}:${CALENDAR_BRIDGE_PORT}`);
    } catch {
      res.writeHead(400, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Bad request");
      return;
    }

    if (requestUrl.pathname === "/health") {
      res.writeHead(200, {"Content-Type":"application/json; charset=utf-8"});
      res.end(JSON.stringify({ok:true, product:"Calendar Sync Pro", bridge:1}));
      return;
    }

    if (requestUrl.pathname !== "/v1/ics") {
      res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Not found");
      return;
    }

    const target = normalizeCalendarUrl(requestUrl.searchParams.get("url"));
    if (!target) {
      res.writeHead(400, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Invalid calendar URL");
      return;
    }

    try {
      const upstream = await fetch(target, {
        redirect:"follow",
        cache:"no-store",
        headers:{"User-Agent":"Packrat-Calendar-Sync-Pro/1.1.1"}
      });
      if (!upstream.ok) {
        res.writeHead(502, {"Content-Type":"text/plain; charset=utf-8"});
        res.end("Calendar fetch failed");
        return;
      }

      const body = await upstream.text();
      if (!/BEGIN:VCALENDAR/i.test(body)) {
        res.writeHead(502, {"Content-Type":"text/plain; charset=utf-8"});
        res.end("Calendar response was not ICS");
        return;
      }

      res.writeHead(200, {"Content-Type":"text/calendar; charset=utf-8"});
      res.end(body);
    } catch {
      res.writeHead(502, {"Content-Type":"text/plain; charset=utf-8"});
      res.end("Calendar fetch failed");
    }
  });

  server.on("error", (error) => {
    if (error?.code !== "EADDRINUSE") logger.warn?.("Calendar companion bridge unavailable");
  });
  server.listen(CALENDAR_BRIDGE_PORT, CALENDAR_BRIDGE_HOST);
  return server;
}
