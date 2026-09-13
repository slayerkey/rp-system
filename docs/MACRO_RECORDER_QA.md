# Macro Recorder Family QA

Date: 2026-09-12

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
| Very slow sequence | yes | yes | duration cap model | physical smoke |
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
| Stuck-key prevention | yes | yes | tracked down-state + finally + crash recovery | modifier interruption smoke |
| Crash during playback | yes | yes | plugin recovery release command | forced helper-kill smoke |
| Loop cancellation | no | yes | mode normalization + host cancellation | count/held/toggle smoke |
| Very long recording | no | yes | 10 min / 25k caps | shortened stress + max-boundary smoke |
| Corrupt saved macro | action settings normalize | yes | Pro library recovery preserves .corrupt backup | corrupt-file smoke |

## Release boundary

Automated QA can establish build, package, profile and deterministic engine invariants. It cannot honestly prove low-level hook behavior, DPI behavior or physical Stream Deck interruption on a hosted CI desktop.

Do not call the family READY_TO_SHIP until the final Windows host + physical Stream Deck matrix is completed against the exact packaged artifacts produced by the passing workflow.
