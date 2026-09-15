# Stream Deck Troubleshooting Playbook

This is the shared PackRat symptom → diagnosis → fix index for recurring Stream Deck failures.

It does **not** replace the canonical standards. Visual values and approved UI structure live in:

- `standards/streamdeck-plugin-design-system-v1.md`
- `standards/streamdeck-key-visuals-v1.md`

Rat Dev behavior lives in `docs/RAT-DEV-RELIABILITY.md`.

Product work should fix the product first. If the defect is repeatable, add the smallest useful shared regression/check afterward.

## 1. Rat Dev does not activate the new build

### Symptom

The source changed, but Stream Deck still shows the previous build.

### First check

Read the stage that failed before activation. Rat Dev intentionally leaves the existing validated link untouched if build, tests, QA, or Elgato validation fails.

### Common causes

- a regression test still expects the previous intentional visual token
- source ownership/branch resolution is ambiguous
- required native dependency is missing from the editable source
- the official Elgato validator rejected the candidate
- Windows still owns a native helper file lock
- the linked Stream Deck Node process still references/uses the old `.sdPlugin` directory even though `node.exe` itself lives outside that directory

### Fix

Do not bypass the failing stage just to see the UI. Correct the source/test/registration, rerun Rat Dev, and let activation happen only after the candidate is green.

## 2. Rat Dev finds the product on multiple branches

### Cause

The same slug exists on multiple unrelated product branches and there is no single authoritative registration.

### Fix

Establish one owner:

1. explicit external registration on `origin/main` for external/private source, or
2. exact `product/<slug>` branch for internal source, or
3. canonical product metadata for a shared Lite/Pro family.

Do not solve ambiguity by copying the product to another branch.

## 3. Property Inspector button does nothing / settings reset / live state is stale

### First checks

Run:

`node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root>`

Then inspect the actual per-action Property Inspector path declared in the manifest.

### Canonical transport

- PI websocket UUID is the message envelope context
- selected action instance is passed separately in payload as `actionContext`
- settings use the PI UUID context
- plugin commands and plugin-owned state use the global `streamDeck.ui` channel by default
- responses use `streamDeck.ui.sendToPropertyInspector(...)`; do not mix a global request path with per-action response helpers

### All PI buttons are dead and profile/configuration changes do not persist

Treat this as one shared Property Inspector transport failure before debugging each button or the product's profile/library model separately.

A particularly strong signature is:

- the PI HTML/CSS renders normally
- Refresh/Capture/Save/Delete all appear clickable but nothing changes
- an action-level profile/device selector does not persist
- the native/helper audit is healthy
- the plugin can still be linked and validated successfully

The first code review should compare the inspector against a **known-good current PackRat PI**, not against conversation memory.

For PackRat's manual WebSocket inspectors, keep these identifiers distinct:

- `uiUuid`: the UUID supplied directly to `connectElgatoStreamDeckSocket(...)`; use this for the PI WebSocket command envelope
- `actionContext`: `actionInfo.context`; carry this separately in the payload when the plugin must resolve the exact visible key/dial

Do not silently replace `uiUuid` with `actionInfo.context` just because both values look like opaque IDs. That mistake can leave the page rendered while the shared command path is effectively dead.

If the plugin supports both per-action `onSendToPlugin` and global `streamDeck.ui.onSendToPlugin` for compatibility, add a correlated `requestId` and de-duplicate requests before executing mutations. Otherwise one click can create/save/delete twice when both SDK surfaces deliver the same command.

A stateful PI should also write at least one normal startup/info log and log PI command receipt/failure. A healthy native helper with **no plugin log at all** is incomplete evidence; after opening the PI and pressing Refresh once, the audit should be able to distinguish "plugin never launched / PI never reached it" from "profile logic failed."

For profile-backed actions, validate the complete chain as one smoke:

1. PI opens and receives live plugin-owned state.
2. Refresh returns visible acknowledgement.
3. Capture/Create produces exactly one profile/item.
4. Save persists edits.
5. selecting that profile/item in the action-level selector persists across close/reopen.
6. pressing the hardware key uses the persisted immutable profile/item ID.
7. Delete removes only the intended profile/item.
8. no command executes twice.

