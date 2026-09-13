# Wireless Device Manager QA

## Current state

**TESTING — not READY_TO_SHIP.**

The hardware-free source/model/profile/media gates below have been exercised during the build session. The native Windows bridge compile/runtime, official Elgato CLI validation/package run, and real Bluetooth hardware matrix remain release blockers until they run on the PackRat Windows host.

## Hardware-free evidence completed

- [x] 35 model/package/profile regression tests are defined and pass in the reconstructed branch test harness
- [x] capability flags are per device rather than global
- [x] battery and charging are absent when telemetry is absent
- [x] Windows charging-property label behavior is covered
- [x] duplicate friendly names remain distinct by stable identity
- [x] endpoint-ID changes preserve identity when Bluetooth address is stable
- [x] dual-mode BLE/classic endpoints sharing one container reconcile into one device
- [x] complementary BLE battery/charging and classic audio-control capabilities are unioned within one current snapshot
- [x] fresh snapshots replace stale connected/disconnected state instead of OR-ing history
- [x] paired sleeping devices remain paired and render SLEEP/OFF
- [x] removed devices render UNPAIRED and lose stale battery/control capabilities
- [x] present-but-disconnected audio fixture can expose CONNECT without DISCONNECT
- [x] adapter-off / bridge-error snapshots are guarded from being applied as removals
- [x] sleep/resume-style device transitions restore live telemetry
- [x] multiple-device summary is covered
- [x] favorites / Cycle Device ordering is deterministic
- [x] low-battery transition alerts are covered
- [x] Dashboard LOW count respects per-device thresholds
- [x] Lite uses one shared selected device while Pro keeps per-key targets
- [x] Lite and Pro each generate Standard / XL / Stream Deck+ profiles
- [x] all six generated profile archives use valid device-grid coordinates
- [x] Stream Deck+ Pro is an explicit 4 x 2 key-only layout
- [x] generated profiles are parsed in tests and all key coordinates are enforced within 5 x 3 / 8 x 4 / 4 x 2 device bounds
- [x] Pro bundled device slots seed favorites and example multi-group memberships
- [x] Lite bundled profiles contain no Pro-only favorite/group settings
- [x] profile labels preserve live battery/status/control values rather than hiding them
- [x] no bundled profile or manifest exposes an Encoder action
- [x] Marketplace SEO regression includes Bluetooth, wireless, battery, headphones, keyboard, mouse, controller, connect, disconnect, Windows, and Stream Deck
- [x] manifest FontSize values use the current numeric schema type
- [x] deterministic Lite and Pro Rat Art each render exactly 6 Marketplace assets
- [x] search icons render at 288 x 288
- [x] cover/gallery frames render at 1920 x 960
- [x] Lite gallery does not advertise Pro-only groups/Cycle Device
- [x] plugin/category/action/key assets render at the intended 256/512, 28/56, 20/40, and 72/144 dimensions

## Automated Windows release gate still required

The canonical self-hosted PackRat Windows workflow remains the executable release gate:

- [ ] `npm ci` from lockfile
- [ ] dependency audit
- [ ] TypeScript no-emit check
- [ ] deterministic profile generation in the canonical checkout
- [ ] x64 self-contained Windows bridge publish
- [ ] ARM64 self-contained Windows bridge publish
- [ ] bundled bridge snapshot smoke on Windows
- [ ] persistent stdio bridge request/recovery smoke on Windows
- [ ] compressed bundled helper package-size check
- [ ] fixture/package suite in the canonical checkout
- [ ] official Elgato validation: Lite
- [ ] official Elgato validation: Pro
- [ ] official Elgato packaging: Lite
- [ ] official Elgato packaging: Pro
- [ ] packaged structure contains the bundled bridge and no separate installer/cloud credential
- [ ] deterministic Marketplace media generation in the canonical checkout
- [ ] release artifact hashes captured

Hosted/self-hosted attempts that receive no runner, execute zero steps, and produce no logs are infrastructure failures and do not count as product QA evidence.

## Required real Windows / Bluetooth smoke before READY_TO_SHIP

This cannot be honestly replaced by fixtures because generic CI runners do not provide the user's paired Bluetooth hardware.

1. **Bluetooth headphones / headset**
   - paired state
   - connected/disconnected state
   - present / sleep-off transitions
   - battery if Windows exposes it
   - charging if Windows exposes it
   - CONNECT only when present
   - real audio reconnect from a disconnected state
   - DISCONNECT of exposed A2DP/HFP services
   - verify PackRat never reports CONNECT success when the device did not actually reconnect

2. **Keyboard**
   - status
   - battery only if exposed
   - charging only if exposed
   - CONNECT / DISCONNECT unavailable unless a genuinely supported path exists

3. **Mouse**
   - same checks as keyboard
   - include a no-battery-telemetry mouse if available

4. **Xbox / other controller**
   - status
   - battery where exposed
   - no invented generic connection control

5. **Telemetry contrast**
   - battery-supported device beside a device with no battery telemetry
   - charging-supported device if available

6. **Lifecycle**
   - sleeping device
   - physical power off/on
   - disconnect/reconnect
   - remove device
   - re-pair device
   - duplicate friendly names
   - device endpoint ID changes where observable

7. **Windows Bluetooth stack**
   - disable/enable Bluetooth adapter
   - restart Bluetooth service if safe on the host
   - confirm adapter-off state does not convert cached devices into fake unpaired removals

8. **PC lifecycle**
   - reboot Windows
   - laptop/PC sleep and resume where available
   - Stream Deck restart

9. **Several devices at once**
   - headphones + keyboard + mouse + controller where available
   - Pro Dashboard count
   - favorites
   - Cycle Device
   - GAMING / WORK / TRAVEL groups
   - per-device threshold changes reflected in Dashboard LOW count

10. **Profiles / Stream Deck+**
    - import Standard profile
    - import XL profile
    - import Plus profile
    - confirm Plus uses keys only
    - confirm no fake dial/Encoder action appears

Record the exact hardware models and the capability matrix Windows exposes for each one. Any capability that fails the reliability rule must be narrowed or removed before Marketplace submission.
