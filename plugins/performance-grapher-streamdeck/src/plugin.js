import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { renderKey, makeView } from "./render.js";
import { TelemetryService } from "./telemetry.js";

const BUILD_VERSION = "1.0.0.0";
const ACTIONS = {
  graph: "com.packrat.performance-grapher.graph",
  fps: "com.packrat.performance-grapher.fps",
  session: "com.packrat.performance-grapher.session",
  metric: "com.packrat.performance-grapher.metric",
  alert: "com.packrat.performance-grapher.alert",
};

const WINDOWS = [60_000, 300_000, 900_000, 0];
const SUMMARY_PAGES = 9;
const DEFAULTS = Object.freeze({
  metricId: "gpu.temperature",
  windowMs: 60_000,
  threshold: 85,
  thresholdDirection: "above",
  scaleMin: null,
  scaleMax: null,
  accent: "#2BE86A",
  fpsMode: "fps",
  lowMode: "one",
  summaryPage: 0,
});

function normalizeSettings(raw = {}, kind = "graph") {
  const source = raw && typeof raw === "object" ? raw : {};
  const metricDefault = kind === "metric" ? "cpu.load" : "gpu.temperature";
  const windowMs = WINDOWS.includes(Number(source.windowMs)) ? Number(source.windowMs) : 60_000;
  const scaleMin = source.scaleMin === "" || source.scaleMin == null ? null : Number(source.scaleMin);
  const scaleMax = source.scaleMax === "" || source.scaleMax == null ? null : Number(source.scaleMax);
  return {
    ...DEFAULTS,
    ...source,
    metricId: String(source.metricId || metricDefault),
    windowMs,
    threshold: Number.isFinite(Number(source.threshold)) ? Number(source.threshold) : 85,
    thresholdDirection: source.thresholdDirection === "below" ? "below" : "above",
    scaleMin: Number.isFinite(scaleMin) ? scaleMin : null,
    scaleMax: Number.isFinite(scaleMax) ? scaleMax : null,
    accent: /^#[0-9A-Fa-f]{6}$/.test(String(source.accent || "")) ? String(source.accent).toUpperCase() : "#2BE86A",
    fpsMode: source.fpsMode === "frametime" ? "frametime" : "fps",
    lowMode: source.lowMode === "pointOne" ? "pointOne" : "one",
    summaryPage: Math.max(0, Math.min(SUMMARY_PAGES - 1, Number(source.summaryPage) || 0)),
  };
}

function logger(message) {
  try { streamDeck.logger.error(String(message)); } catch {}
}

const telemetry = new TelemetryService({ log: logger });
const visible = new Map();
let renderTimer = null;
let inspectorTimer = null;

function renderInterval(record) {
  if (record.kind === "fps") return 250;
  if (record.kind === "session") return 500;
  if (record.kind === "graph" && ["game.fps", "game.frametime"].includes(record.settings.metricId)) return 250;
  return 1000;
}

function scheduleRender(delay = 25) {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    void renderAll();
  }, delay);
  renderTimer.unref?.();
}

function scheduleInspector() {
  if (inspectorTimer) return;
  inspectorTimer = setTimeout(() => {
    inspectorTimer = null;
    for (const record of visible.values()) {
      if (record.inspectorOpen) void sendInspector(record);
    }
  }, 500);
  inspectorTimer.unref?.();
}

async function sendInspector(record) {
  try {
    await record.action.sendToPropertyInspector({
      type: "performanceGrapher.state",
      action: record.kind,
      buildVersion: BUILD_VERSION,
      settings: record.settings,
      snapshot: telemetry.snapshot(),
    });
  } catch {}
}

async function renderRecord(record, force = false) {
  if (!record?.action?.isKey?.()) return;
  const now = Date.now();
  const interval = renderInterval(record);
  if (!force && now - record.lastRenderAt < interval) return;

  telemetry.watchMetric(record.settings.metricId);
  const view = makeView(telemetry, record.kind, record.settings);
  const image = renderKey(view, record.settings, 144);
  record.lastRenderAt = now;
  if (image === record.lastImage) return;
  record.lastImage = image;
  await record.action.setImage(image).catch(logger);
}

