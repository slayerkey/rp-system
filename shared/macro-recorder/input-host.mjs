import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export class InputHost extends EventEmitter {
  constructor(logger = console.error) {
    super();
    this.logger = logger;
    this.proc = null;
    this.pending = new Map();
    this.seq = 0;
    this.stopping = false;
  }

  helperPath() {
    const bin = dirname(fileURLToPath(import.meta.url));
    return resolve(bin, "..", "helpers", "PackRat.InputHost.exe");
  }

  async ensure() {
    if (this.proc && !this.proc.killed) return;
    this.stopping = false;
    const proc = spawn(this.helperPath(), ["--daemon"], { windowsHide: true, stdio: ["pipe","pipe","pipe"] });
    this.proc = proc;
    const lines = createInterface({ input: proc.stdout });
    lines.on("line", (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.event) {
        this.emit(message.event, message);
        return;
      }
      const pending = this.pending.get(String(message.id || ""));
      if (!pending) return;
      this.pending.delete(String(message.id));
      if (message.ok === false) pending.reject(new Error(String(message.error || "Input host command failed.")));
      else pending.resolve(message);
    });
    proc.stderr.on("data", (chunk) => this.logger(String(chunk).trim()));
    proc.on("error", (error) => {
      this.logger(error?.stack || error);
      if (this.proc === proc) this.proc = null;
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
    proc.on("exit", (code, signal) => {
      if (this.proc === proc) this.proc = null;
      for (const pending of this.pending.values()) pending.reject(new Error("Input host exited."));
      this.pending.clear();
      if (!this.stopping) this.emit("crash", { code, signal });
    });
    try {
      await this.command("ping", {}, { skipEnsure: true, timeoutMs: 5000 });
    } catch (error) {
      this.stopping = true;
      try { proc.kill(); } catch {}
      if (this.proc === proc) this.proc = null;
      throw error;
    }
  }

  async command(command, payload = {}, { skipEnsure = false, timeoutMs = 10000 } = {}) {
    if (!skipEnsure) await this.ensure();
    if (!this.proc?.stdin?.writable) throw new Error("Input host is unavailable.");
    const id = String(++this.seq);
    const message = { id, command, ...payload };
    return await new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectPromise(new Error(`Input host timed out: ${command}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolvePromise(value); },
        reject: (error) => { clearTimeout(timer); rejectPromise(error); },
      });
      try {
        this.proc.stdin.write(JSON.stringify(message) + "\n");
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        rejectPromise(error);
      }
    });
  }

  async close() {
    this.stopping = true;
    const proc = this.proc;
    if (!proc) return;
    try { await this.command("stopPlayback", {}, { skipEnsure: true, timeoutMs: 1500 }); } catch {}
    try { proc.kill(); } catch {}
    if (this.proc === proc) this.proc = null;
  }
}
