# Neo Infobar 1.1 release verification

## Exact implementation

- Version 1.1.0.0, dedicated `com.packrat.performance-grapher.neo-infobar` action with `Controllers: ["Neo"]`.
- Elgato SDK 3.0.0, Stream Deck host 7.6+; plugin-wide minimum 7.6 is necessary for manifest-discovered Neo support.
- Separate 232 × 50 overview / single-metric feedback layouts; single/rotating views use the existing 60-second metric history.
- One shared TelemetryService for ordinary keys and Neo contexts. No second sensor helper, polling service, or FPS capture process.
- Manifest names, existing action UUIDs, package UUID, existing profiles, and source-of-truth IDs remain unchanged.

## Automated build gate (requires exact-head CI evidence)

1. GitHub Windows workflow `Performance Grapher Stream Deck`: all Node tests (including `neo-infobar.test.mjs`), source syntax, existing history/PresentMon/PI/profile regressions.
2. Shared PackRat design and major-profile key-face audits, native helper sample/probe, official Elgato CLI manifest + layout validation, official packaging.
3. Verify artifact manifest reports 1.1.0.0, software minimum 7.6, exactly one `Neo` action, unchanged original five Keypad UUIDs, and all four existing profile packages.
4. Archive exact commit, workflow run ID, package hash, deterministic Marketplace assets, and release notes. An older 1.0 package is *not* Neo evidence.

## Remaining actual Neo host smoke (distinct from CI)

Install the exact new .streamDeckPlugin on Windows with Stream Deck 7.6+ and a physical Stream Deck Neo. Drag **Performance Grapher → Neo Infobar** onto the Infobar (not a key).

1. System Overview: CPU/GPU/RAM percentages or honest missing-data `--` state appear in the 232 × 50 area with no clipped labels or overlapping values. Compare with one existing normal-key metric.
2. Single Metric: select supported GPU load (or CPU load without a compatible GPU); confirm live value, supported companion data, and visible 60-second trend after enough samples. Turn trend and labels off, then reopen the PI to check persisted settings.
3. Rotating Metrics: configure three supported metrics, set five-second rotation, and verify readable rotation without additional helper processes or duplicated FPS sessions.
4. Remove/swap the Infobar while ordinary performance keys remain visible; check no old Infobar feedback reappears and no runaway updates appear in plugin logs. Re-add the action to confirm settings and layout initialize correctly.
5. Verify the ordinary-key Property Inspector still saves a metric/accent change, an existing bundled profile opens, and the existing normal-key live graph continues to update.

**Release decision:** Do not label the exact 1.1 package green until the new exact-head automated pipeline passes. If a physical Neo is unavailable, mark its host readability/PI smoke explicitly **DEFERRED**, not PASSED; Marketplace upload should be treated as an accepted, disclosed release risk only if the operator consciously chooses to defer that smoke.
