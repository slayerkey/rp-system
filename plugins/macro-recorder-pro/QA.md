# Macro Recorder Pro QA

See `docs/MACRO_RECORDER_QA.md` for the family matrix.

Automated release gates are implemented in `.github/workflows/macro-recorder-ci.yml`.

Current release boundary: **TESTING** until the workflow passes and the exact packaged artifact completes the final Windows + physical Stream Deck smoke matrix.

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
