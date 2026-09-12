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

## Remaining honest boundary

Implementation and automated QA are complete. The remaining checks require the real customer environment:

1. install the exact Lite 1.0.0.3 package in the user's Windows Stream Deck desktop application and confirm the hidden service starts through the real Stream Deck plugin lifecycle
2. install the exact XENEON 1.0.0 package in iCUE on a physical XENEON Edge and smoke touch/readability plus real foreground/elevation behavior

These are real-runtime/hardware smokes, not missing implementation work.
