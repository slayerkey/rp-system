# Macro Recorder Native Acceptance Handoff

This file keeps its historical path so existing references remain valid. The native implementation is complete; this is now the handoff for final real-host acceptance.

## Repository / branch

- Repository: `slayerkey/rp-system`
- Branch: `product/macro-recorder`
- State: **TESTING**
- Do not merge or publicly ship until the acceptance gate is complete.

## Automated candidate already passed

Current-main-synchronized evidence:

- workflow run: `34777832830`
- tested head: `b91ed6e14e5b90ed97af2bed69b0dc0c39a7860f`
- source-contract: **PASS**
- Windows release: **PASS**
- Lite tests: **19/19**
- Pro tests: **37/37**
- production dependency audits: **PASS**
- native win-x64 build, self-test and daemon ping: **PASS**
- official Elgato validation/package: **PASS** for both editions
- five generated profiles per edition: **PASS**
- exact-package teardown and runtime notices: **PASS**
- Rat Ship media adapters: **PASS**
- Lite package SHA-256: `75F8ABD1829E72866B98D5FDC22DC9B5F65E1EBE5283D312D8F2A333C3D63965`
- Pro package SHA-256: `29DE0D65292ED42785BA5BB5EDEDD9577B2B07E2694B0DA997F6318FFF429051`
- release artifact: `10323523216`
- artifact digest: `sha256:350e2ff485add52a6591be0cf86ac14ef3755d65adc0bcc234647acbf864adf1`

## Native implementation already landed

The Windows helper now implements the release-safety architecture in `docs/MACRO_RECORDER_NATIVE_RELEASE_BLOCKERS.md`:

- recovery before hook startup when family ownership is available
- one cross-process active session across Lite + Pro
- shared journal access only by the active family-session owner
- exact VK / scan-code / extended-key descriptors for held keys
- journal-before-down fail-closed injection
- release-before-journal-removal cleanup
- durable empty held-state tombstone before best-effort deletion
- recorded delays up to the edition duration limit
- Ctrl+Shift+F12 interception only during playback
- plugin-parent PID watchdog
- checked `SendInput` results with clean UIPI failure reporting
- no blanket release of unrelated modifiers or mouse buttons

Regression contracts live in both editions at `tests/native-contract.test.mjs`.

## Remaining work: real-host acceptance only

Use `docs/MACRO_RECORDER_NATIVE_GATE.json` as the machine-readable checklist. Every blocker boolean remains false until the corresponding real-host evidence is actually observed.

Required acceptance includes:

- modifiers and Windows key down/up
- Stop action interruption
- Ctrl+Shift+F12 during playback
- Ctrl+Shift+F12 passes through while idle
- recording F12 without playback does not create a partial emergency-hotkey artifact
- forced helper crash while a key is held
- forced helper crash while a mouse button is held
- exact cleanup for Right Ctrl / Right Alt / extended navigation keys
- unwritable journal path fails closed before held-input injection
- click, drag, vertical wheel, horizontal wheel
- two-monitor virtual desktop including negative coordinates
- 100%, 125%, 150% DPI
- active-window-relative playback
- one recorded idle gap over 60 seconds
- 10-minute Pro recording boundary
- Stream Deck restart persistence
- count / while-held / toggle loop cancellation
- force-kill plugin parent and verify helper exits
- Lite + Pro cannot own simultaneous active sessions
- idle other-edition helper does not touch a live journal
- stale journal recovery after crashed owner
- forced `SendInput` rejection stops playback cleanly
- higher-integrity target fails cleanly with no stuck injected input

## Local release-candidate gate

From repo root on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1
```

After every real-host acceptance item is proven:

1. set the matching booleans in `docs/MACRO_RECORDER_NATIVE_GATE.json` to `true`
2. set `ready` to `true`
3. attach concrete host/device evidence
4. run:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate
```

Do not mark an acceptance case passed unless it actually ran.

## Marketplace sequence

Pro is the commercial anchor:

1. complete native/physical acceptance
2. move Pro to `READY_TO_SHIP`
3. merge the approved candidate to `main`
4. publish/create the real Macro Recorder Pro Marketplace listing
5. capture its exact direct product URL
6. update `products/lite-pro-map.json`, Lite `upgrade_url`, and Lite submission `pro_marketplace_url`
7. rebuild/retest Lite and verify its PI opens that exact URL
8. move Lite to `READY_TO_SHIP`

No guessed, search, creator, or generic Marketplace URL is acceptable.

## Shipping boundary

Do not run public submission yet:

```powershell
rat ship macro-recorder-pro
rat ship macro-recorder-lite
```

Current `main` correctly blocks public Rat Ship unless the product is explicitly `READY_TO_SHIP`.
