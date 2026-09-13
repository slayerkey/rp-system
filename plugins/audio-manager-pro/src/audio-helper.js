import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

function helperPath() {
  return fileURLToPath(new URL("../native/win-x64/PackRat.AudioManager.Helper.exe", import.meta.url));
}

export class AudioHelper {
  constructor({ log = () => {} } = {}) {
    this.log = log;
    this.child = null;
    this.lines = null;
    this.pending = new Map();
    this.sequence = 0;
    this.starting = null;
  }

  async start() {
    if (this.child && !this.child.killed) return;
    if (this.starting) return this.starting;

    this.starting = Promise.resolve().then(() => {
      const executable = helperPath();
      if (!existsSync(executable)) {
        throw new Error("Audio helper is missing. Reinstall Audio Manager Pro.");
      }

      const child = spawn(executable, [], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.child = child;
      this.lines = createInterface({ input: child.stdout });
      this.lines.on("line", (line) => this.onLine(line));
      child.stderr.on("data", (chunk) => {
        const message = String(chunk || "").trim();
        if (message) this.log(message.slice(0, 400));
      });
      child.once("error", (error) => this.onExit(error));
      child.once("exit", (code) => this.onExit(new Error(`Audio helper exited with code ${code ?? "unknown"}.`)));
    }).finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  onLine(line) {
    let message;
    try {
      message = JSON.parse(String(line || ""));
    } catch {
      return;
    }

    const id = String(message?.id || "");
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    pending.resolve(message);
  }

  onExit(error) {
    if (this.lines) {
      try { this.lines.close(); } catch {}
    }
    this.lines = null;
    this.child = null;

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
    this.pending.clear();
  }

  async request(command, payload = {}, timeoutMs = 5000) {
    await this.start();
    const id = `${Date.now().toString(36)}-${(++this.sequence).toString(36)}`;
    const child = this.child;
    if (!child?.stdin?.writable) throw new Error("Audio helper is not available.");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Audio helper timed out."));
      }, timeoutMs);
      timer.unref?.();

      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ id, command, ...payload })}\n`, "utf8", (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        clearTimeout(pending.timer);
        reject(error);
      });
    });
  }

  snapshot() {
    return this.request("snapshot");
  }

  apply(operations) {
    return this.request("apply", {
      operations: (Array.isArray(operations) ? operations : []).map((operation) => ({
        kind: operation.kind,
        flow: operation.flow,
        role: operation.role,
        endpointId: operation.endpointId,
        value: operation.value,
      })),
    });
  }

  shutdown() {
    const child = this.child;
    this.child = null;
    if (!child) return;
    try { child.stdin.end(); } catch {}
    setTimeout(() => {
      try { child.kill(); } catch {}
    }, 250).unref?.();
  }
}

export function packagedHelperPath() {
  return helperPath();
}
