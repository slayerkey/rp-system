# Window Manager for XENEON - QA contract

## Current architecture

Customer architecture:

```text
Window Manager for XENEON
  -> localhost protocol v1 on 127.0.0.1:17487
  -> free Window Manager Lite 1.0.0.3
  -> existing native Window Manager Win32 engine
  -> Windows
```

The standalone PackRat Window Bridge is retained only as historical protocol/native-reference evidence. It is not the intended customer dependency.

## Finished release candidates

### Window Manager Lite

Built from the exact uploaded 1.0.0.2 production package.

Candidate:
- version: `1.0.0.3`
- SHA-256: `731e3ccc1262344f4cef0773cbe3ea660c6573f77ab1ad0594f1d39e61908845`
- size: `1,693,823` bytes
- visible actions remain exactly:
  - Snap Window: `com.packrat.windowmanager.snap`
  - Cycle Windows: `com.packrat.windowmanager.cycle`
- existing Window Manager Pro Marketplace upsell remains present
- no Pro action UUIDs are exposed
- XENEON service registers no Stream Deck action
- Property Inspector adds XENEON Edge setup with pairing-key copy and local setup page controls

### Window Manager for XENEON

Candidate:
- version: `1.0.0`
- SHA-256: `0d3f618024374955a186b3b05591fb6c16257d377e2453c94d00d5b88fd1978c`
- size: `15,662` bytes
- direct Window Manager Lite Marketplace install/update link is shown during pairing/disconnected/version-mismatch setup states

## Passing automated/local gates

- exact Lite baseline captured before modification
- Lite -> Pro conversion guard
- JavaScript syntax for plugin, Win32 adapter, XENEON service and Property Inspector scripts
- ZIP integrity of updated Lite package
- localhost-only service
- protocol v1
- fixed-time pairing-key comparison
- 64 KiB WebSocket message cap
- narrow command allowlist
- snapshot normalization
- correct-key authentication
- wrong-key rejection
- protocol mismatch rejection
- arbitrary-command rejection
- focus/minimize/maximize-restore/snap-left/snap-right/move-monitor/close command routing
- no shell/process execution API
- direct XENEON -> Lite Marketplace setup affordance
- XENEON candidate ZIP integrity

Existing XENEON QA retained from earlier full gates:
- all eight XENEON viewports
- overflow and touch-target checks
- active/empty/disconnected/pairing/version-mismatch states
- safe close confirmation
- pinned-app persistence recovery
- Unicode/emoji/descender/HTML-looking titles
- remote icon URI rejection
- repeated iCUE lifecycle idempotency
- pagehide cleanup
- lexical Custom Style regression
- no-callback iCUE autosync
- official CORSAIR package validation on the pre-link package
- Corsair Labs host smoke on the previous bridge-backed package
- StreamSpell all-eight-presets verification

## Remaining real-runtime boundary

The software release candidates are built. Before claiming hardware verification, still perform:

1. install the exact Lite 1.0.0.3 candidate in the Windows Stream Deck application and confirm its hidden localhost service starts from the real plugin lifecycle
2. connect the exact XENEON candidate and smoke focus/minimize/maximize/snap/move/close against real desktop windows, including expected Windows elevation restrictions
3. perform physical XENEON Edge touch/readability testing when hardware is available

These are real-runtime/hardware smokes, not missing implementation work.
