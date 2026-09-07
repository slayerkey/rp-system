import net from "node:net";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { DISCORD_OPCODE, DiscordFrameDecoder, encodeDiscordFrame } from "./protocol.js";

const REQUEST_TIMEOUT_MS = 6000;
const CONNECT_TIMEOUT_MS = 800;
const HANDSHAKE_TIMEOUT_MS = 3500;
const PIPE_COUNT = 10;

function pipeName(index) {
  return `\\\\?\\pipe\\discord-ipc-${index}`;
}

function preferredPipeIndex() {
  for (const key of ["PACKRAT_DISCORD_PIPE", "PACKRAT_DISCORD_INSTANCE_ID", "DISCORD_INSTANCE_ID"]) {
    const raw = process.env[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const value = Number.parseInt(String(raw), 10);
    if (Number.isInteger(value) && value >= 0 && value < PIPE_COUNT) return value;
  }
  return null;
}

function pipeOrder() {
  const preferred = preferredPipeIndex();
  const indexes = Array.from({ length: PIPE_COUNT }, (_, index) => index);
  if (preferred === null) return indexes;
  return [preferred, ...indexes.filter((index) => index !== preferred)];
}

function parseJson(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return null;
  }
}

function cleanAuthorizeArgs(cmd, args) {
  if (cmd !== "AUTHORIZE" || !args || typeof args !== "object") return args;
  if (!Object.prototype.hasOwnProperty.call(args, "prompt")) return args;
  const cleaned = { ...args };
  delete cleaned.prompt;
  return cleaned;
}

