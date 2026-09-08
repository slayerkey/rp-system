"use strict";
const assert = require("assert");
const model = require("./session-model.js");
const { AppAudioService } = require("./app-audio-service.js");
const { AppAudioStreamDeckController } = require("./streamdeck-controller.js");

function row(pid, process, volume, muted = false, state = "Active") {
  return { pid, process, volume, muted, state, displayName: "", sessionIdentifier: `${process}-${pid}` };
}

class FakeWorker {
  constructor(rows = []) {
    this.rows = rows.map(x => ({ ...x }));
    this.listCalls = 0;
    this.writes = [];
    this.throwList = false;
  }
  async list() {
    this.listCalls++;
    if (this.throwList) throw new Error("no playback endpoint");
    return this.rows.map(x => ({ ...x }));
  }
  match(match) {
    const pid = Number(match), isPid = Number.isInteger(pid) && String(pid) === String(match);
    const key = model.normalizeProcessName(match);
    return this.rows.filter(x => isPid ? Number(x.pid) === pid : model.normalizeProcessName(x.process) === key);
  }
  async write(action, match, value) {
    this.writes.push({ action, match: String(match), value });
    const targets = this.match(match);
    for (const target of targets) {
      if (action === "SetVolume") target.volume = Math.max(0, Math.min(100, Number(value)));
      else if (action === "AdjustVolume") target.volume = Math.max(0, Math.min(100, Number(target.volume) + Number(value)));
      else if (action === "Mute") target.muted = true;
      else if (action === "Unmute") target.muted = false;
      else if (action === "ToggleMute") target.muted = !target.muted;
    }
    return { changed: targets.length, missing: targets.length === 0, match: String(match) };
  }
  setVolume(m, v) { return this.write("SetVolume", m, v); }
  adjustVolume(m, v) { return this.write("AdjustVolume", m, v); }
  mute(m) { return this.write("Mute", m); }
  unmute(m) { return this.write("Unmute", m); }
  toggleMute(m) { return this.write("ToggleMute", m); }
}

