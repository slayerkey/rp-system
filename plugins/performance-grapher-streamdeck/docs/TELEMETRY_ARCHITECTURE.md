# Telemetry architecture and research decision

## Commercial job

The product is not sold as a live temperature tile. Its job is to preserve enough local context to answer:

- What just happened?
- Did frametime spike?
- What were the 1% and 0.1% lows?
- Did GPU or CPU pressure coincide with bad frame buckets?
- What temperature/load peak happened during this game?
- Did the active game/process change?

The key surface is intentionally terse. Diagnosis depth lives in rolling history, process-aware state, completed-session data, and the Property Inspector.

## Evaluated providers

### HWiNFO — rejected as a required source

HWiNFO has excellent sensor coverage, but the free shared-memory path has a 12-hour activation limitation and HWiNFO licensing distinguishes commercial use. Requiring it would make PackRat's paid product depend on a separate licensing/activation story. Performance Grapher therefore does not require or silently select HWiNFO.

### Windows native counters — selected for baseline metrics

Node/Windows process counters provide low-overhead CPU and RAM fallback metrics with no redistribution or account requirements. They do not provide enough temperature/power coverage to be the entire product.

### Libre Hardware Monitor — selected for hardware sensors

LibreHardwareMonitorLib 0.9.6 is pinned because it is a stable .NET package under MPL-2.0. A PackRat helper owns exactly one Computer instance and updates it at 1 Hz. The helper emits a sensor catalog and numeric samples over stdout JSONL.

Important boundary: some low-level sensors may require administrator access or an already-installed compatible PawnIO driver. PackRat does not install PawnIO. The plugin exposes unavailable sensors honestly and always retains Windows-native CPU/RAM metrics.

### PresentMon — selected for game FPS / frametime

PresentMon v2.5.1 is pinned under the MIT license. The build retrieves the exact official v2.5.1 x64 executable, verifies its pinned SHA-256, and records that identity beside the bundled binary. Runtime starts one private named PresentMon capture session and parses process + frame timing only.

Real-time ETW access can require membership in Windows **Performance Log Users** or administrator rights. A permission error is a first-class provider state shown by the Property Inspector and key fallback.

RTSS was evaluated as an optional installed integration. It is not required for 1.0 because PresentMon provides a legitimate independent presentation-timing path without forcing users to install another overlay/monitor. The provider boundary is intentionally isolated so an RTSS adapter can be added later without changing session/history semantics.

## Sampling and overhead budget

| Work | Cadence / bound |
| --- | --- |
| Windows CPU/RAM | 1 Hz |
| Libre Hardware Monitor update | 1 Hz |
| PresentMon raw frame input | event stream, immediately aggregated; presented cadence uses MsBetweenPresents |
| FPS statistic bucket | 100 ms |
| FPS key render | <= 4 Hz, visible keys only |
| Hardware key render | <= 1 Hz, visible keys only |
| Sensor raw history | 900 points (15 min at 1 Hz) |
| Sensor archive | 2,160 points (6 h at 10 s) |
| FPS recent history | 3,600 buckets (6 min at 10 Hz) |
| FPS session archive | 21,600 points (6 h at 1 Hz) |
| Persistence | <= once per 30 s steady state |

Raw per-frame PresentMon events are never written to disk. Average FPS is calculated as total accepted frames divided by total accepted frame time. The 1% and 0.1% low-average metrics use the slowest 1% / 0.1% of accepted frame times, average those frame times, then convert the result back to FPS. The bounded frame-time histogram preserves those statistics incrementally without retaining every raw frame. Graph downsampling keeps the worst point in each bucket so a spike is not averaged away.

Automated benchmarks guard the bounded data structures and render/aggregation path. A **real game A/B frametime run** remains mandatory before public release because synthetic CI cannot prove that ETW + GPU drivers + a real game have zero practical impact.

## Session selection

1. Prefer a frame-producing process that matches the current foreground executable.
2. Require a short stability window before changing the active session.
3. If foreground identity is unavailable, select a dominant frame-producing application over a rolling observation window.
4. Ignore PackRat, PresentMon, Stream Deck, Windows shell, and common desktop compositor processes.
5. Finalize after the active process stops producing frames for the configured idle timeout.
6. A stable different process finalizes the prior session and starts a new one.

The session summary is preserved separately from graph history so a long session can keep accurate aggregate statistics after old graph points have been downsampled.

## Pressure signal

The plugin may label stutter buckets as GPU PRESSURE, CPU PRESSURE, or MIXED / UNKNOWN using contemporaneous utilization and bad-frame buckets. It is deliberately described as a **pressure signal**, not proof of a hardware bottleneck. A Stream Deck key cannot establish causality from utilization alone.
