# Audio Manager Pro QA

Product: Audio Manager Pro  
Slug: audio-manager-pro  
Branch: product/audio-manager-pro  
Version: 1.0.0.0  
Price: $9.99

## Current release state

Workflow state: **READY_FOR_HARDWARE_QA**

Legacy automated status is intentionally back to **testing** until the changed PI/profile/key scope has fresh exact-head CI plus physical confirmation.

Do **not** mark `READY_TO_SHIP`, merge PR #174, or submit publicly until the remaining physical Windows + Stream Deck smoke passes.

Current candidate: **current `product/audio-manager-pro` head after the live-refresh, key-readability, and bundled-profile fixes**

The current candidate is a focused Property Inspector/profile repair on top of a target-machine candidate whose audio/native/install path already passed.

## Target-machine evidence already obtained

Candidate `665eb03e4571daaa06ae2bdc1331ce6651363b15` was installed on the real target Windows machine with:

- `rat dev audio-manager-pro`: PASS
- native .NET helper publish: PASS
- npm suite: **49 tests, 49 pass, 0 fail**
- official Elgato validation: PASS
- Stream Deck development link: PASS
- plugin restart: PASS
- `rat audit audio-manager-pro`: completed successfully with overall WARN only
- helper snapshot protocol: SUCCESS
- Windows Core Audio snapshot: **13 outputs · 5 inputs**
- PolicyConfig default-device switching: available
- Default output Console + Multimedia: aligned
- Default input Console + Multimedia: aligned
- Communications output/input: active
- all role endpoint IDs resolve to active endpoints

The only host-audit warning on that candidate was that no Audio Manager plugin log had been written yet.

This evidence proves the native helper, Windows audio enumeration/role layer, build, validation, link, and restart path. It does **not** prove the Property Inspector/profile workflow.

## Current Property Inspector/profile repair

The physical pass exposed one shared user-facing failure signature:

- Property Inspector HTML rendered
- command buttons appeared clickable but did not work reliably
- Audio Profile creation/selection did not work reliably
- action-level profile selection could therefore fail to persist
- native/helper audit remained healthy

Root cause boundary: Property Inspector transport/context handling, not Windows audio.

Current candidate hardening:

- manual PI WebSocket keeps callback UUID as `uiUuid`
- selected action instance is carried separately as `payload.actionContext`
- `getSettings`, `setSettings`, and `sendToPlugin` use the PI UUID envelope context
- plugin receives PI commands on the canonical global `streamDeck.ui.onSendToPlugin` channel
- request IDs correlate PI commands
- duplicate request IDs are suppressed before mutations
- PI responses use the global `streamDeck.ui.sendToPropertyInspector` channel
- startup and PI command/failure logging added
- Refresh / Capture / Save / Delete show visible progress/feedback
- host audit checks the PI transport contract
- regression tests lock the context/transport contract

The Audio Profile symptom is tested as part of the same chain:

**Capture exactly one profile → Save → select it for the action → close/reopen → selection persists → hardware key applies that exact immutable profile ID → Delete a throwaway profile.**

Do not debug profile storage or native audio separately until this chain passes.

## Canonical Property Inspector visual refresh

The old PI used a product-local green custom theme. The current candidate now follows the canonical PackRat Stream Deck design system:

- page background `#080A0E`
- card gradient `#151920 → #0D1015`
- PackRat interaction/brand accent `#FFB21E`
- green reserved for literal connected/success state
- neutral charcoal secondary controls
- semantic red destructive control
- subtle top-right PackRat orange glow
- local `PackRat ↗` maker link outside product cards
- canonical local logo packaged at `imgs/plugin/packrat-logo.png`

Audio Manager CI now consumes the current canonical shared:

- `streamdeck-plugin-design-audit.mjs --require-canonical-pi`
- `streamdeck-key-visual-audit.mjs --require-major-profiles`

This prevents the visual or PI transport contract from silently drifting again.

## Live-refresh editor race repair

