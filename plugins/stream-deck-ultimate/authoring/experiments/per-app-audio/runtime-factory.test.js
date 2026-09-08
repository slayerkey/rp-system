"use strict";
const assert = require("assert");
const { createAppAudioRuntime } = require("./runtime-factory.js");
const { TestAppAudioWorker } = require("./test-worker.js");

(async () => {
  const renders = [];
  const worker = new TestAppAudioWorker();
  const runtime = createAppAudioRuntime({
    worker,
    cacheMs: 5000,
    coalesceMs: 15,
    render: async (context, view) => renders.push({ context, view: JSON.parse(JSON.stringify(view)) })
  });
  const latest = context => [...renders].reverse().find(x => x.context === context)?.view;
  try {
    const started = await runtime.start();
    assert.equal(started.ready, true);
    assert.equal(started.worker.mock, true);
    assert.equal(started.worker.backend, "test");

    // No custom foreground provider is supplied: Current App must resolve through worker.foreground().
    await runtime.handle({
      event: "willAppear", context: "current",
      payload: { controller: "Encoder", settings: { mode: "current", step: 2 } }
    });
    assert.equal(latest("current").feedback.title, "SPOTIFY");
    assert.equal(latest("current").feedback.value, "35%");

    const rotate = await runtime.handle({ event: "dialRotate", context: "current", payload: { ticks: 3 } });
    assert.equal(rotate.executed, true);
    assert.equal(rotate.plan.match, "202");
    assert.equal(rotate.plan.value, 6);
    assert.equal(latest("current").feedback.value, "41%");

    const press = await runtime.handle({ event: "dialDown", context: "current", payload: {} });
    assert.equal(press.executed, true);
    assert.equal(press.plan.match, "202");
    assert.equal(latest("current").feedback.value, "MUTED");

    // A named control shares the same service/cache while remaining independently targetable.
    await runtime.handle({
      event: "willAppear", context: "discord",
      payload: { controller: "Encoder", settings: { mode: "process", process: "discord", step: 2 } }
    });
    assert.equal(latest("discord").feedback.title, "DISCORD");
    assert.equal(latest("discord").feedback.value, "42%");

    console.log("composed app-audio runtime passed: worker foreground provider -> service -> Stream Deck controller, Current App PID writes, named app channel, shared lifecycle");
  } finally {
    await runtime.dispose();
    assert.equal(worker.closed, true);
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