(async () => {
  const worker = new FakeWorker([
    row(101, "Discord", 40), row(101, "Discord", 40),
    row(202, "Spotify", 30), row(501, "chrome", 50), row(502, "chrome", 70)
  ]);
  let foreground = { pid: 202, process: "Spotify" };
  const foregroundQueue = [];
  const service = new AppAudioService({
    worker,
    cacheMs: 5000,
    coalesceMs: 15,
    foregroundProvider: async () => ({ ...(foregroundQueue.length ? foregroundQueue.shift() : foreground) })
  });
  const renders = [];
  const controller = new AppAudioStreamDeckController({
    service,
    render: async (context, view) => renders.push({ context, view: JSON.parse(JSON.stringify(view)) })
  });
  const latest = context => [...renders].reverse().find(x => x.context === context)?.view;

  // Named app encoder renders live state using the actual Stream Deck willAppear payload shape.
  await controller.handle({
    event: "willAppear", context: "discord-dial",
    payload: { controller: "Encoder", settings: { mode: "process", process: "Discord.exe", step: 2 } }
  });
  assert.equal(latest("discord-dial").feedback.title, "DISCORD");
  assert.equal(latest("discord-dial").feedback.value, "40%");
  assert.equal(latest("discord-dial").feedback.indicator.value, 40);

  // Three dial ticks at 2% each become one +6 exact-process write and render the resulting 46% state.
  worker.writes = [];
  const rotated = await controller.handle({ event: "dialRotate", context: "discord-dial", payload: { ticks: 3 } });
  assert.equal(rotated.executed, true);
  assert.deepEqual(worker.writes, [{ action: "AdjustVolume", match: "discord", value: 6 }]);
  assert.equal(latest("discord-dial").feedback.value, "46%");

  // Encoder press uses the safe product mute plan and renders MUTED.
  worker.writes = [];
  const pressed = await controller.handle({ event: "dialDown", context: "discord-dial", payload: {} });
  assert.equal(pressed.executed, true);
  assert.deepEqual(worker.writes, [{ action: "Mute", match: "discord", value: undefined }]);
  assert.equal(latest("discord-dial").feedback.value, "MUTED");

  // Settings changes immediately re-target the instance. Empty named app becomes SET APP and cannot write.
  await controller.handle({
    event: "didReceiveSettings", context: "discord-dial",
    payload: { settings: { mode: "process", process: "", step: 2 } }
  });
  assert.equal(latest("discord-dial").feedback.value, "SET APP");
  worker.writes = [];
  const unsetRotate = await controller.handle({ event: "dialRotate", context: "discord-dial", payload: { ticks: 2 } });
  assert.equal(unsetRotate.executed, false);
  assert.equal(unsetRotate.reason, "unconfigured");
  assert.equal(worker.writes.length, 0);

  // Current App captures one foreground snapshot for the interaction and writes the PID, not the process family.
  foreground = { pid: 202, process: "Spotify" };
  await controller.handle({
    event: "willAppear", context: "current-dial",
    payload: { controller: "Encoder", settings: { mode: "current", step: 2 } }
  });
  assert.equal(latest("current-dial").feedback.title, "SPOTIFY");
  assert.equal(latest("current-dial").feedback.value, "30%");
  worker.writes = [];
  foregroundQueue.push({ pid: 202, process: "Spotify" });
  const currentRotate = controller.handle({ event: "dialRotate", context: "current-dial", payload: { ticks: 2 } });
  foreground = { pid: 501, process: "chrome" };
  await currentRotate;
  assert.deepEqual(worker.writes, [{ action: "AdjustVolume", match: "202", value: 4 }]);
  assert.equal(worker.rows.find(x => x.pid === 202).volume, 34);

  // A foreground app with no session shows WAITING and a dial turn is a no-op, not a failure.
  foreground = { pid: 999, process: "vlc" };
  await controller.refreshContext("current-dial", true);
  assert.equal(latest("current-dial").feedback.value, "WAITING");
  worker.writes = [];
  const waitingRotate = await controller.handle({ event: "dialRotate", context: "current-dial", payload: { ticks: 2 } });
  assert.equal(waitingRotate.executed, false);
  assert.equal(waitingRotate.reason, "waiting");
  assert.equal(worker.writes.length, 0);

  // Multiple visible controls share the same forced refresh rather than each enumerating Core Audio.
  await controller.handle({
    event: "willAppear", context: "spotify-key",
    payload: { controller: "Keypad", settings: { mode: "process", process: "spotify" } }
  });
  worker.listCalls = 0;
  await controller.refreshVisible(true);
  assert.equal(worker.listCalls, 1);

  // Endpoint loss is rendered as AUDIO OFF and press remains non-destructive.
  worker.throwList = true;
  worker.writes = [];
  await controller.refreshVisible(true);
  assert.equal(latest("current-dial").feedback.value, "AUDIO OFF");
  const offPress = await controller.handle({ event: "dialDown", context: "current-dial", payload: {} });
  assert.equal(offPress.executed, false);
  assert.equal(worker.writes.length, 0);
  worker.throwList = false;

  // Disappeared instances cannot receive a late dial event.
  const renderCount = renders.length;
  assert.equal(await controller.handle({ event: "willDisappear", context: "current-dial", payload: {} }), true);
  const afterDisappear = await controller.handle({ event: "dialRotate", context: "current-dial", payload: { ticks: 5 } });
  assert.equal(afterDisappear.executed, false);
  assert.equal(afterDisappear.reason, "missing-instance");
  assert.equal(renders.length, renderCount);

  await controller.dispose();
  console.log("Stream Deck app-audio controller passed: lifecycle events, named/current targeting, foreground PID snapshot, coalesced dial writes, mute press, WAITING/AUDIO OFF safety, shared refresh, disappear cleanup");
})().catch(e => { console.error(e.stack || e); process.exit(1); });