If steps 2-5 all fail together, fix the PI bridge first. Do not rewrite profile storage, native routing, or hardware code until the shared transport is proven.

### The "half-working PI" signature

Treat this combination as a transport bug until disproven:

- ordinary settings such as speed/dropdowns persist after leaving and reopening the PI
- plugin-owned data such as a library, timeline, device list, live status, or diagnostics stays blank
- Refresh/Rename/Duplicate buttons appear to do nothing
- the hardware action itself still works

This means the Stream Deck settings path is healthy, but the PI → plugin → PI state channel is not. Do **not** debug storage first just because the library UI is empty.

Verify these hops in order:

1. PI websocket is open.
2. `sendToPlugin` uses `context: uiUuid`.
3. selected key/action ID is carried separately as `payload.actionContext`.
4. plugin receives the request through `streamDeck.ui.onSendToPlugin`.
5. plugin resolves `actionContext` to the visible action instance.
6. plugin returns state through `streamDeck.ui.sendToPropertyInspector`.
7. PI receives and renders the returned state.

### Deep diagnostic pattern

For stateful plugins with a library/editor, add a temporary or collapsible **Deep troubleshooting** action before asking the user for repeated manual guesses. It should be non-destructive and report:

- PI websocket/transport mode
- requested action context and resolved visible action
- persisted Stream Deck settings read-back
- in-memory library count/IDs
- library file path, existence, readability and parseability
- disk IDs/count versus memory IDs/count
- a temporary write → read → delete probe in the library directory
- selected `macroId`/item ID resolution
- current recording/playback/live runtime state
- a copyable text report
- a timeout report when the plugin does not answer at all

A diagnostic that can itself fail silently is not a diagnostic.

### Stale-state / save-race variant

If the plugin successfully changes state but the PI still renders the old selection, do not treat every incoming message as safe to render verbatim. A PI can receive a stale startup/state response while a newer local edit is still waiting for `setSettings` acknowledgement.

Use this race-hardening pattern:

- keep pending local setting edits in a `pendingPatch` (or equivalent) until the backend echoes the same values
- reconcile **every** incoming settings-bearing message against that pending patch before render; this includes normal `didReceiveSettings` responses **and** plugin `sendToPropertyInspector` state payloads
- render from immutable item IDs, not display labels, counts, or array positions
- use the plugin's authoritative state response as a valid save acknowledgement when it contains the persisted settings; `Saving…` must reliably become `Saved`
- flush pending settings before sending a command that depends on them
- flush the debounce on `pagehide` / `beforeunload` so a fast click-away cannot lose the last edit
- keep mutable text used by command buttons (rename/name/path/etc.) in a local draft; do not let a background render overwrite that draft while it is dirty
- after a successful create/rename/capture/etc., clear the draft-dirty state only when the authoritative result returns
- disable rename/delete/duplicate-style commands when the selected ID is no longer valid
- use a short command watchdog so `Saving…`, `Renaming…`, `Capturing…`, etc. cannot remain stuck forever if no backend response arrives

For selectors whose items can share a human name, preserve stable IDs and disambiguate labels for the user (for example with an ordinal, type, or count). Do not auto-delete ambiguous old data just to make the dropdown look cleaner.

### Required regression sequence for stateful Property Inspectors

Before hardware QA, cover this sequence in deterministic tests where practical:

1. change a selector or numeric setting
2. inject/receive a stale state response before the setting acknowledgement
3. confirm the local selection/value does not jump backward
4. confirm an authoritative response containing the new value clears `Saving…`
5. type a rename/name draft, trigger a render/focus transition, then press the command
6. confirm the exact typed draft reaches the backend
7. switch to another key/action and back; confirm the saved value and selected immutable ID persist
8. if duplicate display names exist, confirm each row remains independently selectable by ID

### Feedback rule

Refresh/import/export/rename/duplicate actions must provide visible acknowledgement. A successful backend operation with no PI feedback is still a UX defect. Prefer short deterministic confirmations such as:

- `Refreshed · 17 macros`
- `Renamed`
- `Duplicated`
- `Exported · <path>`

