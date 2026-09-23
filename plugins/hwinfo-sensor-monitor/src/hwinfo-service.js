import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BoundedHistory } from "./history.js";
import { finite, resolveSensor } from "./sensor-model.js";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_HELPER = resolve(here, "..", "native", "PackRat.HWiNFOReader.exe");

export class HwinfoService extends EventEmitter {
  constructor({ helperPath = DEFAULT_HELPER, spawnProcess = spawn, createLineInterface = createInterface, log = () => {} } = {}) {
    super();
    this.helperPath = helperPath;
    this.spawnProcess = spawnProcess;
    this.createLineInterface = createLineInterface;
    this.log = log;
    this.status = { state: "starting", detail: "Waiting for HWiNFO." };
    this.catalog = [];
    this.byId = new Map();
    this.histories = new Map();
    this.watchedRefs = new Set();
    this.child = null;
    this.lineReader = null;
    this.stopped = true;
    this.restartTimer = null;
    this.lastPollTime = null;
    this.pollingPeriod = null;
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this._spawn();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
    try { this.lineReader?.close(); } catch {}
    this.lineReader = null;
    try { this.child?.kill(); } catch {}
    this.child = null;
  }

  _spawn() {
    if (this.stopped || this.child) return;
    try {
      const child = this.spawnProcess(this.helperPath, ["--stream", "--interval", "500"], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      this.child = child;
      const lines = this.createLineInterface({ input: child.stdout });
      this.lineReader = lines;
      lines.on("line", (line) => this._handleLine(line));
      child.stderr?.on("data", (chunk) => this.log(String(chunk || "").trim()));
      child.once("error", (error) => this._onExit(error));
      child.once("close", () => this._onExit());
    } catch (error) {
      this._onExit(error);
    }
  }

  _onExit(error = null) {
    if (error) this.log(error?.stack || error?.message || String(error));
    try { this.lineReader?.close(); } catch {}
    this.lineReader = null;
    this.child = null;
    if (this.stopped) return;
    this._setStatus({ state: "shared_memory_unavailable", detail: "The local HWiNFO reader stopped. Reconnecting automatically." });
    clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => this._spawn(), 1500);
    this.restartTimer.unref?.();
  }

  _setStatus(status) {
    const next = status && typeof status === "object" ? status : { state: "shared_memory_unavailable" };
    const changed = JSON.stringify(next) !== JSON.stringify(this.status);
    this.status = next;
    if (changed) this.emit("status", this.status);
  }

  _handleLine(line) {
    if (!String(line || "").trim()) return;
    let message;
    try { message = JSON.parse(line); }
    catch { return; }
    if (message.status) this._setStatus(message.status);
    if (Number.isFinite(Number(message.pollTime))) this.lastPollTime = Number(message.pollTime);
    if (Number.isFinite(Number(message.pollingPeriod))) this.pollingPeriod = Number(message.pollingPeriod);

    if (message.type === "catalog" && Array.isArray(message.sensors)) {
      this.catalog = message.sensors.map((sensor) => ({ ...sensor, id: String(sensor.id || "") })).filter((sensor) => sensor.id);
      this.byId = new Map(this.catalog.map((sensor) => [sensor.id, sensor]));
      this.emit("catalog", this.catalog);
      this._ingestValues(this.catalog);
    } else if (message.type === "values" && Array.isArray(message.values)) {
      this._ingestValues(message.values);
    }
  }

  _ingestValues(values) {
    const now = Date.now();
    for (const item of values) {
      const id = String(item?.id || "");
      if (!id) continue;
      const existing = this.byId.get(id);
      if (existing) Object.assign(existing, item);
    }

    const watchedIds = new Set();
    for (const ref of this.watchedRefs) {
      const sensor = resolveSensor(this.catalog, ref);
      if (sensor) watchedIds.add(sensor.id);
    }
    for (const id of watchedIds) {
      const sensor = this.byId.get(id);
      const value = finite(sensor?.value);
      if (value === null) continue;
      let history = this.histories.get(id);
      if (!history) {
        history = new BoundedHistory();
        this.histories.set(id, history);
      }
      history.push(now, value);
    }
    this.emit("update");
  }

  watch(ref) {
    const value = String(ref || "");
    if (value) this.watchedRefs.add(value);
  }

  watchMany(refs) {
    for (const ref of Array.isArray(refs) ? refs : []) this.watch(ref);
  }

  sensor(ref) {
    return resolveSensor(this.catalog, ref);
  }

  detail(ref) {
    const sensor = this.sensor(ref);
    if (!sensor) return null;
    return { ...sensor };
  }

  history(ref, windowMs) {
    const sensor = this.sensor(ref);
    if (!sensor) return [];
    return this.histories.get(sensor.id)?.series(windowMs) || [];
  }

  search(query = "", offset = 0, limit = 80) {
    const q = String(query || "").trim().toLowerCase();
    const start = Math.max(0, Number(offset) || 0);
    const max = Math.max(1, Math.min(100, Number(limit) || 80));
    const filtered = this.catalog.filter((sensor) => {
      if (!q) return true;
      return [sensor.deviceName, sensor.name, sensor.originalName, sensor.unit, sensor.type]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
    return {
      total: filtered.length,
      offset: start,
      items: filtered.slice(start, start + max).map((sensor) => ({
        id: sensor.id,
        deviceId: sensor.deviceId,
        deviceName: sensor.deviceName,
        name: sensor.name,
        originalName: sensor.originalName,
        unit: sensor.unit,
        type: sensor.type,
        value: finite(sensor.value)
      }))
    };
  }

  snapshot(selectedRefs = []) {
    return {
      status: this.status,
      pollTime: this.lastPollTime,
      pollingPeriod: this.pollingPeriod,
      sensorCount: this.catalog.length,
      selected: (Array.isArray(selectedRefs) ? selectedRefs : []).map((ref) => ({ ref, sensor: this.detail(ref) }))
    };
  }
}
