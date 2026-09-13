# Macro Recorder Lite QA

See `docs/MACRO_RECORDER_QA.md` for the family matrix.

Automated release gates are implemented in `.github/workflows/macro-recorder-ci.yml`.

Current release boundary: **TESTING** until the workflow passes and the exact packaged artifact completes the final Windows + physical Stream Deck smoke matrix.

Edition-specific host checks:
- keyboard down/up and modifiers
- rapid and slow sequences
- Windows key
- cancellation
- 30-second / 60-event caps
- per-Replay-action persistence
- Pro feature boundary: no mouse, loops, speed or Macro Library
