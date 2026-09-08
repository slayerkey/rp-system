"use strict";
const assert = require("assert");
const { AppAudioWorkerClient } = require("./worker-client.js");

(async () => {
  const c = new AppAudioWorkerClient({ mock: true, timeoutMs: 5000 });
  try {
    const ping = await c.ping();
    assert.equal(ping.ready, true);
    assert.equal(ping.mock, true);
    const workerPid = c.pid;
    assert(Number.isInteger(workerPid) && workerPid > 0);

    // Foreground resolution shares the same persistent worker and has a stable structured contract.
    const foreground = await c.foreground();
    assert.deepEqual(foreground, { pid: 202, process: "Spotify" });
    assert.equal(c.pid, workerPid);

    // Concurrent commands must remain correctly correlated over one persistent stdout stream.
    const [all, discord, fuzzy, spotify, foregroundAgain] = await Promise.all([
      c.list(), c.findExact("Discord.exe"), c.findExact("disc"), c.findExact("C:\\Apps\\Spotify.exe"), c.foreground()
    ]);
    assert.equal(all.length, 3);
    assert.equal(discord.length, 2);
    assert.equal(fuzzy.length, 0);
    assert.equal(spotify.length, 1);
    assert.equal(foregroundAgain.pid, 202);
    assert.equal(c.pid, workerPid);

    // Exact app write changes both Discord sessions but not Spotify.
    let write = await c.setVolume("Discord", 51);
    assert.equal(write.changed, 2);
    assert.equal(write.missing, false);
    let list = await c.list();
    assert.deepEqual(list.filter(x => x.process === "Discord").map(x => x.volume), [51, 51]);
    assert.equal(list.find(x => x.process === "Spotify").volume, 35);

    // Dial-style repeated adjustments stay inside the same worker process.
    for (let i = 0; i < 12; i++) await c.adjustVolume("101", 1);
    assert.equal(c.pid, workerPid);
    list = await c.list();
    assert.deepEqual(list.filter(x => x.pid === 101).map(x => x.volume), [63, 63]);

    await c.mute("Discord");
    list = await c.list();
    assert(list.filter(x => x.process === "Discord").every(x => x.muted === true));
    await c.unmute("101");
    list = await c.list();
    assert(list.filter(x => x.pid === 101).every(x => x.muted === false));

    // Session disappearance/race behavior is non-scary: changed=0/missing=true, not a process crash.
    write = await c.setVolume("NotRunning", 50);
    assert.equal(write.changed, 0);
    assert.equal(write.missing, true);
    assert.equal(c.pid, workerPid);
    assert.equal((await c.ping()).ready, true);

    // Unknown commands fail one request while the persistent worker remains healthy.
    let failed = false;
    try { await c.request("DefinitelyNotACommand"); } catch (e) { failed = /Unknown action/i.test(e.message); }
    assert.equal(failed, true);
    assert.equal(c.pid, workerPid);
    assert.equal((await c.list()).length, 3);

    console.log("persistent app-audio worker passed: JSON framing, foreground resolution, concurrency, exact targeting, repeated dial writes, graceful missing session, request-level error recovery");
  } finally {
    await c.close();
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
