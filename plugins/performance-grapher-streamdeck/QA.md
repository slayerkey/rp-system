# Performance Grapher for Stream Deck QA

## Automated gates

The release workflow must pass all of the following before the product can move to `READY_FOR_HARDWARE_QA`:

- locked npm dependency install
- Node unit and fixture tests
- bounded long-session stress test
- PresentMon CSV parser fixtures
- process change / game start / game stop session fixtures
- corrupt history restore fixture
- 72, 96, and 144 pixel renderer checks
- self-contained .NET 8 sensor helper publish
- sensor helper one-shot probe on a Windows runner with no assumption that a supported GPU exists
- checksum verification of official PresentMon 2.5.1 x64 binary
- official Elgato manifest validation
- official Elgato .streamDeckPlugin packaging
- deterministic Marketplace media generation
- package/art SHA-256 evidence

## Required real Windows / hardware boundary

Do not move this product to `READY_TO_SHIP` based only on GitHub Actions.

1. Run `rat dev performance-grapher-streamdeck` or install the exact validated package.
2. Verify desktop idle does not create a game session.
3. Start and stop at least one real game.
4. Verify process changes finalize the previous session.
5. Verify current FPS, 1% low, 0.1% low, worst frametime, session length and peak sensors.
6. Verify PresentMon permission-required UX using a non-authorized Windows account where practical.
7. Verify NVIDIA GPU.
8. Verify AMD GPU.
9. Verify Intel GPU where feasible.
10. Verify no-GPU / unsupported sensor path remains usable through Windows CPU/RAM metrics.
11. Verify a disappearing sensor becomes unavailable without crashing.
12. Run a multi-hour session and restart the Stream Deck plugin.
13. Corrupt the local persistence file and verify it is quarantined.
14. Put multiple graph/metric keys on Mini, MK.2, XL, and + surfaces and check readability.
15. Measure plugin + helper CPU and private working set.
16. Compare game frametime with the plugin disabled vs enabled. Any meaningful repeatable regression blocks release.

### Performance budget

- hardware sensor polling: 1 Hz
- FPS image refresh: <= 4 Hz per visible FPS-like key
- hardware image refresh: <= 1 Hz per visible hardware key
- one shared PresentMon process
- one shared Libre Hardware Monitor helper
- target PackRat-owned average CPU: < 1% normalized CPU on the release test PC
- target plugin + helper private working set: < 150 MB
- no meaningful repeatable 1% low or frametime regression in the real-game A/B run


## Current build evidence — 2026-09-12

### Core automated smoke: PASS ON EARLIER HEAD — CURRENT HEAD RERUN REQUIRED

The current committed history/session/PresentMon parser/renderer core was reconstructed in a clean local Node environment after the GitHub-hosted Windows runner stopped executing jobs.

Result: **10 / 10 PASS** on the earlier validated head.\n\nThe exact current branch head has changed since this smoke due to additional PresentMon cadence, whole-session history, atomic persistence, Property Inspector, Marketplace, and license-inventory hardening. A fresh `npm test` run is required before promotion.

Covered:

- bounded raw/archive history
- worst-point retention inside retained downsample buckets
- 1% and 0.1% lows from per-frame samples
- game session start and idle finalization
- stable process changes
- ignored compositor/helper processes
- worst frametime and hardware peak accounting
- PresentMon CSV including quoted process names and v2 timing headers
- 72, 96, and 144 pixel Stream Deck SVG rendering
- explicit PresentMon permission-required key state
- 250,000-frame synthetic long-session aggregation
- 5,000 repeated Stream Deck key renders

Synthetic benchmark on the local Linux / Node 22 validation container:

- 250,000 frame aggregation: approximately **240 ms**
- 5,000 SVG key renders: approximately **179 ms**
- observed heap delta: approximately **2 MB**
- recent FPS history remained capped at **3,600** points
- 1-second FPS archive contained **2,083** points for the synthetic run

These values prove the JavaScript aggregation/render paths are bounded and inexpensive in the test environment. They are **not** evidence of real-game Windows frametime overhead.

### Bugs found and fixed during the smoke

1. Missing telemetry could be converted from `null` to numeric `0` by the renderer. This hid the explicit PresentMon permission state. Missing values now remain missing so the key can show `PERM / CHECK SETUP`.
2. A continuation-only archive fixture expected a spike that had already been legitimately pruned by its tiny archive bound. The fixture now places the spike inside the retained archive window.
3. Libre Hardware Monitor 0.9.6 `Computer` was verified against the exact upstream API and is closed explicitly rather than treated as `IDisposable`.
4. PresentMon distribution is now deterministic: exact official **2.5.1 x64** binary URL plus pinned SHA-256 `9bec3083069f58f911e6a512f4806db51a27bd096103087bc1d05ef54c80a191`.

### GitHub Actions infrastructure state: runner did not execute

Latest dedicated workflow observed:

- workflow: `Performance Grapher Stream Deck`
- run: `34741285448`
- job: `103681296291`
- result: GitHub reported failure with **no runner steps**
- workflow logs were unavailable from the Actions blob endpoint

The same branch head also showed unrelated repository workflows failing with the same no-step pattern, including RatPack Lightweight CI, Rat Ship Marketplace Routing CI, Voice Deck Release QA, XENEON Lite Pro Link Rebuild, and Lite Pro Portfolio Audit.

Therefore the red Actions state is treated as a hosted-runner/account execution problem, **not** as a completed product validation failure.

### Still unverified

