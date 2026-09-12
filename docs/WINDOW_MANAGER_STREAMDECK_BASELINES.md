# Window Manager Stream Deck baselines

This document records the authoritative Window Manager Stream Deck package identities used by the XENEON integration.

The paid Window Manager Pro runtime is intentionally **not** stored in this public repository. Private recovery/provenance records live in `slayerkey/vcs`.

## Window Manager Lite shipped baseline

- Product: Window Manager Lite
- Version: `1.0.0.2`
- Plugin UUID: `com.packrat.windowmanager`
- Uploaded package size: `1,747,100` bytes
- Uploaded package SHA-256: `9c486243be8d9dc30e133fa329e372a6d8d0195391a639868ab5b7adea481e7d`
- Native dependency baseline: `koffi@3.1.4`
- Customer-visible actions:
  - Snap Window: `com.packrat.windowmanager.snap`
  - Cycle Windows: `com.packrat.windowmanager.cycle`

## Window Manager Lite hardened XENEON candidate

- Version: `1.0.0.3`
- Exact candidate size: `1,855,979` bytes
- Exact candidate SHA-256: `8f1fed423f871479c227a02d022d45205332c8d23cc1f0c2203d67ae32847b09`
- Native dependency: `koffi@3.1.6`
- Validated with Elgato Stream Deck CLI
- Visible Lite action set remains unchanged
- Existing Window Manager Pro Marketplace upsell remains present
- Hidden XENEON localhost service registers no Stream Deck action
- Property Inspector includes XENEON Edge pairing-key setup
- Native Windows app icons are extracted locally and cached as 32x32 PNG data URIs for XENEON

### Lite compatibility rule

XENEON integration must never turn Window Manager Lite into Window Manager Pro. The visible Lite actions remain Snap Window + Cycle Windows, the Pro Marketplace upgrade path remains, and the XENEON-only native service stays hidden from the Stream Deck action list.

## Window Manager Pro baseline

- Product: Window Manager Pro
- Version: `1.1.0.0`
- Plugin UUID: `com.packrat.windowmanagerpro`
- Uploaded package size: `1,858,752` bytes
- Uploaded package SHA-256: `d5cb32d7b404b5a2b130177d0b03535603fe07117cda0a9466f2395d7d5f0280`
- Native dependency baseline: `koffi@3.1.5`
- Customer-visible actions:
  - Window Layout: `com.packrat.windowmanagerpro.layout`
  - Snap Window: `com.packrat.windowmanagerpro.snap`
  - Cycle Windows: `com.packrat.windowmanagerpro.cycle`
  - Nudge Window: `com.packrat.windowmanagerpro.nudge`

## XENEON hardened candidate

- Product: Window Manager for XENEON
- Version: `1.0.0`
- Exact candidate size: `65,836` bytes
- Exact candidate SHA-256: `c26a07f8d374780b3f937102df942f7d0e27371f40253f9aeb69ac1c903336d4`
- Official CORSAIR iCUE package validation: pass
- Official iCUE Link Provider required for the Window Manager Lite install/update button
- The prior `d0fd...` XENEON package extracts to the same four file bytes; the package SHA changed only because the latest official packaging run wrote newer ZIP entry timestamps

## Automated hardening evidence

- Latest XENEON full gate: run `34667669391` — success
- Latest Lite service + Win32 FFI gate: run `34667669347` — success
- Native app icon + exact production Lite lifecycle: private run `34672640410` — success
- Exact official XENEON package artifact: `10289274525`
- Lite/XENEON service evidence artifact: `10288829017`
- Native icon overlay SHA-256: `2d431491f70f8cd710998dd8279173743f91d889092158377b4386cfd5ab8d22`

## Private recovery archive

Private repository paths:

- `streamdeck/window-manager-lite/1.0.0.2/`
- `streamdeck/window-manager-lite/1.0.0.3/`
- `streamdeck/window-manager-pro/1.1.0.0/`
- `streamdeck/window-manager-recovery/`

The original 1.0.0.2 Lite + 1.1.0.0 Pro first-party recovery archive reconstructs to:

- `window-manager-baselines.tar.xz`
- size: `61,570` bytes
- SHA-256: `81d22257e6f14c441448cfacbf6a8e5382fd9af4d4dd65dfddcee026dc28f39a`

The hardened Lite 1.0.0.3 private record stores its exact package identity and dependency/runtime provenance separately from the historical baseline.
