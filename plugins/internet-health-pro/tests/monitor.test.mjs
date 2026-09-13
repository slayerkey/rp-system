import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { HistoryStore } from "../src/history.js";
import { NetworkMonitor } from "../src/monitor.js";

function makeStore(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ihp-" + name + "-"));
  return new HistoryStore({ filePath: path.join(dir, "history.json"), maxHours: 24 });
}

function fakeDiagnostic(overrides = {}) {
  return {
    ipReachable: true,
    dnsWorks: true,
    secondaryPing: { ok: true, ms: 25, method: "icmp" },
    cloudflareTcp: { ok: true, ms: 31, method: "tcp" },
    googleTcp: { ok: true, ms: 34, method: "tcp" },
    cloudflareDns: { ok: true, ms: 7, method: "dns" },
    googleDns: { ok: true, ms: 8, method: "dns" },
    fallbackLatency: { ok: true, ms: 31, method: "tcp" },
    ...overrides
  };
}

function makeMonitor({ nowRef, ping, diagnostic, target, https, speed } = {}) {
  let targetCalls = 0;
  let targetArgs = null;
  const monitor = new NetworkMonitor({
    historyStore: makeStore("monitor"),
    now: () => nowRef.value,
    setTimer: () => 1,
    clearTimer: () => {},
    probe: {
      pingHost: ping || (async () => ({ ok: true, ms: 24, method: "icmp" })),
      fullConnectivityDiagnostic: diagnostic || (async () => fakeDiagnostic()),
      httpsTiming: https || (async () => ({ ok: true, ms: 42, method: "https", status: 204 })),
      probeTarget: async (...args) => {
        targetCalls += 1;
        targetArgs = args;
        return target ? target(...args) : { ok: true, ms: 20, method: "icmp" };
      },
      runCloudflareSpeedTest: speed || (async () => ({ ok: true, downloadMbps: 100, uploadMbps: 20, totalBytes: 10_000_000, completedAt: nowRef.value }))
    }
  });
  return { monitor, targetCalls: () => targetCalls, targetArgs: () => targetArgs };
}

test("healthy connection records native ICMP latency", async () => {
  const nowRef = { value: 100_000 };
  const { monitor } = makeMonitor({ nowRef });
  await monitor.runCycle();
  const snapshot = monitor.snapshot();
  assert.equal(snapshot.connectivity.status, "online");
  assert.equal(snapshot.metrics30.current, 24);
  assert.equal(snapshot.metrics30.method, "icmp");
});

test("ICMP blocked but TCP reachable does not manufacture 100 percent loss", async () => {
  const nowRef = { value: 100_000 };
  const { monitor } = makeMonitor({
    nowRef,
    ping: async () => ({ ok: false, ms: null, method: "icmp" }),
    diagnostic: async () => fakeDiagnostic({ fallbackLatency: { ok: true, ms: 35, method: "tcp" } })
  });
  await monitor.runCycle();
  const snapshot = monitor.snapshot();
  assert.equal(snapshot.connectivity.status, "online");
  assert.equal(snapshot.metrics30.method, "tcp");
  assert.equal(snapshot.metrics30.loss, null);
});

test("whole internet outage needs two independent failed diagnostic cycles then recovers", async () => {
  const nowRef = { value: 100_000 };
  let online = false;
  const { monitor } = makeMonitor({
    nowRef,
    ping: async () => online ? { ok: true, ms: 28, method: "icmp" } : { ok: false, ms: null, method: "icmp" },
    diagnostic: async () => online ? fakeDiagnostic() : fakeDiagnostic({
      ipReachable: false,
      dnsWorks: false,
      secondaryPing: { ok: false },
      cloudflareTcp: { ok: false },
      googleTcp: { ok: false },
      cloudflareDns: { ok: false },
      googleDns: { ok: false },
      fallbackLatency: null
    })
  });
  const firstFailureAt = nowRef.value;
  await monitor.runCycle();
  assert.equal(monitor.snapshot().connectivity.status, "suspected-offline");
  nowRef.value += 10_000;
  await monitor.runCycle();
  assert.equal(monitor.snapshot().connectivity.status, "offline");
  assert.equal(monitor.snapshot().outages.at(-1).start, firstFailureAt);
  assert.equal(monitor.snapshot().outages.at(-1).end, null);

  online = true;
  nowRef.value += 10_000;
  await monitor.runCycle();
  assert.equal(monitor.snapshot().connectivity.status, "online");
  assert.ok(monitor.snapshot().outages.at(-1).end);
});

test("DNS failure is separate from whole-internet outage and requires repeated evidence", async () => {
  const nowRef = { value: 100_000 };
  const { monitor } = makeMonitor({
    nowRef,
    diagnostic: async () => fakeDiagnostic({
      ipReachable: true,
      dnsWorks: false,
      cloudflareDns: { ok: false },
      googleDns: { ok: false }
    })
  });
  await monitor.runCycle();
  assert.equal(monitor.snapshot().connectivity.status, "degraded");
  nowRef.value += 31_000;
  await monitor.runCycle();
  assert.equal(monitor.snapshot().connectivity.status, "dns-failure");
  assert.equal(monitor.snapshot().outages.length, 0);
});

