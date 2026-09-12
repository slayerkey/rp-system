# Window Manager for XENEON - hardened QA contract

## Current architecture

```text
Window Manager for XENEON 1.0.0
  -> localhost protocol v1 on 127.0.0.1:17487
  -> free Window Manager Lite 1.0.0.3
  -> existing native Window Manager Win32 engine
  -> Windows
```

The standalone PackRat Window Bridge remains historical/reference-only. It is not the intended customer dependency.

## Final hardened candidates

### Window Manager Lite 1.0.0.3

- exact candidate SHA-256: `c913f8eabe815561289e07d89b1ddbecccc458bf1303940625e5b903c272a82e`
- size: `1,853,237` bytes
- built from exact shipped Lite 1.0.0.2 baseline
- Koffi upgraded to `3.1.6`
- official Elgato Stream Deck CLI validation passed
- visible actions remain exactly:
  - Snap Window: `com.packrat.windowmanager.snap`
  - Cycle Windows: `com.packrat.windowmanager.cycle`
- existing Window Manager Pro Marketplace upsell remains
- no Pro action UUIDs are exposed
- XENEON service registers no Stream Deck action
- Property Inspector includes XENEON Edge setup, pairing-key copy and local setup page

### Window Manager for XENEON 1.0.0

- exact candidate SHA-256: `d0fdcd3d53559eaf32c63b6c164e123e9283d88e175d638d225487c90ccdd50d`
- size: `65,836` bytes
- officially validated/packaged by CORSAIR iCUE widget CLI
- official iCUE Link Provider opens the Window Manager Lite Marketplace listing
- required plugin: `widgetbuilder.linkprovider:Url:1.0`

## Hardened gates that pass

### Lite / localhost service

- exact Lite baseline captured before modification
- Lite -> Pro conversion guard
- JavaScript syntax
- ZIP/package integrity
- localhost-only binding
- exact local/file/qrc origin policy
- malicious localhost-lookalike origin rejection
- HTTP(S) origins restricted to service port
- fixed-time pairing-key comparison
- 64 KiB WebSocket limit
- malformed/fragmented/RSV frame rejection
- narrow command allowlist
- snapshot normalization
- correct-key authentication
- wrong-key rejection
- protocol mismatch rejection
- arbitrary-command rejection
- focus/minimize/maximize-restore/snap-left/snap-right/move-monitor/close routing
- no shell/process execution API
- setup-page CSP + nosniff
- port-collision/restart retry
- Windows native Koffi 3.1.6 FFI smoke:
  - user32.dll / dwmapi.dll load
  - MONITORINFO layout
  - EnumWindows
  - EnumDisplayMonitors
  - GetMonitorInfoW
  - DwmGetWindowAttribute
  - PostMessageW

Hardened Lite service workflow:
- run: `34661041324`
- result: success
- artifact: `10286748960`

### XENEON

Hardened full gate:
- run: `34660933437`
- result: success

Passed steps include:
- strict UTF-8 / JSON
- localhost port collision check
- static verification
- authored all-eight-layout interaction gate
- shipping all-eight-layout interaction gate
- official CORSAIR validation
- official CORSAIR package
- exact official package integrity/contract
- exact-package all-eight-layout regression
- lexical iCUE Custom Style regression
- no-callback autosync
- Corsair Labs host smoke
- StreamSpell all eight presets
- Unicode / emoji / descender / HTML-looking title safety
- corrupted persistence recovery
- safe-close confirmation
- lifecycle idempotence / pagehide cleanup

Official XENEON package artifact:
- artifact: `10287168322`
- package SHA-256: `d0fdcd3d53559eaf32c63b6c164e123e9283d88e175d638d225487c90ccdd50d`

### Cross-product

The exact officially packaged XENEON widget was also exercised against the actual Lite `xeneon-service.js` that ships. The path passed authentication, snapshot delivery, focus, minimize, maximize/restore, snap, monitor move, safe-close cancel/confirm and wrong-key rejection.

## Exact production Lite lifecycle

Private Windows lifecycle gate:
- run: `34667612648`
- job: `103482622370`
- result: **success**
- exact first-party archive SHA-256: `57d801cebb8c39a47680336d19f32719f99e50065df236acda3cd2356e11184a`

The gate reconstructs the exact PackRat-authored files from the final Lite package and then:

- validates the unchanged Lite action surface and Pro Marketplace upsell
- executes the exact shipping `win32.js` XENEON snapshot on Windows
- starts the exact shipping `xeneon-service.js` directly on Windows
- launches the real production `plugin.js` against a Stream Deck protocol WebSocket host
- verifies two plugin registrations
- verifies two global-settings reads
- verifies exactly one pairing-key persistence write
- verifies the generated pairing key is 48 characters
- stops the plugin and launches it a second time
- verifies the second launch starts the localhost service with the same persisted pairing key

This closes the production-entry-point lifecycle gap without changing the candidate binaries.

## Remaining honest boundary

Implementation and automated QA are complete. The remaining checks require the real customer environment:

1. install the exact Lite 1.0.0.3 package in the actual Windows Stream Deck desktop application as the final host-specific smoke
2. install the exact XENEON 1.0.0 package in iCUE on a physical XENEON Edge and smoke touch/readability plus real foreground/elevation behavior

These are real-runtime/hardware smokes, not missing implementation work.
