# CORSAIR iCUE and XENEON Edge

The canonical skill is `skills/icue-widget-builder/SKILL.md`.

## Canonical PackRat identity

Every PackRat XENEON/iCUE widget manifest must use the exact author string `PackRat 🐀`.

Do not use `Packrat 🐀`, `Packrat`, or other capitalization variants for new widget manifests.

The reverse domain product namespace remains `com.packrat.<product>` unless an existing published identifier must be preserved.

## Product structure

Keep authored widget source outside the final package directory when package tooling archives the package folder wholesale.

The current factory uses `_src/<slug>` as authored source and an inline step to produce the shipping folder.

The canonical generator is `tools/xeneon/inline.py`. CI must regenerate the shipping `widgets/<slug>/index.html` from canonical source before official validation and packaging. Do not depend on a stale checked-in build artifact.

The inline step is not cosmetic. Current host behavior can fail on external script loading from local widget paths, so the shipping artifact is intentionally flattened.

## iCUE settings bindings

iCUE widget controls are document-level JavaScript bindings. Product code must not assume that a control is always represented as a normal own property on `window` or `globalThis`.

Generated shipping HTML uses the RatPack direct-binding bridge from `tools/xeneon/inline.py`. The bridge statically references every declared `x-icue-property`, exposes live compatibility getters only when a host binding exists, and avoids dynamic `Function` or eval based property discovery.

The lexical-binding regression in `tools/xeneon/native-style-smoke.mjs` is mandatory for widgets that declare the XENEON Custom Style triplet. A browser or compatibility runner that writes settings directly onto `window` is not sufficient evidence by itself.

Keep `textColor`, `accentColor`, and `backgroundColor` together and in that order inside a Custom Style property group. Product-specific colors such as a graph color belong after the native triplet.

For products that have shown callback latency in real iCUE, test live binding changes without manually invoking `icueEvents.onDataUpdated`. `tools/xeneon/native-style-autosync-smoke.mjs` is the canonical regression for that failure class.

Do not infer metadata validity from the runtime value shape of an iCUE control. For example, a `sensors-factory` runtime value may be an array while its `data-default` still must follow the current CORSAIR control contract and use the documented sensor expression. Real iCUE importer failures override a green CLI result and must become exact-package regressions.

Keep top-level settings groups within a practical real iCUE viewport. If a product's groups run off screen with no usable navigation, consolidate closely related controls rather than accepting unreachable settings.

### Lifecycle contract for settings-backed widgets

A widget that declares user-facing iCUE properties should have one idempotent refresh path that can safely run at startup and repeatedly after settings changes.

Register both `icueEvents.onICUEInitialized` and `icueEvents.onDataUpdated` where applicable, and route both into the same refresh path rather than maintaining separate behavior.

The canonical inliner injects `__ratpackIcueRead`, `__ratpackIcueBindingBridge`, `__ratpackIcueSyncGlobals`, and `__ratpackIcueBindingSync`. Do not replace or bypass these with product-local global polling.

Real iCUE has exposed cases where bindings update before or without the callback path a browser mock expects. For settings that must update live, test both the explicit callback path and the no-callback autosync path.

Do not initialize a second timer or event subscription every time settings refresh. Lifecycle handlers must be safe to call repeatedly.

## Physical device layout

The iCUE preview is useful but is not proof of physical XENEON readability. Preview and device viewport behavior can differ enough that fixed-pixel typography looks correct in iCUE while becoming undersized on a 1688x696 or 2536x696 physical layout.

Use one deliberate baseline variable for physical-device scaling and derive text, icon, touch target and spacing sizes from it. If a compact preview treatment should remain unchanged, gate the physical override by orientation and/or viewport height instead of globally scaling every surface.

For information-dense wide widgets, add an automated native-resolution readability check at 1688x696 and/or 2536x696. Minimum readable text and icon dimensions should be asserted from computed layout, not judged only from marketing captures.

## Local file origin and network transport

Imported iCUE widgets execute from a local `file://` origin. Arbitrary external endpoints cannot be assumed to grant CORS to that origin.

If a feature needs only reachability or request-to-response timing, do not require a readable CORS response. A tested opaque `no-cors` HTTPS request can provide browser request timing without exposing cross-origin contents. Label the result honestly as HTTPS response timing, not ICMP ping, and label failed attempts as probe loss rather than literal IP packet loss.

If response contents or transferred byte counts are required, such as for a throughput test, use an endpoint that explicitly supports the needed cross-origin read path and validate it separately.

Network-backed widgets must render explicit states instead of going blank. Use product-appropriate equivalents of `LOADING`, `NO CONNECTION`, `API OFFLINE`, `BAD RESPONSE`, `RATE LIMITED`, and `NO DATA`. Preserve the last known good value only when that is honest, and visually mark it stale.

Test timeouts, malformed responses, HTTP failures, offline/reconnect behavior, and recovery after the endpoint becomes healthy again.

## Typography safety

Text that lives inside a clipping or marquee viewport must reserve real glyph room, including descenders and overshoot. Do not use compressed line heights that visibly crop letters such as `g`, `y`, `p`, `q`, or `j`.

For large display titles inside `overflow: hidden`, use a descender-safe line height of at least `1.0` unless explicit tested padding provides equivalent ink clearance. Visual QA fixtures should include descender-heavy sample text so this class of defect is caught before Rat Art captures are generated.

Marketing art must inherit the real corrected widget render. Never patch clipped product typography in the marketplace image itself.

## Automated path

