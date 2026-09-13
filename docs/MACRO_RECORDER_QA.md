# Macro Recorder Family QA

Date: 2026-09-13

## Automated gates

The release workflow must pass on Windows:
- .NET 8 build of the shared PackRat.InputHost as a self-contained single-file Windows executable
- input-host selftest
- input-host daemon startup + JSON ping
- npm ci and production dependency audit for Lite and Pro
- model / limits / import-export unit tests
- deterministic five-device starter-profile generation (MK.2 / standard, Mini, XL, Plus, Neo)
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


## Automated Windows release evidence

The canonical Windows release workflow passed on 2026-09-13:

- workflow run: `34777365333`
- tested head: `2f6aa418ffbbbd4927034689d224c6dccd3b1b0b`
- Lite tests: **19/19 passed**
- Pro tests: **37/37 passed**
- both production dependency audits: PASS
- native `PackRat.InputHost` Release win-x64 build + self-test + daemon ping: PASS
- both official Elgato validations: PASS
- both official Elgato packages: PASS
- five bundled profiles per edition (MK.2 / standard, Mini, XL, Plus, Neo): PASS
- exact-package helper / Property Inspector / runtime notices / profile teardown: PASS
- deterministic source media + Rat Ship six-file media adapters: PASS
- Lite package SHA-256: `01DFA188482FEF0E8F735F7408879C5B0AE77EEDE8D8961765792AB81E9F009A`
- Pro package SHA-256: `B5D7C15C0B94E75A0900037EA36F1593168AE092A909F2386E00275D3972DCAF`
- uploaded release-evidence artifact: `10324027648`
- artifact digest: `sha256:d54960f0be72105341d33810cd13e3eb8a5eadea909ca39c53eaa43ae91c62cd`

The later workflow-only source-contract addition does not change the plugin/native build inputs represented by this evidence.

The family remains **TESTING** because low-level input guarantees still require the real Windows / physical Stream Deck acceptance cases in `docs/MACRO_RECORDER_NATIVE_GATE.json`. Lite also remains blocked from public launch until the real Macro Recorder Pro Marketplace product URL exists and is injected through the canonical Lite-to-Pro catalog.

## Final release-candidate command

After the native gate is truthfully marked ready and the native smoke matrix has passed:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate
```

This mode refuses release-candidate status while any native gate remains false.
