import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { cpus, freemem, homedir, totalmem } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { BoundedHistory } from "./history.js";
import { PresentMonProvider } from "./presentmon.js";
import { SessionTracker } from "./session.js";

const CANONICAL = new Set([
  "cpu.load", "ram.load", "cpu.temperature", "gpu.temperature", "gpu.load", "gpu.power", "cpu.power",
]);

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function norm(text) {
  return String(text || "").trim().toLowerCase();
}

function descriptorScore(sensor, target) {
  const hardware = norm(sensor.hardwareType);
  const type = norm(sensor.sensorType);
  const name = norm(sensor.name);
  const isGpu = hardware.includes("gpu");
  const isCpu = hardware === "cpu" || hardware.includes("cpu");

  if (target === "gpu.temperature" && isGpu && type === "temperature") {
    if (name.includes("gpu core")) return 100;
    if (name.includes("core")) return 90;
    if (name.includes("hot spot") || name.includes("hotspot")) return 65;
    return 50;
  }
  if (target === "cpu.temperature" && isCpu && type === "temperature") {
    if (name.includes("package")) return 100;
    if (name.includes("tctl") || name.includes("tdie")) return 95;
    if (name.includes("core max")) return 90;
    if (name.includes("core")) return 70;
    return 50;
  }
  if (target === "gpu.load" && isGpu && type === "load") {
    if (name === "gpu core" || name.includes("gpu core")) return 100;
    if (name.includes("d3d 3d")) return 90;
    if (name.includes("3d")) return 80;
    return 40;
  }
  if (target === "gpu.power" && isGpu && type === "power") {
    if (name.includes("package") || name.includes("total")) return 100;
    if (name.includes("gpu")) return 80;
    return 50;
  }
  if (target === "cpu.power" && isCpu && type === "power") {
    if (name.includes("package")) return 100;
    return 60;
  }
  return -1;
}

export class TelemetryService extends EventEmitter {
  constructor({ pluginRoot = null, persistPath = null, log = () => {} } = {}) {
    super();
    const here = dirname(fileURLToPath(import.meta.url));
    this.pluginRoot = pluginRoot || resolve(here, "..");
    this.log = log;
    this.persistPath = persistPath || resolve(process.env.LOCALAPPDATA || homedir(), "PackRat", "PerformanceGrapher", "state.json");
    this.values = new Map();
    this.timestamps = new Map();
    this.catalog = new Map();
    this.histories = new Map();
    this.watched = new Set();
    this.aliases = new Map();
    this.hardwareCatalog = [];
    this.hardware = null;
    this.hardwareBackoff = null;
    this.nativeTimer = null;
    this.sessionTimer = null;
    this.persistTimer = null;
    this.started = false;
    this.stopping = false;
    this.previousCpu = null;
    this.session = new SessionTracker();
    this.status = {
      hardware: { state: "starting", detail: null },
      fps: { state: "starting", detail: null },
    };

    let presentMonExecutable = "PresentMon.exe";
    try {
      const provider = JSON.parse(readFileSync(resolve(this.pluginRoot, "third_party", "presentmon", "provider.json"), "utf8"));
      if (provider?.executable) presentMonExecutable = String(provider.executable);
    } catch {}
    const presentMonPath = resolve(this.pluginRoot, "third_party", "presentmon", presentMonExecutable);
    this.presentMon = new PresentMonProvider({ executable: presentMonPath, log });
    this.presentMon.on("frame", (frame) => {
      const metrics = Object.fromEntries(this.values);
      if (this.session.observeFrame(frame, metrics, Date.now())) this._emitFrameUpdate();
    });
    this.presentMon.on("status", (status) => {
      this.status.fps = status;
      this.emit("status", this.safeStatus());
      this.emit("update", { kind: "status" });
    });

    this._registerDescriptor({ id: "cpu.load", name: "CPU Load", unit: "%", source: "Windows", sensorType: "Load" });
    this._registerDescriptor({ id: "ram.load", name: "RAM Used", unit: "%", source: "Windows", sensorType: "Load" });
    this._registerDescriptor({ id: "game.fps", name: "Game FPS", unit: "FPS", source: "PresentMon", sensorType: "FPS" });
    this._registerDescriptor({ id: "game.frametime", name: "Frametime", unit: "ms", source: "PresentMon", sensorType: "Frametime" });
  }