For exports inside the Stream Deck WebView, prefer a plugin-side deterministic file write with the saved path returned to the PI over relying only on browser-download behavior.

### PI HTML loads but the plugin process never answers

Treat this signature differently from a normal PI settings bug:

- Property Inspector HTML/CSS renders
- static manifest/fallback art renders
- `sendToPlugin` requests time out
- runtime-rendered key faces never appear
- a direct native host audit may still succeed

Before rewriting PI context handling again, verify **plugin process launch**.

For Node plugins:

- inspect the manifest `Nodejs` block
- omit `Nodejs.Debug` unless it contains intentional, valid Node command-line arguments
- never use strings such as `"Debug": "disabled"` as a boolean/off switch; developer-mode launch can pass that value into Node and prevent the plugin from starting correctly
- compare the manifest/runtime contract against a known-good current PackRat Node plugin using the same SDK generation

Instrument these lifecycle points when launch is uncertain:

1. module loaded
2. `streamDeck.connect()` resolved/rejected
3. runtime start entered/completed
4. uncaught exception / process exit
5. PI command received
6. bridge refresh entered/completed
7. PI response attempted/completed

A PI timeout is not proof that PI websocket routing is wrong; the plugin process may never have reached the handler.

### Native host probe works but Stream Deck still fails

A successful direct/native host audit proves the native boundary only. It does **not** prove:

- the Stream Deck Node process launched
- the built/linked `plugin.js` is the expected candidate
- PI → plugin delivery works
- plugin → native bridge invocation works inside Stream Deck
- plugin → PI response delivery works
- PI rendering completed without JavaScript exceptions

Trace the chain explicitly:

**PI opens → websocket registers → command leaves PI → plugin handler fires → runtime refreshes → native bridge returns → plugin emits PI payload → PI receives payload → PI renders.**

Use correlated request IDs where practical. Log device count, bridge error, refresh duration, response send, response receive, and render exceptions.

When a product has a native helper, a one-shot deep probe should also verify:

- linked plugin path
- linked `plugin.js` hash versus the Rat Dev build
- running plugin/helper processes
- direct native snapshot
- recent plugin/Stream Deck logs
- Property Inspector debugger availability

Do not send the user through repeated reinstall loops when one copyable probe can identify the failing hop.

## 4. PackRat logo is missing, becomes a square, or renders inconsistently

### Cause

CSS mask/data-URI/WebView rendering is being used for the logo.

### Fix

Bundle the canonical transparent PackRat PNG locally inside the plugin and render it as a normal `<img>`.

Do not use:

- CSS masks
- generated replacement logos
- emoji substitutes
- data-URI logo workarounds when a local asset is available

## 5. PackRat header is inside a card

The PackRat brand/header is global PI chrome, not product-card content.

For normal Pro/full products, keep the PackRat brand outside the first product card.

For Lite products with a direct Pro counterpart, use the canonical two-surface conversion pattern:

- top bar outside all product cards: PackRat left, `Upgrade to Pro ↗` right
- bottom standalone Pro feature card after all normal Lite/setup content

Run the design audit with:

`--require-canonical-pi --require-lite-pro-upsell`

## 6. Neutral buttons look brown/gold

Normal utility controls are charcoal. PackRat orange is used for:

- primary CTA fill
- focus/hover border and glow
- brand links
- highlighted labels

Do not use muddy brown/gold as the base material for normal buttons/cards.

## 7. Static icon looks correct but the hardware key is wrong

### Likely causes

- runtime renderer still uses old colors/layout
- Stream Deck host title is overlaying the art
- extensionless manifest path resolves to an older competing PNG/SVG
- profile generation reintroduced titles
- the runtime value/label is longer than the fallback fixture

### Fix

Run:

`node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>`

Then review representative runtime-rendered states at 72×72 and 36×36.

A manifest path such as `imgs/actions/foo/key` must resolve to exactly one canonical asset.

For bundled/generated profiles, disabling host titles requires both sides of the contract:

- every Keypad state uses `ShowTitle: false`
- generated state `Title` is empty when PackRat owns the entire key face

