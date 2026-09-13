# PackRat XENEON Marketplace Hero V1

## Status

Approved XENEON-specific hero direction for Marketplace Listing V2.

This document overrides the older generic XENEON hero defaults in `standards/marketplace-listing-v2.md` where the two conflict. It does not change the underlying product or widget UI.

Validated 2026-09-04 against the complete current XENEON source set: 17/17 products built, captured, rendered, bundled, and passed the exact 15% QA sheet in GitHub Actions run `33907173651`.

## Non-negotiable hierarchy

The XENEON hero must communicate, in this order:

1. Product name
2. Real XENEON Edge product/device
3. Real widget UI
4. PackRat identity
5. Environment/background

The product name and real product must both survive marketplace browsing scale. Branding and environment are supporting elements.

## Canvas

- Output: `1920 x 960` PNG.
- Exact 15% review size: `288 x 144`.
- The 15% sheet is a mandatory release gate for the hero family.
- The product name must remain immediately readable at 15% without zooming.
- The XENEON device must remain recognizable at 15%.

## Approved composition

The approved family is the deterministic `warm-studio-v1` environment.

The composition uses:

- a fixed repository-owned studio/environment plate
- large product typography inside the background monitor
- the calibrated XENEON Edge hardware plate in the foreground
- a real `XL_H` browser capture composited into that hardware plate
- a restrained PackRat rat/package mark
- deterministic lighting, shadows, texture, and typography

No generative image system is involved.

## Product name

Unlike the older generic V2 rule, the XENEON hero should normally repeat the product name prominently inside the image.

Why: marketplace browsing scale made the earlier small-header system too weak. The approved tests showed that large title treatment improves recognition and product differentiation at approximately 15% scale.

Rules:

- Use one or two strong title lines.
- Prefer short semantic breaks rather than shrinking the entire title.
- Lite and Pro belong in the visible title when they are part of the actual product name.
- Do not add a second unrelated slogan that competes with the name.
- Do not turn the title into a paragraph.
- Keep `for XENEON Edge` visibly subordinate to the product name.

Current title mapping is versioned in `tools/art/xeneon_hero_catalog.json`.

## Real product proof

The widget shown on the device must come from the current real product source.

Required path:

`widgets/_src/<slug>` -> deterministic inline build -> `tools/art/capture_xeneon.mjs` -> real `XL_H.png` -> calibrated XENEON hardware composition.

The renderer may improve presentation sharpness/contrast slightly for compositing, but it may not alter widget layout, data meaning, controls, availability, modes, or functionality.

If a product cannot produce a deterministic real capture, the hero is blocked. Do not create substitute UI.

## Device scale

The physical XENEON product remains a major foreground subject.

- Use the approved calibrated front-facing device plate.
- Keep the device wide and obvious across the lower portion of the hero.
- Do not shrink the hardware to make more room for decoration.
- Do not use a different angle merely to look more cinematic.
- Do not crop important hardware or screen content.

## Environment and background

A real designed environment is allowed and preferred for this XENEON family when it improves scroll-stopping recognition without weakening product proof.

Allowed:

- fixed repository-owned studio scenes
- monitor/display context behind the product
- deterministic gradients, glows, shadows, texture, lines, dots, or geometric treatment
- restrained desk/studio context when the scene is an approved PackRat asset
- product-family color treatment

Not allowed:

- generated room/product imagery
- arbitrary copyrighted game art or cover art
- unrelated stock photography
- fake widget UI or fake floating HUDs
- decorative effects that make the real widget hard to read
- replacing the actual device with an invented XENEON representation

Context art from a specific game/product may only be used when it is rights-cleared and versioned locally with provenance. The default system must not depend on external cover art.

## PackRat mark

PackRat is secondary.

The rat/package mark may sit in a clean corner or another consistent supporting position. It does not need to be top-center.

Current approved warm-studio placement is a small upper-right signature.

Rules:

- recognizable at full size
- subordinate at browsing size
- never larger than the product name
- no duplicate footer logo on the same hero
- no giant PACKRAT wordmark competing with the product

## Lite / Pro families

Lite and Pro variants must look unmistakably related.

Keep identical:

- scene
- device geometry
- type system
- PackRat placement
- platform subtitle treatment
- title structure

Differentiate with:

- the actual edition name in the title
- the real widget UI/state
- truthful feature differences in later gallery media

Do not make Pro brighter, more cinematic, or more expensive-looking by fabricating a different environment.

## Color

The current approved family uses PackRat orange as the primary environment accent, with dark neutral surfaces and high-contrast white/orange title typography.

Per-product color can appear inside the real widget capture. Do not recolor the widget merely to match the hero.

A future scene variant may use another controlled family accent only after a contact-sheet review proves the catalog still reads as one coherent PackRat system.

## QA gates

Every promoted XENEON hero must pass all of the following:

- current product builds successfully
- deterministic Rat Art fixture reaches its intended state
- `XL_H` real capture exists
- no runtime errors or overflow in capture
- calibrated device composition succeeds
- hero is exactly `1920 x 960`
- product name is readable at exact 15% scale (`288 x 144`)
- device remains recognizable at 15%
- real UI remains truthful
- Lite/Pro family relationship is obvious
- PackRat mark is present but secondary
- contact sheet has no obvious scale or title outlier
- no generated image dependency

## Current validated catalog

The approved 17-product set is versioned in `tools/art/xeneon_hero_catalog.json`:

- Calendar Panel
- Desk Notes Lite
- Desk Notes Pro
- Discord Voice Panel
- Helldivers 2 Panel
- Net Dashboard
- Now Playing Panel
- OBS Dashboard
- PC Power Meter Lite
- PC Power Meter Pro
- Rig Battery
- Snake
- Weather Timeline Lite
- Weather Timeline Pro
- Work Session Tracker Lite
- Work Session Tracker Pro
- XENEON EDGE Ultimate

The catalog config is the source of truth for hero naming/order in the batch renderer. New XENEON products must be added there deliberately and must pass the same full-family QA.

## Canonical tooling

Current approved renderer/batch tooling:

- `tools/art/xeneon_all_hero_batch.py`
- `tools/art/xeneon_hero_catalog.json`
- `tools/art/capture_xeneon.mjs`
- `.github/workflows/xeneon-all-heroes-batch.yml`

The batch must emit:

- one hero PNG per configured product
- one provenance JSON per product
- `manifest.csv`
- `contact-sheet.jpg`
- exact `15-percent-sheet.jpg`
- one complete ZIP

A batch is not complete until every configured product passes.