export class DiscordIpcClient extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = String(clientId);
    this.socket = null;
    this.pipe = null;
    this.ready = false;
    this.pending = new Map();
    this.decoder = new DiscordFrameDecoder((opcode, payload) => this.#onFrame(opcode, payload));
    this.connectPromise = null;
    this.handshakeWaiter = null;
  }

  connect() {
    if (this.socket && !this.socket.destroyed && this.ready) return Promise.resolve(this.pipe);
    if (this.connectPromise) return this.connectPromise;

    const attempt = this.#connectOnce().finally(() => {
      if (this.connectPromise === attempt) this.connectPromise = null;
    });
    this.connectPromise = attempt;
    return attempt;
  }

  async #connectOnce() {
    this.disconnect("reconnect");
    let lastError = null;
    let openedPipes = 0;
    const order = pipeOrder();
    const preferred = preferredPipeIndex();

    if (preferred !== null) {
      this.emit("handshake", {
        stage: "preferred_pipe",
        pipe: pipeName(preferred),
        preferredIndex: preferred,
      });
    }

    for (const index of order) {
      const path = pipeName(index);
      this.emit("handshake", { stage: "opening_pipe", pipe: path, pipeIndex: index });

      const result = await this.#tryPipe(path);
      const socket = result.socket;
      if (!socket) {
        this.emit("handshake", {
          stage: "pipe_unavailable",
          pipe: path,
          pipeIndex: index,
          error: result.error || null,
        });
        continue;
      }

      openedPipes += 1;
      this.emit("handshake", { stage: "pipe_opened", pipe: path, pipeIndex: index });
      this.socket = socket;
      this.pipe = path;
      this.ready = false;
      this.decoder = new DiscordFrameDecoder((opcode, payload) => this.#onFrame(opcode, payload));

      socket.on("data", (chunk) => {
        try {
          this.decoder.push(chunk);
        } catch (error) {
          this.emit("error", error);
          this.#rejectHandshake(error);
          this.disconnect("decoder error");
        }
      });
      socket.on("close", () => this.#onClose());
      socket.on("error", (error) => {
        this.emit("error", error);
        this.#rejectHandshake(error);
      });

      const handshakePromise = this.#waitForReady(HANDSHAKE_TIMEOUT_MS);
      try {
        this.emit("handshake", { stage: "waiting_ready", pipe: path, pipeIndex: index });
        this.#write(DISCORD_OPCODE.HANDSHAKE, { v: 1, client_id: this.clientId });
        const ready = await handshakePromise;
        this.emit("handshake", {
          stage: "ready",
          pipe: path,
          pipeIndex: index,
          userId: ready?.user?.id ? String(ready.user.id) : null,
          username: ready?.user?.username ? String(ready.user.username) : null,
          environment: ready?.config?.environment ? String(ready.config.environment) : null,
        });
        return path;
      } catch (error) {
        lastError = error;
        this.emit("handshake", {
          stage: "failed",
          pipe: path,
          pipeIndex: index,
          error: String(error?.message || error),
        });
        this.#clearHandshake();
        if (this.socket === socket) {
          this.socket = null;
          this.pipe = null;
        }
        try { socket.destroy(); } catch {}
        this.ready = false;
      }
    }

    this.emit("handshake", {
      stage: "scan_complete",
      openedPipes,
      error: lastError ? String(lastError?.message || lastError) : null,
    });
    this.emit("offline");
    if (lastError) throw lastError;
    return null;
  }

  disconnect(reason = "disconnect") {
    this.ready = false;
    this.#rejectHandshake(new Error(`Discord IPC disconnected: ${reason}`));
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Discord IPC disconnected: ${reason}`));
    }
    this.pending.clear();
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      this.pipe = null;
      try { socket.destroy(); } catch {}
    }
  }

  async request(cmd, args = {}, evt = null, timeoutMs = REQUEST_TIMEOUT_MS) {
    if (!this.socket || this.socket.destroyed || !this.ready) {
      throw new Error("Discord IPC is not ready");
    }
    const nonce = randomUUID();
    const payload = { cmd, args: cleanAuthorizeArgs(cmd, args), nonce };
    if (evt) payload.evt = evt;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        reject(new Error(`${cmd}${evt ? ` ${evt}` : ""} timed out`));
      }, timeoutMs);
      this.pending.set(nonce, { resolve, reject, timer, cmd, evt });
      try {
        this.#write(DISCORD_OPCODE.FRAME, payload);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(nonce);
        reject(error);
      }
    });
  }

  subscribe(evt, args = {}) {
    return this.request("SUBSCRIBE", args, evt);
  }

  unsubscribe(evt, args = {}) {
    return this.request("UNSUBSCRIBE", args, evt).catch(() => null);
  }

  #tryPipe(path) {
    return new Promise((resolve) => {
      let settled = false;
      let lastError = null;
      const socket = net.createConnection(path);
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ socket: null, error: "connect timeout" });
      }, CONNECT_TIMEOUT_MS);

      socket.once("connect", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ socket, error: null });
      });

      socket.once("error", (error) => {
        lastError = error;
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ socket: null, error: String(lastError?.code || lastError?.message || lastError) });
      });
    });
  }

  #waitForReady(timeoutMs) {
    this.#clearHandshake();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.handshakeWaiter) return;
        this.handshakeWaiter = null;
        reject(new Error("Discord IPC handshake timed out waiting for READY"));
      }, timeoutMs);
      this.handshakeWaiter = { resolve, reject, timer };
    });
  }

  #resolveHandshake(value) {
    if (!this.handshakeWaiter) return;
    const waiter = this.handshakeWaiter;
    this.handshakeWaiter = null;
    clearTimeout(waiter.timer);
    waiter.resolve(value);
  }

  #rejectHandshake(error) {
    if (!this.handshakeWaiter) return;
    const waiter = this.handshakeWaiter;
    this.handshakeWaiter = null;
    clearTimeout(waiter.timer);
    waiter.reject(error instanceof Error ? error : new Error(String(error || "Discord IPC handshake failed")));
  }

  #clearHandshake() {
    if (!this.handshakeWaiter) return;
    clearTimeout(this.handshakeWaiter.timer);
    this.handshakeWaiter = null;
  }

  #write(opcode, payload) {
    if (!this.socket || this.socket.destroyed) throw new Error("Discord IPC socket is closed");
    this.socket.write(encodeDiscordFrame(opcode, payload));
  }

  #onFrame(opcode, payloadBuffer) {
    if (opcode === DISCORD_OPCODE.PING) {
      if (this.socket && !this.socket.destroyed) {
        this.socket.write(encodeDiscordFrame(DISCORD_OPCODE.PONG, payloadBuffer));
      }
      return;
    }

    if (opcode === DISCORD_OPCODE.CLOSE) {
      const data = parseJson(payloadBuffer);
      const message = data?.message || "Discord closed IPC";
      const code = data?.code !== undefined ? ` (${data.code})` : "";
      const error = new Error(`${message}${code}`);
      this.emit("rpcClose", { data, message: error.message });
      this.#rejectHandshake(error);
      this.disconnect("Discord close");
      return;
    }

    if (opcode !== DISCORD_OPCODE.FRAME) return;
    const payload = parseJson(payloadBuffer);
    if (!payload) return;

    if (payload.cmd === "DISPATCH" && payload.evt === "READY") {
      this.ready = true;
      this.#resolveHandshake(payload.data || {});
      this.emit("ready", payload.data || {});
      return;
    }

    if (payload.nonce && this.pending.has(payload.nonce)) {
      const pending = this.pending.get(payload.nonce);
      clearTimeout(pending.timer);
      this.pending.delete(payload.nonce);
      if (payload.evt === "ERROR") {
        const message = payload.data?.message || `Discord RPC ${pending.cmd} failed`;
        const code = payload.data?.code !== undefined ? ` (${payload.data.code})` : "";
        pending.reject(new Error(`${message}${code}`));
      } else {
        pending.resolve(payload.data);
      }
      return;
    }

    if (payload.cmd === "DISPATCH" && payload.evt) {
      this.emit("dispatch", payload.evt, payload.data || {});
      return;
    }

    if (payload.evt === "ERROR") {
      this.emit("rpcError", payload.data || {});
    }
  }

  #onClose() {
    const hadSocket = Boolean(this.socket);
    this.#rejectHandshake(new Error("Discord IPC closed before READY"));
    this.socket = null;
    this.pipe = null;
    this.ready = false;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Discord IPC closed"));
    }
    this.pending.clear();
    if (hadSocket) this.emit("offline");
  }
}
