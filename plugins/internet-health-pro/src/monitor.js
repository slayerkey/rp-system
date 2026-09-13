import { EventEmitter } from "node:events";
import { computeMetrics, normalizeGlobalSettings, targetKind } from "./model.js";
import { HistoryStore } from "./history.js";
import {
  pingHost,
  fullConnectivityDiagnostic,
  httpsTiming,
  probeTarget,
  runCloudflareSpeedTest
} from "./probes.js";

export class NetworkMonitor extends EventEmitter {
  constructor({
    historyStore = new HistoryStore(),
    probe = {},
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout
  } = {}) {
    super();
    this.history = historyStore;
    this.probe = {
      pingHost: probe.pingHost || pingHost,
      fullConnectivityDiagnostic: probe.fullConnectivityDiagnostic || fullConnectivityDiagnostic,
      httpsTiming: probe.httpsTiming || httpsTiming,
      probeTarget: probe.probeTarget || probeTarget,
      runCloudflareSpeedTest: probe.runCloudflareSpeedTest || runCloudflareSpeedTest
    };
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.settings = normalizeGlobalSettings();
    this.connectivity = { status: "starting", reason: "WAITING FOR DATA", changedAt: this.now() };
    this.lastDiagnostic = null;
    this.lastHttps = null;
    this.lastCycleAt = 0;
    this.lastDiagnosticAt = 0;
    this.lastHttpsAt = 0;
    this.lastTargetPollAt = 0;
    this.offlineEvidence = 0;
    this.offlineCandidateSince = null;
    this.dnsFailureEvidence = 0;
    this.icmpVerified = false;
    this.timer = null;
    this.running = false;
    this.cyclePromise = null;
    this.speedPromise = null;
    this.speedRunning = false;
    this.targets = new Map();
    this.targetSubscriptions = new Map();
    this.targetCursor = 0;
    this.state = this.history.load();
    this.history.markOnline(this.state.onlineSince || this.now());
  }

  updateSettings(raw = {}) {
    this.settings = normalizeGlobalSettings({ ...this.settings, ...(raw || {}) });
    this.history.setMaxHours(this.settings.historyHours);
    if (this.running) this.schedule(50);
    this.emitUpdate();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.schedule(20);
  }

  stop() {
    this.running = false;
    if (this.timer) this.clearTimer(this.timer);
    this.timer = null;
    this.history.flush(true, this.now());
  }

