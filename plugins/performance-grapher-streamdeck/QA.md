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

## Exact merged-head JavaScript core harness — 2026-09-13

The product branch was resynced with current `main` through PR #168 before this evidence was recorded. The incoming main commits changed canonical Rat Art / Marketplace standards and assets, not Performance Grapher runtime files.

Result: **43 / 43 behavior checks PASS**

Separate syntax gate: **26 / 26 JavaScript runtime, build, Property Inspector, license-inventory, and test files PASS**

Current merged-head coverage includes:

- frame-time based average FPS and 1% / 0.1% low-average statistics
- migration of the pre-release FPS-histogram persistence shape
- bounded history and archive merging
- process-aware session start, switch, idle finalization, and ignored compositor
- low-FPS fallback selection without foreground telemetry plus ambiguous-producer refusal
- final-bucket temperature/load/pressure context during reset and process switch
- separate 100 ms FPS average history and worst-raw-frametime history
- max-preserving frametime archive so one-frame stutters are not averaged out
- FPS + frametime history persistence across short plugin restarts
- stale interrupted-session finalization
- PresentMon quoted/unquoted CSV parsing, cached column indexes, and `MsBetweenPresents` priority
- PresentMon and hardware-helper stale-child ownership / launch-error recovery
- permission-required and idle-game key states
- 72 / 96 / 144 px SVG key generation
- session-window zero propagation
- NVIDIA / AMD / Intel canonical GPU sensor mapping
- no-GPU fallback and stale sensor expiry
- lazy history allocation so unselected LHM sensors do not allocate rolling arrays
- compact per-frame session metric snapshots instead of copying the full sensor map
- atomic persistence, corruption quarantine, and session-scoped hardware history
- awaitable graceful shutdown persistence
- Property Inspector DOM/control contract, command wiring, syntax, and delayed reveal

Merged-head synthetic V8 benchmark:

- **250,000 frame events:** approximately **706 ms**
- **5,000 144 px SVG renders:** approximately **248 ms**
- **250,000 PresentMon CSV rows:** approximately **198 ms**
- FPS recent raw history capped at **3,600**
- frametime recent raw history capped at **3,600**
- FPS and frametime 1-second archives each contained **2,499** points in the synthetic run

These are implementation-cost measurements, not real Windows/game overhead measurements.

### Marketplace Listing V2 art gate

The merged canonical Marketplace V2 standard is now applied to Performance Grapher Rat Art:

- deterministic key cluster remains the product proof
- no fabricated Stream Deck hardware chassis
- PackRat mark moved to the V2 top-center position
- hero key cluster enlarged for browsing-scale readability
- hero review sheet is generated separately at **480 × 240**, **320 × 160**, and **240 × 120**
- the QA review sheet is staged separately from customer-facing Marketplace art

The Python art render and visual review are still **pending** because the hosted Windows workflow has not executed.

### Remaining automation blocker

GitHub Actions continues to create jobs that fail before checkout with zero steps and no job-log blob, including unrelated workflows. A previous manual API retry reproduced the same pre-step failure. Until hosted jobs execute, the following remain unverified on the merged head:

- `npm ci` / actual Node test runner
- .NET 8 Windows publish
- resolved NuGet dependency/license inventory
- native Libre Hardware Monitor helper probe
- pinned PresentMon binary/hash bundle
- official Elgato validation
- official `.streamDeckPlugin` packaging
- deterministic Python Marketplace V2 media render
- generated thumbnail review sheet
- staged release-candidate artifact

Physical Windows/GPU/Stream Deck testing and enabled-vs-disabled real-game frametime comparison remain the final release boundary.


### Registry and plugin contracts

- **PASS:** all five `ACTIONS` UUIDs in `src/plugin.js` exactly match the five manifest action UUIDs.
- **PASS:** `PerformanceAction` assigns `manifestId` before each `registerAction()` call, matching the official SDK routing model.
- **PASS:** `products/index.json` now contains exactly one `performance-grapher-streamdeck` entry.
- **PASS:** that registry entry exactly matches the canonical product ID, name, type, status, price, and version.
- **FIXED:** a duplicate adjacent product-index entry discovered during merged-head audit was removed.
- **VERIFIED:** current Elgato manifest schema accepts `Nodejs.Version = 24`, `SDKVersion = 3`, `Software.MinimumVersion = 7.3`, and `SupportedInMultiActions`.

### Runtime dependency license gate

The build now generates two dependency inventories:

1. **npm runtime dependency graph**
   - starts from production dependencies only
   - recursively resolves the exact installed runtime tree
   - requires a declared license plus package-supplied LICENSE / NOTICE / COPYING evidence
   - copies package license evidence to `sdPlugin/licenses/npm/`
   - writes `NPM_LICENSE_INVENTORY.json` and `NPM_LICENSE_INVENTORY.md`
   - does not record absolute CI paths

2. **NuGet/.NET publish dependency graph**
   - generated from the exact restored `project.assets.json`
   - copies package-supplied license files when declared
   - writes `NUGET_LICENSE_INVENTORY.json` and `NUGET_LICENSE_INVENTORY.md`

Both inventories are release gates and are copied into the staged release candidate under `license-evidence/`.

The npm inventory script itself passes exact-source JavaScript syntax validation. Actual dependency resolution/copying remains **pending** until a hosted runner can execute `npm ci` and `npm run build`.


### Submission metadata contract

- **FIXED:** `submission.json` ended with literal characters `\\n` after the closing brace and was invalid JSON. The terminator was removed.
- **PASS:** the exact committed `submission.json` now parses successfully.
- **PASS:** submission slug, name, type, price, and version match the canonical product metadata.
- **PASS:** manifest name/version and the unique product-index entry match the same canonical product metadata.
- **PASS:** manifest UUID remains `com.packrat.performance-grapher` with exactly five actions.
- **PASS:** required customer disclosures remain present for PresentMon, Libre Hardware Monitor, Performance Log Users permission, hardware-dependent sensor availability, and the PackRat ecosystem close.
- A dedicated `metadata-contract.test.mjs` now guards these relationships.


### Latest hardening additions

- **PASS:** PresentMon permission-required state becomes quiescent instead of continuously relaunching a capture that Windows will deny. Manual restart remains available after permissions are fixed.
- **PASS:** hardware-helper restart delay grows from 5 seconds toward a 60-second ceiling and resets after valid catalog/sample recovery.
- **FIXED:** idle session timer no longer emits a 250 ms render/update heartbeat when no game/session state changed.
- **PASS:** canonical GPU load/temperature/power follow the active adapter on dual-GPU systems with utilization hysteresis to prevent idle iGPU/dGPU flapping.
- **PASS:** long executable names and secondary key labels are bounded for 72 / 96 / 144 px key rendering.
- **HARDENED:** the native LHM helper refreshes catalog metadata every 30 seconds rather than serializing the whole catalog every second.
- **HARDENED:** native LHM sensor object → stable ID bindings are cached between catalog refreshes instead of recalculating SHA-256 IDs every sample.
- **VERIFIED:** the exact LibreHardwareMonitor 0.9.6 SensorType enum is mapped to appropriate units.
- **VERIFIED:** all PresentMon launch flags exist in v2.5.1 and the chosen `--no_track_display --no_track_gpu --no_track_input` combination preserves `MsBetweenPresents`.
- **CORRECTED:** PresentMon's pinned v2.5.1 copyright notice is 2017–2024 Intel Corporation.
- **ADDED:** exact standalone PresentMon v2.5.1 MIT license is copied into the built plugin and required by the release workflow.
