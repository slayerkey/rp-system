# Window Manager for XENEON — QA contract

## Automated product QA

- static identity, paid-only metadata and localhost-only transport checks
- JavaScript syntax and safe-close routing checks
- all eight native XENEON viewports in Playwright
- overflow and minimum touch-target assertions
- deterministic six-window / four-monitor fixture
- focus, minimize, maximize/restore, snap left/right, move monitor, pin/unpin and confirmed close interaction tests
- disconnected, pairing, protocol-mismatch, empty and no-active-window states
- Windows companion tests for layout geometry, local-origin policy, pairing rejection/acceptance and push snapshots
- self-contained Windows x64 companion publish
- exact customer companion ZIP install from the release layout into `%LOCALAPPDATA%\PackRat\WindowBridge`
- per-user Startup shortcut creation and localhost health verification from the installed executable
- exact installed-process shutdown with bounded wait before update/uninstall
- retrying fail-closed removal of the install directory and Startup shortcut
- exact published GitHub Release ZIP re-download, SHA-256 equality check, install smoke and uninstall smoke

## Canonical XENEON release gate

After product QA passes, the branch synchronously dispatches and waits for:

1. `xeneon-widget-ci.yml` — inline build, official CORSAIR validate/package, exact-package integrity, lexical iCUE Custom Style regression, Corsair Labs Windows runner and StreamSpell all-eight-presets package preview.
2. `rat-art-xeneon.yml` — native slot captures and deterministic Rat Art.
3. `rat-ship-xeneon.yml` — official package, Rat Art, search icon, Maker Console kit and Rat Ship invariants.

## Deliberate remaining real-device boundary

Automated CI cannot prove how Windows foreground-lock rules or elevated target processes behave on a customer's interactive desktop, and it does not claim physical XENEON Edge touch/readability verification. Those are additional real-Windows/physical smokes, not substitutes for the automated gate.

## Troubleshooting playbook regressions

- malformed and legacy pinned-app storage recovery
- Unicode, emoji, descenders and HTML-looking window titles rendered as text
- only data:image icon URIs accepted by the widget
- repeated lifecycle callbacks remain idempotent
- no product-local settings polling loop; canonical iCUE binding autosync owns live settings
- pagehide cleanup prevents reconnect/timer leaks
- bridge restart and protocol mismatch are explicit states
- port collision regression protects 17487 from reuse by this product
