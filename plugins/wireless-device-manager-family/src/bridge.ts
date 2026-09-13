import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RawDevice } from "./model.js";

export type BridgeSnapshot = {
  ok: boolean;
  adapterAvailable: boolean;
  devices: RawDevice[];
  error?: string | null;
};

type PendingRequest = {
  resolve: (value: any) => void;
  timer: NodeJS.Timeout;
};

let child: ChildProcessWithoutNullStreams | null = null;
let stdoutBuffer = "";
let sequence = 0;
const pending = new Map<string, PendingRequest>();

function helperPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return path.join(here, `wireless-device-bridge-${arch}.exe`);
}

function failAll(message: string): void {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    request.resolve({ ok: false, adapterAvailable: false, devices: [], error: message });
    pending.delete(id);
  }
}

function consumeLine(line: string): void {
  if (!line.trim()) return;
  try {
    const message = JSON.parse(line);
    const id = typeof message?.id === "string" ? message.id : "";
    const request = pending.get(id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(id);
    request.resolve(message.result ?? { ok: false, error: "Bridge returned no result." });
  } catch {
    // Ignore non-protocol stdout. The native bridge writes protocol messages as one JSON line.
  }
}

function ensureBridge(): ChildProcessWithoutNullStreams {
  if (child && child.exitCode === null && !child.killed) return child;

  stdoutBuffer = "";
  const processHandle = spawn(helperPath(), ["server"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  child = processHandle;
  processHandle.stdout.setEncoding("utf8");
  processHandle.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    for (;;) {
      const newline = stdoutBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = stdoutBuffer.slice(0, newline).replace(/\r$/, "");
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      consumeLine(line);
    }
  });
  processHandle.stderr.setEncoding("utf8");
  processHandle.stderr.on("data", () => {
    // Native diagnostics stay off the JSON stdout protocol.
  });
  processHandle.on("error", (error) => {
    if (child === processHandle) child = null;
    failAll(error.message || "Wireless Device Bridge failed to start.");
  });
  processHandle.on("exit", (code, signal) => {
    if (child === processHandle) child = null;
    failAll(`Wireless Device Bridge exited (${code ?? signal ?? "unknown"}).`);
  });
  return processHandle;
}

async function request(command: Record<string, unknown>, timeoutMs = 10000): Promise<any> {
  if (process.platform !== "win32") {
    return { ok: false, adapterAvailable: false, devices: [], error: "Windows only" };
  }

  const id = `${process.pid}-${Date.now()}-${++sequence}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, adapterAvailable: false, devices: [], error: "Wireless Device Bridge timed out." });
    }, timeoutMs);
    timer.unref();

    pending.set(id, { resolve, timer });
    try {
      ensureBridge().stdin.write(`${JSON.stringify({ id, ...command })}\n`, "utf8");
    } catch (error: any) {
      clearTimeout(timer);
      pending.delete(id);
      resolve({
        ok: false,
        adapterAvailable: false,
        devices: [],
        error: error?.message || String(error)
      });
    }
  });
}

export async function snapshot(): Promise<BridgeSnapshot> {
  const result = await request({ command: "snapshot" }, 10000);
  return {
    ok: result.ok === true,
    adapterAvailable: result.adapterAvailable === true,
    devices: Array.isArray(result.devices) ? result.devices : [],
    error: result.error ?? null
  };
}

export async function control(
  deviceId: string,
  operation: "connect" | "disconnect"
): Promise<{ ok: boolean; error?: string }> {
  const result = await request({ command: "control", operation, deviceId }, 15000);
  return { ok: result.ok === true, error: result.error ?? undefined };
}
