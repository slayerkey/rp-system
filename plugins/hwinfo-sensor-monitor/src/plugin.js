import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { HwinfoService } from "./hwinfo-service.js";
import { normalizeSettings, formatReading } from "./sensor-model.js";
import { makeDashboardView, makeSensorView, renderKey, renderSpark, severity, inspectorStatus } from "./render.js";

const ACTIONS = {
  sensor: "com.packrat.hwinfo-sensor-monitor.sensor",
  graph: "com.packrat.hwinfo-sensor-monitor.graph",
  dashboard: "com.packrat.hwinfo-sensor-monitor.dashboard",
  alert: "com.packrat.hwinfo-sensor-monitor.alert"
};

const service = new HwinfoService({ log: (message) => streamDeck.logger.error(String(message)) });
const visible = new Map();
let tickTimer = null;
let inspectorTimer = null;

function recordFor(id) { return visible.get(String(id || "")) || null; }
function refsFor(record) { return record.kind === "dashboard" ? record.settings.sensorIds : [record.settings.sensorId]; }
function watchRecord(record) { service.watchMany(refsFor(record)); }

async function sendInspector(record = null, extra = {}) {
  const open = streamDeck.ui.action;
  const target = record || (open?.id ? recordFor(open.id) : null);
  if (!target || !open?.id || String(open.id) !== target.id) return;
  const refs = refsFor(target);
  try {
    await streamDeck.ui.sendToPropertyInspector({
      type: "hwinfo.state",
      kind: target.kind,
      settings: target.settings,
      snapshot: service.snapshot(refs),
      status: inspectorStatus(service.status),
      ...extra
    });
  } catch {}
}

function scheduleInspector(delay = 150) {
  if (inspectorTimer) return;
  inspectorTimer = setTimeout(() => {
    inspectorTimer = null;
    void sendInspector();
  }, delay);
  inspectorTimer.unref?.();
}

function viewFor(record) {
  watchRecord(record);
  if (record.kind === "dashboard") return makeDashboardView(service, record.settings);
  return makeSensorView(service, record.settings, record.kind);
}

async function renderRecord(record, force = false) {
  const now = Date.now();
  if (!force && now - record.lastRenderAt < record.settings.refreshMs) return;
  record.lastRenderAt = now;
  const view = viewFor(record);

  if (record.action.isDial?.()) {
    const ref = record.settings.sensorIds[Math.max(0, record.settings.dashboardPage) % Math.max(1, record.settings.sensorIds.length)];
    const sensor = service.sensor(ref);
    const points = sensor ? service.history(ref, record.settings.historyWindowMs) : [];
    const ready = service.status?.state === "ready" && sensor;
    const title = ready ? String(record.settings.customLabel || sensor.name || "HWiNFO").slice(0, 28) : inspectorStatus(service.status).title;
    const value = ready ? formatReading(sensor.value, record.settings.precision) + (sensor.unit ? " " + sensor.unit : "") : "--";
    const detail = ready ? "MIN " + formatReading(sensor.min, record.settings.precision) + "  MAX " + formatReading(sensor.max, record.settings.precision) : "No sensor data";
    const status = ready ? ((Math.max(0, record.settings.dashboardPage) % Math.max(1, record.settings.sensorIds.length)) + 1) + "/" + record.settings.sensorIds.length + " · rotate to browse" : inspectorStatus(service.status).detail;
    await record.action.setFeedback({
      title,
      spark: renderSpark(points, 112, 48, record.settings.accent),
      value,
      detail,
      status
    }).catch(() => {});
    return;
  }

  const image = renderKey(view, record.settings, 144);
  if (image !== record.lastImage) {
    record.lastImage = image;
    await record.action.setImage(image).catch(() => {});
  }

  if (record.kind === "alert" && record.settings.visualAttention === true && view.state === "ready") {
    const current = severity(view.value, record.settings);
    if (current === "critical" && record.lastSeverity !== "critical") await record.action.showAlert().catch(() => {});
    record.lastSeverity = current;
  }
}

async function renderAll(force = false) {
  await Promise.allSettled([...visible.values()].map((record) => renderRecord(record, force)));
}

function ensureTicker() {
  if (tickTimer) return;
  tickTimer = setInterval(() => void renderAll(false), 100);
  tickTimer.unref?.();
}

class HWiNFOAction extends SingletonAction {
  constructor(manifestId, kind) {
    super();
    this.manifestId = manifestId;
    this.kind = kind;
  }

