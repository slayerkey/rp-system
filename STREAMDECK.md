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
5. `skills/rat-art/SKILL.md`
6. `skills/rat-ship/SKILL.md`
7. `products/index.json`

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

Use GitHub Actions for clean Node builds and vendor CLI work.

Physical Stream Deck testing is final confidence where actual hardware behavior matters, not the normal place to discover ordinary build or packaging failures.

### Profile

Treat profiles as deterministic generated products when possible.

Validate profile archive structure, pages, navigation, action UUIDs, plugin dependencies, grid placement, icons, compatibility, and required platform/device variants.

Generate Windows, Mac, VSD, XL, Plus, or other required variants from canonical definitions rather than hand-editing several independent copies.

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

Keep reusable tooling centralized in `rp-system` rather than duplicating it inside individual product branches.

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

Depending on product type, this can include:

* unit tests
* API/cache/settings fixtures
* manifest validation
* property inspector checks
* SVG/PNG dimensions
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

`Build a Stream Deck <plugin/profile/icon pack> for <idea>. Read RATPACK.md and STREAMDECK.md in slayerkey/rp-system and follow RatPack end to end.`

The assistant should recover the rest of the build, QA, art, and shipping process from GitHub rather than requiring the user to restate it.
