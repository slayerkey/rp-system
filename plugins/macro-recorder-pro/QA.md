# Macro Recorder Pro QA

See `docs/MACRO_RECORDER_QA.md` for the family matrix.

Automated release gates are implemented in `.github/workflows/macro-recorder-ci.yml`.

Current release boundary: **TESTING**. Hosted CI is currently not receiving a runner, so use `plugins/macro-recorder-pro/run-family-qa.ps1` as the automated Windows fallback. The native blockers in `docs/MACRO_RECORDER_NATIVE_RELEASE_BLOCKERS.md` and the exact packaged-artifact Windows + physical Stream Deck smoke matrix must also pass before READY_TO_SHIP.

Edition-specific host checks:
- keyboard down/up and modifiers
- left/right/middle/X mouse buttons
- drag and wheel
- multi-monitor coordinates
- active-window-relative positioning
- 0.25x / 1x / 4x speed
- count / while-held / toggle loops
- library persistence, duplicate, edit, import/export
- 10-minute / 25,000-event caps
- corrupted library recovery

Additional native timing gate:
- record an idle gap over 60 seconds and verify the captured Pro timeline preserves the real delay
