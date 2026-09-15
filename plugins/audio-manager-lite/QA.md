# Audio Manager Lite QA

Product: Audio Manager Lite  
Slug: audio-manager-lite  
Branch: product/audio-manager-lite  
Version: 1.0.0.0  
Price: Free

## Product boundary

Lite intentionally does one useful job: **switch Windows Default Output**.

It does not include Audio Profiles, input switching, Communications routing, cycle/status, mic control, restore state, or Stream Deck+ profile volume. Those are Pro features.

## Automated QA

GitHub Actions run **34930586864** on `421dd86407fdf4eab09a6802d21eaebd8dc1e36c`: **PASS**

- 11/11 tests
- PackRat canonical PI audit: PASS, 0 warnings
- Stream Deck key/profile audit: PASS, 0 warnings
- Lite→Pro catalog relationship audit: PASS
- shared AudioCore Windows build: PASS
- native helper self-test: PASS
- real Windows snapshot protocol: PASS
- Elgato validate: PASS
- Elgato package: PASS
- packaged helper / no-PDB hygiene: PASS

## Global design contract

The Lite PI uses the current PackRat design system:

- #080A0E background
- #151920 → #0D1015 cards
- #FFB21E interaction accent
- PackRat top-left maker link
- persistent top-right **Upgrade to Pro ↗**
- bottom Audio Manager Pro feature card
- width-safe current-device display with no horizontal scrolling
- configured target (`Switch to`) separated from live state (`Windows is using`)

Until Pro has a verified public product URL, upgrade CTAs use the canonical PackRat maker fallback.

## Physical gate

Run `rat dev audio-manager-lite`, then verify:

1. bundled Audio Manager Lite profile imports/opens
2. several Set Output Device keys are already laid out
3. choose speakers/headphones for two different keys
4. wait several seconds and confirm the selections do not snap back
5. press each key and confirm Windows Default Output changes correctly
6. key face shows the configured target and remains readable
7. PI shows the actual current Windows output separately
8. no horizontal scrollbar appears with long device names
9. top **Upgrade to Pro ↗** and bottom **Open Audio Manager Pro ↗** are visible and open the PackRat Marketplace fallback

Do not mark READY_TO_SHIP until this physical pass is complete.
