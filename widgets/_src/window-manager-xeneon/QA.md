# Window Manager for XENEON — QA contract

## Automated product QA

- static identity, paid-only metadata and localhost-only transport checks
- JavaScript syntax and safe-close routing checks
- all eight native XENEON viewports in Playwright
- overflow and minimum touch-target assertions
- deterministic six-window / three-monitor fixture
- focus, minimize, maximize/restore, snap left/right, move monitor, pin/unpin and confirmed close interaction tests
- disconnected, pairing, empty and no-active-window states
- Windows companion tests for layout geometry, local-origin policy, pairing rejection/acceptance and push snapshots
- self-contained Windows x64 companion publish

## Canonical XENEON release gate

After product QA passes, the branch synchronously dispatches and waits for:

1. `xeneon-widget-ci.yml` — inline build, official CORSAIR validate/package, exact-package integrity, lexical iCUE Custom Style regression, Corsair Labs Windows runner and StreamSpell all-eight-presets package preview.
2. `rat-art-xeneon.yml` — native slot captures and deterministic Rat Art.
3. `rat-ship-xeneon.yml` — official package, Rat Art, search icon, Maker Console kit and Rat Ship invariants.

## Deliberate remaining real-device boundary

Automated CI cannot prove how Windows foreground-lock rules or elevated target processes behave on a customer's interactive desktop, and it does not claim physical XENEON Edge touch/readability verification. Those are additional real-Windows/physical smokes, not substitutes for the automated gate.
