# Window Manager Lite XENEON service

This folder is **internal shared infrastructure**, not a separate customer product.

Target architecture:

```text
Window Manager for XENEON
        ↓  ws://127.0.0.1:17487/widget
Window Manager Lite plugin process
        ↓
existing Window Manager native engine
        ↓
Windows
```

## Business boundary

Window Manager Lite remains Lite.

This module does **not** register Stream Deck actions, unlock Pro actions, add Pro property-inspector controls, or change the Lite action list. It only lets the separately purchased XENEON product reuse the native Windows engine that already runs inside the free Lite plugin.

The existing Lite → Pro upgrade surface must remain intact.

## Integration contract

Window Manager Lite starts this service from its existing plugin entry point on Windows and injects its existing window engine:

```js
const xeneon = await startWindowManagerXeneonService({
  backend: {
    snapshot: () => windowEngine.snapshotForXeneon(),
    execute: (command) => windowEngine.executeXeneonCommand(command),
    subscribe: (callback) => windowEngine.onChanged(callback),
  },
  pairingKey: await getOrCreateXeneonPairingKey(),
  pluginVersion: PLUGIN_VERSION,
});
```

The adapter deliberately accepts only:

- focus
- minimize
- maximize/restore
- snap left/right
- move to a detected monitor
- close

It does not expose arbitrary process execution, shell commands, generic hotkeys, profiles, Pro settings, or an automation API.

## Pairing

The Lite plugin should generate one random per-user XENEON pairing key and keep it in its normal local plugin/global settings. The existing Lite Property Inspector may add a small **XENEON setup** section that copies this key or opens `http://127.0.0.1:17487/`.

Do not remove, weaken, or replace the existing **Upgrade to Window Manager Pro** surface.

## Why localhost remains

The CORSAIR iCUE widget runtime can render the XENEON UI but does not expose arbitrary Win32 window enumeration or placement APIs. The native work therefore stays in Window Manager Lite's already-running Stream Deck plugin process instead of requiring a second PackRat EXE.

## Port and protocol

- loopback: `127.0.0.1`
- port: `17487`
- WebSocket: `/widget`
- health: `/health`
- setup: `/`
- protocol: `1`

Keeping the existing protocol means the XENEON product can retain its exact-package and interaction regressions while the customer dependency changes from a standalone bridge to Window Manager Lite.
