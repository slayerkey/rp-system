#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { renderKey as renderVoiceKey } from "../../plugins/voice-deck/src/render.js";
import { renderKey as renderHealthKey } from "../../plugins/internet-health-pro/src/render.js";

const FIXED_NOW = Date.UTC(2026, 8, 13, 22, 0, 0);
Date.now = () => FIXED_NOW;

function parseArgs() {
  const out = {};
  for (let i = 2; i < process.argv.length; i += 2) out[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
  if (!out.product || !out.out) throw new Error("Usage: --product <voice-deck|internet-health-pro> --out <dir>");
  return out;
}

function voiceFixtures() {
  const members = [
    { id: "you", displayName: "YOU", self: true, order: 0, speaking: false, recentlySpeaking: true, mute: false, deaf: false },
    { id: "alex", displayName: "ALEX", self: false, order: 1, speaking: true, recentlySpeaking: true, mute: false, deaf: false },
    { id: "morien", displayName: "MORIEN", self: false, order: 2, speaking: false, recentlySpeaking: false, mute: false, deaf: false },
    { id: "mugzey", displayName: "MUGZEY", self: false, order: 3, speaking: false, recentlySpeaking: false, mute: false, deaf: true },
    { id: "sam", displayName: "SAM", self: false, order: 4, speaking: false, recentlySpeaking: false, mute: true, deaf: false },
  ];
  const base = {
    auth: { stage: "ready" },
    discord: { ready: true, authenticated: true, handshake: "ready" },
    guild: { name: "PackRat" },
    channel: { name: "General" },
    voice: { mute: false, deaf: false },
    members,
  };
  const activeMute = structuredClone(base); activeMute.voice.mute = true;
  const activeDeafen = structuredClone(base); activeDeafen.voice.deaf = true;
  const settings = { accent: "#2BE86A", showAvatar: true, showDisplayName: true, fallbackInitials: true, ordering: "stable" };
  const specs = [
    ["status", base, settings, {}],
    ["channel", base, settings, {}],
    ["member-slot", base, { ...settings, slotIndex: 1 }, {}],
    ["member-slot", base, { ...settings, slotIndex: 2 }, { pulsePhase: true }],
    ["member-slot", base, { ...settings, slotIndex: 3 }, {}],
    ["spotlight", base, settings, { pulsePhase: true }],
    ["activity", base, settings, { pulsePhase: true }],
    ["count", base, settings, {}],
    ["mute", base, settings, {}],
    ["deafen", base, settings, {}],
    ["combined", base, settings, {}],
    ["connection", base, settings, {}],
    ["member-slot", base, { ...settings, slotIndex: 4 }, {}],
    ["mute", activeMute, settings, {}],
    ["deafen", activeDeafen, settings, {}],
  ];
  return {
    title: ["VOICE DECK", "FOR DISCORD"],
    keys: specs.map(([kind, snapshot, s, options]) => renderVoiceKey(kind, snapshot, s, { now: FIXED_NOW, ...options })),
  };
}

function healthBase() {
  const samples = [24, 25, 23, 27, 26, 29, 28, 25, 24, 26, 23, 24].map((ms, i, arr) => ({
    t: FIXED_NOW - (arr.length - 1 - i) * 2500,
    ok: true,
    ms,
    method: "icmp",
  }));
  const metrics = { current: 24, lastGood: 24, jitter: 3.2, loss: 0, attempts: 60, adjacentPairs: 50, method: "icmp" };
  return {
    connectivity: { status: "online", reason: "MULTI PROBE HEALTHY" },
    samples,
    metrics5: metrics,
    metrics30: metrics,
    metrics120: metrics,
    outages: [{ start: FIXED_NOW - 5 * 60 * 60 * 1000, end: FIXED_NOW - 5 * 60 * 60 * 1000 + 134000, durationMs: 134000 }],
    onlineSince: FIXED_NOW - 6 * 60 * 60 * 1000,
    latestSpeed: null,
    speedRunning: false,
  };
}

function healthFixtures() {
  const base = healthBase();
  const degraded = structuredClone(base);
  degraded.metrics30 = { ...base.metrics30, current: 135, lastGood: 135, jitter: 26, loss: 4.5 };
  degraded.metrics5 = degraded.metrics30;
  degraded.metrics120 = degraded.metrics30;
  const offline = structuredClone(base);
  offline.connectivity = { status: "offline", reason: "MULTI PROBE FAILED" };
  offline.metrics30 = { current: null, lastGood: 24, jitter: null, loss: 100, attempts: 12, adjacentPairs: 0, method: "icmp" };
  offline.metrics5 = offline.metrics30;
  offline.metrics120 = offline.metrics30;
  const running = structuredClone(base); running.speedRunning = true;
  const measured = structuredClone(base);
  measured.latestSpeed = { ok: true, downloadMbps: 612, uploadMbps: 104 };
  const targetUp = {
    target: "edge.packrat.test",
    reading: { ok: true, ms: 21, method: "icmp" },
    expectedMethod: "icmp",
    history: base.samples,
  };
  const targetDown = {
    target: "api.packrat.test",
    reading: { ok: false, method: "tcp" },
    expectedMethod: "tcp",
    history: [],
  };
  const settings = { accent: "#2BE86A", historyWindow: 30 };
  const specs = [
    ["health", base, settings, null],
    ["latency", base, settings, null],
    ["jitter-loss", base, { ...settings, metric: "jitter" }, null],
    ["jitter-loss", base, { ...settings, metric: "loss" }, null],
    ["outage", base, { ...settings, outageMode: "uptime" }, null],
    ["outage", base, { ...settings, outageMode: "last" }, null],
    ["outage", base, { ...settings, outageMode: "count" }, null],
    ["target", base, { ...settings, target: "edge.packrat.test" }, targetUp],
    ["target", base, { ...settings, target: "api.packrat.test" }, targetDown],
    ["speed-test", base, settings, null],
    ["speed-test", running, settings, null],
    ["speed-test", measured, { ...settings, expectedDownloadMbps: 500, expectedUploadMbps: 100 }, null],
    ["summary", base, settings, null],
    ["health", degraded, settings, null],
    ["health", offline, settings, null],
  ];
  return {
    title: ["INTERNET", "HEALTH PRO"],
    keys: specs.map(([kind, snapshot, s, target]) => renderHealthKey(kind, snapshot, s, target)),
  };
}

async function rasterize(browser, uri, output) {
  const page = await browser.newPage({ viewport: { width: 288, height: 288 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    html,body{margin:0;width:288px;height:288px;overflow:hidden;background:transparent}
    img{display:block;width:288px;height:288px}
  </style></head><body><img id="key"></body></html>`);
  await page.locator("#key").evaluate((img, src) => { img.src = src; }, uri);
  await page.locator("#key").evaluate(img => img.decode());
  await page.locator("#key").screenshot({ path: output, omitBackground: true });
  await page.close();
}

async function main() {
  const args = parseArgs();
  const fixture = args.product === "voice-deck" ? voiceFixtures() :
    args.product === "internet-health-pro" ? healthFixtures() : null;
  if (!fixture) throw new Error(`Unknown product: ${args.product}`);
  if (fixture.keys.length !== 15) throw new Error(`Expected 15 runtime keys, got ${fixture.keys.length}`);

  const out = path.resolve(args.out);
  const keyDir = path.join(out, "keys");
  await fs.mkdir(keyDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (let i = 0; i < fixture.keys.length; i++) {
      await rasterize(browser, fixture.keys[i], path.join(keyDir, String(i).padStart(2, "0") + ".png"));
    }
  } finally {
    await browser.close();
  }
  await fs.writeFile(path.join(out, "runtime-key-manifest.json"), JSON.stringify({
    product: args.product,
    source: args.product === "voice-deck" ? "plugins/voice-deck/src/render.js" : "plugins/internet-health-pro/src/render.js",
    title: fixture.title,
    key_count: fixture.keys.length,
    fixed_now: new Date(FIXED_NOW).toISOString(),
    image_generation: "disabled",
  }, null, 2) + "\n");
  console.log(`RUNTIME KEYS PASS: ${args.product} -> ${keyDir}`);
}

main().catch(error => { console.error(error); process.exit(1); });
