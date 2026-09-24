import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { EventEmitter } from "node:events";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { TelemetryService } from "../../performance-grapher-streamdeck/src/telemetry.js";
import {
  makeNeoFeedback,
  neoLayoutFor,
  neoMetricIds,
  normalizeNeoSettings,
} from "../../performance-grapher-streamdeck/src/neo.js";

const VERSION = "1.0.0.0";
const ACTION_UUID = "com.packrat.performance-grapher-neo.infobar";
const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// This Neo-only SKU deliberately does NOT launch a second PresentMon session.
// All advertised readings are sourced from the existing Windows/LHM sensor engine.
class DisabledGameCapture extends EventEmitter {
  start() {}
  stop() {}
  restart() {}
}
function log(error) {
  try { streamDeck.logger.error(String(error?.stack || error?.message || error)); } catch {}
}
const telemetry = new TelemetryService({
  pluginRoot: PLUGIN_ROOT,
  persistPath: resolve(process.env.LOCALAPPDATA || homedir(), "PackRat", "PerformanceGrapherNeo", "state.json"),
  presentMonProvider: new DisabledGameCapture(),
  log,
});
const visible = new Map();
let lifecycle = Promise.resolve();
let repaintTimer = null;
let ticker = null;
let repainting = false;
let repaintAgain = false;

function settingsFrom(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...normalizeNeoSettings(source),
    metricId: String(source.metricId || "gpu.load"),
    accent: /^#[0-9a-f]{6}$/i.test(String(source.accent || ""))
      ? String(source.accent).toUpperCase() : "#2BE86A",
  };
}
function watchedMetrics(record) {
  const list = record.settings.neoMode === "overview"
    ? ["cpu.load", "gpu.load", "ram.load"]
    : neoMetricIds(record.settings);
  for (const id of [...list, "gpu.temperature", "cpu.temperature"]) {
    telemetry.watchMetric(id);
  }
  return list;
}
function transitionTelemetry() {
  lifecycle = lifecycle.catch(log).then(async () => {
    if (visible.size > 0 && !telemetry.started) await telemetry.start();
    else if (visible.size === 0 && telemetry.started) await telemetry.shutdown();
  });
  return lifecycle;
}
function queueRepaint(delay = 40) {
  if (!visible.size || repaintTimer) return;
  repaintTimer = setTimeout(() => {
    repaintTimer = null;
    void renderAll();
  }, delay);
  repaintTimer.unref?.();
}
async function notifyInspector(record) {
  if (!record || String(streamDeck.ui.action?.id || "") !== record.id) return;
  try {
    await streamDeck.ui.sendToPropertyInspector({
      type: "performanceNeo.state",
      settings: record.settings,
      snapshot: telemetry.snapshot(),
      version: VERSION,
    });
  } catch (error) { log(error); }
}
async function paint(record, force = false) {
  if (visible.get(record.id) !== record || !record.action.isNeoInfobar()) return;
  if (record.inflight) {
    record.needsRefresh ||= force;
    return record.inflight;
  }
  record.inflight = (async () => {
    const now = Date.now();
    const settings = record.settings;
    if (!force && now - record.lastRenderAt < settings.neoRefreshMs) return;
    const ids = watchedMetrics(record);
    const layout = neoLayoutFor(settings);
    if (force || record.lastLayout !== layout) {
      await record.action.setFeedbackLayout(layout);
      if (visible.get(record.id) !== record || record.settings !== settings) return;
      record.lastLayout = layout;
      record.lastFeedback = "";
    }
    let metric = settings.metricId;
    if (settings.neoMode === "rotate" && ids.length) {
      while (Date.now() >= record.nextRotationAt) {
        record.rotationIndex = (record.rotationIndex + 1) % ids.length;
        record.nextRotationAt += settings.neoRotationMs;
      }
      metric = ids[record.rotationIndex % ids.length];
    }
    const feedback = makeNeoFeedback(telemetry, settings, metric);
    const signature = JSON.stringify(feedback);
    record.lastRenderAt = now;
    if (visible.get(record.id) !== record || record.settings !== settings) return;
    if (!force && record.lastFeedback === signature) return;
    await record.action.setFeedback(feedback);
    if (visible.get(record.id) === record && record.settings === settings) {
      record.lastFeedback = signature;
    }
  })().catch(log).finally(() => {
    record.inflight = null;
    if (record.needsRefresh && visible.get(record.id) === record) {
      record.needsRefresh = false;
      queueRepaint(0);
    }
  });
  return record.inflight;
}
async function renderAll() {
  if (repainting) {
    repaintAgain = true;
    return;
  }
  repainting = true;
  try {
    await Promise.allSettled([...visible.values()].map((record) => paint(record)));
  } finally {
    repainting = false;
    if (repaintAgain) {
      repaintAgain = false;
      queueRepaint(0);
    }
  }
}
function syncTicker() {
  if (!visible.size && ticker) {
    clearInterval(ticker);
    ticker = null;
  } else if (visible.size && !ticker) {
    // Display scheduler only. Telemetry polling is owned by ONE shared service.
    ticker = setInterval(() => void renderAll(), 1000);
    ticker.unref?.();
  }
}
class NeoPerformanceInfobar extends SingletonAction {
  manifestId = ACTION_UUID;
  async onWillAppear(ev) {
    if (!ev.action.isNeoInfobar()) return;
    const id = String(ev.action.id || "");
    if (!id) return;
    const settings = settingsFrom(ev.payload?.settings);
    const record = {
      id, action: ev.action, settings,
      lastFeedback: "", lastLayout: "", lastRenderAt: 0,
      rotationIndex: 0, nextRotationAt: Date.now() + settings.neoRotationMs,
      inflight: null, needsRefresh: false,
    };
    visible.set(id, record);
    watchedMetrics(record);
    syncTicker();
    await transitionTelemetry();
    await paint(record, true);
    await notifyInspector(record);
  }
  onWillDisappear(ev) {
    const id = String(ev.action?.id || "");
    visible.delete(id);
    syncTicker();
    if (!visible.size && repaintTimer) {
      clearTimeout(repaintTimer);
      repaintTimer = null;
    }
    void transitionTelemetry();
  }
  async onDidReceiveSettings(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    record.settings = settingsFrom(ev.payload?.settings);
    record.rotationIndex = 0;
    record.nextRotationAt = Date.now() + record.settings.neoRotationMs;
    watchedMetrics(record);
    record.lastRenderAt = 0;
    await paint(record, true);
    await notifyInspector(record);
  }
  async onPropertyInspectorDidAppear(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record) await notifyInspector(record);
  }
}
streamDeck.actions.registerAction(new NeoPerformanceInfobar());
streamDeck.ui.onSendToPlugin((ev) => {
  const payload = ev?.payload || {};
  const actionId = String(payload.actionContext || "");
  const record = visible.get(actionId);
  if (payload.type === "performanceNeo.inspect" && record) {
    void notifyInspector(record);
  }
});
telemetry.on("update", () => queueRepaint());
telemetry.on("catalog", () => {
  queueRepaint();
  const record = visible.get(String(streamDeck.ui.action?.id || ""));
  if (record) void notifyInspector(record);
});
streamDeck.system.onSystemDidWakeUp(() => {
  if (visible.size) telemetry.resume();
});
process.once("SIGTERM", () => void telemetry.shutdown().finally(() => process.exit(0)));
process.once("SIGINT", () => void telemetry.shutdown().finally(() => process.exit(0)));
streamDeck.connect().catch((error) => { log(error); process.exitCode = 1; });
