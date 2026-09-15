# Performance Grapher 1.4.2 QA

Published identity preserved:

* id: `com.packrat.perfgrapher`
* name: `Performance Grapher`
* author: `PackRat 🐀`
* previous candidate: `1.4.1`
* current candidate: `1.4.2`

## 1.4.1 baseline preserved

1.4.1 fixed XENEON background transparency after dashboard-page transitions, restored usable sensor-title width, hardened temperature-unit containment with FPS disabled, used the direct iCUE settings binding path, and preserved sensor readout/header sizing, font selection, HTTPS response-time display, and product-line accent polish.

1.4.2 intentionally does not redesign those surfaces. It is a narrow persistence correction for per-sensor display mode and custom scale.

## 1.4.2 persistence regression

Reported physical symptom on 1.4.1: previously configured sensor displays could return as `GRAPH`, with custom LOW/HIGH scales returning to `Auto`.

The 1.4.1 storage path could accept an empty/malformed active preference record as a successful restore. That left `sensorPrefs` empty, so the normal renderer correctly fell through to its built-in defaults: graph mode with automatic range. 1.4.1 also contained a sensor-signature fallback lookup that was not maintained as part of the documented iCUE UUID storage record.

1.4.2 hardens that path:

* persisted widget state remains under the exact `localStorage[uniqueId]` JSON object required by CORSAIR's Widget Builder storage contract;
* every preference save writes the active preference record and a second sensor-signature backup inside that same UUID JSON object;
* a saved record is considered valid only when it contains a non-empty `sensorPrefs` object;
* an empty or malformed active record no longer suppresses fallback recovery;
* an existing valid 1.4.1 v3 preference record is migrated to v4 and immediately seeds the UUID-scoped backup;
* graph/bar/radial/readout modes, custom LOW/HIGH values, FPS window, and FPS/ms hero choice are included in the durable payload;
* the backup keeps at most the newest twelve sensor-set signatures to avoid unbounded localStorage growth;
* older standalone/suffixed records remain readable as migration inputs, but new persistence does not depend on them.

## Automated regression

`widgets/_src/perf-grapher/preference-persistence-smoke.mjs` reproduces the failure class and verifies:

1. Save mixed non-default sensor modes and custom ranges.
2. Confirm the sensor-signature backup is stored inside `localStorage[uniqueId]`.
3. Recreate runtime state using the same CORSAIR widget UUID and confirm modes/ranges restore.
4. Replace the active preference record with `{}` and confirm the UUID-scoped backup restores instead of Graph + Auto.
5. Load a valid 1.4.1 v3 record, confirm migration seeds a v4 backup, corrupt the active record, and confirm the migrated modes/ranges still recover.

GitHub Actions run `33898595993` passed:

* persistence regression on Ubuntu;
* persistence regression on Windows;
* authored-source generation and generated-source freshness check;
* official `icuewidget-cli@0.4.47` validation;
* official `.icuewidget` packaging.

Exact package artifact: `performance-grapher-1.4.2-package` (`9946742308`).

## Required physical check

A real XENEON EDGE/iCUE session remains the final persistence check. Install the exact 1.4.2 package and:

1. Configure at least two sensors to different non-default modes, for example Bar + Radial or Readout.
2. Give both sensors explicit LOW/HIGH custom scales.
3. Switch to another XENEON dashboard page and return.
4. Reload/restart iCUE.
5. Confirm every chosen mode and LOW/HIGH value is unchanged rather than Graph + Auto.
6. Optionally change the selected sensor set away and back; matching sensors should retain their saved preferences.

If any configured mode or scale resets after the restart, capture whether the selected sensor itself also changed. That distinguishes a storage failure from iCUE returning a different sensor ID.

No physical-hardware persistence pass is claimed by the automated gate.
