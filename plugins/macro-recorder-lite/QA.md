# Macro Recorder Lite QA

See `docs/MACRO_RECORDER_QA.md` for the family matrix.

Automated release gates are implemented in `.github/workflows/macro-recorder-ci.yml`.

Current release boundary: **TESTING**.

The current-main-synchronized automated candidate passed:
- source-contract: PASS
- Windows release: PASS
- Lite tests: 19/19
- production dependency audit: PASS
- official Elgato validation/package: PASS
- five generated device profiles: PASS
- exact-package teardown + notices: PASS

Remaining before `READY_TO_SHIP`:
- complete every real-host/native acceptance item in `docs/MACRO_RECORDER_NATIVE_GATE.json`
- verify the exact packaged artifact on Windows + physical Stream Deck
- publish/verify Macro Recorder Pro first and wire its exact direct Marketplace URL into the Lite upsell

Edition-specific host checks:
- keyboard down/up and modifiers
- rapid and slow sequences
- Windows key and right/extended keys
- cancellation and emergency-stop behavior
- 30-second / 60-event caps
- per-Replay-action persistence
- Pro feature boundary: no mouse, loops, speed or Macro Library
