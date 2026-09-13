import streamDeck, { SingletonAction } from "@elgato/streamdeck";
import { normalizeActionSettings, normalizeGlobalSettings } from "./model.js";
import { NetworkMonitor } from "./monitor.js";
import { renderKey } from "./render.js";

const BUILD_VERSION = "1.0.0.0";
const ACTIONS = {
  health: "com.packrat.internet-health-pro.health",
  latency: "com.packrat.internet-health-pro.latency",
  "jitter-loss": "com.packrat.internet-health-pro.jitter-loss",
  outage: "com.packrat.internet-health-pro.outage",
  target: "com.packrat.internet-health-pro.target",
  "speed-test": "com.packrat.internet-health-pro.speed-test",
  summary: "com.packrat.internet-health-pro.summary"
};

const monitor = new NetworkMonitor();
const visible = new Map();
let latest = monitor.snapshot();
let renderTimer = null;

function logger(message) {
  try { streamDeck.logger.error(String(message)); } catch {}
}

function scheduleRender(delay = 25) {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    void renderAll();
  }, delay);
}

async function sendInspector(record) {
  if (!record?.action) return;
  const metrics = record.settings.historyWindow === 5
    ? latest.metrics5
    : record.settings.historyWindow === 120
      ? latest.metrics120
      : latest.metrics30;
  const target = record.kind === "target" ? monitor.targetSnapshot(record.id) : null;
  try {
    await record.action.sendToPropertyInspector({
      type: "internetHealth.state",
      buildVersion: BUILD_VERSION,
      kind: record.kind,
      connectivity: latest.connectivity,
      metrics,
      diagnostic: latest.diagnostic ? {
        ipReachable: Boolean(latest.diagnostic.ipReachable),
        dnsWorks: Boolean(latest.diagnostic.dnsWorks)
      } : null,
      https: latest.https ? {
        ok: Boolean(latest.https.ok),
        ms: latest.https.ms,
        status: latest.https.status,
        method: latest.https.method
      } : null,
      speedRunning: latest.speedRunning,
      latestSpeed: latest.latestSpeed,
      target: target ? {
        target: target.target,
        method: target.reading?.method || target.configuredMethod,
        reading: target.reading
      } : null,
      monitoringIntervalSeconds: latest.monitoringIntervalSeconds
    });
  } catch {}
}

async function renderRecord(record) {
  if (!record?.action?.isKey?.()) return;
  const target = record.kind === "target" ? monitor.targetSnapshot(record.id) : null;
  const image = renderKey(record.kind, latest, record.settings, target);
  if (image === record.lastImage) return;
  record.lastImage = image;
  await record.action.setImage(image).catch(logger);
}

async function renderAll() {
  await Promise.allSettled([...visible.values()].map(renderRecord));
  for (const record of visible.values()) {
    if (record.inspectorOpen) void sendInspector(record);
  }
}

function registerTarget(record) {
  if (!record || record.kind !== "target") return;
  monitor.registerTarget(record.id, record.settings);
}

class InternetHealthAction extends SingletonAction {
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
      settings: normalizeActionSettings(ev.payload?.settings),
      lastImage: "",
      inspectorOpen: false
    };
    visible.set(id, record);
    registerTarget(record);
    await renderRecord(record);
  }

  onWillDisappear(ev) {
    const id = String(ev.action?.id || "");
    monitor.unregisterTarget(id);
    visible.delete(id);
  }

  async onDidReceiveSettings(ev) {
    const id = String(ev.action?.id || "");
    const record = visible.get(id);
    if (!record) return;
    record.settings = normalizeActionSettings(ev.payload?.settings);
    record.lastImage = "";
    registerTarget(record);
    await renderRecord(record);
    await sendInspector(record);
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
    if (payload.type === "internetHealth.inspect") {
      await sendInspector(record);
      return;
    }
    if (payload.type !== "internetHealth.command") return;

    const command = String(payload.command || "");
    if (command === "refresh") {
      await monitor.refresh();
    } else if (command === "speedTest") {
      const result = await monitor.runSpeedTest();
      if (result?.ok) await record.action.showOk().catch(() => {});
      else await record.action.showAlert().catch(() => {});
    }
    await sendInspector(record);
  }

  async onKeyDown(ev) {
    const record = visible.get(String(ev.action?.id || ""));
    if (!record) return;
    if (record.kind === "speed-test") {
      const result = await monitor.runSpeedTest();
      if (result?.ok) await ev.action.showOk().catch(() => {});
      else await ev.action.showAlert().catch(() => {});
      return;
    }
    await monitor.refresh();
  }
}

for (const [kind, manifestId] of Object.entries(ACTIONS)) {
  streamDeck.actions.registerAction(new InternetHealthAction(manifestId, kind));
}

monitor.on("update", (snapshot) => {
  latest = snapshot;
  scheduleRender();
});

process.on("beforeExit", () => monitor.stop());
process.on("SIGINT", () => {
  monitor.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  monitor.stop();
  process.exit(0);
});
process.on("uncaughtException", (error) => logger(error?.stack || error));
process.on("unhandledRejection", (error) => logger(error?.stack || error));

async function main() {
  streamDeck.settings.onDidReceiveGlobalSettings?.((ev) => {
    monitor.updateSettings(normalizeGlobalSettings(ev?.payload?.settings || {}));
  });
  streamDeck.system.onSystemDidWakeUp?.(() => void monitor.refresh());
  await streamDeck.connect();

  try {
    const globals = await streamDeck.settings.getGlobalSettings();
    monitor.updateSettings(normalizeGlobalSettings(globals || {}));
  } catch {}

  monitor.start();
}

main().catch((error) => {
  logger(error?.stack || error?.message || error);
  process.exitCode = 1;
});
