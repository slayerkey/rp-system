# Macro Recorder Lite QA

See `docs/MACRO_RECORDER_QA.md` for the family matrix.

Automated release gates are implemented in `.github/workflows/macro-recorder-ci.yml`.

Current release boundary: **TESTING**. Hosted CI is currently not receiving a runner, so use `plugins/macro-recorder-pro/run-family-qa.ps1` as the automated Windows fallback. The native blockers in `docs/MACRO_RECORDER_NATIVE_RELEASE_BLOCKERS.md` and the exact packaged-artifact Windows + physical Stream Deck smoke matrix must also pass before READY_TO_SHIP.

Edition-specific host checks:
- keyboard down/up and modifiers
- rapid and slow sequences
- Windows key
- cancellation
- 30-second / 60-event caps
- per-Replay-action persistence
- Pro feature boundary: no mouse, loops, speed or Macro Library
