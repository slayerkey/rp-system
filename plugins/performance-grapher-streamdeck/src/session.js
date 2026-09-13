import { BoundedHistory, FPS_ARCHIVE_MAX, FPS_RECENT_MAX } from "./history.js";
import { LowFpsHistogram } from "./stats.js";

const IGNORED = new Set([
  "dwm.exe", "explorer.exe", "streamdeck.exe", "streamdeckui.exe", "presentmon.exe",
  "packrat.performancetelemetry.exe", "searchhost.exe", "shellexperiencehost.exe",
  "applicationframehost.exe", "textinputhost.exe", "startmenuexperiencehost.exe",
]);

function processName(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  return text.endsWith(".exe") ? text : text + ".exe";
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function metricValue(metrics, id) {
  const value = metrics?.[id];
  return finite(value);
}

function cloneSummary(session, endedAt = null) {
  if (!session) return null;
  return {
    process: session.process,
    startedAt: session.startedAt,
    endedAt,
    durationMs: Math.max(0, (endedAt || Date.now()) - session.startedAt),
    averageFps: session.histogram.average(),
    onePercentLow: session.histogram.lowest(0.01),
    pointOnePercentLow: session.histogram.lowest(0.001),
    worstFrametimeMs: session.worstFrametimeMs || null,
    peakGpuTemperature: session.peaks.gpuTemperature,
    peakCpuTemperature: session.peaks.cpuTemperature,
    peakGpuLoad: session.peaks.gpuLoad,
    samples: session.histogram.count,
    pressure: pressureLabel(session.pressure),
  };
}

function pressureLabel(pressure) {
  const total = pressure.gpu + pressure.cpu + pressure.mixed;
  if (total < 3) return "NOT ENOUGH SPIKES";
  if (pressure.gpu / total >= 0.6) return "GPU PRESSURE";
  if (pressure.cpu / total >= 0.6) return "CPU PRESSURE";
  return "MIXED / UNKNOWN";
}

export class SessionTracker {
  constructor({ switchMs = 1200, idleMs = 3000 } = {}) {
    this.switchMs = switchMs;
    this.idleMs = idleMs;
    this.foreground = "";
    this.active = null;
    this.lastCompleted = null;
    this.candidate = null;
    this.activity = new Map();
    this.bucket = null;
    this.recent = new BoundedHistory({ rawMax: FPS_RECENT_MAX, archiveMax: FPS_ARCHIVE_MAX, archiveMs: 1000, archiveMode: "min" });
    this.currentFps = null;
    this.lastFrameAt = 0;
  }

  setForeground(value) {
    this.foreground = processName(value);
  }

  _touchActivity(app, now) {
    const prior = this.activity.get(app);
    if (!prior || now - prior.since > 2000) this.activity.set(app, { since: now, last: now, count: 1 });
    else {
      prior.last = now;
      prior.count += 1;
    }
    for (const [key, value] of this.activity) {
      if (now - value.last > 2500) this.activity.delete(key);
    }
  }

  _candidateProcess(app, now) {
    const preferred = Boolean(this.foreground && app === this.foreground);
    const activity = this.activity.get(app);
    const dominant = Boolean(activity && activity.count >= 20 && now - activity.since >= 500);
    if (!preferred && !dominant) return null;

    if (!this.candidate || this.candidate.process !== app) {
      this.candidate = { process: app, since: now, frames: 1, preferred };
      return null;
    }
    this.candidate.frames += 1;
    this.candidate.preferred ||= preferred;
    const stableFor = now - this.candidate.since;
    const needed = this.candidate.preferred ? Math.min(this.switchMs, 650) : this.switchMs;
    if (stableFor >= needed && this.candidate.frames >= 8) return app;
    return null;
  }

  _start(process, now) {
    if (this.active) this._finish(now);
    this.active = {
      process,
      startedAt: now,
      lastFrameAt: now,
      histogram: new LowFpsHistogram(),
      worstFrametimeMs: 0,
      peaks: { gpuTemperature: null, cpuTemperature: null, gpuLoad: null },
      pressure: { gpu: 0, cpu: 0, mixed: 0 },
    };
    this.bucket = null;
    this.currentFps = null;
    this.recent = new BoundedHistory({ rawMax: FPS_RECENT_MAX, archiveMax: FPS_ARCHIVE_MAX, archiveMs: 1000, archiveMode: "min" });
    this.candidate = null;
  }

  _finish(now) {
    if (!this.active) return null;
    this._flushBucket(now, {});
    this.lastCompleted = cloneSummary(this.active, now);
    this.active = null;
    this.bucket = null;
    this.currentFps = null;
    this.candidate = null;
    return this.lastCompleted;
  }

  _updatePeaks(metrics) {
    if (!this.active) return;
    const gpuTemp = metricValue(metrics, "gpu.temperature");
    const cpuTemp = metricValue(metrics, "cpu.temperature");
    const gpuLoad = metricValue(metrics, "gpu.load");
    if (gpuTemp !== null) this.active.peaks.gpuTemperature = Math.max(this.active.peaks.gpuTemperature ?? -Infinity, gpuTemp);
    if (cpuTemp !== null) this.active.peaks.cpuTemperature = Math.max(this.active.peaks.cpuTemperature ?? -Infinity, cpuTemp);
    if (gpuLoad !== null) this.active.peaks.gpuLoad = Math.max(this.active.peaks.gpuLoad ?? -Infinity, gpuLoad);
  }

  _flushBucket(now, metrics) {
    const bucket = this.bucket;
    if (!bucket || !this.active || !bucket.count) return;
    const averageFrame = bucket.sumFrameMs / bucket.count;
    const fps = averageFrame > 0 ? 1000 / averageFrame : null;
    if (Number.isFinite(fps)) {
      this.currentFps = fps;
      this.recent.push(bucket.startedAt, fps);
    }

    this.active.worstFrametimeMs = Math.max(this.active.worstFrametimeMs, bucket.worstFrameMs);
    this._updatePeaks(metrics);

    if (bucket.worstFrameMs >= 25) {
      const gpuLoad = metricValue(metrics, "gpu.load");
      const cpuLoad = metricValue(metrics, "cpu.load");
      if (gpuLoad !== null && gpuLoad >= 95) this.active.pressure.gpu += 1;
      else if (cpuLoad !== null && cpuLoad >= 90 && (gpuLoad === null || gpuLoad < 90)) this.active.pressure.cpu += 1;
      else this.active.pressure.mixed += 1;
    }

    this.bucket = null;
  }

  observeFrame(frame, metrics = {}, now = Date.now()) {
    const app = processName(frame?.application);
    const frameMs = finite(frame?.frameTimeMs);
    if (!app || IGNORED.has(app) || frameMs === null || frameMs <= 0 || frameMs > 5000) return false;
    this._touchActivity(app, now);

    if (!this.active || this.active.process !== app) {
      const selected = this._candidateProcess(app, now);
      if (selected) this._start(selected, now);
    }

    if (!this.active || this.active.process !== app) return false;
    this.active.lastFrameAt = now;
    this.lastFrameAt = now;
    this.active.worstFrametimeMs = Math.max(this.active.worstFrametimeMs, frameMs);
    this.active.histogram.add(1000 / frameMs);

    if (!this.bucket) {
      this.bucket = { startedAt: now, count: 0, sumFrameMs: 0, worstFrameMs: 0 };
    }
    if (now - this.bucket.startedAt >= 100) {
      this._flushBucket(now, metrics);
      this.bucket = { startedAt: now, count: 0, sumFrameMs: 0, worstFrameMs: 0 };
    }
    this.bucket.count += 1;
    this.bucket.sumFrameMs += frameMs;
    this.bucket.worstFrameMs = Math.max(this.bucket.worstFrameMs, frameMs);
    return true;
  }

  tick(metrics = {}, now = Date.now()) {
    if (this.bucket && now - this.bucket.startedAt >= 120) this._flushBucket(now, metrics);
    if (this.active && now - this.active.lastFrameAt >= this.idleMs) return this._finish(now);
    return null;
  }

  reset(now = Date.now()) {
    const completed = this._finish(now);
    this.lastCompleted = completed;
    return completed;
  }

  snapshot(now = Date.now()) {
    const current = cloneSummary(this.active, null);
    if (current) current.durationMs = now - this.active.startedAt;
    return {
      active: Boolean(this.active),
      process: this.active?.process || null,
      currentFps: this.currentFps,
      currentFrametimeMs: this.currentFps ? 1000 / this.currentFps : null,
      current,
      lastCompleted: this.lastCompleted,
      recent: this.recent,
    };
  }

  setLastCompleted(summary) {
    if (!summary || typeof summary !== "object") return;
    this.lastCompleted = {
      process: String(summary.process || ""),
      startedAt: finite(summary.startedAt),
      endedAt: finite(summary.endedAt),
      durationMs: finite(summary.durationMs),
      averageFps: finite(summary.averageFps),
      onePercentLow: finite(summary.onePercentLow),
      pointOnePercentLow: finite(summary.pointOnePercentLow),
      worstFrametimeMs: finite(summary.worstFrametimeMs),
      peakGpuTemperature: finite(summary.peakGpuTemperature),
      peakCpuTemperature: finite(summary.peakCpuTemperature),
      peakGpuLoad: finite(summary.peakGpuLoad),
      samples: finite(summary.samples),
      pressure: String(summary.pressure || "MIXED / UNKNOWN"),
    };
  }
}
