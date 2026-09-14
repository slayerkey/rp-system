# Stream Deck Product Lab

This is the canonical fresh-chat entry point for PackRat Stream Deck marketplace work.

## Purpose

Use this file when starting a new ChatGPT chat or ChatGPT Project focused on Stream Deck products.

GitHub remains the source of truth. Do not rebuild the Stream Deck process from conversation memory.

## Read order for every new Stream Deck product chat

1. `RATPACK.md`
2. `STREAMDECK.md`
3. `skills/rat-build/SKILL.md`
4. the matching platform/product-type guidance
5. `standards/streamdeck-plugin-design-system-v1.md`
6. `standards/streamdeck-key-visuals-v1.md`
7. `docs/RAT-DEV-RELIABILITY.md`
8. `docs/STREAMDECK_TROUBLESHOOTING_PLAYBOOK.md`
9. `skills/rat-qa/SKILL.md`
10. `skills/rat-art/SKILL.md`
11. `skills/rat-ship/SKILL.md`
12. `products/index.json`

Read product-specific source and QA only after the product slug and type are known.

## Project scope

The `PackRat Stream Deck` ChatGPT Project should contain chats for:

* Stream Deck plugins
* Stream Deck profiles
* Stream Deck icon packs
* Stream Deck screensavers
* other Stream Deck-native marketplace products

Do not create a separate ChatGPT Project for every individual product.

Each actual product gets one dedicated chat and one Git branch:

`product/<slug>`

## Product routing

### Plugin

Use the Stream Deck SDK and canonical plugin build/test/package path.

Validate manifest structure, built code paths, property inspectors, actions, assets, settings, cache/API behavior, error states, and Elgato CLI validation/package.

Key-face visual quality and Property Inspector behavior are part of plugin correctness. Read `standards/streamdeck-plugin-design-system-v1.md` and `standards/streamdeck-key-visuals-v1.md` before designing action art, settings UI, live telemetry, or bundled profiles. A key must be obvious at real 72 x 72 Stream Deck scale, with the action or live value upfront. PackRat Keypad UI owns the full rendered key face: disable the Stream Deck title overlay with `ShowTitle: false` and render any state/value text into the image with an explicit text band. Do not cover a generic device illustration with host-managed title text.

Every plugin with Keypad actions must run the shared key-face audit when practical:

`node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin>`

New Node SDK plugins should also run the source-level design contract audit:

`node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root>`

For work using the canonical PackRat Property Inspector, add `--require-canonical-pi`. For Lite/free products with a direct Pro counterpart, add `--require-lite-pro-upsell`. The audit reads the real action-level Property Inspector paths declared in the manifest and should be run before the hardware pass.

That audit catches stable action-identity drift, host-title regressions, and the Property Inspector context/transport failure pattern that causes dead buttons, stale startup state, and settings that do not persist.

Dashboard-style plugins that promise the default major-model bundle must run:

`node tools/qa/streamdeck-key-visual-audit.mjs <path-to-.sdPlugin> --require-major-profiles`

The default major-model bundle is standard/MK.2, XL, Plus, and Neo (DeviceTypes 0, 2, 7, and 9) unless the product records a deliberate exception. Use `tools/streamdeck/profile-builder.mjs` for deterministic generation instead of hand-maintaining multiple archives. The shared builder supports multi-page layouts for feature-rich products.

When bundled profiles exist, Rat Dev should make them impossible to forget: `rat dev <slug>` opens the DeviceType 0 standard/MK.2 profile by default after a validated link, unless the product explicitly opts out. Use `dev_profile` only to override which bundled profile is opened.

The automated audit is only a floor. Also review actual keys at 72 x 72 and a reduced 36 x 36 preview. Dynamic keys must be reviewed using representative rendered states, not only their manifest fallback image.

Use GitHub Actions for clean Node builds and vendor CLI work.

Physical Stream Deck testing is final confidence where actual hardware behavior matters, not the normal place to discover ordinary build or packaging failures. The hardware pass must explicitly cover readable 72 x 72 key faces, accent/state behavior, Property Inspector save/reopen persistence, PI command buttons, live update cadence, and bundled profile appearance when profiles are promised.

### Profile

Treat profiles as deterministic generated products when possible.

Validate profile archive structure, pages, navigation, action UUIDs, plugin dependencies, grid placement, icons, compatibility, required platform/device variants, and key-face legibility.

Bundled profile titles and action images must follow `standards/streamdeck-key-visuals-v1.md`. Profile generation is not allowed to reintroduce long labels over icon art that the plugin manifest avoided.

Generate device variants from canonical definitions rather than hand-editing several independent copies. New PackRat profile bundles should prefer the shared deterministic builder in `tools/streamdeck/profile-builder.mjs`.

A local Stream Deck import remains useful as final validation when required.

### Icon pack

Treat icon packs as deterministic art/data products.

Validate required counts, dimensions, naming, variants, packaging, marketplace imagery, and brand consistency.

Do not use chat image generation as a substitute for canonical Rat Art when Rat Art is invoked.

### Screensaver or visual product

Use the matching canonical generator and validate target resolutions, frame behavior, packaging, and marketplace presentation.

## Shared rules

GitHub is canonical.

ChatGPT is the preferred development/orchestration environment.

GitHub Actions is the remote build/test computer.

Use local execution only for genuine host, hardware, or authenticated-browser boundaries.

Keep reusable tooling centralized in `ratpack-system` rather than duplicating it inside individual product branches.