source -> inline build -> structural checks -> browser fixtures -> responsive checks -> functional checks -> deterministic shots -> art -> official iCUE CLI validate -> official iCUE CLI package -> exact package extraction -> lexical iCUE settings smoke -> Corsair Labs Windows runner smoke -> StreamSpell packaged preview -> artifact.

Every downstream package or host test must consume the exact official package or its exact extracted contents. Do not rebuild a cleaner copy between validation layers.

Use GitHub Actions as the normal clean execution environment for the vendor CLI, Corsair Labs runner smoke, and packaged preview.

## Verification tiers

1. Source and structure checks catch silent host failures such as XML head problems, translation drift, invalid settings metadata, and non self contained shipping files.
2. The RatPack browser harness renders all eight official XENEON Edge slot sizes with deterministic provider fixtures and checks overflow, typography, interaction, and runtime errors.
3. The official `icuewidget` CLI validates and packages the shipping directory. CI then opens the exact produced `.icuewidget`, checks ZIP integrity, and requires root `index.html` and `manifest.json` before any downstream host test.
4. The RatPack lexical-binding smoke verifies XENEON Custom Style updates using document-level bindings rather than `window` properties. This is the regression gate for the Marketplace failure class where settings appear in iCUE but do not affect the widget.
5. Corsair Labs `iCUE-widget-runner-windows` loads the exact extracted official package on a Windows GitHub runner and exercises the widget through its iCUE compatibility host. The canonical automation is `tools/xeneon/icue-runner-smoke.mjs`.
6. StreamSpell's `xeneon-edge-widget-builder` loads the produced `.icuewidget`, independently extracts it, validates its package structure, and renders the official XENEON viewport presets. The canonical automation is `tools/xeneon/streamspell.mjs`.
7. Real iCUE or physical hardware testing remains the highest confidence host/device smoke when available.

### Hardware-free troubleshooting order

When no physical XENEON Edge is available, do not stop at a browser preview and do not repeatedly block product work on unavailable hardware.

Use this order:

1. reproduce in authored source with deterministic fixtures
2. regenerate shipping HTML and verify the source/package are not stale
3. reproduce against the exact extracted official package
4. run lexical binding and autosync settings smokes when properties are involved
5. run Corsair Labs Windows runner for lifecycle, interaction and compatibility-host behavior
6. run StreamSpell for independent package and eight-preset layout verification
7. record the remaining real-iCUE or physical-device uncertainty explicitly

If an external tester later reports a physical or real-iCUE failure, capture the exact product version, package, slot/orientation, settings, iCUE version and reproducible steps. Treat that observation as authoritative, fix shared infrastructure first when appropriate, and add a regression for that failure class.

The Corsair Labs runner is experimental software, not the real iCUE runtime. Its current compatibility shim assigns property values onto the widget `window`, so it can be more permissive than real iCUE for settings binding behavior. Treat it as a valuable Windows host and interaction layer, but never let it replace the lexical-binding regression or a real iCUE smoke when one is available.

StreamSpell is an independent approximation, not a physical device. Its hosted preview runs in a sandboxed browser and does not emulate local iCUE providers. For provider based widgets, use deterministic RatPack fixtures for behavior and StreamSpell for package and layout verification.

The hosted StreamSpell flow uploads the package to a third party service. Only use it for packages that contain no secrets or confidential data.

## Art requirement

Widget marketing must use real deterministic widget captures. Missing captures are a hard failure.

Corsair runner and StreamSpell screenshots are verification evidence, not listing art. Marketplace artwork must continue to use the deterministic RatPack capture pipeline at native slot resolutions.

## Release boundary

A XENEON widget may reach release candidate without a physical XENEON Edge only when all applicable automated verification tiers pass and the feature does not depend on an untested external transport.

A product with user facing iCUE controls must not be marked Marketplace ready merely because browser fixtures or StreamSpell pass. Its exact package must pass the lexical settings gate and Corsair Labs runner gate as applicable.

If compatible hardware or a real iCUE host becomes available, run it as an additional smoke test rather than treating it as the place where ordinary code, layout, settings, or packaging bugs should first be discovered.

When physical iCUE behavior contradicts an emulator, runner, preview, or CLI, treat the physical observation as authoritative. Diagnose the mismatch, fix the product or tooling, and add an automated regression for that exact failure before release status is restored.


## Durable failure classes

Before adding a local workaround, classify the failure.

- lifecycle/init: startup races, callbacks, bindings, provider readiness
- persistence: corrupt or stale local storage, schema changes, reload behavior
- touch/interaction: hit targets, double actions, destructive actions, disabled states
- timers/cleanup: duplicate intervals, pagehide cleanup, resume/re-entry
- responsive layout: clipping, overflow, descenders, long strings, physical-scale readability
- network/API: file-origin CORS, timeout, rate limit, malformed response, reconnect
- settings: inaccessible groups, invalid metadata, lexical bindings, live update
- provider: loading, empty, unavailable and error states
- packaging: stale generated HTML, invalid root layout, unsupported control metadata
- host fidelity: browser mock passes but runner, real iCUE or hardware differs

For persistence, parse stored state defensively, version it when the schema can change, and test reload plus corrupt-data recovery.

For timers and subscriptions, keep a single owner, make initialization idempotent, and clean up on `pagehide` or equivalent lifecycle boundaries.

For user-provided text, test long values, Unicode and HTML-looking strings. Render text as text, not executable markup.

For touch controls, test the smallest layouts as real touch surfaces, not only as screenshots. Destructive actions should require a deliberate confirmation when accidental taps would be costly.

See `docs/XENEON_TROUBLESHOOTING_PLAYBOOK.md` for the full recovery procedure.
