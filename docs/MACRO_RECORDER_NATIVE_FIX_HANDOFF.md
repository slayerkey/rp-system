# Macro Recorder Native Fix Handoff

Use this when continuing the Macro Recorder family on a local Windows machine / local Codex environment with access to the full repository and Windows build tools.

## Repository / branch

- Repository: `slayerkey/rp-system`
- Branch: `product/macro-recorder`
- Do not merge to `main` until the complete release gate passes.

## Read first

1. `RATPACK.md`
2. `STREAMDECK.md`
3. `skills/rat-build/SKILL.md`
4. `skills/rat-qa/SKILL.md`
5. `skills/rat-ship/SKILL.md`
6. `docs/MACRO_RECORDER_QA.md`
7. `docs/MACRO_RECORDER_NATIVE_RELEASE_BLOCKERS.md`
8. `docs/MACRO_RECORDER_NATIVE_GATE.json`
9. `shared/windows-input/PackRat.InputHost/Program.cs`
10. `shared/macro-recorder/model.mjs`
11. `shared/macro-recorder/runtime.mjs`

## Scope

Do not redesign the product and do not change the Lite/Pro commercial split.

The remaining work is the native Windows input helper plus real host/device validation.

Keep:
- Lite: keyboard only, 30 seconds, 60 events, free
- Pro: keyboard + mouse, 10 minutes, 25,000 events, $7.99
- local-only macro data
- Ctrl+Shift+F12 emergency stop
- exact held-input crash-recovery journal
- no scripting language
- no anti-AFK / gameplay farming / cheat examples

## Required native fixes

### 1. Recover held input before hook startup

Current startup calls hook initialization before crash recovery.

Change startup order so the held-input journal is read and recovery releases are attempted before global keyboard/mouse hooks are installed.

Recovery must not depend on hook installation succeeding.

### 2. Never clear held-input recovery state before releases are attempted

Current cleanup snapshots held keys/buttons, clears the tracked state + recovery journal, then sends release events.

Change the order:

1. snapshot exact held inputs
2. leave recovery journal intact
3. send key-up / mouse-up events
4. confirm each `SendInput` call succeeded
5. only then remove successfully released inputs from tracked state and rewrite/clear the journal

If a release fails or the process dies during cleanup, enough journal state must remain for the next launch to retry.

Do not solve this by releasing every possible key or mouse button. Recovery must remain exact to inputs the helper itself injected.

### 3. Journal persistence must fail closed before held input injection

Current journal writes suppress filesystem failures.

For a key-down or mouse-button-down:

1. update intended held state
2. persist that intended held state successfully
3. only then call `SendInput`

If persistence fails:
- roll back the in-memory held state
- do not inject the down event
- stop playback with an error

For matching key-up / mouse-up:
- send the release
- only remove it from the journal after successful release

Have `Native.SendKey`, `Native.SendMouseButton`, mouse movement, and wheel helpers return whether `SendInput` accepted the event where useful for safe cleanup/error reporting.

### 4. Preserve exact keyboard descriptors for interrupted cleanup

The current held-key set and recovery journal store only the virtual-key integer.

Change held-key tracking so each injected keyboard down remembers the descriptor needed to release that exact key later, including:
- virtual key
- scan code
- extended-key flag

Use that descriptor for:
- cancellation cleanup
- error cleanup
- normal final cleanup
- next-launch crash recovery

Do not assume `SendKey(vk, 0, true, false)` is an exact release for every injected extended/right-side key.

### 5. Preserve Pro recorded idle gaps beyond 60 seconds

Native capture currently clamps one recorded delay to 60,000 ms.

The JS model/editor/import/playback path already permits:
- Lite: up to 30,000 ms, matching its total recording limit
- Pro: up to 600,000 ms, matching its total recording limit

Native recording must preserve a Pro idle gap longer than 60 seconds accurately up to the remaining total recording duration.

Do not reduce the advertised 10-minute Pro limit.

### 6. Only reserve Ctrl+Shift+F12 during active playback

The current hook consumes the Ctrl+Shift+F12 key-down whenever the helper is running.

