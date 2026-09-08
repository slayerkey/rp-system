# Stream Deck Ultimate Bundle v0.6 Acceptance

This document is the canonical hardware acceptance checkpoint for the flagship Ultimate product.

## Why this exists

Automated validation is necessary but not sufficient. A package can pass manifest/schema checks without proving real Stream Deck host behavior, Windows foreground behavior, a user's audio drivers, or whether the profile is actually pleasant to use.

Every future revision must preserve already-proven behavior and explicitly identify new physical unknowns.

## Proven on the user's physical standard Stream Deck in earlier revisions

- Plugin can install and load a PackRat runtime.
- Bundled standard profile installs on a clean uninstall/reinstall cycle.
- Window Left works.
- Window Right works.
- Maximize works.
- Region Capture works.
- Clipboard recent-item paste works.
- The user strongly prefers simple semantic icons with controlled baked-in labels, not Stream Deck overlay titles or copy/paste icon templates.

These should be treated as regression-sensitive core behavior, not re-prototyped from scratch.

## Earlier failures that must not regress

- v0.1 package validation passed while the actual Node runtime was dead. CI must launch the manifest CodePath.
- Early v2 profiles used malformed internal page-folder mapping and did not install correctly.
- Early key art had overlapping/truncated titles because Stream Deck titles fought custom key artwork.
- Browser focus/launch was unreliable.
- Early WORK behavior could move unrelated windows too aggressively.
- Plugin/category iconography looked like placeholder art.

## v0.6 automated gates

The exact v0.6 branch package must pass all of the following before hardware handoff:

- Windows Node 20 runtime launch.
- Manifest CodePath runtime smoke test.
- Stream Deck registration and setImage behavior.
- Stream Deck+ encoder setFeedback behavior.
- Real Windows custom executable workspace launch using Notepad in CI.
- Safe config migration from v0.5 micMuted presets to v0.6 micMode presets.
- Work / Columns / Grid layout geometry tests.
- Explicit empty workspace support for audio-only / link-only routines.
- PowerShell Core Audio helper syntax parse.
- Seven hardware profiles generated and structurally validated.
- Official Elgato CLI validation.
- Official Elgato .streamDeckPlugin packaging.

## v0.6 new physical acceptance areas

These are NOT considered proven until tested on a real Windows PC with the user's devices:

### Audio
- MIC toggles the intended default microphone.
- MIC key reflects actual mute state after external changes.
- OUT cycles useful active output endpoints in a sensible order.
- IN cycles useful active input endpoints in a sensible order.
- Named output/input switching works with the user's actual driver/device names.
- Volume presets apply correctly.
- v0.6 never unexpectedly unmutes the mic when a mode is configured as Keep current.

### Setup
- SETUP opens the localhost onboarding page reliably.
- Output and input device lists are understandable and do not contain unusable duplicate endpoints.
- Installed-app detection correctly recognizes the user's common apps.
- Sensible / Creator / Gaming suggestions produce reasonable routines.
- Saved setup persists after Stream Deck restart.
- Reset restores safe defaults.

### Routines
- Work only moves windows belonging to its configured apps.
- Focus applies its intended audio and app layout without collateral window movement.
- Meeting can be audio-only, app-only, link-only, or a combination.
- Gaming does not rearrange the desktop unless explicitly configured.
- Repeated presses while a routine is already executing do not create duplicate launches/races.

### Hardware-specific profiles
- XL layout actually installs on XL and feels like a dashboard rather than a stretched standard profile.
- Stream Deck+ key profile installs and all four encoders behave correctly.
- Neo profile installs and uses its limited key count effectively.

## v0.6 safety defaults

- Work mic: Keep current.
- Focus mic: Mute.
- Meeting mic: Keep current.
- Gaming mic: Keep current.
- Meeting/other routines may intentionally contain zero apps.
- Clipboard remains local and is not sent to PackRat.
- Setup server binds to 127.0.0.1 only.
- Meeting URLs are limited to http/https during config sanitization.

## Known limitations / future premium work

Do not quietly claim these as shipping capabilities yet:

- Per-application volume mixer is not implemented.
- Windows Do Not Disturb / Focus Session integration is not implemented.
- Calendar-aware Next Meeting is not implemented.
- Context-aware foreground-app control layer is not implemented.
- Clipboard storage is local but not yet encrypted at rest.
- macOS is not implemented.
- Real physical Stream Deck+ / XL / Neo acceptance is still required.

## Handoff standard

Do not ask the user to diagnose internals. Ask for broad observation only, for example:

- MIC controlled the wrong device.
- OUT skipped my headphones.
- Setup found Discord but missed Todoist.
- Work moved my browser correctly but Discord ended up tiny.
- Focus is useful / not useful.
- The Plus dials feel natural / confusing.

Engineering should infer and investigate root causes from those observations, logs, and regression gates.