async function renderAll(force = false) {
  const jobs = [];
  for (const record of visible.values()) jobs.push(renderRecord(record, force));
  await Promise.allSettled(jobs);
}

class PerformanceAction extends SingletonAction {
  constructor(manifestId, kind) {
    super();
    this.manifestId = manifestId;
    this.kind = kind;
  }

  async onWillAppear(ev) {
    const id = String(ev.action?.id || "");
    if (!id) return;
    const record = {
      id,
      kind: this.kind,
      action: ev.action,
      settings: normalizeSettings(ev.payload?.settings, this.kind),
      lastImage: "",
      lastRenderAt: 0,
      inspectorOpen: false,
    };
    visible.set(id, record);
    telemetry.watchMetric(record.settings.metricId);
    await renderRecord(record, true);
  }

  onWillDisappear(ev) {
    visible.delete(String(ev.action?.id || ""));
  }

  async onDidReceiveSettings(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    record.settings = normalizeSettings(ev.payload?.settings, record.kind);
    telemetry.watchMetric(record.settings.metricId);
    record.lastImage = "";
    await renderRecord(record, true);
    if (record.inspectorOpen) await sendInspector(record);
  }

  async onPropertyInspectorDidAppear(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    record.inspectorOpen = true;
    await sendInspector(record);
  }

  onPropertyInspectorDidDisappear(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (record) record.inspectorOpen = false;
  }

  async onSendToPlugin(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    const payload = ev.payload || {};
    if (payload.type === "performanceGrapher.inspect") {
      await sendInspector(record);
      return;
    }
    if (payload.type !== "performanceGrapher.command") return;
    if (payload.command === "restart-fps") telemetry.restartFps();
    else if (payload.command === "reset-session") telemetry.resetSession();
    else if (payload.command === "open-presentmon-help") {
      await streamDeck.system.openUrl("https://github.com/GameTechDev/PresentMon/blob/v2.5.1/README-ConsoleApplication.md");
    }
    await renderRecord(record, true);
    await sendInspector(record);
  }

  async onKeyDown(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    let next = { ...record.settings };

    if (record.kind === "graph") {
      const current = WINDOWS.indexOf(Number(record.settings.windowMs));
      next.windowMs = WINDOWS[(current + 1 + WINDOWS.length) % WINDOWS.length];
    } else if (record.kind === "fps") {
      next.fpsMode = record.settings.fpsMode === "frametime" ? "fps" : "frametime";
    } else if (record.kind === "session") {
      next.summaryPage = (Number(record.settings.summaryPage) + 1) % SUMMARY_PAGES;
    } else {
      await ev.action.showOk().catch(() => {});
      return;
    }

    record.settings = normalizeSettings(next, record.kind);
    await ev.action.setSettings(record.settings);
    await renderRecord(record, true);
  }
}

for (const [kind, manifestId] of Object.entries(ACTIONS)) {
  streamDeck.actions.registerAction(new PerformanceAction(manifestId, kind));
}

telemetry.on("update", () => {
  scheduleRender();
  scheduleInspector();
});
telemetry.on("catalog", () => scheduleInspector());
telemetry.on("status", () => scheduleInspector());
telemetry.on("session", () => scheduleInspector());

process.on("uncaughtException", (error) => logger(error?.stack || error));
process.on("unhandledRejection", (error) => logger(error?.stack || error));
let shutdownStarted = false;

async function shutdown(exitCode = 0) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  try {
    await telemetry.shutdown();
  } catch (error) {
    logger(error?.stack || error?.message || error);
  }
  process.exit(exitCode);
}

process.once("SIGTERM", () => { void shutdown(0); });
process.once("SIGINT", () => { void shutdown(0); });
process.on("exit", () => telemetry.stop({ persist: false }));

async function main() {
  streamDeck.system.onSystemDidWakeUp(() => telemetry.resume());
  await streamDeck.connect();
  await telemetry.start();
  scheduleRender(0);
}

main().catch((error) => {
  logger(error?.stack || error?.message || error);
  process.exitCode = 1;
});
