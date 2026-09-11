# Window Manager for XENEON - QA contract

## Current architecture state

Target customer architecture:

```text
Window Manager for XENEON
  -> localhost protocol v1 on 127.0.0.1:17487
  -> free Window Manager Lite Stream Deck plugin
  -> existing native Window Manager engine
  -> Windows
```

The previous standalone PackRat Window Bridge remains only as a protocol/native reference during this refactor. It is not the intended final customer dependency.

The product is intentionally **not READY_TO_SHIP** until the actual Window Manager Lite source is migrated and the exact Lite package passes the gates below.

## XENEON automated QA already retained

- static identity and paid XENEON metadata
- JavaScript syntax and safe-close routing
- all eight native XENEON viewports in Playwright
- overflow and minimum touch-target assertions
- deterministic six-window / four-monitor fixture
- focus, minimize, maximize/restore, snap left/right, move monitor, pin/unpin and confirmed close
- disconnected, pairing, protocol-mismatch, empty and no-active-window states
- malformed and legacy pinned-app storage recovery
- Unicode, emoji, descenders and HTML-looking titles
- data-image-only icon URI allowlist
- repeated iCUE lifecycle idempotency
- pagehide cleanup
- lexical iCUE Custom Style regression
- no-callback iCUE autosync regression
- official CORSAIR package validation
- Corsair Labs host smoke
- StreamSpell all-eight-presets package verification

## New Window Manager Lite service gate

`shared/window-manager-xeneon-service/` is the hidden localhost service intended to run inside the existing Lite plugin process.

Automated contract tests cover:

- localhost-only HTTP/WebSocket service
- local/file origin policy
- protocol v1
- fixed-time pairing-key comparison
- narrow command allowlist
- normalized windows/monitors/active-window snapshot
- wrong-key rejection
- protocol mismatch
- service restart/reconnect
- exact official XENEON package communicating with the Lite-hosted service
- all XENEON window commands against the service fixture
- zero Stream Deck action registration by the shared service

## Lite -> Pro conversion guard

Before modifying the actual Window Manager Lite source, capture its current shipped manifest and Property Inspector as the baseline.

After integration, run:

`tools/qa/window-manager-lite-conversion-guard.mjs`

The final Lite update must prove:

- visible Lite action UUID/name set is unchanged
- Window Manager Pro upsell URL is still present
- no Pro action is added to Lite
- the hidden XENEON service registers no Stream Deck action
- the XENEON setup affordance does not replace or weaken the Pro upsell

## Required final exact-Lite gate

These items are still required before release status can be restored:

1. migrate the actual Window Manager Lite source into canonical GitHub
2. integrate the shared service with Lite's existing native window engine
3. preserve the exact visible Lite action surface
4. preserve the existing Window Manager Pro upsell
5. build and officially validate the updated Lite `.streamDeckPlugin`
6. launch the exact updated Lite package/backend on Windows
7. connect the exact official XENEON `.icuewidget` to that running Lite service
8. run focus/minimize/maximize/snap/move/close, restart, wrong-key and protocol-mismatch integration
9. rerun all XENEON host/layout/package gates
10. regenerate Rat Art and Rat Ship only after all above are green

## Deliberate remaining real-device boundary

Even after the exact Lite package gate passes, automated CI cannot prove every Windows foreground-lock/elevation case or physical XENEON Edge touch/readability behavior. Those remain additional real-Windows/physical smokes, not substitutes for the automated release gate.