Canonical standards are **read-only inputs to normal product work**. A product build, visual refresh, QA pass, or rollout task should consume the global Stream Deck standards exactly; it must not edit them to make a local implementation pass. Update a global standard only when the user is explicitly asking for a reusable system change.

When a product-level fix reveals a repeatable failure, first fix the product, then promote the minimal reusable rule/check into shared tooling. Do not copy product-specific hacks into the global system.

Before a destructive rollback, product split, or architecture reversal, freeze the current exact working state on a branch/tag/commit so useful engineering can be reused instead of reconstructed from chat history.

## Marketplace demand data

The dated Marketplace search snapshot lives at `data/marketplace/streamdeck_search_popularity.json`. Its interpretation and usage rules live at `docs/STREAMDECK_MARKETPLACE_SEARCH_DATA.md`.

Read these files when researching demand, choosing truthful product names or keywords, evaluating saturation, positioning a visual theme, or planning marketplace art copy.

The `popularity` field is a rolling 30 day raw search value, not a normalized score out of 100. The `exact_product_hits` field measures strict result supply, not sales. Refresh dated data before making a major product decision.

## Product start workflow

When the user gives a new Stream Deck idea:

1. Identify the product type.
2. Check `products/index.json` for overlap.
3. Research the actual user problem and marketplace gap when validation is needed.
4. Confirm technical feasibility against the real Stream Deck SDK/profile/package constraints before promising functionality.
5. Propose the smallest strong v1 and pricing rationale.
6. For visually sensitive products, PLAN FIRST when design choices materially affect the product.
7. Create or use `product/<slug>` only after the direction is sufficiently clear.
8. Build from canonical source and reusable tooling.

Ask questions only when the answer would materially change the product, architecture, design, platform support, or pricing.

## QA principle

Automate everything that can be objectively checked before local hardware/import testing.

The first local `rat dev` pass should be a **visual/physical confirmation pass**, not the place where ordinary source, asset, settings, text-overflow, or package mistakes are first discovered.

Shared automation should catch, when applicable:

- missing or ambiguous extensionless Stream Deck assets
- stale host title overlays
- action-list icon drift
- wrong canonical PI palette/branding
- missing local PackRat logo asset
- PI transport/settings-context mistakes
- Lite→Pro top/bottom conversion surfaces
- profile coverage/generation mistakes
- marketplace text overflow and reduced-size readability failures
- stale QA/package evidence after behavior-scope changes

Depending on product type, this can include:

* unit tests
* API/cache/settings fixtures
* manifest validation
* property inspector checks
* SVG/PNG dimensions
* 72 x 72 key-face visual audit and reduced-scale review
* profile archive validation
* action UUID/dependency checks
* golden package comparisons
* Elgato CLI validation
* package creation
* browser screenshot/layout checks
* deterministic Rat Art

## Rat Art

`/rat-art` is the deterministic repository art pipeline, not ChatGPT image generation.

Use real product screenshots, generated keys, device plates, approved assets, and canonical composition tooling.

### Canonical Stream Deck hardware hero

The shared MK.2 photo compositor lives at `tools/art/streamdeck_photo.py`.

The approved hardware plate is `tools/art/assets/streamdeck-mk2-straight.png` and its 15-button calibration is `tools/art/streamdeck-mk2-straight.apertures.json`.

The hardware plate contains real transparent LCD windows. Product key art must be rendered on an underlay **behind** those windows, then the untouched photographed hardware plate must be composited on top. Never draw key art over the physical button bezel, glass rim, chassis, or lighting.

The source PNG alpha channel is authoritative. The calibration stores coarse physical button bounds and cached expected LCD bounds, but the compositor must detect each real LCD hole as an internal connected alpha component at render time. Every detected LCD pixel must receive a fully opaque screen underlay, with a small under-bezel safety bleed, before product art is added. A successful render requires exactly 15 detected LCDs and zero uncovered LCD pixels.

Transparent key assets must be alpha-trimmed before fitting so invisible canvas padding cannot make the visible artwork undersized. Their transparency reveals the intentional screen background, never the marketplace scene. Opaque key-face screenshots fill the detected LCD area. The compositor must reject bad calibration that does not match the plate's real alpha holes.

Stream Deck hero titles use the same deterministic font resolver, warm-studio scene, white/orange hierarchy, and source PackRat mark as the approved XENEON hero system.

## Shipping

Rat Ship should prepare the complete marketplace candidate from canonical source and validated artifacts.

Keep package, listing art, description, pricing evidence, compatibility, release notes, QA evidence, and gallery order together.

Use the local authenticated Maker Console bridge only when needed. Do not put marketplace browser credentials or session state into GitHub Actions.

## Parallel product rule

Several Stream Deck products may be built at the same time.

Use one ChatGPT chat per product and one Git branch per product.

Do not make unrelated products wait on each other.

When one product uncovers a genuinely reusable fix, move that fix into shared tooling so later products inherit it.

## Fresh-chat minimum prompt

A new chat should be able to start from something as small as:

`Build a Stream Deck <plugin/profile/icon pack> for <idea>. Read RATPACK.md and STREAMDECK.md in slayerkey/ratpack-system and follow RatPack end to end.`

The assistant should recover the rest of the build, QA, art, and shipping process from GitHub rather than requiring the user to restate it.

For an existing product refresh, the minimum prompt can be even smaller:

`Update <slug>. Read RATPACK.md + STREAMDECK.md, use the canonical PackRat Stream Deck design system read-only, preserve product behavior unless I explicitly change scope, run Rat Dev/QA/art gates, and leave it ready for my final hardware check.`

