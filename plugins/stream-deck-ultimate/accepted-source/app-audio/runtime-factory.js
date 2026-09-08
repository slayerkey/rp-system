"use strict";
const path = require("path");
const { AppAudioWorkerClient } = require("./worker-client.js");
const { AppAudioService } = require("./app-audio-service.js");
const { AppAudioStreamDeckController } = require("./streamdeck-controller.js");

function createAppAudioRuntime(options = {}) {
  const worker = options.worker || new AppAudioWorkerClient({
    script: options.workerScript || path.join(__dirname, "app-audio-worker.ps1"),
    mock: !!options.mock,
    assemblyPath: options.assemblyPath || "",
    timeoutMs: options.timeoutMs || 6000
  });
  const foregroundProvider = options.foregroundProvider || (() => {
    if (typeof worker.foreground !== "function") return {};
    return worker.foreground();
  });
  const service = options.service || new AppAudioService({
    worker,
    foregroundProvider,
    cacheMs: options.cacheMs || 650,
    coalesceMs: options.coalesceMs || 55,
    now: options.now
  });
  const controller = options.controller || new AppAudioStreamDeckController({
    service,
    render: options.render || (() => {})
  });
  let disposed = false;

  return {
    worker,
    service,
    controller,
    async start() {
      if (disposed) throw new Error("App audio runtime is disposed");
      const ping = typeof worker.ping === "function" ? await worker.ping() : { ready: true };
      if (ping?.ready === false) throw new Error("App audio worker did not become ready");
      return { ready: true, worker: ping };
    },
    handle(message) {
      if (disposed) return Promise.resolve(null);
      return controller.handle(message);
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      if (controller && typeof controller.dispose === "function") await controller.dispose();
      if (worker && typeof worker.close === "function") await worker.close();
    }
  };
}

module.exports = { createAppAudioRuntime };
