# Macro Recorder Maker Console Checklist

Date: 2026-09-13

Do not submit either edition until:
- `docs/MACRO_RECORDER_NATIVE_GATE.json` has `ready: true`
- `powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate` passes
- the exact packaged artifacts pass the Windows + physical Stream Deck smoke matrix in `docs/MACRO_RECORDER_QA.md`

## Macro Recorder Lite

- Product type: Stream Deck plugin
- Name: **Macro Recorder Lite**
- Version: **1.0.0.0**
- Price: **Free**
- Platform: Windows 10+
- Minimum Stream Deck: 7.1
- Node runtime: 24
- Package source: `plugins/macro-recorder-lite/dist/*.streamDeckPlugin`
- Submission metadata: `plugins/macro-recorder-lite/submission.json`
- Marketplace app icon: `artifacts/marketplace/macro-recorder-lite/00-app-icon.png`
- Thumbnail: `artifacts/marketplace/macro-recorder-lite/01-hero.png`
- Gallery: `02-capture.png`, `03-edit.png`, `04-safety.png`
- Thumbnail review sheet: `artifacts/marketplace/macro-recorder-lite/hero-thumbnail-review.png`

Primary positioning:
- record short keyboard workflows by performing them once
- replay without scripting
- 30 seconds / 60 events
- one assigned keyboard macro per Replay action
- mouse, long macros, loops and reusable library are Pro features

Privacy:
- no PackRat upload path
- assigned Lite macros live in Stream Deck action settings
- exported/shared Stream Deck profiles can include those action settings
- do not deliberately record passwords

## Macro Recorder Pro

- Product type: Stream Deck plugin
- Name: **Macro Recorder Pro**
- Version: **1.0.0.0**
- Net price: **$7.99**
- Platform: Windows 10+
- Minimum Stream Deck: 7.1
- Node runtime: 24
- Package source: `plugins/macro-recorder-pro/dist/*.streamDeckPlugin`
- Submission metadata: `plugins/macro-recorder-pro/submission.json`
- Marketplace app icon: `artifacts/marketplace/macro-recorder-pro/00-app-icon.png`
- Thumbnail: `artifacts/marketplace/macro-recorder-pro/01-hero.png`
- Gallery: `02-capture.png`, `03-library.png`, `04-playback.png`
- Thumbnail review sheet: `artifacts/marketplace/macro-recorder-pro/hero-thumbnail-review.png`

Primary positioning:
- record keyboard + mouse workflows by performing them once
- edit and reuse macros without a scripting language
- 10 minutes / 25,000 events
- 0.25x–4x playback
- count / while-held / toggle repeat
- reusable local Macro Library
- import/export PackRat macro files
- screen or active-window-relative mouse playback

Privacy:
- no PackRat upload path
- reusable Macro Library lives in local AppData
- a macro leaves the library only when the user explicitly exports a PackRat macro file
- do not deliberately record passwords

## Media contract

The deterministic Rat Art pipeline must produce:
- app icon: 288×288 PNG
- thumbnail: 1920×960 PNG
- three gallery images: 1920×960 PNG each
- plugin manifest icon: 256×256 + 512×512
- category icon: 28×28 + 56×56
- action-list icon: 20×20 + 40×40
- key state image: 72×72 + 144×144

`tools/art/macro_recorder_art.py` validates these dimensions and fails the release gate if they drift.

Hero copy:
**RECORD → DO IT → REPLAY**

## SEO / description

Use the structured copy in each edition's `submission.json`.

Truthful terms:
- macro
- macro recorder
- keyboard
- hotkeys
- shortcuts
- automation
- Windows
- Stream Deck
- keyboard macro
- record keystrokes

Pro may additionally use:
- mouse
- mouse macro
- record mouse
- loops
- Macro Library

Do not claim the category is empty.

## Profiles

Bundled device variants for both editions:
- Stream Deck / MK.2 (DeviceType 0)
- Stream Deck XL (DeviceType 2)
- Stream Deck + keypad (DeviceType 7)
- Stream Deck Neo (DeviceType 9)

Lite starter layout:
- BASIC
- REC
- STOP
- PLAY
- safe keyboard examples

Pro starter pages:
- MACROS
- GAMING
- PRODUCTIVITY
- MOUSE
- LOOPS

Plus/Neo use compact 4×2 keypad layouts. XL preserves the same logical pages with additional empty grid space. Macro Recorder does not claim encoder actions because its current action surface is keypad-only.

Examples must remain generic and harmless:
- no anti-AFK
- no gameplay farming
- no cheats

## Lite -> Pro URL sequence

Before Pro is public:
- keep Lite direct Pro Marketplace URL null
- do not use a search URL, creator URL, placeholder, or guessed slug

After Pro is published:
1. capture the verified direct Pro Marketplace product URL
2. update `products/lite-pro-map.json`
3. update `products/macro-recorder-lite.json`
4. update `plugins/macro-recorder-lite/submission.json`
5. add the verified direct link to the Lite property-inspector upsell
6. bump Lite version before publishing that upsell update

## Final checks before Maker Console

- official `streamdeck validate` passes
- official `streamdeck pack` passes
- exactly one Lite and one Pro package are produced
- package SHA256 values are recorded in QA output
- package/helper sizes are reviewed
- generated app icon + thumbnail are present
- names/prices are intentional before product creation
- release notes match the exact artifact
- privacy statements match actual storage behavior
- native gate is ready
- physical smoke matrix is complete

Do not run Rat Ship until all of the above is clean.
