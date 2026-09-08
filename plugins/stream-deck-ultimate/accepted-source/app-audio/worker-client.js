"use strict";
const path = require("path");
const { spawn } = require("child_process");

class AppAudioWorkerClient {
  constructor(options = {}) {
    this.script = path.resolve(options.script || path.join(__dirname, "app-audio-worker.ps1"));
    this.mock = !!options.mock;
    this.assemblyPath = options.assemblyPath ? path.resolve(options.assemblyPath) : "";
    this.timeoutMs = Math.max(250, Number(options.timeoutMs || 6000));
    this.process = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = "";
    this.closed = false;
  }

  start() {
    if (this.process && !this.process.killed) return this;
    this.closed = false;
    const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", this.script];
    if (this.mock) args.push("-Mock");
    else if (this.assemblyPath) args.push("-AssemblyPath", this.assemblyPath);
    this.process = spawn("powershell.exe", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", d => this._onStdout(d));
    this.process.stderr.on("data", d => { this.stderr = (this.stderr + d).slice(-16384); });
    this.process.on("error", e => this._failAll(e));
    this.process.on("exit", (code, signal) => {
      const expected = this.closed || code === 0;
      const err = new Error(`App audio worker exited (${code ?? "null"}/${signal || "none"})${this.stderr ? `: ${this.stderr.trim()}` : ""}`);
      if (!expected || this.pending.size) this._failAll(err);
      this.process = null;
    });
    return this;
  }

  get pid() { return this.process?.pid || null; }

  _onStdout(chunk) {
    this.buffer += String(chunk || "");
    while (true) {
      const i = this.buffer.indexOf("\n");
      if (i < 0) break;
      const line = this.buffer.slice(0, i).trim();
      this.buffer = this.buffer.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); }
      catch { continue; }
      const pending = this.pending.get(String(msg.id));
      if (!pending) continue;
      this.pending.delete(String(msg.id));
      clearTimeout(pending.timer);
      if (msg.ok) pending.resolve(msg.result);
      else pending.reject(new Error(String(msg.error || "App audio worker request failed")));
    }
  }

  _failAll(error) {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear();
  }

  request(action, payload = {}) {
    this.start();
    if (!this.process?.stdin?.writable) return Promise.reject(new Error("App audio worker stdin unavailable"));
    const id = String(this.nextId++);
    const request = { id, action, ...payload };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`App audio worker timeout: ${action}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer, action });
      try { this.process.stdin.write(JSON.stringify(request) + "\n", "utf8"); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }

  ping() { return this.request("Ping"); }
  foreground() { return this.request("Foreground"); }
  list() { return this.request("List"); }
  findExact(match) { return this.request("FindExact", { match: String(match || "") }); }
  setVolume(match, value) { return this.request("SetVolume", { match: String(match || ""), value: Number(value || 0) }); }
  adjustVolume(match, value) { return this.request("AdjustVolume", { match: String(match || ""), value: Number(value || 0) }); }
  mute(match) { return this.request("Mute", { match: String(match || "") }); }
  unmute(match) { return this.request("Unmute", { match: String(match || "") }); }
  toggleMute(match) { return this.request("ToggleMute", { match: String(match || "") }); }

  async close() {
    if (!this.process) return;
    const proc = this.process;
    this.closed = true;
    try { await this.request("Quit"); } catch {}
    try { proc.stdin.end(); } catch {}
    await new Promise(resolve => {
      if (!this.process || proc.exitCode !== null) return resolve();
      const t = setTimeout(() => { try { proc.kill(); } catch {} resolve(); }, 1500);
      proc.once("exit", () => { clearTimeout(t); resolve(); });
    });
  }
}

module.exports = { AppAudioWorkerClient };