  _registerDescriptor(descriptor) {
    if (!descriptor?.id) return;
    this.catalog.set(descriptor.id, { ...descriptor });
  }

  _history(id) {
    if (!this.histories.has(id)) this.histories.set(id, new BoundedHistory({ archiveMode: "max" }));
    return this.histories.get(id);
  }

  watchMetric(id) {
    const key = String(id || "");
    if (!key) return;
    if (this.watched.has(key)) this.watched.delete(key);
    this.watched.add(key);
    while (this.watched.size > 32) this.watched.delete(this.watched.values().next().value);
  }

  metricDescriptor(id) {
    return this.catalog.get(String(id || "")) || null;
  }

  metricValue(id) {
    const key = String(id || "");
    if (key === "game.fps") return this.session.snapshot().currentFps;
    if (key === "game.frametime") return this.session.snapshot().currentFrametimeMs;
    if (!this.values.has(key)) return null;
    const at = this.timestamps.get(key);
    if (!Number.isFinite(at) || Date.now() - at > 5000) return null;
    return this.values.get(key);
  }

  metricSeries(id, windowMs) {
    const key = String(id || "");
    const requestedWindow = Number(windowMs);
    const now = Date.now();
    const session = this.session.snapshot(now);
    const summary = session.current || session.lastCompleted;
    const sessionStart = Number(summary?.startedAt);
    const sessionEnd = Number(summary?.endedAt);

    const scopeSession = (points) => {
      if (requestedWindow !== 0) return points;
      if (!Number.isFinite(sessionStart)) return [];
      const end = Number.isFinite(sessionEnd) ? sessionEnd : now;
      return points.filter(([at]) => at >= sessionStart && at <= end);
    };

    if (key === "game.fps" || key === "game.frametime") {
      const points = scopeSession(session.recent.series(requestedWindow, now));
      if (key === "game.fps") return points;
      return points.map(([t, fps]) => [t, fps > 0 ? 1000 / fps : 0]);
    }

    return scopeSession(this._history(key).series(requestedWindow, now));
  }

  metricCatalog() {
    return [...this.catalog.values()].sort((a, b) => {
      const aKey = (a.source || "") + "|" + (a.hardwareName || "") + "|" + a.name;
      const bKey = (b.source || "") + "|" + (b.hardwareName || "") + "|" + b.name;
      return aKey.localeCompare(bKey);
    });
  }

  safeStatus() {
    return {
      hardware: { ...this.status.hardware },
      fps: { ...this.status.fps },
    };
  }

  snapshot() {
    const session = this.session.snapshot();
    return {
      status: this.safeStatus(),
      session: {
        active: session.active,
        process: session.process,
        currentFps: session.currentFps,
        currentFrametimeMs: session.currentFrametimeMs,
        current: session.current,
        lastCompleted: session.lastCompleted,
      },
      metrics: this.metricCatalog().map((item) => ({ ...item, value: this.metricValue(item.id) })),
    };
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    await this._restore();
    this._sampleWindows();
    this.nativeTimer = setInterval(() => this._sampleWindows(), 1000);
    this.nativeTimer.unref?.();
    this.sessionTimer = setInterval(() => {
      const completed = this.session.tick(Object.fromEntries(this.values), Date.now());
      if (completed) {
        this._schedulePersist();
        this.emit("session", completed);
      }
      this.emit("update", { kind: "frame" });
    }, 250);
    this.sessionTimer.unref?.();
    this._startHardware();
    this.presentMon.start();
  }

  stop() {
    this.stopping = true;
    this.started = false;
    if (this.nativeTimer) clearInterval(this.nativeTimer);
    if (this.sessionTimer) clearInterval(this.sessionTimer);
    if (this.persistTimer) clearTimeout(this.persistTimer);
    if (this.hardwareBackoff) clearTimeout(this.hardwareBackoff);
    this.nativeTimer = null;
    this.sessionTimer = null;
    this.persistTimer = null;
    this.hardwareBackoff = null;
    this.presentMon.stop();
    if (this.hardware) {
      try { this.hardware.kill(); } catch {}
      this.hardware = null;
    }
    void this._persistNow();
  }

