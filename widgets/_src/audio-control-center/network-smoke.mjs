import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { WebSocketServer } from "ws";

const entry = path.resolve(process.argv[2]);
const received = [];

const snapshot = {
  type: "snapshot",
  protocol: 1,
  bridge: { listening: true, version: "fixture" },
  capabilities: {
    defaultDeviceSwitching: true,
    outputVolume: true,
    inputVolume: true
  },
  defaultOutputId: "o1",
  defaultInputId: "i1",
  outputs: [
    {
      id: "o1",
      name: "Speakers",
      volume: 60,
      muted: false,
      volumeAvailable: true,
      muteAvailable: true
    },
    {
      id: "o2",
      name: "Headphones",
      volume: 35,
      muted: false,
      volumeAvailable: true,
      muteAvailable: true
    }
  ],
  inputs: [
    {
      id: "i1",
      name: "Studio Mic",
      volume: 75,
      muted: false,
      volumeAvailable: true,
      muteAvailable: true
    }
  ],
  error: null
};

async function startServer() {
  const server = new WebSocketServer({
    host: "127.0.0.1",
    port: 17484,
    path: "/ws"
  });

  server.on("connection", (socket) => {
    socket.send(JSON.stringify(snapshot));
    socket.on("message", (raw) => {
      let command;
      try {
        command = JSON.parse(String(raw));
      } catch {
        return;
      }

      received.push(command);

      if (command.command === "set-default-output") {
        snapshot.defaultOutputId = command.deviceId;
      }
      if (command.command === "set-output-mute") {
        const endpoint = snapshot.outputs.find(
          (value) => value.id === snapshot.defaultOutputId
        );
        if (endpoint) endpoint.muted = Boolean(command.value);
      }

      socket.send(JSON.stringify(snapshot));
    });
  });

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  return server;
}

async function stopServer(server) {
  if (!server) return;
  for (const client of server.clients) {
    try { client.terminate(); } catch {}
  }
  await new Promise((resolve) => server.close(resolve));
}

let server = await startServer();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 840, height: 696 } });

try {
  await page.addInitScript(() => {
    globalThis.tr = async (value) => value;
    globalThis.icueEvents = {};
  });

  await page.goto(pathToFileURL(entry).href, { waitUntil: "load" });
  await page.waitForFunction(() => (
    document.body.dataset.connection === "ready" &&
    globalThis.__PACKRAT_AUDIO_TEST__?.getState().outputs.length === 2
  ), { timeout: 10000 });

  assert.ok(
    received.some((value) => value.command === "refresh"),
    "widget did not request an initial bridge refresh"
  );

  await page.locator('.device[title="Headphones"]').click();
  await page.waitForFunction(() => (
    globalThis.__PACKRAT_AUDIO_TEST__.getState().defaultOutputId === "o2"
  ));

  assert.ok(
    received.some((value) =>
      value.command === "set-default-output" && value.deviceId === "o2"),
    "default output command did not cross the real WebSocket path"
  );

  await page.locator("#outputMute").click();
  await page.waitForFunction(() => (
    globalThis.__PACKRAT_AUDIO_TEST__.getState()
      .outputs.find((value) => value.id === "o2")?.muted === true
  ));

  await stopServer(server);
  server = null;

  await page.waitForFunction(() => (
    document.body.dataset.connection === "offline"
  ), { timeout: 6000 });

  server = await startServer();

  await page.waitForFunction(() => (
    document.body.dataset.connection === "ready"
  ), { timeout: 8000 });

  assert.deepEqual(
    await page.evaluate(() => {
      const state = globalThis.__PACKRAT_AUDIO_TEST__.getState();
      return {
        output: state.defaultOutputId,
        input: state.defaultInputId,
        outputs: state.outputs.length,
        inputs: state.inputs.length
      };
    }),
    { output: "o2", input: "i1", outputs: 2, inputs: 1 },
    "widget did not recover the fresh bridge snapshot after reconnect"
  );

  console.log(
    "AUDIO CONTROL CENTER PACKAGED NETWORK PASS: commands, loss, reconnect"
  );
} finally {
  try { await stopServer(server); } catch {}
  await browser.close();
}