Do not assume the plugin manifest's `ShowTitle: false` protects a profile generated with `ShowTitle: true` or a non-empty host title. That mismatch produces clipped/duplicated text over otherwise-correct runtime art.

## 8. Key text is too small, clips, or crosses the box/icon

Use one central renderer for glyph + label/value geometry.

- reserve an explicit text band
- fit against the longest real label/state
- use the largest readable size that fits the safe region
- use at most two intentional lines for normal utility keys
- shorten copy before shrinking into micro-text
- use compact labels such as `1440P` instead of raw verbose resolution strings
- never rely on host title placement

If empty space exists, use it to make the useful information larger.

## 9. Action-list/sidebar icons look colorful or inconsistent

Action-list/category icons and hardware key faces are separate surfaces.

- action-list/sidebar icons: monochrome white when required by Elgato presentation
- hardware key faces: canonical dark + white + PackRat orange system

Do not reuse a colorful hardware key face as the action-list icon.

## 10. Graph/history key looks empty or useless

Keep analytical history separate from the short hardware visual window.

For live key graphs, normally show the most recent 10–30 seconds so the graph fills the key and spikes remain visible.

For Marketplace/Rat Art, if graph/history is a primary reason to buy the product, use a deterministic truthful representative populated state. Do not sell a graph product using an empty graph.

## 11. Rat Art text technically fits but is unreadable

All marketplace prose uses explicit bounding boxes and `draw_fitted_text(...)`.

Review actual renders at:

- 480×240
- 320×160
- 240×120

If text becomes decorative noise, crosses a divider/card, or requires squinting, reduce copy and use the available space to make the remaining text larger.

Do not “solve” overflow by allowing text outside the box.

## 12. Rat Art looks generic / random / does not show the product

Replace decorative filler with actual product proof:

- real shipping key faces
- representative runtime-rendered states
- real Property Inspector controls
- real profiles
- real graphs/states
- the actual workflow being sold

The cover earns the click. Gallery frames should prove core outcome, strongest differentiator, concrete workflow, and high-frequency interaction/upgrade story.

## 13. Cover/gallery media duplicates or fights Rat Ship

For normal in-repository Stream Deck plugins:

- product-local Rat Art generates search icon + gallery
- Rat Ship owns and overwrites only the canonical Stream Deck cover/hero
- product-local art must not overwrite the global hero afterward
- cover and gallery files must remain distinct

## Device-reported battery/status looks stuck or implausibly stable

Do not "correct" device telemetry by inventing values.

For battery/status products:

- distinguish **fresh observation** from **changed value**
- record or expose telemetry source when practical (`windows-aep`, direct HID feature report, vendor API, etc.)
- record an observation timestamp/freshness indicator when stale-vs-live is ambiguous
- if the device returns the same value repeatedly from fresh reads, show that value truthfully
- do not smooth, decrement, interpolate, or estimate a different battery percentage unless the product explicitly owns an estimation model and labels it as estimated
- clear battery value **and** freshness/source metadata when the device disappears or the telemetry capability is no longer present

For vendor HID devices, verify transport changes independently. A receiver plugged into the PC is not the same as the device being physically wired/charging.

Useful physical proof:

1. sample the bridge several times with timestamps
2. confirm each sample is a new hardware request
3. compare receiver/wireless mode with direct wired mode
4. verify charging state changes only when the device itself reports charging
5. if receiver mode remains at one percentage but wired mode immediately reports a different live value, preserve the device-reported values rather than fabricating a correction

A good host audit prints repeated samples with transport, kind, battery, charging, source, and observation time.

## 14. Lite → Pro upsell is missing, buried, or misleading

For a Lite/free product with a direct Pro counterpart:

- top: compact direct `Upgrade to Pro ↗`
- bottom: explanatory Pro feature card with 2–3 real Pro-only benefits and `Open <Product> Pro ↗`
- both links use the exact public direct Pro Marketplace `/product/` URL
- do not guess the URL
- do not use maker/search routes as the conversion destination
- if Pro is not public yet, keep the Lite rollout blocked

Do not add fake locked features to manufacture an upsell.

## 15. A rollback/product split risks losing useful work

Before changing the shipping product boundary:

