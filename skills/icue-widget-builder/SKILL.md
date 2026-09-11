---
name: icue-widget-builder
description: Build, test, package, and validate CORSAIR iCUE widgets including XENEON Edge dashboard LCD products.
---

# iCUE Widget Builder

Read `platforms/icue-xeneon.md` and `docs/XENEON_TROUBLESHOOTING_PLAYBOOK.md` before implementation.

This canonical skill preserves the proven local workflow while the full vendor reference bundle is migrated into this repository.

## Product contract

Target the current iCUE Widget API and declare the correct supported device class. XENEON Edge uses the dashboard LCD class.

Keep authored source separate from final shipping output when the vendor package command archives the package folder wholesale.

The current factory pattern is authored source under `_src/<slug>` and a flattened shipping directory generated from that source.

Do not remove the inline flattening step merely because external scripts work in a normal browser. The real iCUE host has different local loading behavior.

Do not assume an `x-icue-property` is an own property of `window` or `globalThis`. iCUE controls are document-level JavaScript bindings. Shipping output must preserve direct binding compatibility through the canonical RatPack inline bridge.

## Build path

source -> inline build -> structural checks -> browser fixtures -> responsive checks -> functional checks -> deterministic captures -> art -> vendor validate -> vendor package -> exact package integrity/extraction -> lexical iCUE settings smoke -> Corsair Labs Windows runner smoke -> StreamSpell packaged verification -> release artifact.

Do not skip directly from a green browser fixture to release status. Browser success proves only the browser layer.

## Layout

Test every supported size and orientation used by the product. Treat text clipping, overflow, touch target issues, missing provider state, and blank layouts as failures.

The public platform currently cannot reliably restrict an imported dashboard LCD widget to one exact XENEON slot size or orientation. Treat that as a platform limitation, not a product bug.

Do not use an iCUE preview window as proof that physical XENEON typography is correctly sized. The preview and physical device can expose different viewport scaling behavior. For wide 696px-high XENEON slots, use one explicit device baseline variable and derive readable typography, icons and spacing from that baseline. Add a native-resolution 1688x696 and/or 2536x696 readability assertion for products whose information density changes materially with physical size.

If the preview needs a different compact treatment, isolate the physical-device override with a deliberate viewport/orientation gate rather than globally enlarging the preview layout.

## Settings and Custom Style

If the widget declares `x-icue-property` controls, test updates after initial load rather than only checking default rendering.

If a property group contains the XENEON Custom Style color controls, keep the canonical triplet together and in order: `textColor`, `accentColor`, `backgroundColor`. Extra product-specific color controls belong after that triplet.

Run `tools/xeneon/native-style-smoke.mjs` against the exact extracted official package. That smoke deliberately uses lexical bindings so a widget that only works with values placed on `window` fails before Marketplace review.

For products that have shown real-host callback delays, also run `tools/xeneon/native-style-autosync-smoke.mjs` or an equivalent no-callback regression. A user-visible color change should not depend on an eventually delivered callback if the live iCUE binding itself is already changing.

Also run the exact package through Corsair Labs `iCUE-widget-runner-windows` on Windows using `tools/xeneon/icue-runner-smoke.mjs`. Treat this runner as a compatibility host, not a substitute for real iCUE. Its current shim writes settings onto the widget window and is therefore more permissive than the real host for some binding failures.

Do not assume unusual controls are valid because the vendor CLI accepts them. In particular, `sensors-factory` defaults must follow the current CORSAIR metadata contract and use the documented sensor expression rather than inventing a runtime-shaped literal such as `[]`.

Keep the number of top-level property groups practical for the real iCUE settings viewport. If controls run off screen with no usable horizontal navigation, consolidate closely related behavior, layout and appearance controls instead of shipping unreachable settings.

## Providers

Use only the iCUE providers the product actually needs. Validate sensor, media, FPS, device action, link, or Stream Deck provider behavior with deterministic fixtures before real host testing.

Do not put secrets in client side widget source.

Imported widgets execute from a local `file://` origin. Do not require arbitrary third-party probe targets to grant CORS unless response contents truly must be read. For reachability or timing-only measurements, a deliberately tested opaque `no-cors` request can be appropriate. Keep the metric wording honest: browser HTTPS response timing is not ICMP ping, and failed browser probes are not literal IP packet-loss telemetry.

When response bytes are required, such as a throughput test, use a target that explicitly supports the required cross-origin read path and test that path separately from latency probes.

## Common tools

If the widget depends on CORSAIR common tools, vendor the required approved common resources into the product rather than assuming a machine global install path.

## Art

Marketing art must use real deterministic widget captures from the browser harness. Missing captures are a hard failure.

## Packaging

Run vendor validation before package creation. Prefer a clean Windows GitHub Actions runner once unattended installation of the iCUE Widget CLI is proven.

After packaging, validate the exact `.icuewidget` as a ZIP-compatible archive, test every member for corruption, and require root `index.html` and `manifest.json`. Downstream host tests must consume this exact package rather than rebuilding a separate copy.

If real iCUE reports `unsupported`, `corrupted`, or `missing required attribute`, reopen the exact package contract even when the vendor CLI is green. Compare metadata against the current control reference and add a regression for the specific control shape that escaped validation.

## Troubleshooting contract

When a failure appears, reproduce before patching and classify it before deciding where the fix belongs.

Prefer a shared-tooling fix when multiple widgets can suffer from the same lifecycle, settings, packaging, network or host-fidelity issue. A product-local workaround is appropriate only when the behavior is genuinely product-specific.

For any property-backed widget:
- keep one idempotent settings refresh path
- support both initialization and data-update lifecycle events where applicable
- preserve the canonical direct-binding bridge generated by `tools/xeneon/inline.py`
- test explicit callback updates and no-callback autosync
- never depend only on values being own properties of `window`

For any stateful widget:
- test reload and corrupt persistence
- version persisted data when schema changes are plausible
- avoid duplicate timers/listeners after refresh
- clear intervals/listeners at lifecycle teardown

For any network widget:
- test file-origin transport
- show deliberate loading/offline/error/empty states
- test reconnect and recovery
- never leave the display blank after a handled failure

For interaction and layout:
- test all eight compositions
- include long strings, Unicode and HTML-looking text
- verify touch targets in compact slots
- verify destructive-action confirmation
- assert zero overflow, runtime errors and console errors

Every confirmed real-iCUE or physical-device failure should become a regression test when technically possible.

## Final local boundary

Use local iCUE and the physical XENEON Edge only for final import, exact device rendering, touch behavior, host provider behavior, and physical inspection.

A product can still reach release candidate without physical hardware when all applicable automated host, package, settings, provider, and layout gates pass. Do not use lack of hardware as a reason to skip failures that can be reproduced automatically.

When real iCUE contradicts an emulator or runner, real iCUE wins. Convert that observation into an automated regression before considering the product recovered.