Change the hook so:
- active playback: Ctrl+Shift+F12 stops playback and consumes the emergency combination
- no active playback: do not intercept the combination
- recording without playback: do not create a partial Ctrl/Shift-only capture because F12 was suppressed

Keep Ctrl+Shift+F12 as the documented emergency playback fallback, but do not reserve it globally while idle.

### 7. Tie helper lifetime to the Stream Deck plugin process

A graceful Node shutdown calls `host.close()`, but the helper must also handle abrupt parent death.

Implement either:
- a Windows Job Object / kill-on-parent-close pattern, or
- pass the Node parent PID to `PackRat.InputHost.exe` and have the helper watch it

Requirements:
- parent death causes prompt helper shutdown
- no orphaned global hooks
- do not destroy crash-recovery journal evidence before held inputs are safely released/recoverable

### 8. Coordinate Lite and Pro with one cross-process active-session lock

Both editions may be installed simultaneously and each bundles its own helper.

Use a Windows named mutex or equivalent user-session-wide primitive around active recording/playback.

Requirements:
- at most one active PackRat Macro Recorder record/play session across Lite + Pro
- clean error when lock is busy
- release on stop/cancel/completion/error/shutdown
- safe abandoned mutex recovery after a crash
- do not prevent both plugin helpers from existing idle; only active input work must be exclusive
- guard the shared `%LOCALAPPDATA%\PackRat\InputHost\held-input.json` with the same mutex
- never perform held-input journal recovery while another helper owns the session mutex
- once this helper owns the mutex, recover any stale journal before injecting or recording new input
- treat an abandoned mutex as crash ownership transfer: acquire it, recover stale held input, then continue
- starting the idle helper for the other edition must never release/delete a live journal owned by the active edition

This also makes the playback-only Ctrl+Shift+F12 emergency hook deterministic across the product family and prevents cross-edition crash-recovery corruption.

## Native safety constraints

- Ignore injected hook events so playback is not re-recorded.
- No failure path may intentionally leave a key or mouse button held.
- Do not release unrelated user-held physical inputs as a blanket recovery strategy.
- Keep Per-Monitor-V2 / virtual-desktop coordinate behavior intact.
- Keep Secure Desktop claims conservative. Ordinary password fields cannot be identified reliably.
- Keep everything local.

## Required automated/local gate

From repo root on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1
```

This must pass before physical smoke testing.

## Required native host tests

Test against the exact helper/plugin artifacts produced by the passing build:

- Ctrl / Shift / Alt down-up
- Windows key
- rapid repeat
- Stop action during playback
- Ctrl+Shift+F12 during playback
- forced helper kill while an injected modifier is held
- forced helper kill while an injected mouse button is held
- cancellation while Right Ctrl / Right Alt or an extended navigation key is held
- restart and verify exact recovery
- make the recovery journal path unwritable and verify down-event injection fails closed
- left/right/middle/X1/X2 mouse buttons
- drag
- vertical + horizontal wheel
- two monitors including negative virtual-screen coordinates
- 100%, 125%, 150% DPI
- active-window-relative playback
- Pro recording with one idle gap over 60 seconds
- 10-minute overall Pro recording boundary
- Stream Deck restart persistence
- count, while-held, and toggle loop cancellation
- corrupt Macro Library backup/recovery

## Updating the gate

Only after all four native blockers are fixed and the required native smoke cases pass:

1. update `docs/MACRO_RECORDER_NATIVE_GATE.json`
2. set each blocker boolean to `true`
3. set `ready` to `true`
4. update `updated_at`
5. update `docs/MACRO_RECORDER_QA.md` with concrete evidence

Then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\plugins\macro-recorder-pro\run-family-qa.ps1 -ReleaseCandidate
```

That command must pass before either product moves to `READY_TO_SHIP`.

## Shipping boundary

Do not run:

```powershell
rat ship macro-recorder-lite
rat ship macro-recorder-pro
```

until the release-candidate gate and physical Stream Deck smoke matrix are both clean.

Do not mark tests as passed unless they actually ran.
