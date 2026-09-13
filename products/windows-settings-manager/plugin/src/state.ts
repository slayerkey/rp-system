import { WindowsBackend } from "./backend.js";
import type { BackendReply, SystemSnapshot } from "./types.js";

const OFFLINE: SystemSnapshot = {
  backendOnline: false,
  capturedAt: new Date(0).toISOString(),
  hdr: { available: false, api: "unavailable", supportedCount: 0, enabledCount: 0, mixed: false, errors: [] },
  topology: "unknown",
  powerPlans: [],
  keepAwake: false,
  errors: ["Waiting for Windows backend"]
};

export class StateService {
  private backend = new WindowsBackend();
  private snapshot: SystemSnapshot = OFFLINE;
  private listeners = new Set<() => void>();
  private timer: NodeJS.Timeout | null = null;
  private refreshing: Promise<void> | null = null;

  getSnapshot(): SystemSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), 2500);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.backend.dispose();
  }

  async refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      try {
        this.snapshot = await this.backend.snapshot();
      } catch (error) {
        this.snapshot = {
          ...this.snapshot,
          backendOnline: false,
          capturedAt: new Date().toISOString(),
          keepAwake: false,
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
      this.emit();
    })();
    try {
      await this.refreshing;
    } finally {
      this.refreshing = null;
    }
  }

  async execute<T = unknown>(op: string, args: Record<string, unknown> = {}): Promise<BackendReply<T>> {
    try {
      const reply = await this.backend.request<T>(op, args);
      await this.refresh();
      return reply;
    } catch (error) {
      await this.refresh();
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* isolate action repaint failures */ }
    }
  }
}