  resume() {
    if (!this.started) return this.start();
    this.presentMon.restart();
    if (!this.hardware) this._startHardware();
  }

  restartFps() {
    this.presentMon.restart();
  }

  resetSession() {
    const summary = this.session.reset(Date.now());
    this._schedulePersist();
    this.emit("update", { kind: "frame" });
    return summary;
  }

  _emitFrameUpdate() {
    const now = Date.now();
    if (this.lastFrameEmit && now - this.lastFrameEmit < 90) return;
    this.lastFrameEmit = now;
    this.emit("update", { kind: "frame" });
  }

  _sampleWindows() {
    const cores = cpus();
    let idle = 0;
    let total = 0;
    for (const core of cores) {
      const times = core.times || {};
      const coreIdle = Number(times.idle) || 0;
      const coreTotal = Object.values(times).reduce((sum, value) => sum + (Number(value) || 0), 0);
      idle += coreIdle;
      total += coreTotal;
    }
    if (this.previousCpu) {
      const idleDelta = idle - this.previousCpu.idle;
      const totalDelta = total - this.previousCpu.total;
      if (totalDelta > 0) this._setMetric("cpu.load", 100 * (1 - idleDelta / totalDelta), Date.now());
    }
    this.previousCpu = { idle, total };

    const totalRam = totalmem();
    if (totalRam > 0) this._setMetric("ram.load", 100 * (1 - freemem() / totalRam), Date.now());
    this.emit("update", { kind: "sensor" });
  }

  _setMetric(id, value, at, descriptor = null) {
    const number = finite(value);
    if (number === null) return;
    if (descriptor) this._registerDescriptor(descriptor);
    this.values.set(id, number);
    this.timestamps.set(id, Number(at) || Date.now());
    this._history(id).push(at, number);
    if (CANONICAL.has(id) || this.watched.has(id)) this._schedulePersist();
  }