Until a Windows runner actually executes, do **not** claim these passed:

- locked `npm ci` on Windows
- self-contained .NET 8 Libre Hardware Monitor helper publish
- native helper probe
- real PresentMon executable help/probe
- official Elgato CLI validation
- official Elgato `.streamDeckPlugin` packaging
- deterministic Marketplace-art execution on Windows
- exact package SHA-256

The product therefore remains `BUILDING`, not `READY_FOR_HARDWARE_QA`.


## Hardening continuation — 2026-09-12

Additional deterministic review after the core smoke found and fixed:

- PresentMon FPS cadence now prefers `MsBetweenPresents`, matching PresentMon's presented-FPS semantics, instead of preferring the v2 CPU-oriented `FrameTime` column.
- Removed `--exclude_dropped` while using `--no_track_display`; the two options describe contradictory display-tracking assumptions.
- `windowMs = 0` now survives JavaScript fallback logic, so the Session history option is no longer silently converted back to 60 seconds.
- Hardware Session graphs now filter to the active game session or most recently completed game session rather than showing the full retained six-hour hardware archive under a misleading SESSION label.
- Persistence now writes a temporary state file and atomically renames it into place, with corrupt-state quarantine retained as a second recovery layer.
- The package build now includes Libre Hardware Monitor's exact MPL-2.0 license and upstream third-party notices.
- PresentMon documentation now matches the deterministic direct-binary download and pinned SHA-256 build.
- Marketplace description reduced from 2,000 to 1,352 characters to fit the current 1,500-character limit while preserving primary search terms early.
- Rat Art already enforces a 288×288 search icon and 1920×960 cover/gallery media.

### Latest hosted-runner evidence

Latest observed dedicated workflow:

- workflow: `Performance Grapher Stream Deck`
- run: `34741687462`
- job: `103682340114`
- conclusion: `failure`
- runner steps: **null / never started**

On the same commit, XENEON Lite Pro Link Rebuild, Voice Deck Release QA, RatPack Lightweight CI, Lite Pro Portfolio Audit, and Rat Ship Marketplace Routing CI also failed before useful execution. This remains an infrastructure-wide Actions blocker, not evidence that the Performance Grapher build or tests ran and failed.

### Additional distribution gate

LibreHardwareMonitorLib 0.9.6 has transitive managed dependencies. Before the package may move to `READY_FOR_HARDWARE_QA`, the successful Windows publish must generate and archive a dependency/license inventory from the resolved publish graph. The final release kit must preserve all required notices for every redistributed dependency, not only the top-level MPL and PresentMon MIT notices.


## Current-head release boundary

Latest attempted dedicated Windows validation after the hardening above:

- workflow run: `34742207090`
- job: `103683691891`
- conclusion: `failure`
- job steps: **null / never started**
- exact current-head automated suite: **RERUN REQUIRED**

The same commit again showed unrelated repository workflows failing at the hosted-runner boundary. Do not interpret this as a test, build, native-helper, Elgato CLI, package, or Rat Art failure because none of those steps executed.

Additional current-head release changes that require the fresh run:

- whole-session history now merges retained archive + raw points
- Session hardware graphs are bounded to active/last game timestamps
- PresentMon FPS uses `MsBetweenPresents`
- persistence uses temp-write + rename
- Property Inspector is hidden until filtered and links to official PresentMon setup help
- manifest sidebar category is `Performance Grapher`
- action name is `Performance Alert`
- Marketplace discovery categories are Gaming / Monitoring / Utilities
- listing description is 1,369 characters
- Rat Art no longer draws an approximate Stream Deck chassis
- Rat Art fails closed if the PackRat logo or deterministic font cannot be resolved
- Windows build now gates on a resolved NuGet dependency/license inventory

Promotion remains blocked at `BUILDING`.


## Exact current-head JavaScript core harness — 2026-09-13

Because GitHub-hosted jobs are still failing before checkout, the current committed JavaScript modules were fetched directly from the product branch and executed in isolated module factories inside the ChatGPT V8 tool runtime.

Result: **23 / 23 PASS**

Covered:

- bounded raw/archive history and whole-session archive merge
- game session start, idle finalization, process switching, and ignored compositor
- percent-low, worst-frametime, and peak accounting
- recent active-session restore without restoring a stale current FPS
- stale persisted-session finalization at the saved boundary
- PresentMon CSV parsing and live provider preference for `MsBetweenPresents`
- quoted CSV process names
- PresentMon replacement-child ownership during manual restart
- PresentMon launch-error state and recovery scheduling
- permission-required key rendering
- 72, 96, and 144 px SVG generation
- `windowMs = 0` Session propagation
- NVIDIA / AMD / Intel sensor alias mapping
- missing-GPU CPU/RAM fallback
- stale sensor expiry
- atomic state persistence + active-session history round trip
- corrupt state quarantine
- session-scoped hardware history
- hardware-helper replacement-child ownership
- hardware-helper launch-error state and recovery scheduling

Current-head synthetic V8 benchmark:

- **250,000 frame events:** approximately **493 ms**
- **5,000 144 px SVG renders:** approximately **250 ms**
- FPS recent raw history remained capped at **3,600** points
- FPS 1-second archive contained **2,499** points for the synthetic run

These timings are implementation-cost evidence only. They do not prove real Windows/game frametime overhead.

The exact-head JavaScript core is therefore no longer stale. The remaining automated release blocker is the environment-dependent Windows/npm/.NET/Elgato/Rat Art pipeline, which GitHub Actions still has not started.
