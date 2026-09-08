"use strict";
const assert = require("assert");
const model = require("./session-model.js");
const { AppAudioService, stableTarget, targetKey } = require("./app-audio-service.js");

const sleep = ms => new Promise(r => setTimeout(r, ms));
function row(pid, process, volume, muted = false, state = "Active") { return { pid, process, volume, muted, state, displayName: "", sessionIdentifier: `${process}-${pid}` }; }

class FakeWorker {
  constructor(rows = []) {
    this.rows = rows.map(x => ({ ...x }));
    this.listCalls = 0; this.writes = []; this.listDelay = 0; this.throwList = false; this.missingNext = false;
  }
  async list() {
    this.listCalls++;
    if (this.listDelay) await sleep(this.listDelay);
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
    if (this.missingNext) { this.missingNext = false; this.rows = []; return { changed: 0, missing: true, match: String(match) }; }
    const rows = this.match(match);
    for (const r of rows) {
      if (action === "SetVolume") r.volume = Math.max(0, Math.min(100, Number(value)));
      if (action === "AdjustVolume") r.volume = Math.max(0, Math.min(100, Number(r.volume) + Number(value)));
      if (action === "Mute") r.muted = true;
      if (action === "Unmute") r.muted = false;
      if (action === "ToggleMute") r.muted = !r.muted;
    }
    return { changed: rows.length, missing: rows.length === 0, match: String(match) };
  }
  setVolume(m, v) { return this.write("SetVolume", m, v); }
  adjustVolume(m, v) { return this.write("AdjustVolume", m, v); }
  mute(m) { return this.write("Mute", m); }
  unmute(m) { return this.write("Unmute", m); }
  toggleMute(m) { return this.write("ToggleMute", m); }
}

