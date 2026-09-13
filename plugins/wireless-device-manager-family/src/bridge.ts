import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { RawDevice } from "./model.js";

const execFileAsync = promisify(execFile);

export type BridgeSnapshot = {
  ok: boolean;
  adapterAvailable: boolean;
  devices: RawDevice[];
  error?: string | null;
};

function helperPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  return path.join(here, `wireless-device-bridge-${arch}.exe`);
}

async function run(args: string[]): Promise<any> {
  if (process.platform !== "win32") {
    return { ok: false, adapterAvailable: false, devices: [], error: "Windows only" };
  }
  try {
    const { stdout } = await execFileAsync(helperPath(), args, {
      windowsHide: true,
      timeout: 8000,
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(stdout.trim() || "{}");
  } catch (error: any) {
    return {
      ok: false,
      adapterAvailable: false,
      devices: [],
      error: error?.message || String(error)
    };
  }
}

export async function snapshot(): Promise<BridgeSnapshot> {
  const result = await run(["snapshot"]);
  return {
    ok: result.ok === true,
    adapterAvailable: result.adapterAvailable === true,
    devices: Array.isArray(result.devices) ? result.devices : [],
    error: result.error ?? null
  };
}

export async function control(deviceId: string, operation: "connect" | "disconnect"): Promise<{ ok: boolean; error?: string }> {
  const result = await run(["control", operation, "--id", deviceId]);
  return { ok: result.ok === true, error: result.error ?? undefined };
}
