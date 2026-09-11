---
name: rat-ship
description: Prepare a verified PackRat release candidate, marketplace kit, and submission checklist after QA is clean.
---

# Rat Ship

Require a clean automated QA report before preparing submission.

Create the release candidate from canonical source and generated artifacts. Include package, listing art, description, tags or keywords, pricing evidence, compatibility, version, changelog or release notes, QA report, and gallery order where the marketplace needs it.

## Marketplace rejection versioning

Treat a rejected Marketplace submission as a correction to the same release, not as a new product update. When fixing a rejected submission for resubmission, preserve the exact version that was rejected unless the marketplace explicitly requires otherwise. Code changes made only to satisfy rejection feedback do not by themselves justify a version bump.

Only increment the product version for a genuine new release or upgrade after the prior version has been accepted or published, or when the marketplace explicitly requires a higher version. Before Rat Ship packages a rejected resubmission, compare the candidate version against the rejected submission record and fail closed if they differ without an explicit override and reason.

Validate that the ship helper has an explicit branch for the product type. Do not let widgets fall through to profile handling.

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

A search/app icon is never a gallery image. Only upload `01_search_icon.png` when Maker Console exposes a dedicated icon, search icon, or app icon control. If no dedicated icon control exists, skip the standalone icon upload. Never guess by sending the icon to an unlabeled or gallery file input.

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

Hardware-dependent products need an honest review-evidence boundary. When current Marketplace review guidance or the live flow requires a functionality video:

- use real hardware for hardware-origin claims
- do not label browser fixtures, simulated providers, StreamSpell, or Corsair Labs runner output as physical-device evidence
- include a short reviewer-demo checklist in the ship kit when owned hardware was unavailable during automated QA
- if the live submission flow makes the video a required field, fail closed rather than uploading simulated evidence or guessing
- if review requests a demo after submission, preserve the exact submitted package/version and provide the requested physical evidence against that candidate

## Release notes

Marketplace release notes are concise bullets, not a prose announcement.

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
