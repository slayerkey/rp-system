#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const entry = process.argv[2];
const base = (process.argv[3] || "http://127.0.0.1:8123").replace(/\/+$/, "");
const outDir = process.argv[4] || "artifacts/home-assistant-real-core";
if (!entry || !fs.existsSync(entry)) {
  console.error("usage: node home-assistant-real-core-smoke.mjs <diagnostic-index.html> [ha-url] [out-dir]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const clientId = `${base}/`;
const entityId = "sensor.ratpack_temperature";
const password = "RatPack-QA-Only-2026!";

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}

async function waitForHomeAssistant() {
  let last = "";
  for (let i = 0; i < 90; i++) {
    try {
      const result = await fetch(`${base}/api/onboarding`, { cache: "no-store" });
      last = `${result.status} ${await result.text()}`;
      if (result.status === 200) return;
    } catch (error) {
      last = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Home Assistant did not become ready: ${last}`);
}

async function onboardAndSeed() {
  await waitForHomeAssistant();
  const status = await jsonFetch(`${base}/api/onboarding`);
  if (!status.response.ok) throw new Error(`onboarding status failed: ${status.response.status} ${JSON.stringify(status.data)}`);
  const userDone = Array.isArray(status.data) && status.data.find((step) => step.step === "user")?.done;
  if (userDone) throw new Error("test Home Assistant instance was not clean; user onboarding is already done");

  const user = await jsonFetch(`${base}/api/onboarding/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      name: "RatPack QA",
      username: "ratpack_qa",
      password,
      language: "en"
    })
  });
  if (!user.response.ok || !user.data?.auth_code) {
    throw new Error(`user onboarding failed: ${user.response.status} ${JSON.stringify(user.data)}`);
  }

  const form = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code: user.data.auth_code
  });
  const token = await jsonFetch(`${base}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form
  });
  if (!token.response.ok || !token.data?.access_token) {
    throw new Error(`token exchange failed: ${token.response.status} ${JSON.stringify(token.data)}`);
  }

  const accessToken = token.data.access_token;
  const seeded = await jsonFetch(`${base}/api/states/${entityId}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      state: "72",
      attributes: { friendly_name: "RatPack Temperature", unit_of_measurement: "°F" }
    })
  });
  if (!seeded.response.ok || seeded.data?.entity_id !== entityId) {
    throw new Error(`state seed failed: ${seeded.response.status} ${JSON.stringify(seeded.data)}`);
  }

  const states = await jsonFetch(`${base}/api/states`, {
    headers: { "Authorization": `Bearer ${accessToken}` }
  });
  if (!states.response.ok || !Array.isArray(states.data) || !states.data.some((state) => state.entity_id === entityId)) {
    throw new Error(`seeded entity is not visible through real REST API: ${states.response.status}`);
  }
  return accessToken;
}

const report = {
  schema_version: 1,
  evidence_type: "real Home Assistant Core 2026.8 container plus exact diagnostic file-origin page",
  home_assistant_url: base,
  entity_id: entityId,
  passed: false
};
let browser;
let temp;
let exitCode = 0;

try {
  const accessToken = await onboardAndSeed();
  const original = fs.readFileSync(entry, "utf8");
  const safeBase = JSON.stringify(base);
  const safeToken = JSON.stringify(accessToken);
  const safeEntity = JSON.stringify(entityId);
  const harness = `<script id="ratpack-real-ha-harness">
let serverAddress = ${safeBase};
let accessToken = ${safeToken};
let entityId = ${safeEntity};
let uniqueId = "ratpack-real-home-assistant";
globalThis.tr = async function(value){ return value; };
</script>`;
  const instrumented = original.replace(/<head(\s[^>]*)?>/i, (match) => match + "\n" + harness);
  temp = path.join(path.dirname(path.resolve(entry)), "__ratpack-real-home-assistant.html");
  fs.writeFileSync(temp, instrumented, "utf8");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1688, height: 696 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(pathToFileURL(temp).href, { waitUntil: "load", timeout: 30_000 });
  await page.waitForFunction(
    () => document.getElementById("headline")?.textContent?.includes("REST CORS is blocked, but WebSocket WORKS"),
    null,
    { timeout: 20_000 }
  );

  report.result = await page.evaluate(() => ({
    origin: location.origin,
    headline: document.getElementById("headline")?.textContent,
    reach: {
      state: document.getElementById("stepReach")?.getAttribute("data-state"),
      result: document.querySelector("#stepReach .result")?.textContent
    },
    cors: {
      state: document.getElementById("stepApi")?.getAttribute("data-state"),
      result: document.querySelector("#stepApi .result")?.textContent
    },
    websocket: {
      state: document.getElementById("stepWs")?.getAttribute("data-state"),
      result: document.querySelector("#stepWs .result")?.textContent
    }
  }));
  report.pageErrors = errors;

  if (report.result.reach.state !== "pass") throw new Error(`real HA LAN reachability failed: ${JSON.stringify(report.result)}`);
  if (report.result.cors.state !== "fail") throw new Error(`expected default real HA REST CORS to block file origin: ${JSON.stringify(report.result)}`);
  if (report.result.websocket.state !== "pass") throw new Error(`real HA WebSocket path failed: ${JSON.stringify(report.result)}`);
  if (!report.result.websocket.result.includes(entityId) || !report.result.websocket.result.includes("72")) {
    throw new Error(`real HA WebSocket did not return seeded entity: ${JSON.stringify(report.result)}`);
  }
  if (errors.length) throw new Error(`page errors: ${JSON.stringify(errors)}`);

  await page.screenshot({ path: path.join(outDir, "real-home-assistant-websocket-pass.png") });
  await context.close();
  report.passed = true;
} catch (error) {
  report.error = String(error?.stack || error);
  exitCode = 1;
} finally {
  fs.writeFileSync(path.join(outDir, "real-home-assistant-result.json"), JSON.stringify(report, null, 2) + "\n");
  if (temp) try { fs.unlinkSync(temp); } catch {}
  if (browser) await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
