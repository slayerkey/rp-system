import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import type { BackendReply, SystemSnapshot } from "./types.js";

type Pending = {
  resolve: (value: BackendReply<any>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export class WindowsBackend {
  private process: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private starting: Promise<void> | null = null;

  async request<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<BackendReply<T>> {
    await this.ensureStarted();
    const id = this.nextId++;
    return new Promise<BackendReply<T>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Windows backend timed out during ${op}`));
      }, 9000);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      this.process!.stdin.write(`${JSON.stringify({ id, op, args })}\n`);
    });
  }

  async snapshot(): Promise<SystemSnapshot> {
    const reply = await this.request<SystemSnapshot>("snapshot");
    if (!reply.ok || !reply.result) throw new Error(reply.error || "Snapshot failed");
    return reply.result;
  }

  dispose(): void {
    this.process?.kill();
    this.process = null;
    this.failPending(new Error("Windows backend stopped"));
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) return;
    if (this.starting) return this.starting;
    this.starting = this.startProcess();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async startProcess(): Promise<void> {
    const here = dirname(fileURLToPath(import.meta.url));
    const script = join(here, "windows-settings-backend.ps1");
    const child = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script
    ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.process = child;

    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      let message: { id?: number } & BackendReply<any>;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      if (typeof message.id !== "number") return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      pending.resolve({ ok: message.ok, result: message.result, error: message.error });
    });

    child.stderr.on("data", () => {
      // Backend diagnostics are intentionally not treated as protocol messages.
    });
    child.once("exit", () => {
      if (this.process === child) this.process = null;
      this.failPending(new Error("Windows backend exited"));
    });
    child.once("error", (error) => {
      if (this.process === child) this.process = null;
      this.failPending(error);
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Windows backend failed to start")), 5000);
      timer.unref();
      const attempt = async () => {
        try {
          const reply = await this.requestWithoutStart("ping", {});
          clearTimeout(timer);
          if (reply.ok) resolve();
          else reject(new Error(reply.error || "Windows backend ping failed"));
        } catch (error) {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      setTimeout(() => void attempt(), 120).unref();
    });
  }

  private requestWithoutStart(op: string, args: Record<string, unknown>): Promise<BackendReply<any>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error("Windows backend is not running"));
        return;
      }
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Windows backend timed out during ${op}`));
      }, 4500);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(`${JSON.stringify({ id, op, args })}\n`);
    });
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
