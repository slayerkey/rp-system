# XENEON physical review Round 5 — 2026-08-29

## Physical feedback that triggered this round

### Network Dashboard

Real iCUE/XENEON confirmed live HTTPS host timing works. The remaining issues were presentation/lifecycle:

* Custom Header, Monitored Hosts Text Size, and Background Transparency only became visible after changing XENEON dashboard pages.
* Custom Header was initially implemented as a replacement for `LATENCY HISTORY`; the reviewer intended a product title at the top of the widget like Performance Grapher.
* Transparency made the metric/ribbon/host/throughput panels themselves see-through, hurting readability.
* Reviewer requested restrained accent-color corner treatment and consistent top-left accent wash across PackRat telemetry products.

### PC Power Meter Pro

Real iCUE still rejected the exact Round 4 package before installation with:

`Unsupported or corrupted file. Check the file and try again. Numeric attribute conversion error.`

No sensor/runtime testing was possible because import failed.

## Network Dashboard Round 5 response

* Keep the physically proven opaque HTTPS timing transport unchanged.
* Add a true `NETWORK DASHBOARD` top product header. `customHeader` edits that title only; `LATENCY HISTORY` stays attached to the ribbon.
* Reconcile document-level iCUE settings bindings every 140 ms only when their signature changes. This removes dependence on iCUE delivering `onDataUpdated` and prevents the page-change-only behavior.
* Feed those same direct bindings into the older core `getIcueProperty` path so monitoring settings and appearance settings share one host-compatible source of truth.
* Apply user transparency only to the outer widget canvas. Ribbon, host, throughput and other dashboard panels remain opaque/readable.
* Add restrained accent corners to panels and preserve the subtle upper-left accent wash.
* Keep host text sizing usable on the 840x344 composition.

The exact-package regression changes header, host size, transparency, text, accent, and background lexical settings without calling `icueEvents.onDataUpdated` and requires the visible widget to update while staying on the same page. It then simulates page return and requires the settings to remain stable.

## PC Power Meter Pro Round 5 importer bisection

The real iCUE error is specifically numeric conversion, so Round 5 removes the remaining Pro-only numeric control metadata from the import surface:

* `electricityRate` is now a textfield with default `0.15`.
* `highPowerThreshold` is now a textfield with default `0`.
* The runtime still parses both with `Number(...)`, so cost and threshold behavior are preserved.
* The exact package contains zero slider controls and zero `data-min`, `data-max`, or `data-step` attributes.
* The earlier `sensors-factory` control remains removed. Primary plus three optional comparison sensors use ordinary `sensors-combobox` controls.

This is intentionally an importer bisection. Real iCUE remains the authority on whether the numeric conversion error is now gone.

## Automated evidence

Workflow: `XENEON Real iCUE Round 4`

Successful run: `33269668942`

Package artifact: `xeneon-real-icue-round5-network-power`

Artifact id: `9719721289`

Both exact packages pass official CORSAIR validation/package generation, ZIP/root-file integrity, product-specific regressions, and Corsair Labs exact-package host smoke.

Network additionally passes the real-file-origin latency regression and no-callback live settings regression.

PC Power Pro additionally passes the zero-numeric-attribute importer contract, comparison behavior, no-callback Custom Style, and delayed Sensors plugin initialization.

## HWiNFO note

Do not add HWiNFO to this V1 recovery. A XENEON HTML widget cannot directly consume HWiNFO's Windows shared-memory/native SDK interface without a companion/native bridge. HWiNFO also has separate licensing/integration requirements. Treat HWiNFO as future companion-app R&D rather than mixing it into the current iCUE importer recovery.
