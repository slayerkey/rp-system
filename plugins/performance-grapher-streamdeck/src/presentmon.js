import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

export function splitCsv(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < String(line).length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

export function parsePresentMonRows(lines) {
  let header = null;
  const rows = [];
  for (const raw of lines) {
    const line = String(raw || "").replace(/^\uFEFF/, "").trim();
    if (!line || line.startsWith("#")) continue;
    const cells = splitCsv(line);
    if (!header) {
      const normalized = cells.map((x) => x.trim());
      const hasProcess = normalized.some((x) => /^(Application|ProcessName|Process)$/i.test(x));
      const hasTiming = normalized.some((x) => /^(FrameTime|MsBetweenPresents|CPUFrameTime|MsBetweenSimulationStart)$/i.test(x));
      if (hasProcess && hasTiming) header = normalized;
      continue;
    }
    if (cells.length < header.length) continue;
    const record = {};
    for (let i = 0; i < header.length; i += 1) record[header[i]] = cells[i];
    const pick = (names) => {
      for (const name of names) {
        const key = Object.keys(record).find((x) => x.toLowerCase() === name.toLowerCase());
        if (key && String(record[key]).trim()) return record[key];
      }
      return null;
    };
    const application = pick(["Application", "ProcessName", "Process"]);
    const pid = Number(pick(["ProcessID", "PID"]));
    const frameTimeMs = Number(pick(["MsBetweenPresents", "FrameTime", "CPUFrameTime", "MsBetweenSimulationStart"]));
    if (application && Number.isFinite(frameTimeMs) && frameTimeMs > 0) rows.push({ application, pid: Number.isFinite(pid) ? pid : null, frameTimeMs });
  }
  return rows;
}

export class PresentMonProvider extends EventEmitter {
  constructor({ executable, log = () => {}, spawnProcess = spawn, createLineInterface = createInterface } = {}) {
    super();
    this.executable = executable;
    this.log = log;
    this.spawnProcess = spawnProcess;
    this.createLineInterface = createLineInterface;
    this.child = null;
    this.running = false;
    this.status = { state: "stopped", detail: null };
    this.header = null;
    this.backoffMs = 1000;
    this.restartTimer = null;
    this.intentionalStop = false;
  }

  _setStatus(state, detail = null) {
    const next = { state, detail };
    if (JSON.stringify(next) === JSON.stringify(this.status)) return;
    this.status = next;
    this.emit("status", next);
  }

  start() {
    if (this.child || this.running) return;
    this.intentionalStop = false;
    this.running = true;
    this._spawn();
  }

  stop() {
    this.intentionalStop = true;
    this.running = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.child) {
      try { this.child.kill(); } catch {}
      this.child = null;
    }
    this._setStatus("stopped");
  }

  restart() {
    this.stop();
    this.intentionalStop = false;
    this.running = true;
    this.backoffMs = 1000;
    this._spawn();
  }

  _scheduleRestart() {
    if (!this.running || this.intentionalStop || this.restartTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(30_000, Math.round(this.backoffMs * 1.8));
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this._spawn();
    }, delay);
    this.restartTimer.unref?.();
  }

  _spawn() {
    if (!this.running || this.child) return;
    if (!this.executable) {
      this._setStatus("unavailable", "PresentMon executable is not bundled.");
      return;
    }

    const args = [
      "--output_stdout",
      "--no_console_stats",
      "--qpc_time_ms",
      "--session_name", "PackRatPerformanceGrapher",
      "--stop_existing_session",
      "--no_track_gpu",
      "--no_track_input",
      "--no_track_display",
      "--v2_metrics",
    ];

    let child;
    try {
      child = this.spawnProcess(this.executable, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      this._setStatus("unavailable", error?.message || String(error));
      this._scheduleRestart();
      return;
    }

    this.child = child;
    this.header = null;
    this._setStatus("starting");

    const stdout = this.createLineInterface({ input: child.stdout });
    stdout.on("line", (line) => this._consumeLine(line));

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      const text = String(chunk || "");
      stderr = (stderr + text).slice(-16_000);
      if (/performance log users|access is denied|permission|error\s*5\b|0x0*5\b/i.test(text)) {
        this._setStatus("permission_required", text.trim().slice(0, 500));
      }
    });

    child.once("error", (error) => {
      if (this.child !== child) return;
      this.log("PresentMon error: " + (error?.message || error));
      this._setStatus("unavailable", error?.message || String(error));
    });

    child.once("close", (code) => {
      if (this.child !== child) {
        stdout.close();
        return;
      }
      this.child = null;
      stdout.close();
      if (this.intentionalStop || !this.running) return;
      if (!["permission_required", "unavailable"].includes(this.status.state)) {
        this._setStatus("offline", ("PresentMon exited " + code + ". " + stderr).trim().slice(0, 700));
      }
      this._scheduleRestart();
    });
  }

  _consumeLine(raw) {
    const line = String(raw || "").replace(/^\uFEFF/, "").trim();
    if (!line || line.startsWith("#")) return;
    const cells = splitCsv(line);
    if (!this.header) {
      const hasProcess = cells.some((x) => /^(Application|ProcessName|Process)$/i.test(x.trim()));
      const hasTiming = cells.some((x) => /^(FrameTime|MsBetweenPresents|CPUFrameTime|MsBetweenSimulationStart)$/i.test(x.trim()));
      if (hasProcess && hasTiming) {
        this.header = cells.map((x) => x.trim());
        this.backoffMs = 1000;
        this._setStatus("ready");
      }
      return;
    }

    if (cells.length < this.header.length) return;
    const record = {};
    for (let i = 0; i < this.header.length; i += 1) record[this.header[i]] = cells[i];
    const pick = (names) => {
      for (const name of names) {
        const key = Object.keys(record).find((x) => x.toLowerCase() === name.toLowerCase());
        if (key && String(record[key]).trim()) return record[key];
      }
      return null;
    };
    const application = pick(["Application", "ProcessName", "Process"]);
    const pid = Number(pick(["ProcessID", "PID"]));
    const frameTimeMs = Number(pick(["MsBetweenPresents", "FrameTime", "CPUFrameTime", "MsBetweenSimulationStart"]));
    if (!application || !Number.isFinite(frameTimeMs) || frameTimeMs <= 0) return;
    this.emit("frame", { application, pid: Number.isFinite(pid) ? pid : null, frameTimeMs });
  }
}