(async () => {
  assert.deepEqual(stableTarget({ kind: "current" }, { pid: 55, process: "chrome" }), { kind: "pid", pid: 55 });
  assert.deepEqual(stableTarget({ kind: "current" }, { process: "Discord.exe" }), { kind: "process", process: "discord" });
  assert.equal(targetKey({ kind: "pid", pid: 55 }), "pid:55");
  assert.equal(targetKey({ kind: "process", process: "Discord.exe" }), "process:discord");

  const worker = new FakeWorker([
    row(101, "Discord", 40), row(101, "Discord", 40), row(202, "Spotify", 30),
    row(501, "chrome", 50), row(502, "chrome", 70)
  ]);
  worker.listDelay = 25;
  let now = 1000;
  let foreground = { pid: 501, process: "chrome" };
  const svc = new AppAudioService({ worker, now: () => now, cacheMs: 500, coalesceMs: 25, foregroundProvider: async () => foreground });

  // Multiple controls appearing together share one native session enumeration.
  const [discord, spotify, current] = await Promise.all([
    svc.stateFor({ kind: "process", process: "discord" }),
    svc.stateFor({ kind: "process", process: "spotify" }),
    svc.stateFor({ kind: "current" })
  ]);
  assert.equal(worker.listCalls, 1);
  assert.equal(discord.volume, 40);
  assert.equal(spotify.volume, 30);
  assert.equal(current.volume, 50);
  assert.deepEqual(current.pids, [501]);

  // Cache avoids another enumeration within the visible-state window.
  now += 100;
  await svc.stateFor({ kind: "process", process: "discord" });
  assert.equal(worker.listCalls, 1);
  now += 600;
  await svc.stateFor({ kind: "process", process: "discord" });
  assert.equal(worker.listCalls, 2);

  // A rapid dial burst becomes one native delta write, then one state refresh.
  worker.writes = [];
  const burst = [];
  for (let i = 0; i < 12; i++) burst.push(svc.adjustCoalesced({ kind: "process", process: "discord" }, 1));
  const burstResults = await Promise.all(burst);
  assert.equal(worker.writes.length, 1);
  assert.deepEqual(worker.writes[0], { action: "AdjustVolume", match: "discord", value: 12 });
  assert(burstResults.every(x => x.executed === true));
  assert.equal(worker.rows.find(x => x.process === "Discord").volume, 52);

  // Opposing ticks inside one burst can cancel without touching native audio.
  worker.writes = [];
  const cancel = [
    svc.adjustCoalesced({ kind: "process", process: "spotify" }, 3),
    svc.adjustCoalesced({ kind: "process", process: "spotify" }, -3)
  ];
  const cancelResults = await Promise.all(cancel);
  assert.equal(worker.writes.length, 0);
  assert(cancelResults.every(x => x.executed === false && x.reason === "zero-delta"));

  // Current-app dial snapshots the foreground PID, so a later app switch cannot redirect an in-flight burst.
  worker.writes = [];
  foreground = { pid: 501, process: "chrome" };
  const first = svc.adjustCoalesced({ kind: "current" }, 4);
  foreground = { pid: 502, process: "chrome" };
  const second = svc.adjustCoalesced({ kind: "current" }, 6);
  await Promise.all([first, second]);
  assert.equal(worker.writes.length, 2);
  assert(worker.writes.some(x => x.match === "501" && x.value === 4));
  assert(worker.writes.some(x => x.match === "502" && x.value === 6));
  assert.equal(worker.rows.find(x => x.pid === 501).volume, 54);
  assert.equal(worker.rows.find(x => x.pid === 502).volume, 76);

  // Missing session is a no-op before native execution.
  svc.invalidate(); now += 1000; worker.writes = [];
  const waiting = await svc.execute({ kind: "process", process: "vlc" }, { type: "adjust-volume", delta: 5 }, {});
  assert.equal(waiting.executed, false);
  assert.equal(waiting.reason, "waiting");
  assert.equal(worker.writes.length, 0);

  // Session disappearing between cached read and write becomes WAITING rather than a scary native failure.
  svc.invalidate(); now += 1000;
  await svc.stateFor({ kind: "process", process: "discord" }, {});
  worker.missingNext = true; worker.writes = [];
  const raced = await svc.execute({ kind: "process", process: "discord" }, { type: "set-volume", value: 55 }, {});
  assert.equal(raced.executed, false);
  assert.equal(raced.reason, "session-disappeared");
  assert.equal(raced.after.status, "waiting");
  assert.equal(worker.writes.length, 1);

  // Enumeration failure becomes explicit AUDIO OFF state instead of throwing through the UI.
  worker.rows = [row(101, "Discord", 40)]; worker.throwList = true; svc.invalidate(); now += 1000;
  const unavailable = await svc.stateFor({ kind: "process", process: "discord" }, {});
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.label, "AUDIO OFF");
  assert.match(unavailable.error, /playback endpoint/i);
  const noWrite = await svc.execute({ kind: "process", process: "discord" }, { type: "mute" }, {});
  assert.equal(noWrite.executed, false);
  assert.equal(noWrite.reason, "unavailable");

  // Recovery on the next successful refresh restores normal state.
  worker.throwList = false; svc.invalidate(); now += 1000;
  const recovered = await svc.stateFor({ kind: "process", process: "discord" }, {});
  assert.equal(recovered.status, "active");
  assert.equal(recovered.volume, 40);

  // Mixed mute state converges through the product plan, not low-level blind toggle.
  worker.rows = [row(101, "Discord", 40, true), row(101, "Discord", 40, false)]; svc.invalidate(); now += 1000; worker.writes = [];
  const muted = await svc.execute({ kind: "process", process: "discord" }, { type: "toggle-mute" }, {});
  assert.equal(muted.executed, true);
  assert.equal(worker.writes[0].action, "Mute");
  assert(worker.rows.every(x => x.muted === true));

  await svc.dispose();
  console.log("app-audio service passed: shared refresh cache, concurrent dedupe, dial coalescing/cancel, foreground snapshot safety, WAITING race recovery, AUDIO OFF recovery, mixed-mute convergence");
})().catch(e => { console.error(e.stack || e); process.exit(1); });
