---
name: rat-ship
description: Prepare a verified PackRat release candidate, marketplace kit, and submission checklist after QA is clean.
---

# Rat Ship

Require a clean automated QA report before preparing submission.

Create the release candidate from canonical source and generated artifacts. Include package, listing art, description, tags or keywords, pricing evidence, compatibility, version, changelog or release notes, QA report, and gallery order where the marketplace needs it.

Final evidence must match the exact source commit and package being submitted. If product behavior, feature scope, or release boundary changed after an earlier green QA run, invalidate that earlier final evidence and regenerate the package/art/QA record before Rat Ship can proceed.


## Canonical registration and diverged product branches

`rat ship <slug>` resolves the release control plane from canonical `main`. Before shipping, require:

- `products/<slug>.json` on `main`
- submission metadata at the canonical path referenced by that product record
- a `products/index.json` entry
- truthful workflow state

Do not merge a heavily diverged/long-lived product branch wholesale into `main` merely to satisfy registration.

When the product is developed on a separate branch, prefer canonical metadata on `main` that pins Rat Ship to an immutable, already-green release artifact:

- exact repository
- exact source commit
- exact Actions run/artifact
- exact package path
- exact package SHA-256
- exact media paths when the artifact owns immutable media

Registration and readiness are separate concepts. Adding the canonical record fixes "not registered" but must not silently change `TESTING` to `READY_TO_SHIP`. Promote readiness only when the remaining gate is intentionally accepted/closed.

## Marketplace rejection versioning

Treat a rejected Marketplace submission as a correction to the same release, not as a new product update. When fixing a rejected submission for resubmission, preserve the exact version that was rejected unless the marketplace explicitly requires otherwise. Code changes made only to satisfy rejection feedback do not by themselves justify a version bump.

Only increment the product version for a genuine new release or upgrade after the prior version has been accepted or published, or when the marketplace explicitly requires a higher version. Before Rat Ship packages a rejected resubmission, compare the candidate version against the rejected submission record and fail closed if they differ without an explicit override and reason.

Validate that the ship helper has an explicit branch for the product type. Do not let widgets fall through to profile handling.

## Stream Deck plugin hero rule

For normal in-repository Stream Deck plugins, Rat Ship owns the Marketplace cover globally.

- product-local Rat Art may generate the search icon and gallery frames
- after product-local art finishes, Rat Ship must render the canonical warm-studio/photo Stream Deck hero and overwrite **only** `02_cover.png`
- the global hero uses the approved warm-studio environment, real photographed Stream Deck hardware plate, PackRat white/orange monitor hierarchy, and deterministic action/key representation
- product-local art must not be allowed to overwrite the canonical hero after this step
- Marketplace preflight runs only after the global hero has been applied
- external immutable release artifacts remain exact validated artifacts and are not rewritten by this rule

This is the default for future Stream Deck plugins. Do not reimplement the hero product by product.

## Stream Deck canonical UI preflight

Before packaging a Stream Deck plugin that uses the PackRat canonical Property Inspector, Rat Ship should require the shared design audit against the actual shipping source:

`node tools/qa/streamdeck-plugin-design-audit.mjs <plugin-source-root> --require-canonical-pi`

For a Lite/free plugin with a direct Pro counterpart, add `--require-lite-pro-upsell`.

The Lite→Pro ship gate must verify both conversion surfaces are packaged:

- top PackRat chrome row with direct `Upgrade to Pro ↗`
- bottom explanatory Pro feature card with direct `Open <Product> Pro ↗`

Both CTAs must resolve to the exact public Pro Marketplace `/product/` listing. A maker page, search route, guessed URL, placeholder URL, or unpublished Pro listing is not acceptable. If the Pro listing is not live, leave the Lite upsell release blocked rather than inventing a route.

Product-specific shipping work consumes the canonical design standard; it must not rewrite `standards/streamdeck-plugin-design-system-v1.md` to match a local implementation.

## XENEON marketplace media

For XENEON widgets, treat the cover, search/app icon, and gallery as separate customer jobs.

The default marketplace order is:

1. Cover or hero
2. Feature and value breakdown
3. Product showcase
4. Settings, interaction, or alternate state
5. Slot size compatibility

Do not upload the cover again as a gallery item. The ship kit must fail if the cover or any gallery image is byte identical to another listing image.

The first gallery frame should explain the product in more detail with concise feature or value points rather than repeat the hero composition. It is the conversion frame immediately after the click, so prioritize the most important practical reasons to use or buy the product rather than low-value implementation trivia.