1. freeze the current exact working state on a dedicated branch/tag/commit
2. make the rollback/split on the shipping branch
3. reuse preserved engineering from the frozen source in the new product where appropriate

Do not make a later chat reconstruct valuable work from conversation history.

## 16. QA was green before the product scope changed

Old evidence is no longer final release evidence.

A feature rollback, product split, major settings migration, or added/removed app-launch/profile/workspace behavior requires fresh:

- deterministic tests
- native smoke
- vendor validation/package
- relevant Rat Art
- exact package hash/size
- final hardware/host gate

Pin evidence to the exact source commit under review.

## 17. Private GitHub Actions is red before tests really start

Differentiate infrastructure failure from product failure.

A job that fails before meaningful checkout/test steps because private-runner allocation is unavailable is not code evidence.

For paid/private source, use the established public control-plane → private read-only checkout QA bridge when configured:

- pin the exact private SHA
- use read-only credentials
- never publish paid source/package artifacts publicly
- record Windows/macOS job evidence from the bridge

## 18. Profile keeps duplicating, looks stale, or Rat Dev says "unchanged" incorrectly

Rat Dev must not rely on the exported bundle SHA alone.

The canonical profile sync contract is:

- locate installed profiles by bundled profile **Name**
- enumerate **all** same-name installed copies, not only the first folder returned
- compare installed profile manifests/pages/actions/settings/states semantically against the current bundle
- ignore host-owned fields when comparing, including the physical Stream Deck `Device` binding, host `AppIdentifier`, and current page selection
- if every installed copy matches, skip refresh
- if any copy differs, treat it as installed-profile drift even when the bundle fingerprint is unchanged
- if the bundle changed, the installed profile is untracked, profile-state metadata was upgraded, or installed content drifted, refresh in place instead of importing another duplicate
- preserve the installed `.sdProfile` path and Stream Deck device binding
- back up the old installed profile before replacement
- stop Stream Deck once, stage/validate the new profile, swap transactionally, verify pages/action UUIDs, then restart
- rollback automatically if post-swap verification fails
- if multiple same-name copies already exist from older workflows, refresh all of them together so the user cannot remain on a stale duplicate

Do **not** tell the user to repeatedly delete/import profiles when Rat Dev can prove the identity and replace safely.

### "Bundle unchanged" but the visible profile is old

This usually means one of:

- Rat Dev compared only its stored bundle fingerprint
- the installed profile was modified/drifted after the last Rat Dev run
- an older duplicate with the same profile Name is the one currently active

The fix is semantic installed-profile comparison plus same-name duplicate enumeration, not another blind import.

### Generated-profile ActionID collision variant

If actions from the generated profile behave strangely but manually dragged actions work, inspect the generated **ActionIDs** before debugging the plugin runtime.

Every action instance in every bundled device profile must have a unique ActionID. Reusing the same generated ActionID across MK.2/Mini/XL/Plus/Neo can make profile-installed actions collide in runtime maps while drag-and-drop actions appear healthy because Stream Deck gives them fresh IDs.

The profile builder should fail closed when:

- a required action is missing
- a profile contains unexpected extra actions
- an ActionID is missing
- any ActionID is duplicated across bundled device variants

Expose generated ActionIDs in profile audit output/maps so this can be verified deterministically.

## 19. Rat Ship says the product is not registered on canonical main

Do not merge a long-lived/diverged product branch into `main` just to satisfy registration.

Canonical `main` is the release control plane. For a product developed on a separate branch, register the minimal canonical release metadata on `main` and pin shipping to the **exact green artifact**:

- `products/<slug>.json`
- `products/_submission/<slug>.json`
- `products/index.json` entry
- exact source commit
- exact QA run/artifact
- exact package path and SHA-256
- truthful workflow state

If the product branch is hundreds of commits ahead/behind main, that is a strong signal to use canonical metadata + immutable release artifact routing rather than a wholesale merge.

A registration fix must not silently bypass release blockers. Keep `workflow_state: TESTING` until the user explicitly accepts/promotes the remaining gate, then move to `READY_TO_SHIP`.

### Release-note formatting trap

