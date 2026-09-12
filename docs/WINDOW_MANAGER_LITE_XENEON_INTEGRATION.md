# Window Manager Lite -> XENEON integration contract

## Decision

Window Manager for XENEON will use the existing free **Window Manager Lite** Stream Deck plugin as its native Windows engine.

The standalone `PackRat Window Bridge` is no longer the target customer architecture. Keep its source/release only as historical protocol/native reference until the Lite migration is fully validated.

## Product boundary

Window Manager Lite **must remain Lite**.

This integration is an internal backend reuse, not a feature unlock for the Stream Deck edition.

The Lite update must not:

- add any new visible Stream Deck action
- expose a Pro-only action in the Lite action list
- remove or weaken the existing Window Manager Pro upsell
- add Pro property-inspector controls
- add a generic local automation API
- provide arbitrary hotkey, shell, process or profile execution through localhost

The XENEON service may expose only the window primitives required by the separately purchased XENEON product:

- enumerate normalized visible top-level windows
- enumerate normalized monitors
- foreground/active window state
- focus
- minimize
- maximize/restore
- snap left/right
- move to a detected monitor
- close

## Customer architecture

```text
Window Manager for XENEON (.icuewidget)
        |
        | ws://127.0.0.1:17487/widget
        v
Window Manager Lite Stream Deck plugin process
        |
        | existing Window Manager native engine
        v
Windows
```

No separate PackRat EXE should be required by the final customer flow.

## Shared service

The protocol/service implementation lives at:

`shared/window-manager-xeneon-service/`

Window Manager Lite should import/bundle that service into its normal plugin build and start it from its existing Windows plugin entry point.

The service itself registers **zero Stream Deck actions**.

Backend adapter shape:

```js
const xeneonService = await startWindowManagerXeneonService({
  backend: {
    snapshot: () => windowEngine.snapshotForXeneon(),
    execute: (command) => windowEngine.executeXeneonCommand(command),
    subscribe: (callback) => windowEngine.onChanged(callback),
  },
  pairingKey: await getOrCreateXeneonPairingKey(),
  pluginVersion: PLUGIN_VERSION,
});
```

Use the existing native implementation where possible. Do not create a second independent window-enumeration/control engine inside Lite.

## Pairing / setup

Keep protocol v1 and port 17487 so the already-tested XENEON package does not need a needless wire-protocol migration.

Window Manager Lite should create one random per-user pairing key and provide a small XENEON setup affordance in its Property Inspector or existing settings surface.

Acceptable setup UI:

- `XENEON setup`
- copy pairing key
- open local setup page
- short note that desktop data stays local

This setup section goes **alongside** the existing Pro upsell. It does not replace it.

## Conversion guard

Before modifying Window Manager Lite, capture the shipped Lite manifest and Property Inspector as a baseline.

After integration, CI must prove all of the following:

1. visible Lite action UUID set is byte-for-byte identical to the baseline
2. action names/titles visible in the Stream Deck action list are unchanged
3. existing Window Manager Pro Marketplace URL is unchanged:
   `https://marketplace.elgato.com/product/window-manager-pro-f3ed6217-0282-419d-a71d-4b1548147b11`
4. the Pro upsell remains present and clickable
5. no Pro-only action UUID is added to the Lite manifest
6. localhost service module registers no Stream Deck action
7. XENEON setup UI is subordinate to normal product settings and does not replace the upgrade surface

A version bump is expected because the plugin binary/backend changes, but the visible Lite product surface must not expand.

## Required end-to-end gate

Do not return Window Manager for XENEON to `READY_TO_SHIP` until the actual Lite source/package is available and this exact chain passes:

1. build Window Manager Lite
2. official Stream Deck CLI validation of the exact Lite package
3. conversion guard against the pre-change Lite action/upsell baseline
4. launch the exact Lite plugin backend/service on Windows
5. verify `/health` reports `PackRat Window Manager Lite`
6. load the exact official Window Manager XENEON package from `file://`
7. pair it to the running Lite service
8. test window snapshot, focus, minimize, maximize/restore, snap left/right, monitor move and confirmed close
9. test Lite/Stream Deck restart and XENEON reconnect
10. test wrong pairing key and protocol mismatch
11. rerun all eight XENEON layouts, lexical bindings, Corsair Labs, StreamSpell, Rat Art and Rat Ship

## Source migration blocker

The current canonical GitHub repository contains the live Window Manager Lite/Pro catalog relationship but **not the actual Lite plugin source**. Historical local project evidence points to the older `ratpack-projects` checkout.

Until that source is migrated into canonical GitHub, the shared service and XENEON side can be completed and tested against fixtures, but the final exact-Lite-package gate cannot honestly be claimed.