  async onWillAppear(ev) {
    const id = String(ev.action?.id || "");
    if (!id) return;
    const settings = normalizeSettings(ev.payload?.settings, this.kind);
    const record = { id, kind: this.kind, action: ev.action, settings, lastImage: "", lastRenderAt: 0, lastSeverity: "normal" };
    visible.set(id, record);
    watchRecord(record);
    if (ev.action.isDial?.()) await ev.action.setFeedbackLayout("layouts/dashboard.json").catch(() => {});
    await renderRecord(record, true);
  }

  onWillDisappear(ev) { visible.delete(String(ev.action?.id || "")); }

  async onDidReceiveSettings(ev) {
    const record = recordFor(ev.action?.id);
    if (!record) return;
    record.settings = normalizeSettings(ev.payload?.settings, record.kind);
    watchRecord(record);
    record.lastImage = "";
    await renderRecord(record, true);
    await sendInspector(record);
  }

  async onPropertyInspectorDidAppear(ev) {
    const record = recordFor(ev.action?.id);
    if (record) await sendInspector(record);
  }

  async onKeyDown(ev) {
    const record = recordFor(ev.action?.id);
    if (!record) return;
    const next = { ...record.settings };
    if (record.kind === "graph") {
      const windows = [30000, 60000, 300000];
      const index = windows.indexOf(Number(next.historyWindowMs));
      next.historyWindowMs = windows[(index + 1 + windows.length) % windows.length];
    } else if (record.kind === "dashboard") {
      const pages = Math.max(1, Math.ceil(next.sensorIds.length / 3));
      next.dashboardPage = (Number(next.dashboardPage) + 1) % pages;
    } else {
      await ev.action.showOk().catch(() => {});
      return;
    }
    record.settings = normalizeSettings(next, record.kind);
    await ev.action.setSettings(record.settings);
    await renderRecord(record, true);
  }

  async onDialRotate(ev) {
    const record = recordFor(ev.action?.id);
    if (!record || record.kind !== "dashboard") return;
    const count = Math.max(1, record.settings.sensorIds.length);
    const ticks = Number(ev.payload?.ticks) || 0;
    let index = Number(record.settings.dashboardPage) || 0;
    index = ((index + Math.sign(ticks)) % count + count) % count;
    record.settings = normalizeSettings({ ...record.settings, dashboardPage: index }, record.kind);
    await ev.action.setSettings(record.settings);
    await renderRecord(record, true);
  }

  async onDialDown(ev) {
    const record = recordFor(ev.action?.id);
    if (!record || record.kind !== "dashboard") return;
    const count = Math.max(1, record.settings.sensorIds.length);
    record.settings = normalizeSettings({ ...record.settings, dashboardPage: (Number(record.settings.dashboardPage) + 1) % count }, record.kind);
    await ev.action.setSettings(record.settings);
    await renderRecord(record, true);
  }

  async onTouchTap(ev) { await this.onDialDown(ev); }
}

async function handleInspector(payload = {}) {
  const actionContext = String(payload?.actionContext || "");
  const openActionId = String(streamDeck.ui.action?.id || "");
  if (!actionContext || actionContext !== openActionId) return;
  const record = recordFor(actionContext);
  if (!record) return;

  if (payload.type === "hwinfo.inspect") {
    await sendInspector(record);
    return;
  }
  if (payload.type === "hwinfo.search") {
    const results = service.search(payload.query, payload.offset, payload.limit);
    await sendInspector(record, { search: { requestId: String(payload.requestId || ""), ...results } });
    return;
  }
  if (payload.type === "hwinfo.reset") {
    record.settings = normalizeSettings({}, record.kind);
    await record.action.setSettings(record.settings);
    await renderRecord(record, true);
    await sendInspector(record);
  }
}

for (const [kind, uuid] of Object.entries(ACTIONS)) streamDeck.actions.registerAction(new HWiNFOAction(uuid, kind));

streamDeck.ui.onSendToPlugin((ev) => void handleInspector(ev?.payload || {}));
service.on("update", () => { scheduleInspector(350); });
service.on("catalog", () => { scheduleInspector(50); void renderAll(true); });
service.on("status", () => { scheduleInspector(50); void renderAll(true); });

process.on("uncaughtException", (error) => streamDeck.logger.error(error?.stack || String(error)));
process.on("unhandledRejection", (error) => streamDeck.logger.error(error?.stack || String(error)));
process.once("SIGTERM", () => service.stop());
process.once("SIGINT", () => service.stop());

async function main() {
  await streamDeck.connect();
  service.start();
  ensureTicker();
}
main().catch((error) => { streamDeck.logger.error(error?.stack || String(error)); process.exitCode = 1; });
