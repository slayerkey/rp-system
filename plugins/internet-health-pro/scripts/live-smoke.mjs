import { dnsLookup, pingHost, tcpConnect } from "../src/probes.js";

const platform = process.platform;
const dns = await dnsLookup("one.one.one.one", { timeoutMs: 3000 });
const tcp = await tcpConnect("1.1.1.1", 443, { timeoutMs: 3000 });
const icmp = await pingHost("1.1.1.1", { timeoutMs: 2500 });
const ipv4 = await tcpConnect("1.1.1.1", 443, { timeoutMs: 3000, family: "ipv4" });
const ipv6Dns = await dnsLookup("one.one.one.one", { timeoutMs: 3000, family: "ipv6" });

console.log(JSON.stringify({
  platform,
  dns: { ok: dns.ok, ms: dns.ms, family: dns.family, error: dns.error },
  tcp: { ok: tcp.ok, ms: tcp.ms, error: tcp.error },
  icmp: { ok: icmp.ok, ms: icmp.ms, error: icmp.error },
  ipv4: { ok: ipv4.ok, ms: ipv4.ms, error: ipv4.error },
  ipv6Dns: { ok: ipv6Dns.ok, ms: ipv6Dns.ms, family: ipv6Dns.family, error: ipv6Dns.error }
}, null, 2));

if (!dns.ok) throw new Error("Live DNS lookup failed on clean runner");
if (!tcp.ok) throw new Error("Live TCP-connect check failed on clean runner");
if (!ipv4.ok) throw new Error("Live IPv4 TCP-connect check failed on clean runner");
// ICMP and IPv6 are intentionally diagnostic-only: runners and networks may block them.
