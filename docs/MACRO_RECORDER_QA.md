# Macro Recorder Family QA

Date: 2026-09-13

## Automated gates

The release workflow must pass on Windows:
- .NET 8 build of the shared PackRat.InputHost as a self-contained single-file Windows executable
- input-host selftest
- input-host daemon startup + JSON ping
- npm ci and production dependency audit for Lite and Pro
- model / limits / import-export unit tests
- deterministic starter-profile generation
- Rollup bundle
- official Elgato CLI manifest validation
- official Elgato CLI package generation
- package and profile artifact checks

## Behavioral test matrix

| Case | Lite | Pro | Automated coverage | Final host / device check |
| --- | --- | --- | --- | --- |
| Modifiers | yes | yes | timeline normalization + unmatched-key analysis | Ctrl/Shift/Alt physical smoke |
| Simultaneous key combinations | yes | yes | down/up order fixtures | Ctrl+C, Ctrl+Shift+key |
| Key-down / key-up correctness | yes | yes | unit test + cleanup model | physical smoke |
| Rapid key sequence | yes | yes | event cap / ordering model | physical smoke |
| Very slow sequence | yes | yes | duration cap model | physical smoke, including an idle gap over 60 seconds |
| Recording cancellation | yes | yes | protocol path | Stream Deck + PI cancel |
| Windows key | yes | yes | native VK path | physical smoke |
| Mouse click | no | yes | native host code path | physical smoke |
| Mouse drag | no | yes | down/move/up event model | physical smoke |
| Wheel / horizontal wheel | no | yes | event model | physical smoke |
| Multi-monitor mouse | no | yes | virtual-screen SendInput implementation | 2-monitor Windows host |
| DPI scaling | no | yes | screen-coordinate implementation | 100%, 125%, 150% smoke |
| Interrupted playback | yes | yes | cancellation + finally cleanup | Stop key during macro |
| Stream Deck restart | yes | yes | persisted action settings / local library | restart smoke |
| User changes app mid-macro | yes | yes | coordinate modes deterministic | app-switch smoke |
| Stuck-key prevention | yes | yes | tracked down-state + finally + local held-input crash-recovery journal | modifier interruption smoke |
| Crash during playback | yes | yes | exact held-input journal + bounded one-restart recovery path | forced helper-kill smoke |
| Loop cancellation | no | yes | mode normalization + host cancellation | count/held/toggle smoke |
| Very long recording | no | yes | 10 min / 25k caps | shortened stress + max-boundary smoke |
| Corrupt saved macro | action settings normalize | yes | Pro library recovery preserves .corrupt backup | corrupt-file smoke |

## Native release blockers

The complete native input safety and timing blocker list is maintained in `docs/MACRO_RECORDER_NATIVE_RELEASE_BLOCKERS.md`. Machine-readable release state lives in `docs/MACRO_RECORDER_NATIVE_GATE.json`, and the local implementation handoff is `docs/MACRO_RECORDER_NATIVE_FIX_HANDOFF.md`. These blockers must be resolved before either edition is READY_TO_SHIP.

## Native timing blocker

The editor/model/import/playback path now permits Pro delays up to the full 10-minute edition boundary. The remaining issue is native capture: the current recorder still clamps any single observed delay between two input events to 60 seconds.

Before shipping Pro, update native recording capture so an idle gap over 60 seconds is preserved accurately up to the recording-duration limit, then run the host smoke case documented in `docs/MACRO_RECORDER_NATIVE_RELEASE_BLOCKERS.md`.

## Release boundary

Automated QA can establish build, package, profile and deterministic engine invariants. It cannot honestly prove low-level hook behavior, DPI behavior or physical Stream Deck interruption on a hosted CI desktop.

Do not call the family READY_TO_SHIP until the final Windows host + physical Stream Deck matrix is completed against the exact packaged artifacts produced by the passing workflow.


## Current hosted-runner infrastructure blocker

As of 2026-09-13, the current-head Macro Recorder workflow rerun is still being created by GitHub Actions without receiving a hosted runner. Run `34741738309`, attempt 2, produced a `windows-release` job with no assigned runner and zero steps. Other unrelated repository workflows have shown the same no-runner symptom.

This is not evidence that Macro Recorder tests failed. On that attempt, no test or build process started.

Until hosted runners are available again, run the equivalent local automated gate on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1
```

The product remains TESTING until either that local automated gate or the canonical hosted workflow completes successfully, followed by the real Windows / physical Stream Deck smoke matrix.


## Final release-candidate command

After the native gate is truthfully marked ready and the native smoke matrix has passed:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate
```

This mode refuses release-candidate status while any native gate remains false.