  _startHardware() {
    if (this.stopping || this.hardware) return;
    const exe = resolve(this.pluginRoot, "native", "telemetry", "PackRat.PerformanceTelemetry.exe");
    let child;
    try {
      child = spawn(exe, [], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      this.status.hardware = { state: "unavailable", detail: error?.message || String(error) };
      this.emit("status", this.safeStatus());
      return;
    }

    this.hardware = child;
    this.status.hardware = { state: "starting", detail: null };
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => this._consumeHardwareLine(line));
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + String(chunk || "")).slice(-8000); });
    child.once("error", (error) => {
      this.status.hardware = { state: "unavailable", detail: error?.message || String(error) };
      this.emit("status", this.safeStatus());
    });
    child.once("exit", (code) => {
      if (this.hardware === child) this.hardware = null;
      lines.close();
      if (this.stopping) return;
      if (this.status.hardware.state !== "degraded") {
        this.status.hardware = { state: "offline", detail: ("Sensor helper exited " + code + ". " + stderr).trim().slice(0, 700) };
      }
      this.emit("status", this.safeStatus());
      this.hardwareBackoff = setTimeout(() => {
        this.hardwareBackoff = null;
        this._startHardware();
      }, 5000);
      this.hardwareBackoff.unref?.();
    });
  }

  _consumeHardwareLine(line) {
    let message;
    try { message = JSON.parse(String(line || "")); } catch { return; }
    if (message.type === "status") {
      this.status.hardware = { state: String(message.status || "degraded"), detail: message.error ? String(message.error) : null };
      this.emit("status", this.safeStatus());
      return;
    }
    if (message.type === "catalog") {
      this.hardwareCatalog = Array.isArray(message.sensors) ? message.sensors.filter((x) => x?.id) : [];
      for (const sensor of this.hardwareCatalog) {
        this._registerDescriptor({
          id: sensor.id,
          name: String(sensor.name || sensor.id),
          unit: String(sensor.unit || ""),
          source: "Libre Hardware Monitor",
          sensorType: String(sensor.sensorType || ""),
          hardwareType: String(sensor.hardwareType || ""),
          hardwareName: String(sensor.hardwareName || ""),
        });
      }
      this._selectAliases();
      this.status.hardware = { state: "ready", detail: null };
      this.emit("catalog", this.metricCatalog());
      this.emit("status", this.safeStatus());
      return;
    }
    if (message.type !== "sample" || !message.values || typeof message.values !== "object") return;

    const at = finite(message.at) ?? Date.now();
    this.session.setForeground(message.foregroundProcess);
    for (const [id, value] of Object.entries(message.values)) {
      const descriptor = this.catalog.get(id);
      this._setMetric(id, value, at, descriptor);
    }
    for (const [alias, id] of this.aliases) {
      if (Object.prototype.hasOwnProperty.call(message.values, id)) {
        const source = this.catalog.get(id);
        this._setMetric(alias, message.values[id], at, {
          id: alias,
          name: alias === "gpu.temperature" ? "GPU Temperature" :
            alias === "cpu.temperature" ? "CPU Temperature" :
            alias === "gpu.load" ? "GPU Load" :
            alias === "gpu.power" ? "GPU Power" : "CPU Power",
          unit: source?.unit || "",
          source: "Libre Hardware Monitor",
          sensorType: source?.sensorType || "",
          hardwareName: source?.hardwareName || "",
        });
      }
    }
    this.status.hardware = { state: "ready", detail: null };
    this.emit("update", { kind: "sensor" });
  }

  _selectAliases() {
    this.aliases.clear();
    for (const target of ["gpu.temperature", "cpu.temperature", "gpu.load", "gpu.power", "cpu.power"]) {
      let best = null;
      let bestScore = -1;
      for (const sensor of this.hardwareCatalog) {
        const score = descriptorScore(sensor, target);
        if (score > bestScore) {
          best = sensor.id;
          bestScore = score;
        }
      }
      if (best && bestScore >= 0) this.aliases.set(target, best);
    }
  }

  _schedulePersist() {
    if (this.persistTimer || this.stopping) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this._persistNow();
    }, 30_000);
    this.persistTimer.unref?.();
  }

  async _persistNow() {
    try {
      const keep = new Set([...CANONICAL, ...this.watched]);
      const histories = {};
      for (const id of keep) {
        if (this.histories.has(id)) histories[id] = this.histories.get(id).toJSON();
      }
      const payload = {
        version: 1,
        savedAt: Date.now(),
        watched: [...this.watched],
        histories,
        lastCompleted: this.session.snapshot().lastCompleted,
      };
      await mkdir(dirname(this.persistPath), { recursive: true });
      const temporary = this.persistPath + ".tmp";
      await writeFile(temporary, JSON.stringify(payload), "utf8");
      try {
        await rename(temporary, this.persistPath);
      } catch (error) {
        await rm(temporary, { force: true }).catch(() => {});
        throw error;
      }
    } catch (error) {
      this.log("Persistence write failed: " + (error?.message || error));
    }
  }

  async _restore() {
    let raw;
    try {
      raw = await readFile(this.persistPath, "utf8");
    } catch {
      return;
    }
    let state;
    try {
      state = JSON.parse(raw);
      if (state?.version !== 1 || !state.histories || typeof state.histories !== "object") throw new Error("Unsupported state");
    } catch (error) {
      try { await rename(this.persistPath, this.persistPath + ".corrupt." + Date.now() + ".json"); } catch {}
      this.log("Corrupt persistence quarantined: " + (error?.message || error));
      return;
    }

    for (const id of Array.isArray(state.watched) ? state.watched.slice(-32) : []) this.watched.add(String(id));
    for (const [id, value] of Object.entries(state.histories)) {
      this.histories.set(id, BoundedHistory.fromJSON(value, { archiveMode: "max" }));
      const latest = this.histories.get(id).latest();
      if (latest !== null) this.values.set(id, latest);
    }
    this.session.setLastCompleted(state.lastCompleted);
  }
}