Physical PI review found a second repeatable defect: the 1.5-second live Windows snapshot refresh called the editor renderer and overwrote unsaved local edits. Device choices, profile name, accent, volume and mute controls could visibly snap back before Save.

The current candidate now:

- keeps a dirty local Audio Profile draft until authoritative saved state matches it
- prevents live snapshot renders from overwriting a dirty draft
- protects action-level settings with a pending settings patch until Stream Deck acknowledges them
- marks profile name, accent, device, restore-volume, restore-mute, volume and mute edits dirty immediately
- prompts before switching profiles with unsaved changes
- shows `Save profile · unsaved` while a draft is dirty
- shows explicit Refresh / Capture / Save / Delete success acknowledgement

Regression coverage must prove a user can change a device/name/accent, wait through multiple live refreshes, and still save the exact intended values.

## Bundled Stream Deck profile contract

Audio Manager now follows the PackRat major-device profile baseline instead of forcing the user to manually construct the Stream Deck layout:

- DeviceType 0: standard / MK.2
- DeviceType 2: XL
- DeviceType 7: Plus
- DeviceType 9: Neo

The layouts provide Apply Profile slots, Cycle, Status, Mute Default Mic, and direct Default/Communications input/output controls. Plus includes encoder Profile Output Volume slots.

These bundled Stream Deck layouts do **not** invent Windows audio-device IDs. Audio Profiles remain user/machine-specific and are selected/configured through the Property Inspector.

## Device resilience contract

Automatic endpoint matching order:

1. exact active endpoint ID
2. unique hardware Container ID + exact normalized friendly name
3. otherwise stop and require explicit rebind

Device Instance ID alone and friendly-name-only matches are intentionally insufficient. Ambiguous or missing devices must never silently substitute another endpoint.

## Audio Profile result contract

Every profile application returns:

- **SUCCESS** when all requested operations succeed and final Windows state verifies
- **PARTIAL** when some operations succeed but another operation/device/state cannot be safely completed or verified
- **FAILED** when no requested operation succeeds

The user-facing Default role means both Windows Console + Multimedia. Profile Status only reports active when the complete saved state matches.

Contradictory saved volume/mute values for the same endpoint are skipped and reported rather than arbitrarily choosing one.

## Remaining physical gate

Use `REAL_WINDOWS_SMOKE.md` as the canonical checklist.

The immediate short smoke is:

1. rerun `rat dev audio-manager-pro` for the current PI/profile candidate
2. open an Apply Audio Profile action
3. verify live Windows audio state appears
4. Refresh
5. Capture current setup
6. rename + Save profile
7. select that profile for the action
8. leave/reopen the action and verify the selection persists
9. press the hardware key and verify the saved profile applies
10. rerun `rat audit audio-manager-pro`

Only after that short PI/profile smoke passes continue with the deeper physical matrix:

- USB headset + speakers
- two microphones
- Default vs Communications separation
- saved volume/mute restore
- Bluetooth disconnect/reconnect
- missing-device PARTIAL / explicit rebind
- rapid Cycle presses
- Stream Deck+ rotate / press / touch
- Stream Deck restart
- Windows reboot
- Windows sleep/wake + PI/action recovery
- real-hardware demonstration evidence if required

## Catalog decisions

- bundled Stream Deck layout profiles ship for standard/MK.2, XL, Plus, and Neo; they arrange the actions but do not fake machine-specific Windows endpoint IDs
- no Audio Manager Lite edition
- no unrelated in-product upsell
- standalone paid product at $9.99

## Final promotion sequence

Only after `REAL_WINDOWS_SMOKE.md` and any required real-hardware demo evidence pass:

1. move `products/audio-manager-pro.json` to `READY_TO_SHIP`
2. mark PR #174 ready
3. reconcile current `main` carefully if required
4. merge PR #174 to committed `main`
5. run `rat ship audio-manager-pro`

Rat Ship must package committed canonical `main`, not the unmerged product branch.
