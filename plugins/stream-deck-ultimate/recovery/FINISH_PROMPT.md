# STREAM DECK ULTIMATE — POST-SUBMISSION / RECOVERY HANDOFF

Stream Deck Ultimate v1.0.0.0 was submitted to the Elgato Marketplace on 2026-09-02. The final physical acceptance workspace was recovered on 2026-09-04 and is now represented durably under `plugins/stream-deck-ultimate/`.

## Canonical recovery rule

Future work starts from `plugins/stream-deck-ultimate/`.

The upstream source commit is `fc314e6f42fbe3e16da82a3af7aca75bda288e4f`, but **upstream source alone is not the accepted release**. Final v1 additionally requires:

- exact F1–F7 hardware payload restoration;
- accepted key-art polish;
- the 16-file immutable v1 capsule, including all eight physically tested profile archives;
- the Elgato white category/action-list icon pass.

The previously reconstructed `UPSTREAM-PATCHES/ALL-FIXES.patch` was only a summary and must not be treated as source authority.

## Hardware acceptance already proven

The recovered v1 release was physically/directly validated for install/load, bundled profiles, key art, profile navigation, Smart App, window actions, clipboard, capture, routines, Setup, audio switching, microphone control, privacy-safe diagnostics, per-app audio write/restore, App Volume Current/Specific/WAITING/mute/property-inspector behavior, upgrade retention, and hidden worker processes.

Do not repeat those physical tests without a concrete regression reason. CI should verify source/runtime contracts first.

## Intentionally unresolved profile behavior

The accepted profile packs contain a page-ID mismatch that causes a non-fatal log warning. Rewriting those IDs caused total profile import failure during local acceptance. The eight accepted profile archives are therefore immutable for v1.0.0.0 unless a replacement is physically proven.

## Marketplace review correction — 2026-09-04

Elgato requested white category/action icons inside the Stream Deck app. The correction affects exactly 32 PNGs: 15 action icon normal/@2x pairs and the category normal/@2x pair. It does not alter runtime code, profile behavior, colorful key faces or Marketplace artwork.

Corrected direct-from-accepted package SHA-256:
`5f6d1c546c370113b0f02677934214d8af7ef958592409b2d991db555d8243bb`
