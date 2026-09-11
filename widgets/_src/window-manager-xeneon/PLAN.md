# Window Manager for XENEON — implementation plan

## Platform ceiling

A normal XENEON/iCUE widget is an HTML/JavaScript surface. It cannot honestly enumerate arbitrary native Windows HWNDs or invoke Win32 placement APIs by itself. The product therefore uses the established PackRat widget-to-localhost pattern with the smallest dedicated Windows companion required for native desktop control.

## Architecture

- Paid XENEON widget: touch UI, pins, settings, safe-close confirmation, local presentation state.
- Free PackRat Window Bridge: native Win32 enumeration/control and app-icon extraction.
- Transport: authenticated WebSocket on `127.0.0.1:17484` only.
- Pairing: random key generated locally and stored in `%LOCALAPPDATA%\PackRat\WindowBridge\bridge-key.txt`.
- Update model: WinEvent notifications are debounced for fast push updates; a 5-second reconciliation scan catches missed changes. The widget never polls the desktop.
- No cloud account, telemetry, remote API, injected DLL or privileged service.

## UI

Horizontal slots are a scrollable visual desktop strip with pinned apps separated from the active window list and a dedicated touch action rail. Vertical slots switch to a stacked window list with the same actions. All eight XENEON slot sizes get explicit rules.

## Release proof

Deterministic browser fixtures cover window lists, three-monitor states, active-state clearing, all actions, safe close and all eight layouts. Windows CI covers companion layout math, origin/pairing policy and end-to-end fixture WebSocket commands. The canonical XENEON exact-package, lexical settings, Corsair Labs, StreamSpell, Rat Art and Rat Ship workflows run after product QA.
