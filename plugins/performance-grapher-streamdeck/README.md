# Performance Grapher for Stream Deck

**Marketplace promise:** See what your PC did, not just what it's doing right now.

Performance Grapher for Stream Deck is a Windows-only PackRat Stream Deck plugin focused on history, context, and diagnosis rather than another instantaneous hardware readout.

## Actions

1. **Performance Graph** — one metric, current value, compact rolling history, threshold state, and press-to-cycle history windows.
2. **Game FPS** — current FPS or frametime, compact history, 1% low, optional 0.1% low, and process-aware session tracking.
3. **Session Summary** — press to cycle average FPS, 1% low, 0.1% low, worst frametime, peak GPU/CPU temperature, peak GPU load, session length, and a conservative pressure signal.
4. **Sensor / Metric** — configurable CPU/GPU/RAM/storage/general sensor action.
5. **Alert** — a selected metric becomes a high-visibility warning above or below a configured threshold.

No Stream Deck + dial action ships in 1.0 because changing a graph window is not enough value to justify a separate encoder action.

## Telemetry architecture

One TelemetryService instance is shared by every visible key.

- **Windows-native baseline:** Node's OS counters provide CPU utilization and RAM utilization without a helper, API key, account, or driver.
- **Hardware sensors:** a small PackRat .NET helper hosts LibreHardwareMonitorLib 0.9.6 at a 1 Hz update rate and streams a sensor catalog plus samples as JSON Lines.
- **FPS / frametime:** PresentMon 2.5.1 is downloaded from its official GitHub release during the deterministic build, bundled in the plugin, and run as one private named capture session. PackRat consumes only presentation timing/process identity and disables unrelated console stats.
- **Session engine:** frame events are aggregated into 100 ms FPS buckets. Percent-low calculations, worst raw frametime, hardware peaks, process changes, and completed-session summaries are maintained centrally.
- **Persistence:** versioned, bounded JSON under %LOCALAPPDATA%\PackRat\PerformanceGrapher. Corrupt state is quarantined instead of crashing startup.

Adding five keys does not create five PresentMon sessions or five Libre Hardware Monitor readers.

## Permission and hardware boundaries

PresentMon's real-time ETW path may require the current Windows user to be in **Performance Log Users** or to run with administrator rights. The plugin reports permission_required explicitly.

Libre Hardware Monitor can expose many GPU sensors without extra setup, but some lower-level motherboard/CPU sensors require elevated access or an already-installed compatible PawnIO path. This product never silently installs PawnIO or another kernel driver. Unsupported/missing sensors render an honest unavailable state.

## Performance budget

- Hardware sensors: 1 Hz.
- Windows CPU/RAM fallback: 1 Hz.
- Frame aggregation: 100 ms buckets; raw events are not persisted.
- FPS key rendering: maximum 4 image updates/second and only when visible.
- Hardware key rendering: maximum 1 image update/second.
- Sensor raw history: 15 minutes at 1 Hz.
- Sensor archive: 6 hours at 10-second resolution.
- FPS graph history: bounded recent samples plus 1-second session archive.
- Persistence: debounced, maximum once every 30 seconds during steady state.
- Target real-host budget before release: less than 1% normalized CPU average for PackRat-owned monitoring work and less than 150 MB combined private working set for plugin + sensor helper. The real-game frametime comparison is a hardware release gate, not a CI claim.

## Data-source licensing

See THIRD_PARTY_NOTICES.md and docs/TELEMETRY_ARCHITECTURE.md.

- Libre Hardware Monitor 0.9.6: Mozilla Public License 2.0.
- PresentMon 2.5.1: MIT License.
- Stream Deck SDK dependency: MIT-licensed @elgato/streamdeck.

No HWiNFO dependency is bundled or required.

## Development

    rat dev performance-grapher-streamdeck

After automated QA and the real hardware boundary are complete and the product is merged to canonical main as READY_TO_SHIP:

    rat ship performance-grapher-streamdeck
