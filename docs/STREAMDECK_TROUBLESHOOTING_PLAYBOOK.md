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
- selected action instance is passed separately in payload
- settings use the PI UUID context
- plugin commands use the global `streamDeck.ui` channel by default

### Stale-state variant

If the plugin successfully changes state but the PI still renders the old selection, merge the authoritative state/settings returned by the plugin into PI-local state **before render**. Keep one selected-ID source of truth. Do not render from stale startup settings after the plugin has already acknowledged a new value.

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

## 18. Profile keeps duplicating or Rat Dev forgets to open it

Rat Dev fingerprints bundled profiles.

- unchanged installed profile: do not reopen/import
- changed bundle: open newest once for replace/update
- deleted/missing installed profile: open again
- default selection: DeviceType 0 standard/MK.2 unless overridden

Do not blindly import the same unchanged profile on every Rat Dev run.

## 19. Global rules start changing while fixing one product

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