test("sleep/resume creates an unobserved gap instead of an outage", async () => {
  const nowRef = { value: 100_000 };
  const { monitor } = makeMonitor({ nowRef });
  await monitor.runCycle();
  nowRef.value += 120_000;
  await monitor.runCycle();
  const snapshot = monitor.snapshot();
  assert.equal(snapshot.connectivity.status, "online");
  assert.equal(snapshot.outages.length, 0);
  assert.ok(snapshot.samples.some((item) => item.gap === true && item.observed === false));
});

test("multiple keys with the same target share one target record and one probe", async () => {
  const nowRef = { value: 100_000 };
  const ctx = makeMonitor({ nowRef });
  ctx.monitor.registerTarget("key-a", { target: "example.com", targetMethod: "tcp", targetPort: 443, family: "auto" });
  ctx.monitor.registerTarget("key-b", { target: "example.com", targetMethod: "tcp", targetPort: 443, family: "auto" });
  assert.equal(ctx.monitor.targets.size, 1);
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetCalls(), 1);
  assert.equal(ctx.monitor.targetSnapshot("key-a").reading.ok, true);
  assert.equal(ctx.monitor.targetSnapshot("key-b").reading.ok, true);
});

test("target family setting is forwarded for IPv4 and IPv6 checks", async () => {
  const nowRef = { value: 100_000 };
  const ctx = makeMonitor({ nowRef });
  ctx.monitor.registerTarget("v6", { target: "example.com", targetMethod: "tcp", targetPort: 443, family: "ipv6" });
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetArgs()[1].family, "ipv6");
});

test("host unavailable affects Target Health only, not whole internet state", async () => {
  const nowRef = { value: 100_000 };
  const ctx = makeMonitor({ nowRef, target: async () => ({ ok: false, ms: null, method: "tcp", error: "ECONNREFUSED" }) });
  ctx.monitor.registerTarget("target", { target: "bad.example", targetMethod: "tcp", targetPort: 443 });
  await ctx.monitor.runCycle();
  assert.equal(ctx.monitor.snapshot().connectivity.status, "online");
  assert.equal(ctx.monitor.targetSnapshot("target").reading.ok, false);
});

test("manual speed test is the only path that runs throughput and respects declared cap result", async () => {
  const nowRef = { value: 100_000 };
  let speedCalls = 0;
  const { monitor } = makeMonitor({
    nowRef,
    speed: async (options) => {
      speedCalls += 1;
      assert.equal(options.downloadBytes, 64_000_000);
      assert.equal(options.uploadBytes, 4_000_000);
      assert.equal(options.warmupBytes, 1_000_000);
      assert.equal(options.probeBytes, 4_000_000);
      assert.equal(options.timeoutMs, 45_000);
      return { ok: true, downloadMbps: 800, uploadMbps: 95, totalBytes: 73_000_000, completedAt: nowRef.value };
    }
  });
  await monitor.runCycle();
  assert.equal(speedCalls, 0);
  await monitor.runSpeedTest();
  assert.equal(speedCalls, 1);
  assert.equal(monitor.snapshot().latestSpeed.totalBytes, 73_000_000);
});


test("VPN-style route change can alter latency without creating an outage", async () => {
  const nowRef = { value: 100_000 };
  let latency = 24;
  const { monitor } = makeMonitor({
    nowRef,
    ping: async () => ({ ok: true, ms: latency, method: "icmp" })
  });
  await monitor.runCycle();
  latency = 72;
  nowRef.value += 10_000;
  await monitor.runCycle();
  assert.equal(monitor.snapshot().connectivity.status, "online");
  assert.equal(monitor.snapshot().outages.length, 0);
  assert.equal(monitor.snapshot().metrics30.current, 72);
});

test("failed Target Health endpoints back off instead of being hammered", async () => {
  const nowRef = { value: 100_000 };
  const ctx = makeMonitor({
    nowRef,
    target: async () => ({ ok: false, ms: null, method: "tcp", error: "timeout" })
  });
  ctx.monitor.registerTarget("dead", { target: "dead.example", targetMethod: "tcp", targetPort: 443 });
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetCalls(), 1);
  nowRef.value += 10_000;
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetCalls(), 1, "target remains in backoff before next due time");
  nowRef.value += 20_000;
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetCalls(), 2);
  const record = [...ctx.monitor.targets.values()][0];
  assert.equal(record.failureStreak, 2);
  assert.ok(record.nextPollAt >= nowRef.value + 60_000);
});

test("more than eight distinct targets are rotated rather than spawning more pollers", async () => {
  const nowRef = { value: 100_000 };
  const ctx = makeMonitor({ nowRef });
  for (let i = 0; i < 10; i += 1) {
    ctx.monitor.registerTarget("key-" + i, { target: "host-" + i + ".example", targetMethod: "tcp", targetPort: 443 });
  }
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetCalls(), 8);
  nowRef.value += 30_000;
  await ctx.monitor.pollTargets();
  assert.ok(ctx.targetCalls() >= 10, "second batch reaches the targets not included in the first capped batch");
});

test("Auto Target Health preserves auto mode so ICMP can fall back to TCP", async () => {
  const nowRef = { value: 100_000 };
  const ctx = makeMonitor({ nowRef });
  ctx.monitor.registerTarget("auto", { target: "example.com", targetMethod: "auto", targetPort: 443, family: "auto" });
  await ctx.monitor.pollTargets();
  assert.equal(ctx.targetArgs()[1].method, "auto");
  const snapshot = ctx.monitor.targetSnapshot("auto");
  assert.equal(snapshot.configuredMethod, "auto");
  assert.equal(snapshot.expectedMethod, "icmp");
});