Marketplace release notes are real newline-separated bullets. Do not serialize literal backslash-n text into one giant line. Contract tests should parse the submitted JSON value and verify the rendered release-note lines.

## 20. Global rules start changing while fixing one product

Stop.

Normal product tasks treat global standards as read-only. Fix the product against the standard.

Only edit a global standard when the user is explicitly asking for a reusable system change, and only promote lessons that genuinely recur across products.

## 20. Canonical Rat Ship cover uses generic text keys instead of the real product visuals

### Symptom

The warm-studio/photo hero is present, so the cover looks globally "correct," but the Stream Deck itself contains generic text tiles such as action names instead of the product's real icons or runtime key states.

### Why this happens

The global hero compositor and the product key source are separate layers. A correct photographed device plate does **not** prove the key faces are correct.

Common causes:

- product Rat Art did not emit exact runtime key faces
- the plugin paints keys dynamically at runtime but Rat Ship only saw static manifest metadata
- the action art is SVG and the hero pipeline only considered raster assets
- the renderer silently fell back to action-name text when it could not resolve usable art
- the final Maker Console cover was never inspected; only the product-local gallery or an intermediate render was reviewed

### Canonical key-source order

For Stream Deck heroes, resolve key faces in this order:

1. exact product-authored `rat-art-keys/` PNGs when available
2. `rat-art-key-fixtures.json` for truthful representative runtime states plus the plugin's real icons
3. the plugin's real action/state assets, including deterministic SVG rasterization
4. **never** a silent text-only placeholder

If no real visual source can be resolved, Rat Art should fail closed.

### Fix

- inspect the exact final `02_cover.png` from the Rat Ship ship-kit artifact
- if runtime keys differ materially from static manifest art, add exact `rat-art-keys/` or representative `rat-art-key-fixtures.json`
- preserve the real product glyphs; do not replace them with generated lettermarks or generic action-name cards
- keep representative state values truthful to the shipping product
- rerun the final canonical ship-kit render and visually inspect that artifact before Maker Console upload

Do not use the user as the rendering QA loop by asking them to repeatedly run `rat ship` just to discover deterministic art defects that CI can expose.

## 21. Every SVG action in the hero shows the same icon

### Symptom

The hero successfully contains icons instead of text placeholders, but multiple unrelated actions all show the same glyph.

### Cause

Many Stream Deck products store each action visual under a path ending in the same basename such as `icon.svg`.

A raster cache keyed only by filename will collide:

- brightness/icon.svg
- contrast/icon.svg
- input/icon.svg
- hdr/icon.svg

If all become a cached `icon_svg.png`, the first rendered glyph is reused for every later action.

### Canonical fix

Cache rasterized SVG assets by **content identity**, not basename.

The shared Stream Deck hero renderer uses a content hash in the cache key. Preserve that behavior.

Never key shared art caches using only:

- filename
- stem
- extensionless asset name

The regression is subtle because the render completes successfully and dimensions remain valid. Visual review of the exact final ship-kit artifact is mandatory.

## 22. Product-local Rat Art looks good but the submitted cover is still wrong

### Cause

For normal Stream Deck plugins, Rat Ship globally owns and overwrites `02_cover.png` after product-local Rat Art runs.

Reviewing only:

- product-local `dist/marketplace/02_cover.png`
- gallery frames
- source SVGs
- an earlier hero render

does not prove what Maker Console will receive.

### Fix

CI for visually sensitive Stream Deck products should preserve/upload the **final canonical Rat Ship ship-kit**, including:

- final `02_cover.png`
- gallery files
- key-source/provenance report
- any representative key fixtures used to build the cover

The artifact to approve is the one produced after the global hero overwrite and marketplace preflight.

## Minimal diagnostic order

When a Stream Deck product looks wrong:

1. confirm canonical source/ref
2. run product tests
3. run design audit
4. run key visual audit
5. run official Elgato validation
6. Rat Dev the validated candidate
7. inspect real hardware/PI
8. convert any repeatable hardware finding into a regression/shared rule
9. rerun exact-commit QA before release

The objective is that local hardware review finds taste/host-specific issues, not ordinary repeatable engineering mistakes.
