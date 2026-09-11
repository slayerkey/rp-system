#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const entry = process.argv[2];
const outDir = process.argv[3] || "artifacts/home-assistant-diagnostic";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node home-assistant-diagnostic-smoke.mjs <index.html> [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

function states() {
  return [
    { entity_id: "sensor.office_temperature", state: "72", attributes: { friendly_name: "Office Temperature", unit_of_measurement: "°F" } }
  ];
}

function startMock(port, allowCors) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({
      method: req.method,
      url: req.url,
      origin: req.headers.origin || "",
      authorization: req.headers.authorization ? "present" : "missing",
      acrHeaders: req.headers["access-control-request-headers"] || "",
      acrPrivateNetwork: req.headers["access-control-request-private-network"] || "",
    });

    const origin = req.headers.origin || "";
    if (allowCors && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
      res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url?.startsWith("/api/")) {
      if (req.headers.authorization !== "Bearer ratpack-test-token") {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Unauthorized" }));
        return;
      }
      if (req.url === "/api/" || req.url?.startsWith("/api/?")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "API running." }));
        return;
      }
      if (req.url === "/api/states") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(states()));
        return;
      }
      if (req.url === "/api/states/sensor.office_temperature") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(states()[0]));
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Entity not found." }));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><title>Home Assistant Mock</title>");
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/api/websocket") {
      socket.destroy();
      return;
    }
    requests.push({ method:"WS", url:req.url, origin:req.headers.origin || "" });
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type:"auth_required", ha_version:"2026.8.0" }));
    let authed = false;
    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      if (!authed) {
        if (msg.type === "auth" && msg.access_token === "ratpack-test-token") {
          authed = true;
          ws.send(JSON.stringify({ type:"auth_ok", ha_version:"2026.8.0" }));
        } else {
          ws.send(JSON.stringify({ type:"auth_invalid", message:"Invalid access token" }));
          ws.close();
        }
        return;
      }
      if (msg.type === "get_states") {
        ws.send(JSON.stringify({ id:msg.id, type:"result", success:true, result:states() }));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, wss, requests }));
  });
}

const good = await startMock(18123, true);
const noCors = await startMock(18124, false);

const original = fs.readFileSync(entry, "utf8");
const harness = `<script id="ratpack-ha-diagnostic-harness">
let serverAddress = "http://127.0.0.1:18123";
let accessToken = "ratpack-test-token";
let entityId = "sensor.office_temperature";
let uniqueId = "ratpack-ha-diagnostic-smoke";
globalThis.tr = async function(value){ return value; };
globalThis.__setDiagConfig = function(next) {
  if (next.serverAddress !== undefined) serverAddress = String(next.serverAddress);
  if (next.accessToken !== undefined) accessToken = String(next.accessToken);
  if (next.entityId !== undefined) entityId = String(next.entityId);
};
</script>`;
const instrumented = original.replace(/<head(\s[^>]*)?>/i, (m) => m + "\n" + harness);
const instrumentedPath = path.join(path.dirname(path.resolve(entry)), "__ratpack-ha-diagnostic-instrumented.html");
fs.writeFileSync(instrumentedPath, instrumented, "utf8");

const report = { schema_version: 2, entry: path.basename(entry), passed: false, requests:{} };
let exitCode = 0;
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
  const page = await context.newPage();

  await page.goto(pathToFileURL(instrumentedPath).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(
    () => document.getElementById("headline")?.textContent?.includes("ALL FIVE TESTS PASSED"),
    null,
    { timeout: 15_000 }
  );
  report.success = await page.evaluate(() => ({
    origin: location.origin,
    headline: document.getElementById("headline")?.textContent,
    steps: [...document.querySelectorAll(".step")].map((n) => ({
      id:n.id, state:n.getAttribute("data-state"), result:n.querySelector(".result")?.textContent
    }))
  }));
  if (!report.success.steps.every((s) => s.state === "pass")) {
    throw new Error(`success path did not pass all five stages: ${JSON.stringify(report.success)}`);
  }

  await page.evaluate(async () => {
    globalThis.__setDiagConfig({ serverAddress:"http://127.0.0.1:18124" });
    await globalThis.__packratHomeAssistantDiagnostic.test();
  });
  await page.waitForFunction(
    () => document.getElementById("headline")?.textContent?.includes("REST CORS is blocked, but WebSocket WORKS"),
    null,
    { timeout: 15_000 }
  );
  report.corsFallback = await page.evaluate(() => ({
    headline:document.getElementById("headline")?.textContent,
    reach:document.getElementById("stepReach")?.getAttribute("data-state"),
    cors:document.getElementById("stepApi")?.getAttribute("data-state"),
    ws:document.getElementById("stepWs")?.getAttribute("data-state")
  }));
  if (report.corsFallback.reach !== "pass" || report.corsFallback.cors !== "fail" || report.corsFallback.ws !== "pass") {
    throw new Error(`REST CORS/WebSocket fallback classification failed: ${JSON.stringify(report.corsFallback)}`);
  }

  report.requests.good = good.requests;
  report.requests.noCors = noCors.requests;
  const preflight = good.requests.find((r) => r.method === "OPTIONS" && r.url === "/api/");
  if (!preflight) throw new Error("expected REST API CORS preflight was not observed");
  if (preflight.origin !== "null") throw new Error(`file-origin REST Origin was not null: ${JSON.stringify(preflight)}`);
  if (!/authorization/i.test(preflight.acrHeaders)) throw new Error(`Authorization missing from preflight: ${JSON.stringify(preflight)}`);
  const wsRequest = noCors.requests.find((r) => r.method === "WS");
  if (!wsRequest) throw new Error("WebSocket connection was not observed on CORS-blocked server");

  await page.screenshot({ path:path.join(outDir, "home-assistant-diagnostic-cors-ws-fallback.png") });
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  report.requests.good = good.requests;
  report.requests.noCors = noCors.requests;
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "home-assistant-diagnostic-result.json"), JSON.stringify(report, null, 2) + "\n");
  try { fs.unlinkSync(instrumentedPath); } catch {}
  await browser.close();
  await new Promise((resolve) => good.wss.close(resolve));
  await new Promise((resolve) => noCors.wss.close(resolve));
  await new Promise((resolve) => good.server.close(resolve));
  await new Promise((resolve) => noCors.server.close(resolve));
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