A search/app icon is never a gallery image. Only upload `01_search_icon.png` to the dedicated icon/search/app control. Maker Console has changed this control's DOM labeling before, so detection must use the live field context, validation copy, and the 288×288 / 1:1 requirement rather than one brittle element ID. If the page says **App icon required**, the media step is not complete: do not mark it done, do not advance, and capture diagnostics instead of silently skipping the icon.

The Maker Console media editor may visually include the Thumbnail as the first item in its carousel/gallery preview. That is platform presentation, not permission to upload `02_cover.png` again. Rat Ship uploads only `03_gallery_01.png` through `06_gallery_04.png` to the gallery input and records the before/after count as proof.

When the gallery input supports multiple files, upload the canonical gallery sequence as one ordered FileList and verify the browser FileList order before continuing. A resumed draft with unexpected pre-existing gallery media must not be treated as proof of correct ordering.

Use the shared Rat Art footer and spacing rules. Do not add product-local footer wordmarks or one-off label/divider placement fixes when the shared renderer can own them.

## XENEON listing preflight

For XENEON Marketplace kits, fail closed on the current media contract:

- dedicated search/app icon, when the live Maker Console exposes that field: PNG at 288 × 288
- cover/thumbnail: PNG at 1920 × 960
- at least 3 gallery items; image gallery items are PNG at 1920 × 960
- video gallery items, when used, follow the current Marketplace video requirements shown by the live submission flow/guidelines
- keep cover and gallery frames distinct, readable, English-language, and representative of the actual product

Prefer product names at or below the current Marketplace recommendation when that can be done without losing clarity. Treat the live create-product form as authoritative for immutable fields such as the final product name and monetization choice.

Hardware-dependent products need an honest review-evidence boundary. When current Marketplace review guidance requires a functionality video:

- use real hardware for hardware-origin claims
- do not label browser fixtures, simulated providers, StreamSpell, or Corsair Labs runner output as physical-device evidence
- include a short reviewer-demo checklist in the ship kit when owned hardware was unavailable during automated QA
- allow kit generation and non-public staging to proceed, but keep final authenticated submission blocked until the required real-hardware demo is recorded or Marketplace explicitly provides another acceptable evidence route
- if the live submission flow exposes a required video field, fail closed rather than uploading simulated evidence or guessing
- preserve the exact submitted package/version when producing reviewer evidence so the demo corresponds to the candidate under review

## Release notes

Marketplace release notes are concise bullets, not a prose announcement.

Use actual newline characters between bullets. Literal `\n` text serialized into one giant release-note line is a metadata bug and should fail preflight.

Default to three to six bullets describing the user-visible changes. Do not add headings or preambles such as `Initial release`, `What's new`, or `Version 1.0.0`. Do not submit one long paragraph when the information can be scanned as separate changes.

For a first release, list the actual capabilities that shipped. For an update, list only meaningful changes in that version. Rat Ship may normalize legacy prose into bullet formatting, but new `submission.json` metadata should already be authored as clean bullet points.

## Elgato Maker Console

Use the live Maker Console behavior as the operational source of truth when it conflicts with lagging public documentation.

PackRat has directly confirmed that `Widget` is a selectable Maker Console product type and that the create-product flow accepts `.icuewidget` packages. Do not route iCUE/XENEON widgets to email merely because the public supported-product list omits Widget.

For widgets, the canonical submission path is Maker Console when the live UI offers `Widget`.

The existing Maker Console automation uses Playwright with a local persistent Chromium profile. Authentication remains local. Never copy browser profile data, cookies, passwords, or session tokens into GitHub, GitHub Actions, repository files, or CI secrets for this workflow.

Prefer the canonical local Playwright driver under `tools/ship/` for repeatable staging and upload. The driver must fail closed when required widget-specific fields are unknown rather than guessing.

Treat irreversible fields such as product ID, name, paid versus free selection, price, gallery order, and final publication state as explicit submission decisions. Verify them immediately before the final submit action.

Advance to SUBMITTED only after the actual marketplace submission has occurred.


### Maker Console self-healing draft rule

A retry must recover the wizard state instead of creating more manual cleanup.

- if an existing Draft reopens at the package-upload slide, reuse the exact validated package and replay package → description → details → media in the same draft
- never create a duplicate product merely because the create wizard returned to an earlier slide
- if a Draft reopens directly on Media, invalidate stale media/continue completion markers and re-verify required icon and thumbnail fields before continuing
- required-field validation is authoritative; a visible `App icon required`, `Thumbnail required`, or equivalent error means the step failed even if files were uploaded elsewhere
- do not retry an unknown state three times with identical logic; capture the page, controls, file inputs, and validation text needed to make the next retry deterministic
