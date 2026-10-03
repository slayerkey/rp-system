# PackRat XENEON Marketplace Gallery V1

## Scope

Shared, deterministic XENEON **gallery** system for all newly rendered Rat Art / Rat Ship widget media. This is the gallery companion to `standards/xeneon-marketplace-hero-v1.md`; it does **not** replace that approved hardware hero or redesign shipping widget UI.

The legacy flat dark-green gallery background is retired for newly generated media. Instead use the same repository-owned clean studio and warm-left/cool-right glass campaign as the approved Stream Deck Marketplace gallery.

## Approved assets and truth

- Hero: existing `warm-studio-v1` scene, unchanged product title and calibrated real XENEON plate, with a subtle deterministic cool-right ambient lighting pass. Validate at exactly 15% (288×144).
- Galleries: `tools/art/scenes/warm-studio-clean-v1/base-v2.png` by default. Apply a dark readability veil, one restrained orange→blue glass content field, concise typography and the shared PackRat icon footer.
- Preserve the real screenshots produced by `tools/art/capture_xeneon.mjs`, including product-specific variant captures where they demonstrate an actual feature. No invented HUDs, device models, synthetic sensor values or generated environments.
- Do not replace widget-specific graph colors with marketing-only fake UI. The orange→blue palette belongs to the marketing frame, not the actual widget capture.
- Only repo-owned approved scene overrides under `products/<slug>.json` `marketplace_art.gallery_scene` are allowed. If configured assets are missing, fail closed.

## Five-frame buyer sequence

1. `02_cover.png` — approved XENEON hero, big product name and real widget on actual XENEON device.
2. `03_gallery_01.png` — actual product showcase. Show the most useful real screen without a wall of small benefit text.
3. `04_gallery_02.png` — three or four outcome-led core feature points backed by a real product capture.
4. `05_gallery_03.png` — interaction, configuration or genuinely distinct runtime state where supported. Prefer real variants to another slide of resized dashboard layouts.
5. `06_gallery_04.png` — compatibility/size close with truthful XENEON layout captures and both orientations stated where actually supported.

The separate `01_search_icon.png` is uploaded only to the dedicated app-icon field. **The cover is never a gallery image.** Four and only four final gallery files belong in the SHIP_KIT.

## Visual review and release

Review `contact-sheet.jpg` and `marketplace-15percent-sheet.jpg`, then inspect all five full-size final SHIP_KIT images. At 15%, every frame needs a distinctive visual job and the hero title/device must remain legible.

`tools/art/validate_xeneon_marketplace_campaign.py` checks the shared gallery, output dimensions, orange→blue frame treatment, duplicate-image hashes, final file mapping and order. Canonical Rat Art and Rat Ship invoke it before uploading CI artifacts.

The non-publishing `XENEON Marketplace Gallery Preview` GitHub Actions workflow renders and packages two representative current widgets for review. A clean preview **does not** submit or replace any existing Maker Console listing.

## Existing drafts

Changing repository media will not automatically edit an existing Marketplace Draft or Pending Review submission. A previously uploaded duplicate thumbnail or old gallery frame must be removed/replaced deliberately in the live Maker Console. Do not silently append new images to stale existing galleries or treat the platform's automatic thumbnail preview as a second uploaded gallery image.

## Ownership

- Shared gallery canvas/header/footer: `tools/art/xeneon_marketplace_campaign.py`
- Shared output generator + 15% contact sheet: `tools/art/rat_art.py`
- Shared final filename/order mapping: `tools/ship/make_xeneon_kit.py`
- Per-product copy, real capture selection and real runtime state: `widgets/_src/<slug>/rat-art.json` and `rat-art.mjs`
- Approved hero compositor: `tools/art/xeneon_all_hero_batch.py`
