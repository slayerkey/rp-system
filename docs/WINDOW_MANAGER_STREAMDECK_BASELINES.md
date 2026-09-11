# Window Manager Stream Deck baselines

This document records the authoritative Stream Deck package identities used while building and maintaining the XENEON Window Manager integration.

The paid Window Manager Pro runtime is intentionally **not** stored in this public repository. The first-party Lite and Pro recovery payloads are archived privately in `slayerkey/vcs` under `streamdeck/window-manager-recovery/`.

## Window Manager Lite

- Product: Window Manager Lite
- Version: `1.0.0.2`
- Plugin UUID: `com.packrat.windowmanager`
- Uploaded package: `com.packrat.windowmanager.streamDeckPlugin`
- Uploaded package size: `1,747,100` bytes
- Uploaded package SHA-256: `9c486243be8d9dc30e133fa329e372a6d8d0195391a639868ab5b7adea481e7d`
- Native dependency baseline: `koffi@3.1.4`
- Customer-visible actions:
  - Snap Window: `com.packrat.windowmanager.snap`
  - Cycle Windows: `com.packrat.windowmanager.cycle`
- Existing Pro Marketplace upsell:
  `https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11`

### Lite compatibility rule

XENEON integration must not turn the Stream Deck Lite package into Pro. The existing Lite actions and Pro upsell remain customer-visible as they are. Any XENEON-only local service added to Lite must stay hidden from the Stream Deck action list and must not expose Pro-only Stream Deck actions.

## Window Manager Pro

- Product: Window Manager Pro
- Version: `1.1.0.0`
- Plugin UUID: `com.packrat.windowmanagerpro`
- Uploaded package: `com.packrat.windowmanagerpro.streamDeckPlugin`
- Uploaded package size: `1,858,752` bytes
- Uploaded package SHA-256: `d5cb32d7b404b5a2b130177d0b03535603fe07117cda0a9466f2395d7d5f0280`
- Native dependency baseline: `koffi@3.1.5`
- Customer-visible actions:
  - Window Layout: `com.packrat.windowmanagerpro.layout`
  - Snap Window: `com.packrat.windowmanagerpro.snap`
  - Cycle Windows: `com.packrat.windowmanagerpro.cycle`
  - Nudge Window: `com.packrat.windowmanagerpro.nudge`

## Private recovery archive

Private repository: `slayerkey/vcs`

Paths:

- `streamdeck/window-manager-lite/1.0.0.2/`
- `streamdeck/window-manager-pro/1.1.0.0/`
- `streamdeck/window-manager-recovery/`

The shared recovery archive reconstructs to:

- `window-manager-baselines.tar.xz`
- size: `61,570` bytes
- SHA-256: `81d22257e6f14c441448cfacbf6a8e5382fd9af4d4dd65dfddcee026dc28f39a`
- XZ magic: `FD 37 7A 58 5A 00`

Use the private `Restore-WindowManagerBaselines.ps1` script to reconstruct the archive. It refuses to extract if the SHA-256 does not match.

The original uploaded installer hashes above are the package identity/provenance checks. The private recovery archive preserves the PackRat-authored distributable runtime while avoiding duplication of third-party Koffi source.
