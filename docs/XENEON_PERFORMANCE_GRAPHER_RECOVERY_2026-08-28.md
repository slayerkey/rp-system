# Performance Grapher recovery, 2026-08-28

The authoritative Performance Grapher 1.4.0 source was recovered from the user supplied `perf-grapher.zip` and compared with the user supplied `performance-grapher.icuewidget`. The authored HTML and packaged HTML matched before this recovery.

Published identity is preserved:

* id: `com.packrat.perfgrapher`
* author: `PackRat 🐀`
* name: `Performance Grapher`
* previous recovered version: `1.4.0`
* physical candidate: `1.4.1`

## Physical feedback retained

The recovered 1.4.0 source already contained the requested Sensor Readout Size slider, Performance Header Size slider, optional HTTPS response-time display, and unit-safe value markup. 1.4.1 hardens those paths instead of redesigning them.

## New transparency regression

The previous content panel token was almost transparent white and depended on the body being opaque. After a user changed Transparency and switched XENEON dashboard pages, the body became correctly transparent while the sensor panels then exposed the dashboard wallpaper through themselves.

1.4.1 separates those layers:

* the outer widget body owns user-selected transparency;
* content panels remain opaque surfaces derived from the selected background color;
* visibility and `pageshow` restoration reapply the current property value idempotently;
* Custom Style settings use the canonical static direct-binding reader instead of dynamic `Function` property lookup.

The Celsius top-right readout is additionally allowed to shrink its numeric portion while keeping the unit fixed inside the metric card.

## Automated evidence

Workflow: `XENEON Performance Grapher Recovery`

Successful run: `33226859130`

Candidate artifact: `performance-grapher-1.4.1-real-icue-candidate`

Artifact id: `9707175020`

The exact official package passed:

* authored JavaScript syntax checks;
* canonical `tools/xeneon/inline.py` generation and deterministic check;
* `icuewidget-cli@0.4.47 validate`;
* official CORSAIR package generation and ZIP/root-file integrity;
* lexical iCUE Custom Style regression;
* product-specific eight-composition regression;
* readout slider 75/100/180 checks;
* header slider 75/100/180 checks;
* graph, bar, and radial Celsius containment with FPS disabled;
* Ping numeric zero, unavailable, and recovery behavior;
* four repeated transparency page-return cycles in each of the eight official compositions;
* Corsair Labs exact-package host smoke.

The physical merge gate remains one real XENEON check: set nonzero transparency, switch dashboard pages repeatedly, and confirm cards remain dark/readable while only the outer widget background shows the requested transparency.
