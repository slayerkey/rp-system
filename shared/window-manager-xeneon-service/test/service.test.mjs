import assert from "node:assert/strict";
import test from "node:test";
import { WebSocket } from "ws";
import {
  fixedTimeKeyEquals,
  isAllowedOrigin,
  normalizeSnapshot,
  startWindowManagerXeneonService,
  validateCommand,
} from "../service.mjs";

const fixture = {
  activeWindowId: "2",
  monitors: [
    { id: "A", name: "Main", width: 1920, height: 1080 },
    { id: "B", name: "Side", width: 2560, height: 1440 },
  ],
  windows: [
    { id: "1", appName: "Browser", title: "Dashboard", monitorId: "A", state: "normal" },
    { id: "2", appName: "Editor", title: "Project", monitorId: "B", state: "maximized" },
  ],
};

test("fixed-time pairing equality", () => {
  assert.equal(fixedTimeKeyEquals("a".repeat(32), "a".repeat(32)), true);
  assert.equal(fixedTimeKeyEquals("a".repeat(32), "b".repeat(32)), false);
  assert.equal(fixedTimeKeyEquals("", "b".repeat(32)), false);
});

test("origin policy stays local/file only", () => {
  assert.equal(isAllowedOrigin("null"), true);
  assert.equal(isAllowedOrigin("file://"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:17487"), true);
  assert.equal(isAllowedOrigin("https://example.com"), false);
});

test("snapshot normalization and command validation are narrow", () => {
  const snapshot = normalizeSnapshot(fixture);
  assert.equal(snapshot.type, "snapshot");
  assert.equal(snapshot.windows[0].id, "1");
  assert.equal(snapshot.monitors[1].id, "B");
  assert.deepEqual(validateCommand({ type: "command", command: "move_monitor", windowId: "1", monitorId: "B" }, snapshot), {
    command: "move_monitor",
    windowId: "1",
    monitorId: "B",
  });
  assert.throws(() => validateCommand({ type: "command", command: "shell", windowId: "1" }, snapshot), /Unknown window command/);
  assert.throws(() => validateCommand({ type: "command", command: "focus", windowId: "999" }, snapshot), /no longer available/);
});

test("service authenticates and executes without exposing Pro actions", async () => {
  let state = structuredClone(fixture);
  const commands = [];
  const subscribers = new Set();
  const backend = {
    snapshot() { return structuredClone(state); },
    async execute(command) {
      commands.push(command);
      const window = state.windows.find((item) => String(item.id) === command.windowId);
      if (!window) throw new Error("missing");
      if (command.command === "focus") state.activeWindowId = command.windowId;
      if (command.command === "minimize") {
        window.state = "minimized";
        if (state.activeWindowId === command.windowId) state.activeWindowId = null;
      }
      if (command.command === "move_monitor") window.monitorId = command.monitorId;
      if (command.command === "close") state.windows = state.windows.filter((item) => String(item.id) !== command.windowId);
      for (const callback of subscribers) callback();
    },
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };

  const key = "window-manager-lite-test-key-123456";
  const live = await startWindowManagerXeneonService({
    backend,
    pairingKey: key,
    pluginVersion: "1.2.3.4",
    port: 0,
    reconcileMs: 60_000,
  });
  const port = live.port;
  assert.ok(Number.isInteger(port) && port > 0, "ephemeral listener port was not returned");

  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
    assert.equal(health.product, "PackRat Window Manager Lite");
    assert.equal(health.service, "xeneon-window-manager");

    const rejected = new WebSocket(`ws://127.0.0.1:${port}/widget`);
    await new Promise((resolve, reject) => {
      rejected.once("open", () => rejected.send(JSON.stringify({ type: "hello", protocol: 1, key: "wrong-key" })));
      rejected.once("message", (data) => {
        const message = JSON.parse(data.toString());
        assert.equal(message.type, "pairing_required");
        resolve();
      });
      rejected.once("error", reject);
    });
    rejected.close();

    const socket = new WebSocket(`ws://127.0.0.1:${port}/widget`);
    const messages = [];
    await new Promise((resolve, reject) => {
      socket.once("open", () => socket.send(JSON.stringify({ type: "hello", protocol: 1, key })));
      socket.on("message", (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.some((message) => message.type === "snapshot")) resolve();
      });
      socket.once("error", reject);
    });
    assert.equal(messages[0].type, "auth_ok");
    assert.equal(messages[0].product, "PackRat Window Manager Lite");

    socket.send(JSON.stringify({ type: "command", command: "focus", windowId: "1" }));
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("command timeout")), 2000);
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "command_result" && message.command === "focus") {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    assert.equal(commands.at(-1).command, "focus");
    assert.equal(commands.at(-1).windowId, "1");

    socket.close();
  } finally {
    await live.close();
  }
});
