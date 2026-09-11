# XENEON Edge Product Lab

This is the canonical fresh-chat entry point for PackRat XENEON Edge / CORSAIR iCUE widget work.

## Purpose

Use this file when starting a new ChatGPT chat or ChatGPT Project focused on XENEON Edge products.

GitHub remains the source of truth. Do not rebuild the XENEON process from conversation memory.

## Read order for every new XENEON product chat

1. `RATPACK.md`
2. `XENEON.md`
3. `skills/icue-widget-builder/SKILL.md`
4. `platforms/icue-xeneon.md`
5. `skills/rat-art/SKILL.md`
6. `skills/rat-ship/SKILL.md`
7. `products/index.json`

Read product-specific source and QA only after the product slug is known.

## Repository model

Keep all XENEON products in `rp-system` unless there is a concrete technical reason to split one out.

`main` is the stable canonical system.

Each product gets its own branch:

`product/<slug>`

Examples:

`product/now-playing`

`product/system-monitor`

`product/spotify-controls`

Multiple product branches may be developed in parallel.

Do not make one product wait on another unless they truly share a required change.

If a reusable change belongs in shared XENEON tooling, isolate that shared change clearly and avoid silently baking it into one product only.

## Product folders

Authored source:

`widgets/_src/<slug>/`

Generated shipping widget:

`widgets/<slug>/`

Canonical XENEON shared tooling:

`tools/xeneon/`

Canonical deterministic Rat Art tooling:

`tools/art/`

Canonical shipping tooling:

`tools/ship/`

## Identity

Every new PackRat XENEON widget manifest uses the exact author string:

`PackRat 🐀`

Use the reverse-domain namespace:

`com.packrat.<product>`

unless preserving an already-published immutable identifier.

## Product start workflow

When the user gives a new XENEON product idea:

1. Identify the actual customer problem and intended use.
2. Research the relevant iCUE provider/API ceiling before promising features.
3. Do not fake unavailable data, controls, state, album art, progress, telemetry, sensors, or host behavior.
4. Check `products/index.json` for overlap with existing PackRat products.
5. Propose the smallest strong v1 and pricing rationale.
6. For visually sensitive products, PLAN FIRST and show the important layout, typography, interaction, settings, and state decisions before writing product code.
7. Create or use `product/<slug>` only after the direction is sufficiently clear.
8. Build from canonical source under `widgets/_src/<slug>/`.

Ask questions only when the answer would materially change the product, API contract, design, or pricing. Do not stall on minor implementation details.

## API honesty rule

The iCUE provider is the ceiling.

A polished widget must design around the real provider rather than inventing capabilities the provider does not expose.

If the desired feature is unavailable, explain the limitation and redesign around what is actually possible.

Deterministic fixtures may simulate valid provider responses for QA, but they must never imply that the shipping provider exposes fields it does not actually expose.

## Eight-slot requirement

Every XENEON widget must deliberately support and test all eight official size/orientation compositions unless the platform itself provides a proven restriction mechanism.

Treat these as distinct compositions, not one layout stretched eight ways.

Test:

* overflow
* clipping
* typography hierarchy
* descenders and glyph safety
* touch targets
* settings
* provider loading, normal, empty, unavailable, and error states as applicable
* reduced motion when applicable
* runtime errors

## Release gate

The canonical hardware-free XENEON release candidate path is:

source and structure QA

-> all eight deterministic browser fixtures

-> official CORSAIR `icuewidget` validation

-> official `.icuewidget` package

-> StreamSpell packaged-widget verification across all eight presets

-> deterministic `/rat-art`

-> Rat Ship marketplace kit

A physical XENEON Edge is optional extra confidence, not a release requirement under the current PackRat workflow.

## Rat Art rule

`/rat-art` is repository tooling, never ChatGPT image generation.

Use the real widget capture through the deterministic Rat Art pipeline. If a required capture, device plate, brand asset, font, or mapping is missing, fail and repair the pipeline rather than substituting generated imagery.

## Shipping rule

For normal local use after a product is ready:

`rat ship <slug>`

This syncs the canonical repo, triggers GitHub Rat Ship, downloads the fresh marketplace kit into the local ignored `out/ship/<slug>` folder, and opens it for manual upload.

The Maker Console Playwright bridge is optional.

## Parallel product rule

It is expected that several XENEON widgets may be in progress at the same time.

Use one ChatGPT chat per product and one Git branch per product.

Keep product-specific decisions inside the product branch.

Move genuinely reusable improvements into canonical shared tooling so later products inherit them.

Do not duplicate the same fix independently across multiple widgets.

## Fresh-chat minimum prompt

A new chat should be able to start from something as small as:

`Build a XENEON Edge widget for <idea>. Read XENEON.md in slayerkey/rp-system first and follow RatPack end to end.`

The assistant should recover the rest of the build, QA, art, and shipping process from GitHub rather than requiring the user to restate the system.