  schedule(delayMs = null) {
    if (!this.running) return;
    if (this.timer) this.clearTimer(this.timer);
    const base = this.settings.intervalSeconds * 1000;
    let delay = delayMs == null ? base : Math.max(0, Number(delayMs) || 0);
    if (delayMs == null && this.connectivity.status === "offline") {
      const exponent = Math.max(0, this.offlineEvidence - 2);
      delay = Math.min(60_000, Math.max(base, base * (2 ** exponent)));
    }
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.runCycle().finally(() => this.schedule());
    }, delay);
  }

  async refresh() {
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    await this.runCycle();
    this.schedule();
  }

  noteSleepGap(now) {
    if (!this.lastCycleAt) return;
    const expected = this.settings.intervalSeconds * 1000;
    if (now - this.lastCycleAt <= Math.max(45_000, expected * 3)) return;
    this.history.addSample({
      t: now,
      ok: null,
      ms: null,
      method: "unobserved",
      observed: false,
      gap: true,
      lossCounted: false
    });
  }

  setConnectivity(status, reason, now) {
    const changed = status !== this.connectivity.status || reason !== this.connectivity.reason;
    this.connectivity = {
      status,
      reason,
      changedAt: changed ? now : this.connectivity.changedAt
    };
  }

  classifyCycle(primary, diagnostic, now) {
    let latencyResult = primary?.ok ? primary : diagnostic?.fallbackLatency || null;
    let status = "online";
    let reason = "CONNECTION HEALTHY";

    if (primary?.ok) this.icmpVerified = true;

    const ipReachable = Boolean(primary?.ok || diagnostic?.ipReachable);
    const dnsKnown = Boolean(diagnostic);
    const dnsWorks = diagnostic ? Boolean(diagnostic.dnsWorks) : true;

    if (!ipReachable) {
      if (!this.offlineCandidateSince) this.offlineCandidateSince = now;
      this.offlineEvidence += 1;
      this.dnsFailureEvidence = 0;
      if (this.offlineEvidence >= 2) {
        status = "offline";
        reason = "INTERNET OFFLINE";
      } else {
        status = "suspected-offline";
        reason = "CHECKING CONNECTION";
      }
    } else if (dnsKnown && !dnsWorks) {
      this.offlineEvidence = 0;
      this.offlineCandidateSince = null;
      this.dnsFailureEvidence += 1;
      status = this.dnsFailureEvidence >= 2 ? "dns-failure" : "degraded";
      reason = this.dnsFailureEvidence >= 2 ? "DNS FAILURE" : "CHECKING DNS";
    } else {
      this.offlineEvidence = 0;
      this.offlineCandidateSince = null;
      this.dnsFailureEvidence = 0;
      status = "online";
      reason = primary?.ok ? "CONNECTION HEALTHY" : "ICMP BLOCKED • TCP HEALTHY";
    }

    const lossCounted = this.icmpVerified ? true : status === "offline";
    const lossOk = this.icmpVerified ? Boolean(primary?.ok) : status !== "offline";
    const sampleOk = status !== "offline" && status !== "suspected-offline" && Boolean(latencyResult?.ok);
    const sample = {
      t: now,
      ok: sampleOk,
      ms: sampleOk && Number.isFinite(Number(latencyResult?.ms)) ? Number(latencyResult.ms) : null,
      method: sampleOk ? String(latencyResult?.method || "unknown") : "none",
      observed: true,
      counted: true,
      lossCounted,
      lossOk,
      icmpAttempted: true,
      icmpOk: Boolean(primary?.ok)
    };

    return { status, reason, sample };
  }

  updateOutageState(status, reason, now) {
    if (status === "offline") {
      this.history.startOutage(reason, this.offlineCandidateSince || now);
      return;
    }
    if (status === "online" || status === "dns-failure" || status === "degraded") {
      const current = this.history.state.outages[this.history.state.outages.length - 1];
      if (current && !current.end) this.history.endOutage(now);
      else this.history.markOnline(now);
    }
  }

  async runCycle() {
    if (this.cyclePromise) return this.cyclePromise;
    if (this.speedRunning) return null;

    this.cyclePromise = (async () => {
      const now = this.now();
      this.noteSleepGap(now);
      this.lastCycleAt = now;

      const primary = await this.probe.pingHost(this.settings.primaryIcmpTarget, { timeoutMs: 1600 });
      const recovering = ["offline", "suspected-offline", "dns-failure", "degraded"].includes(this.connectivity.status);
      const diagnosticDue = !primary.ok || recovering || now - this.lastDiagnosticAt >= this.settings.diagnosticSeconds * 1000;
      let diagnostic = null;
      if (diagnosticDue) {
        diagnostic = await this.probe.fullConnectivityDiagnostic({
          secondaryIcmpTarget: this.settings.secondaryIcmpTarget,
          timeoutMs: 1800
        });
        this.lastDiagnostic = diagnostic;
        this.lastDiagnosticAt = now;
      } else {
        diagnostic = this.lastDiagnostic;
      }

      const classified = this.classifyCycle(primary, diagnostic, now);
      this.setConnectivity(classified.status, classified.reason, now);
      this.history.addSample(classified.sample);
      this.updateOutageState(classified.status, classified.reason, now);

      if (classified.status !== "offline" && now - this.lastHttpsAt >= this.settings.httpSeconds * 1000) {
        this.lastHttpsAt = now;
        this.lastHttps = await this.probe.httpsTiming("https://www.google.com/generate_204", { timeoutMs: 3000 });
      }

      if (classified.status !== "offline" && now - this.lastTargetPollAt >= this.settings.targetSeconds * 1000) {
        this.lastTargetPollAt = now;
        await this.pollTargets();
      }

      this.history.flush(false, now);
      this.emitUpdate();
      return this.snapshot();
    })().finally(() => {
      this.cyclePromise = null;
    });

    return this.cyclePromise;
  }

  registerTarget(subscriptionId, rawSettings = {}) {
    const id = String(subscriptionId || "");
    if (!id) return;
    this.unregisterTarget(id);

    const target = String(rawSettings.target || "1.1.1.1").trim();
    const requestedMethod = ["auto", "icmp", "tcp", "dns", "https"].includes(rawSettings.targetMethod)
      ? rawSettings.targetMethod
      : "auto";
    const method = requestedMethod;
    const expectedMethod = targetKind(target, requestedMethod);
    const port = Number(rawSettings.targetPort || 443);
    const family = rawSettings.family || "auto";
    const key = [method, target.toLowerCase(), port, family].join("|");

    let record = this.targets.get(key);
    if (!record) {
      record = {
        key,
        target,
        method,
        expectedMethod,
        port,
        family,
        subscribers: new Set(),
        reading: null,
        history: [],
        failureStreak: 0,
        nextPollAt: 0
      };
      this.targets.set(key, record);
    }
    record.subscribers.add(id);
    this.targetSubscriptions.set(id, key);
  }

  unregisterTarget(subscriptionId) {
    const id = String(subscriptionId || "");
    const key = this.targetSubscriptions.get(id);
    if (!key) return;
    const record = this.targets.get(key);
    if (record) {
      record.subscribers.delete(id);
      if (!record.subscribers.size) this.targets.delete(key);
    }
    this.targetSubscriptions.delete(id);
  }

  async pollTargets() {
    const now = this.now();
    const all = [...this.targets.values()];
    if (!all.length) return;

    const ordered = all.slice(this.targetCursor).concat(all.slice(0, this.targetCursor));
    const records = ordered.filter((record) => now >= Number(record.nextPollAt || 0)).slice(0, 8);
    this.targetCursor = all.length ? (this.targetCursor + Math.max(1, records.length)) % all.length : 0;

    await Promise.all(records.map(async (record) => {
      const result = await this.probe.probeTarget(record.target, {
        method: record.method,
        port: record.port,
        family: record.family,
        timeoutMs: 2500
      });
      record.reading = { ...result, t: now };
      record.history.push({
        t: now,
        ok: Boolean(result.ok),
        ms: Number.isFinite(Number(result.ms)) ? Number(result.ms) : null,
        method: result.method || record.method
      });
      if (result.ok) {
        record.failureStreak = 0;
        record.nextPollAt = now + this.settings.targetSeconds * 1000;
      } else {
        record.failureStreak += 1;
        const backoffMs = Math.min(300_000, this.settings.targetSeconds * 1000 * (2 ** Math.max(0, record.failureStreak - 1)));
        record.nextPollAt = now + backoffMs;
      }
      const cutoff = now - 2 * 60 * 60 * 1000;
      record.history = record.history.filter((sample) => sample.t >= cutoff).slice(-500);
    }));
  }

  targetSnapshot(subscriptionId) {
    const key = this.targetSubscriptions.get(String(subscriptionId || ""));
    const record = key ? this.targets.get(key) : null;
    if (!record) return null;
    return {
      target: record.target,
      configuredMethod: record.method,
      expectedMethod: record.expectedMethod,
      port: record.port,
      family: record.family,
      reading: record.reading,
      history: record.history.slice()
    };
  }

  async runSpeedTest() {
    if (this.speedPromise) return this.speedPromise;
    this.speedPromise = (async () => {
      if (this.cyclePromise) {
        try { await this.cyclePromise; } catch {}
      }
      this.speedRunning = true;
      this.emitUpdate();
      try {
        const result = await this.probe.runCloudflareSpeedTest({
          downloadBytes: 64_000_000,
          uploadBytes: 4_000_000,
          warmupBytes: 1_000_000,
          probeBytes: 4_000_000,
          timeoutMs: 45_000
        });
        this.history.addSpeedTest(result);
        this.history.flush(true, this.now());
        return result;
      } finally {
        this.speedRunning = false;
        this.emitUpdate();
      }
    })().finally(() => {
      this.speedPromise = null;
      if (this.running) this.schedule(50);
    });
    return this.speedPromise;
  }

  snapshot() {
    const samples = this.history.state.samples.slice();
    const latestSpeed = this.history.state.speedTests.length
      ? this.history.state.speedTests[this.history.state.speedTests.length - 1]
      : null;
    return {
      connectivity: { ...this.connectivity },
      samples,
      metrics5: computeMetrics(samples, 5, this.now()),
      metrics30: computeMetrics(samples, 30, this.now()),
      metrics120: computeMetrics(samples, 120, this.now()),
      outages: this.history.state.outages.map((item) => ({ ...item })),
      onlineSince: this.history.state.onlineSince,
      diagnostic: this.lastDiagnostic,
      https: this.lastHttps,
      speedRunning: this.speedRunning,
      latestSpeed,
      targetCount: this.targets.size,
      monitoringIntervalSeconds: this.settings.intervalSeconds,
      bandwidthBudget: {
        backgroundProbePayload: "tiny control traffic only",
        speedTest: "manual only, warmed adaptive test capped at about 80 MB per run"
      }
    };
  }

  emitUpdate() {
    this.emit("update", this.snapshot());
  }
}
