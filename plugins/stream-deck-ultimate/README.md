# Stream Deck Ultimate — recovered canonical v1.0 source

This directory is the durable source of truth for **Stream Deck Ultimate 1.0.0.0** after the physical Windows/Stream Deck acceptance pass and the Elgato review correction requiring white category/action-list icons.

## Source lineage

The desktop acceptance bundle recorded upstream authoring commit:

`fc314e6f42fbe3e16da82a3af7aca75bda288e4f`

That source is preserved under `authoring/`. The final submission also contained post-build hardware fixes and final profile/key-art state that the older authoring pipeline did not reproduce by itself.

The recovery therefore uses three layers:

1. **Recovered authoring source** — normal JS/HTML/PowerShell/build machinery.
2. **Exact hardware payloads** — seven post-build fixes restored byte-for-byte and regression checked as F1–F7.
3. **Accepted v1 immutable capsules** — 16 exact final files that must not be regenerated for the v1 release: eight physically tested profile archives, the accepted native App Volume helper, final Smart Context runtime, final app/smart key faces, and acceptance bookkeeping/backup files.

Everything else is regenerated from source. The corrected key-art pipeline reproduces all 105 accepted key faces pixel-for-pixel; PNG compression bytes may differ while rendered pixels remain identical.

## Seven hardware fixes

1. Correct `IMMDeviceCollection` IID in `bin/audio.ps1`.
2. Use `pluginUUID` context for `switchToProfile`.
3. Use the Smart artwork for Smart navigation.
4. Limit App Volume titles to 9 characters.
5. Handle encoder activation on `dialDown`.
6. Handle `touchTap` as App Volume activation.
7. Carry configurable physical `micDevice` through audio/config/diagnostics/onboarding.

The old summarized `ALL-FIXES.patch` is **not** the authority. The exact accepted payload files plus automated F1–F7 checks are authoritative.

## Profile rule

The eight `profiles/*.streamDeckProfile` files in the immutable capsules are the exact archives physically imported/tested. Preserve them for v1.0.0.0. A prior attempt to rewrite the known page-ID mismatch caused full profile import failure and was deliberately not shipped.

## Elgato review correction

The Marketplace correction changes only the Stream Deck app's category/action-list icons: 15 action icon pairs plus the category pair, **32 PNGs total**. Every visible pixel is pure `#FFFFFF` with transparency preserved. Key faces remain colorful.

The corrected package produced directly from the hardware-accepted submission has SHA-256:

`5f6d1c546c370113b0f02677934214d8af7ef958592409b2d991db555d8243bb`

## Build and validation

The canonical CI deliberately splits native and art phases:

- Windows rebuilds/stages the App Volume runtime and proves F1–F7.
- Ubuntu regenerates art, applies accepted key polish, restores the immutable final slice, applies the white-icon correction, runs all release contracts, then runs official Elgato validation/packing.

For a local environment with a working CairoSVG/Cairo installation:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\stream-deck-ultimate\scripts\build-final.ps1
```

Start future Ultimate work from `plugins/stream-deck-ultimate/`, not the older `products/stream-deck-ultimate-bundle/prototype/` lineage.
