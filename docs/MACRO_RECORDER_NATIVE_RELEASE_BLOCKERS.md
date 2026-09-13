# Macro Recorder Native Release Blockers

Date: 2026-09-13

These items are required before Macro Recorder Lite or Pro can move to READY_TO_SHIP.

The connected GitHub write path could not safely modify the native Windows input source during this session, so these requirements are intentionally recorded as unresolved rather than being represented as completed.

## 1. Recover held input before hook startup

Current startup initializes global input hooks before calling crash recovery.

Required behavior:
- read the local held-input journal first
- send recovery releases before installing recording hooks
- only then initialize keyboard/mouse hooks

Reason:
If a prior playback crashed while holding an injected key or mouse button, recovery must not depend on hook installation succeeding on the next launch.

Acceptance:
- force-kill the helper while an injected modifier is held
- make the next hook initialization fail in a controlled test
- verify the recovery release is still attempted before the hook failure ends the process

## 2. Keep the recovery journal until release events are sent

Current normal cleanup clears the in-memory held set and recovery journal before it sends key-up / mouse-up cleanup events.

Required behavior:
- snapshot held inputs
- keep the journal intact
- send all cleanup release events
- only after successful release attempts, clear the held state and journal
- if cleanup cannot be confirmed, leave enough journal state for the next helper launch to retry

Reason:
A crash after clearing the journal but before sending the release events can otherwise leave an input stuck with no recovery record.

Acceptance:
- interrupt the helper during cleanup between journal handling and release
- restart it
- verify the recorded held inputs are released

## 3. Do not fail open if the held-input journal cannot be written

Current journal persistence suppresses file-system write errors.

Required behavior:
- before injecting a key-down or mouse-button-down that may remain held, persist the intended held state successfully
- if persistence fails, do not inject the down-event
- surface a playback error and stop safely

Reason:
The stuck-input guarantee depends on the journal existing before a held input is injected.

Acceptance:
- make the journal directory/file unwritable
- start a macro containing a held modifier or mouse-button-down
- verify playback stops before injecting the held state

## 4. Preserve the exact keyboard descriptor for cleanup and crash recovery

Current held-key tracking and the recovery journal keep only a virtual-key integer. Interrupted-playback cleanup then sends a generic key-up with scan code 0 and `extended=false`.

Required behavior:
- when a keyboard down-event is successfully injected, track enough information to release that exact injected key later
- preserve at minimum the virtual key, scan code, and extended-key flag used for the down-event
- persist the same exact descriptor in the crash-recovery journal
- normal cancellation cleanup and next-launch crash recovery must use that stored descriptor
- do not collapse distinct injected held keys into an ambiguous generic modifier release

Reason:
Extended/right-side keys can require different injection flags from their left/non-extended counterparts. The stuck-input guarantee must not depend on a generic VK-only key-up matching every injected key.

Acceptance:
- cancel playback while Right Ctrl / Right Alt and representative extended navigation keys are held
- force-kill the helper while one of those injected keys is held, restart it, and verify the exact key is released
- verify cleanup does not release unrelated physical keys

## 5. Preserve Pro idle gaps longer than 60 seconds

Current native recording clamps a single delay between events to 60 seconds even though Pro supports recordings up to 10 minutes.

Current non-native status:
- Lite editor/model remains bounded by its truthful 30-second edition limit
- Pro editor/import/playback now accepts a single delay up to the full 10-minute edition limit

Required native behavior:
- Pro recording capture must preserve a single idle gap accurately up to the 10-minute total recording limit

Acceptance:
- Pro: record event A, wait more than 60 seconds, record event B, stop
- verify the timeline contains the real gap rather than 60 seconds
- replay and verify timing within normal scheduling tolerance

## 6. Only intercept Ctrl+Shift+F12 while playback is active

The low-level keyboard hook currently intercepts Ctrl+Shift+F12 whenever the helper is running, even when no playback exists.

Required behavior:
- if playback is active, Ctrl+Shift+F12 cancels playback and may consume the hotkey
- if playback is idle, the helper must not reserve or swallow Ctrl+Shift+F12
- while recording with no playback active, the emergency playback hotkey must not create a partial Ctrl/Shift-only recording artifact

Reason:
The helper remains alive after first use. A playback emergency shortcut should not become a permanent global keyboard reservation while Macro Recorder is idle.

Acceptance:
- start the helper, leave playback idle, press Ctrl+Shift+F12, and verify the combination is not swallowed by Macro Recorder
- record a macro and press Ctrl+Shift+F12 without active playback; verify the capture is not corrupted by a suppressed F12 down-event
- during playback, verify Ctrl+Shift+F12 still cancels immediately

## Final native smoke matrix

After all six fixes:
- Ctrl / Shift / Alt down-up
- Windows key
- rapid key repeat
- Stop action interruption
- Ctrl+Shift+F12 interruption
- helper kill while modifier is held
- helper kill while mouse button is held
- forced cancellation while Right Ctrl / Right Alt or an extended navigation key is held
- journal directory unwritable
- left/right/middle/X mouse buttons
- drag and wheel
- 2-monitor negative/positive coordinates
- 100%, 125%, 150% DPI
- active-window-relative replay
- single idle gap over 60 seconds
- 10-minute overall Pro recording boundary

Do not run `rat ship macro-recorder-lite` or `rat ship macro-recorder-pro` until these native blockers and the rest of `docs/MACRO_RECORDER_QA.md` are clean.
