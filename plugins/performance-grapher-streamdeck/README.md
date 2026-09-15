# Performance Grapher for Stream Deck

**Marketplace promise:** See what your PC did, not just what it's doing right now.

Performance Grapher for Stream Deck is a Windows-only PackRat Stream Deck plugin focused on history, context, and diagnosis rather than another instantaneous hardware readout.

## Actions

1. **Performance Graph** — one metric, current value, compact rolling history, threshold state, and press-to-cycle history windows.
2. **Game FPS** — current FPS or frametime, compact history, 1% low, optional 0.1% low, and process-aware session tracking.
3. **Session Summary** — press to cycle average FPS, 1% low, 0.1% low, worst frametime, peak GPU/CPU temperature, peak GPU load, session length, and a conservative pressure signal.
4. **Sensor / Metric** — configurable CPU/GPU/RAM/storage/general sensor action.
5. **Performance Alert** — a selected metric becomes a high-visibility warning above or below a configured threshold.

No Stream Deck + dial action ships in 1.0 because changing a graph window is not enough value to justify a separate encoder action.

## Included profiles

Four editable dashboards are generated deterministically and bundled with the plugin:

- MK.2 / other 15-key Stream Deck models: 15-key performance dashboard.
- Stream Deck XL: 32-key expanded history and alert dashboard.
- Stream Deck +: 8-key dashboard using the keypad only; no phantom encoder action.
- Stream Deck Neo: 8-key compact dashboard.

Profiles auto-install with the plugin but do not auto-switch. They use the same five plugin actions and supported settings that users can configure manually.

## Telemetry architecture

One TelemetryService instance is shared by every visible key.

- **Windows-native baseline:** Node's OS counters provide CPU utilization and RAM utilization without a helper, API key, account, or driver.
- **Hardware sensors:** a small PackRat .NET helper hosts LibreHardwareMonitorLib 0.9.6 at a 2 Hz update rate and streams a sensor catalog plus samples as JSON Lines. The Property Inspector presents a short Common list first; raw sensor internals stay behind Show advanced sensors.
- **FPS / frametime:** PresentMon 2.5.1 is downloaded from its official GitHub release during the deterministic build, bundled in the plugin, and run as one private named capture session. FPS uses `MsBetweenPresents`, the cadence between application `Present()` calls; it is not claimed as display-confirmed scan-out FPS. PackRat disables unrelated display/GPU/input tracking and console stats.
- **Session engine:** frame events are aggregated into 100 ms FPS buckets. Percent-low calculations, worst raw frametime, hardware peaks, process changes, and completed-session summaries are maintained centrally.
- **Persistence:** versioned, bounded JSON under %LOCALAPPDATA%\PackRat\PerformanceGrapher. Writes are committed through a temporary file, and corrupt state is quarantined instead of crashing startup.

Adding five keys does not create five PresentMon sessions or five Libre Hardware Monitor readers.

## Permission and hardware boundaries

PresentMon's real-time ETW path may require one Windows permission. When that happens, the Property Inspector offers **Enable Game FPS**: approve the normal UAC prompt, then sign out and back in once. The setup adds the current Windows user to the required local performance-logging group automatically, so customers do not have to edit Windows groups by hand.

Libre Hardware Monitor can expose many GPU sensors without extra setup, but some lower-level motherboard/CPU sensors require elevated access or an already-installed compatible PawnIO path. Performance Grapher does not install PawnIO or another driver for you. Unsupported/missing sensors render an honest unavailable state.

## Performance budget

- Hardware sensors: 2 Hz.
- Windows CPU/RAM fallback: 1 Hz.
- Frame aggregation: 100 ms graph buckets; raw events are not persisted. Average FPS and 1% / 0.1% lows are calculated from accepted raw frame times before graph aggregation.
- FPS key rendering: maximum 4 image updates/second and only when visible.
- Hardware key rendering: maximum 2 image updates/second.
- Sensor recent history: 900 raw samples plus a 10-second bounded archive for longer windows.
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
