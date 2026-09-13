# Performance Grapher for Stream Deck — QA

Version: 1.0.0.0  
Release state: BUILDING until automated CI passes, then READY_FOR_HARDWARE_QA.  
Marketplace price: $9.99.

## Automated matrix

The product branch must pass all of the following before moving to hardware QA:

- Locked npm dependency install.
- Unit tests for bounded raw/archive history.
- Exact XENEON-style 1% and 0.1% low behavior.
- Incremental percent-low histogram memory bounds.
- PresentMon quoted CSV and timing-column parsing.
- Desktop idle / ignored system-process fixtures.
- Game process start, stop, and stable process change.
- No-GPU fallback.
- NVIDIA-, AMD-, and Intel-style sensor catalog aliasing.
- Unsupported/missing sensor state.
- Sensor disappearance / stale value expiry.
- Corrupt persisted history quarantine.
- Long-session history bounds.
- 72 px, 96 px, and 144 px native key rendering.
- Multiple action views sharing one telemetry service by architecture.
- Synthetic frame aggregation and SVG render benchmark.
- .NET 8 Libre Hardware Monitor helper publish.
- Native helper probe on Windows runner with no discrete GPU assumption.
- PresentMon release download/probe and pinned SHA-256 recording.
- Official Elgato Stream Deck CLI validation.
- Official .streamDeckPlugin packaging.
- Deterministic Rat Art output and media dimension checks.

## Performance budget

Automated tests enforce bounded allocations and a generous CI regression ceiling for the hot aggregation/render code. Windows CI additionally samples the standalone hardware helper.

The public-release target is stricter than the CI ceiling:

- hardware sampling: 1 Hz;
- FPS aggregation: 100 ms;
- visible FPS key render: <= 4 Hz;
- visible hardware key render: <= 1 Hz;
- raw frame events: never persisted;
- bounded local history only;
- target PackRat-owned monitoring CPU: < 1% normalized average on a real gaming host;
- target plugin + sensor helper private working set: < 150 MB;
- no measurable practical regression to game frametime distribution in an A/B real-game run.

## Mandatory physical / real-host boundary

Do **not** mark READY_TO_SHIP based on CI alone.

Required before release:

1. Windows desktop idle for at least 15 minutes.
2. Start and stop at least one DX11/DX12 game; verify session begin/end and saved summary.
3. Change from one frame-producing process to another; verify clean session rollover.
4. PresentMon with a normal user in Performance Log Users.
5. PresentMon permission failure; verify Property Inspector says permission required and no stale FPS is shown.
6. NVIDIA GPU sensor coverage.
7. AMD GPU sensor coverage where available.
8. Intel GPU sensor coverage where available.
9. Advanced sensor missing / disappearing while plugin remains running.
10. Long game session and Stream Deck software restart.
11. Physical Stream Deck Mini, MK.2, XL, and + key readability/reconnect. No dial action is expected.
12. A/B frametime run with plugin disabled vs enabled using the same game/scenario. Compare average FPS, 1% low, 0.1% low, and frametime tail. Investigate any repeatable regression before release.

## Honest limitations

- CI cannot prove real GPU-driver sensor coverage.
- CI cannot prove real-game ETW overhead.
- Some Libre Hardware Monitor sensors may require elevated access or an already-installed compatible PawnIO path.
- Performance Grapher does not install PawnIO.
- PresentMon real-time ETW may require Performance Log Users membership or administrator rights.
- The pressure label is a diagnostic signal, not proof of causality.
