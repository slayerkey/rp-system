import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Pending = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export class MonitorBridge {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<number, Pending>();
  private buffer = "";
  private nextId = 1;

  private helperPath(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "..", "helper", "monitor-helper.ps1");
  }

  private ensure(): ChildProcessWithoutNullStreams {
    if (this.child && !this.child.killed) return this.child;
    const child = spawn("powershell.exe", [
      "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-File", this.helperPath()
    ], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.onData(String(chunk)));
    child.stderr.setEncoding("utf8");
    child.on("exit", (code) => {
      const error = new Error("Monitor helper exited with code " + code);
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(error);
      }
      this.pending.clear();
      this.child = null;
    });
    this.child = child;
    return child;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    while (true) {
      const index = this.buffer.indexOf("\n");
      if (index < 0) return;
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message: any;
      try { message = JSON.parse(line); } catch { continue; }
      const entry = this.pending.get(Number(message.id));
      if (!entry) continue;
      clearTimeout(entry.timer);
      this.pending.delete(Number(message.id));
      if (message.ok) entry.resolve(message.result);
      else entry.reject(new Error(String(message.error || "Monitor helper request failed")));
    }
  }

  request(op: string, params: Record<string, unknown> = {}, timeoutMs = 8000): Promise<any> {
    const child = this.ensure();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Monitor helper timed out during " + op));
      }, timeoutMs);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, op, params }) + "\n");
    });
  }

  dispose(): void {
    try { this.child?.kill(); } catch {}
    this.child = null;
  }
}
