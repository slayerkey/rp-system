# Macro Recorder Pro QA

See `docs/MACRO_RECORDER_QA.md` for the family matrix.

Automated release gates are implemented in `.github/workflows/macro-recorder-ci.yml`.

Current release boundary: **TESTING**.

The current-main-synchronized automated candidate passed:
- source-contract: PASS
- Windows release: PASS
- Pro tests: 37/37
- production dependency audit: PASS
- official Elgato validation/package: PASS
- five generated device profiles: PASS
- exact-package teardown + notices: PASS

Remaining before `READY_TO_SHIP`:
- complete every real-host/native acceptance item in `docs/MACRO_RECORDER_NATIVE_GATE.json`
- verify the exact packaged artifact on Windows + physical Stream Deck

Edition-specific host checks:
- keyboard down/up and modifiers
- right/extended keyboard cleanup
- left/right/middle/X mouse buttons
- drag and vertical/horizontal wheel
- multi-monitor coordinates and negative virtual desktop positions
- active-window-relative positioning
- 100%, 125%, 150% DPI
- 0.25x / 1x / 4x speed
- count / while-held / toggle loops
- library persistence, duplicate, edit, import/export
- 10-minute / 25,000-event caps
- corrupt library recovery
- one idle gap over 60 seconds
- parent-death, family-lock, journal, and `SendInput` failure acceptance
