"use strict";
const assert = require("assert");
const { AppAudioWorkerClient } = require("./worker-client.js");

(async () => {
  const c = new AppAudioWorkerClient({ mock: false, timeoutMs: 12000 });
  try {
    // This proves the persistent worker can compile/load the real COM + foreground interop from source and speak the protocol.
    // It deliberately does not require a hosted CI runner to expose a playback endpoint.
    const ping = await c.ping();
    assert.equal(ping.ready, true);
    assert.equal(ping.mock, false);
    assert.equal(ping.type, "PackRatAppAudio.Core");
    assert.equal(ping.backend, "source");
    assert(Number.isInteger(c.pid) && c.pid > 0);
    const foreground = await c.foreground();
    assert(Number.isInteger(Number(foreground.pid)) && Number(foreground.pid) >= 0);
    assert.equal(typeof foreground.process, "string");
    console.log(`native app-audio source fallback startup passed: Core Audio + foreground interop ready; foreground pid=${foreground.pid} process=${foreground.process || "<none>"}`);
  } finally {
    await c.close();
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
