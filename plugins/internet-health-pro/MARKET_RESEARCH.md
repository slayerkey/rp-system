# Internet Health Pro — Marketplace validation

Research date: 2026-09-13

## Current competition found

- **Speed Test by BarRaider** — current Marketplace version 1.4.2. BarRaider's documentation describes it as running a Speedtest.net speed test directly from Stream Deck and displaying the results.
- **Speedtest by FCAN** — current Marketplace speed-test utility for Windows and macOS.
- **Speedtest Tracker by MrAndersenDK** — current Marketplace utility tied to Speedtest Tracker.
- **Uptime by Value Object** — current Marketplace monitoring plugin.
- **Netstatik by Vaz Inc** — current Marketplace monitoring/productivity/network utility.
- **Uptime Kuma** — Stream Deck integration for an external Uptime Kuma monitoring system.
- **Win Tools** — includes a Ping action that shows server latency and timeout state.

## Gap Internet Health Pro owns

Internet Health Pro is not positioned as another button that launches or periodically runs a throughput benchmark.

The product job is:

> Tell me whether my internet connection is healthy over time, what kind of failure is happening, and when it started.

The combined differentiators are:

1. One local shared monitoring engine for all Internet Health Pro keys.
2. Native ICMP latency where available, with TCP-connect fallback that is labeled as TCP rather than "ping".
3. Separate DNS lookup and HTTPS response-timing diagnostics.
4. Whole-internet outage confirmation that requires independent signals instead of one failed host.
5. Explicit distinction between INTERNET OFFLINE, DNS FAILURE, TARGET OFFLINE, HIGH LATENCY, HIGH JITTER, and observed PROBE LOSS.
6. Rolling local history, outage duration/uptime, and manual target monitoring.
7. Manual-only throughput testing with a hard transfer cap.
8. No PackRat telemetry and bounded local persistence.

## Pricing

Initial price remains **$7.99**.

That price is justified by the always-on diagnosis/history layer and seven coordinated actions, while remaining below PackRat's larger $9.99 system-control products.
