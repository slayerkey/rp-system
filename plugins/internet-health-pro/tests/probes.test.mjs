import test from "node:test";
import assert from "node:assert/strict";
import { parsePingOutput, pingInvocation, probeTarget } from "../src/probes.js";

test("parses Windows and Unix ICMP timing without relabeling it", () => {
  assert.equal(parsePingOutput("Reply from 1.1.1.1: bytes=32 time=24ms TTL=57"), 24);
  assert.equal(parsePingOutput("Reply from 1.1.1.1: bytes=32 time<1ms TTL=57"), 1);
  assert.equal(parsePingOutput("64 bytes from 1.1.1.1: icmp_seq=0 ttl=57 time=13.742 ms"), 13.742);
  assert.equal(parsePingOutput("Request timed out."), null);
});

test("builds platform-correct ping commands for explicit IP families", () => {
  assert.deepEqual(pingInvocation("win32", "example.com", "ipv4"), { command: "ping", args: ["-4", "-n", "1", "example.com"] });
  assert.deepEqual(pingInvocation("win32", "example.com", "ipv6"), { command: "ping", args: ["-6", "-n", "1", "example.com"] });
  assert.deepEqual(pingInvocation("darwin", "example.com", "ipv4"), { command: "ping", args: ["-c", "1", "example.com"] });
  assert.deepEqual(pingInvocation("darwin", "example.com", "ipv6"), { command: "ping6", args: ["-c", "1", "example.com"] });
  assert.deepEqual(pingInvocation("linux", "example.com", "ipv4"), { command: "ping", args: ["-4", "-c", "1", "example.com"] });
  assert.deepEqual(pingInvocation("linux", "example.com", "ipv6"), { command: "ping", args: ["-6", "-c", "1", "example.com"] });
});

test("auto target method treats HTTPS URLs as HTTPS response timing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 429,
    ok: false,
    body: { cancel: async () => {} }
  });
  try {
    const result = await probeTarget("https://example.test/health", { method: "auto", timeoutMs: 100 });
    assert.equal(result.method, "https");
    assert.equal(result.ok, true, "an HTTP response proves the host is reachable even if rate-limited");
    assert.equal(result.status, 429);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
