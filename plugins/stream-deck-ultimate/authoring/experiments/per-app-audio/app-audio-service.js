"use strict";
const model = require("./session-model.js");

function stableTarget(target = {}, foreground = {}) {
  const kind = String(target.kind || "process").toLowerCase();
  if (kind !== "current") return { ...target };
  const pid = Number(foreground.pid);
  if (Number.isInteger(pid) && pid > 0) return { kind: "pid", pid };
  const process = model.normalizeProcessName(foreground.process);
  return process ? { kind: "process", process } : { kind: "process", process: "" };
}

function targetKey(target = {}) {
  if (String(target.kind).toLowerCase() === "pid") return `pid:${Number(target.pid) || 0}`;
  return `process:${model.normalizeProcessName(target.process || target.match)}`;
}

class AppAudioService {
  constructor(options = {}) {
    if (!options.worker) throw new Error("AppAudioService requires a worker");
    this.worker = options.worker;
    this.foregroundProvider = options.foregroundProvider || (() => ({}));
    this.now = options.now || (() => Date.now());
    this.cacheMs = Math.max(50, Number(options.cacheMs || 650));
    this.coalesceMs = Math.max(10, Number(options.coalesceMs || 55));
    this.sessions = [];
    this.lastRefreshAt = 0;
    this.refreshPromise = null;
    this.lastError = null;
    this.pendingAdjust = new Map();
    this.disposed = false;
  }

  async foreground() {
    try { return (await this.foregroundProvider()) || {}; }
    catch { return {}; }
  }

  invalidate() { this.lastRefreshAt = 0; }

  async refresh(force = false) {
    if (this.disposed) return this.sessions;
    const fresh = this.lastRefreshAt && (this.now() - this.lastRefreshAt) < this.cacheMs;
    if (!force && fresh) return this.sessions;
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      try {
        const rows = await this.worker.list();
        this.sessions = Array.isArray(rows) ? rows : [];
        this.lastError = null;
      } catch (e) {
        this.sessions = [];
        this.lastError = e;
      } finally {
        this.lastRefreshAt = this.now();
        this.refreshPromise = null;
      }
      return this.sessions;
    })();
    return this.refreshPromise;
  }

  unavailableState(target, foreground = {}) {
    const selector = model.resolveSelector(target, foreground);
    return {
      status: "unavailable", label: "AUDIO OFF", process: selector?.processKey || "",
      selector, sessionCount: 0, pidCount: 0, pids: [], volume: null, volumeMin: null,
      volumeMax: null, mixedVolume: false, muted: null, mixedMute: false, writable: false,
      error: String(this.lastError?.message || this.lastError || "Audio service unavailable")
    };
  }

  async stateFor(target, foregroundOverride) {
    const foreground = foregroundOverride || await this.foreground();
    await this.refresh(false);
    return this.lastError ? this.unavailableState(target, foreground) : model.buildChannelState(this.sessions, target, foreground);
  }

  async _runPlan(plan) {
    if (!plan?.execute) return { executed: false, plan, native: null };
    let native;
    if (plan.action === "SetVolume") native = await this.worker.setVolume(plan.match, plan.value);
    else if (plan.action === "AdjustVolume") native = await this.worker.adjustVolume(plan.match, plan.value);
    else if (plan.action === "Mute") native = await this.worker.mute(plan.match);
    else if (plan.action === "Unmute") native = await this.worker.unmute(plan.match);
    else if (plan.action === "ToggleMute") native = await this.worker.toggleMute(plan.match);
    else return { executed: false, plan: { ...plan, execute: false, reason: "unsupported-native-action" }, native: null };
    return { executed: true, plan, native };
  }

  async execute(target, command, foregroundOverride) {
    const foreground = foregroundOverride || await this.foreground();
    await this.refresh(false);
    const before = this.lastError ? this.unavailableState(target, foreground) : model.buildChannelState(this.sessions, target, foreground);
    if (before.status === "unavailable") return { executed: false, reason: "unavailable", before, after: before };
    const plan = model.planCommand(before, command);
    if (!plan.execute) return { executed: false, reason: plan.reason, plan, before, after: before };
    try {
      const result = await this._runPlan(plan);
      this.invalidate();
      // Native exact writes report missing=true if the session disappeared after our cached snapshot.
      if (result.native?.missing) {
        await this.refresh(true);
        const afterMissing = this.lastError ? this.unavailableState(target, foreground) : model.buildChannelState(this.sessions, target, foreground);
        return { ...result, executed: false, reason: "session-disappeared", before, after: afterMissing };
      }
      await this.refresh(true);
      const after = this.lastError ? this.unavailableState(target, foreground) : model.buildChannelState(this.sessions, target, foreground);
      return { ...result, before, after };
    } catch (e) {
      this.lastError = e;
      this.sessions = [];
      this.lastRefreshAt = this.now();
      const after = this.unavailableState(target, foreground);
      return { executed: false, reason: "native-error", error: e, plan, before, after };
    }
  }

  async adjustCoalesced(target, delta, foregroundOverride) {
    if (this.disposed) return { executed: false, reason: "disposed" };
    const foreground = foregroundOverride || await this.foreground();
    const concrete = stableTarget(target, foreground);
    const key = targetKey(concrete);
    if (!key || /:(0|)$/.test(key)) return { executed: false, reason: "unconfigured" };
    return new Promise((resolve, reject) => {
      let p = this.pendingAdjust.get(key);
      if (!p) {
        p = { target: concrete, delta: 0, waiters: [], timer: null };
        this.pendingAdjust.set(key, p);
      }
      p.delta += Number(delta || 0);
      p.waiters.push({ resolve, reject });
      clearTimeout(p.timer);
      p.timer = setTimeout(() => this._flushAdjust(key), this.coalesceMs);
    });
  }

  async _flushAdjust(key) {
    const p = this.pendingAdjust.get(key);
    if (!p) return;
    this.pendingAdjust.delete(key);
    clearTimeout(p.timer);
    const delta = Math.round(model.clamp(p.delta, -100, 100, 0));
    let result;
    try {
      result = delta ? await this.execute(p.target, { type: "adjust-volume", delta }, {}) : { executed: false, reason: "zero-delta" };
      for (const w of p.waiters) w.resolve(result);
    } catch (e) {
      for (const w of p.waiters) w.reject(e);
    }
  }

  async flushAll() {
    const keys = [...this.pendingAdjust.keys()];
    await Promise.all(keys.map(k => this._flushAdjust(k)));
  }

  async dispose() {
    if (this.disposed) return;
    await this.flushAll();
    this.disposed = true;
  }
}

module.exports = { AppAudioService, stableTarget, targetKey };
