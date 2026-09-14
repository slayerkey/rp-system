# Wireless Device Manager QA

## Current state

**PRO READY_TO_SHIP — Bluetooth audio-control physical QA explicitly waived by the product owner. Lite remains publication-order blocked only on the real public Pro Marketplace URL.**

The runtime/profile investigation is complete through validated code commit `c7faedf73e54de2896ea9ec2678ad2d2f2b47484`. Lite and Pro build from the same family and both pass the current Windows release gate. The LAMZU Maya X path has also been physically exercised on the user's real Stream Deck host.

The investigation found two concrete host-side regressions that matched the physical screenshots:
- both Wireless manifests carried `Nodejs.Debug: "disabled"`; this has been removed so Rat Dev no longer launches the Node plugin with that fake debug argument
- bundled profiles were generated with `ShowTitle: true`; Wireless now uses the canonical shared profile builder with host title rendering disabled so runtime key art owns the full key face

The Property Inspector now traces websocket registration, command send/receive, bridge refresh, device count, response send/receive, and render failure with correlated request IDs. `scripts/host-probe.ps1` provides one-shot real-machine evidence if the physical run still disagrees with CI.

The hardware-free source/model/profile/media gates and GitHub-hosted Windows release gate have passed. USB/HID receiver telemetry is release-cleared. The product owner explicitly waived the remaining real Bluetooth audio-control hardware matrix for the initial Pro release; this waiver does not claim that A2DP/HFP connect/disconnect was physically verified.

## Hardware-free evidence completed

- [x] 64 model/package/profile/catalog/runtime-diagnostic regression cases pass in the hardware-free suite
- [x] capability flags are per device rather than global
- [x] A2DP/HFP control eligibility is derived from Windows AssociationEndpointService contracts rather than broad Audio/Video device-class inference
- [x] group names are canonicalized case-insensitively so `gaming` and `GAMING` feed the same dashboard
- [x] battery and charging are absent when telemetry is absent
- [x] Windows charging-property label behavior is covered
- [x] duplicate friendly names remain distinct by stable identity
- [x] endpoint-ID changes preserve identity when Bluetooth address is stable
- [x] dual-mode BLE/classic endpoints sharing one container reconcile into one device
- [x] complementary BLE battery/charging and classic audio-control capabilities are unioned within one current snapshot
- [x] dual-mode merge preserves an explicit classic native control target regardless of endpoint order
- [x] fresh snapshots replace stale connected/disconnected state instead of OR-ing history
- [x] paired sleeping devices remain paired and render SLEEP/OFF
- [x] native endpoint merge preserves Windows unknown/present/absent tri-state instead of converting unknown presence into false
- [x] removed devices render UNPAIRED and lose stale battery/control capabilities
- [x] present-but-disconnected audio fixture can expose CONNECT without DISCONNECT
- [x] adapter-off / bridge-error snapshots are guarded from being applied as removals
- [x] sleep/resume-style device transitions restore live telemetry
- [x] multiple-device summary is covered
- [x] favorites / Cycle Device ordering is deterministic
- [x] Cycle Device skips cached unpaired favorites while dashboards may still report missing grouped devices
- [x] low-battery transition alerts are covered
- [x] Dashboard LOW count respects per-device thresholds
- [x] Lite uses one shared selected device while Pro supports independent keys plus linked logical profile slots
- [x] Lite and Pro each generate Standard / Mini / XL / Stream Deck+ / Neo profiles
- [x] all generated profile actions disable Stream Deck host titles (`ShowTitle: false`) so runtime key rendering owns the full key face
- [x] Pro profiles use canonical multi-page bundles with focused DEVICES and GROUPS workflows rather than crowding every concept onto page one
- [x] all ten generated profile archives use valid device-grid coordinates
- [x] Mini Pro is an explicit 3 x 2 compact layout
- [x] Stream Deck+ and Neo Pro are explicit 4 x 2 key-only layouts with focused device controls plus separate group workflow pages
- [x] generated profiles are parsed in tests and all key coordinates are enforced within 5 x 3 / 3 x 2 / 8 x 4 / 4 x 2 device bounds
- [x] Pro bundled device slots are device-neutral and do not pretend the first device is headphones, mouse, keyboard, or controller
- [x] bundled device keys do not silently auto-assign selected hardware into example GAMING / WORK / TRAVEL groups
- [x] Lite bundled profiles contain no Pro-only favorite/group settings
- [x] profile labels preserve live battery/status/control values rather than hiding them
- [x] Property Inspector changes repaint linked keys immediately through a non-recursive repaint notifier
- [x] no bundled profile or manifest exposes an Encoder action
- [x] Marketplace SEO regression includes Bluetooth, wireless, battery, headphones, keyboard, mouse, controller, connect, disconnect, Windows, and Stream Deck
- [x] Marketplace release notes follow Rat Ship's 3–6 bullet-line contract
- [x] PackRat catalog registers exactly one Lite/Pro pair at Free / $7.99 with no fabricated Marketplace URLs
- [x] Lite Property Inspector contains a truthful Pro feature upsell while the unpublished Pro URL remains intentionally absent
- [x] manifest FontSize values use the current numeric schema type
- [x] deterministic Lite and Pro Rat Art each render exactly 6 Marketplace assets
- [x] search icons render at 288 x 288
- [x] cover/gallery frames render at 1920 x 960
- [x] Lite gallery does not advertise Pro-only groups/Cycle Device
- [x] plugin/category/action/key assets render at the intended 256/512, 28/56, 20/40, and 72/144 dimensions
- [x] semantic runtime glyph regressions cover status, battery, charging, connect, disconnect, unavailable control, dashboard, group, and favorite-cycle visuals
- [x] decorative left yellow key rail is removed from runtime and fallback/profile art for a simpler key face
- [x] Cycle Device uses favorite-star + next semantics rather than refresh arrows
- [x] both Lite and Pro pass the canonical structural Stream Deck key-visual audit with 0 warnings

## Automated Windows release gate — PASS

The canonical self-hosted PackRat Windows workflow remains the executable release gate:

- [x] `npm ci` from lockfile
- [x] dependency audit — 0 vulnerabilities
- [x] TypeScript no-emit check
- [x] deterministic profile generation in the canonical checkout — 10 profiles
- [x] x64 self-contained Windows bridge publish — 41,420,926 bytes
- [x] ARM64 self-contained Windows bridge publish — 40,727,210 bytes
- [x] bundled bridge snapshot smoke on Windows — hosted runner correctly reported no Bluetooth adapter
- [x] persistent stdio bridge request/recovery smoke on Windows
- [x] compressed bundled helper/package-size check
- [x] fixture/package suite in the canonical checkout — 64/64 pass
- [x] official Elgato validation: Lite
- [x] official Elgato validation: Pro
- [x] official Elgato packaging: Lite
- [x] official Elgato packaging: Pro
- [x] packaged structure contains x64 + ARM64 bundled bridges and no separate installer/cloud credential
- [x] deterministic Marketplace media generation in the canonical checkout
- [x] release artifact hashes captured

### Hosted Windows release evidence

Latest release-candidate source:

- Validated code commit: `c7faedf73e54de2896ea9ec2678ad2d2f2b47484`
- GitHub Actions run: `34901568905`
- Windows job: `104168498060`
- Dependency audit: **0 vulnerabilities**
- Test suite: **64 passed / 0 failed**
- Canonical key visual audit: **Lite PASS, 0 warnings; Pro PASS, 0 warnings**
- Official Elgato validation: **Lite PASS; Pro PASS**
- Lite package: `com.packrat.wireless-device-manager.streamDeckPlugin`
  - size: **70,967,730 bytes (67.68 MiB)**
  - SHA-256: `45E79BDAB53C2DEF44F2B0A9DC9F6904D2A2B22717EB2F5AF5D157778C1742FE`
- Pro package: `com.packrat.wireless-device-manager-pro.streamDeckPlugin`
  - size: **70,972,221 bytes (67.68 MiB)**
  - SHA-256: `F871E723FA5AE24600DD182E0478DC8B620FD2FE8903359C575BF375CB4D7B1C`
- Uploaded workflow artifact: `wireless-device-manager-family`
  - artifact ID: `10371152083`
  - artifact ZIP SHA-256: `2D1E55A775840BE77BE7EFFF8C2988F3A935B184D65B9FFA21598C304792624D`
  - uploaded size: **142,939,442 bytes**

The hosted runner has no paired Bluetooth hardware, so this proves compile/package/runtime-startup behavior but does not replace the physical device matrix.

Hosted/self-hosted attempts that receive no runner, execute zero steps, and produce no logs are infrastructure failures and do not count as product QA evidence.

## Physical hardware evidence completed on the user's Stream Deck host

- [x] Property Inspector receives live plugin snapshots instead of timing out
- [x] sole visible wireless device can be selected automatically
- [x] LAMZU Maya X detected with **no Bluetooth adapter installed**
- [x] 2.4 GHz receiver mode reports `kind=2.4ghz-receiver`, battery telemetry, and `charging=False`
- [x] receiver-mode Property Inspector shows fresh `direct HID read` telemetry rather than a cached wired value
- [x] direct cable connection to the Maya X produced a different live battery reading (**96%**) and a charging state, demonstrating wired/receiver distinction
- [x] Maya X exposes STATUS / BATTERY / CHARGING only; CONNECT / DISCONNECT remain unavailable
- [x] Rat Dev successfully refreshed the already-installed Wireless profile in place and created a backup instead of importing another copy
- [x] runtime key faces render live Maya X status/battery data on the physical Stream Deck

The receiver may remain at 100% for a while because PackRat displays the percentage reported by the Maya X receiver protocol. PackRat does not invent or smooth a different battery percentage. A repeatedly fresh `hid-feature-report` observation is considered valid device-reported telemetry.

## Explicit initial-release hardware waiver

On 2026-09-14, the product owner accepted the release risk of shipping Wireless Device Manager Pro without a physical Bluetooth A2DP/HFP connect/disconnect test because the available QA machine has no Bluetooth adapter.

This is a **waiver, not a pass**. The following remain unverified on real Bluetooth audio hardware:
- Bluetooth headset/headphones connect
- Bluetooth headset/headphones disconnect
- A2DP/HFP service transitions
- Bluetooth adapter/service lifecycle behavior

If customer or reviewer evidence exposes a regression in those paths, narrow or fix the affected capability in the next release. Do not reinterpret this waiver as proof that the paths were tested.

## Required real Windows wireless-device smoke before READY_TO_SHIP

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

3. **Mouse / USB receiver telemetry**
   - LAMZU Maya X is the first required non-Bluetooth hardware fixture
   - verify wired USB PID 0x001C exposes exact battery percentage and charging state
   - verify 2.4 GHz receiver PID 0x001E exposes battery percentage without a Bluetooth adapter
   - unplug the charging cable and confirm the same logical Maya X survives the wired -> receiver transition
   - power/sleep the mouse and confirm stale battery data is not presented as current
   - CONNECT / DISCONNECT must remain unavailable for Maya X because PackRat is reading telemetry, not inventing receiver control
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

10. **Profiles / device families**
    - import Standard profile
    - import Mini profile
    - import XL profile
    - import Plus profile
    - import Neo profile
    - confirm Mini stays within 3 x 2
    - confirm Plus and Neo use keys only
    - confirm HEADPHONES and CONNECT share the same selected headset on Standard / Mini / XL / Plus / Neo
    - confirm no fake dial/Encoder action appears

Record the exact hardware models and the capability matrix Windows exposes for each one. Any capability that fails the reliability rule must be narrowed or removed before Marketplace submission.


## Lite / Pro publication order

PackRat's canonical Lite/Pro policy requires a verified direct public Pro Marketplace URL before the Lite upsell may ship.

1. Complete the Windows automated gate and physical Bluetooth matrix for both editions.
2. Move **Wireless Device Manager Pro** to `READY_TO_SHIP` first and submit/publish Pro.
3. Record the verified Pro Marketplace product ID and direct public URL in `products/lite-pro-map.json`.
4. Rebuild Lite. `scripts/render-assets.py` must inject that exact canonical URL into Lite's generated `ui/upsell-config.js`; malformed or placeholder destinations fail closed.
5. Verify the packaged Lite Property Inspector opens the exact Pro product page.
6. Submit/publish Lite only after the verified Pro destination is present.
7. Record Lite's final public Marketplace product ID/URL in `products/lite-pro-map.json`.
8. Run `python tools/lite_pro_audit.py --shipping wireless-device-manager` once both public URLs exist. The strict portfolio gate also requires Pro status `published`.

Do not hardcode a search URL, creator page, generic Marketplace route, guessed UUID, or placeholder destination into the Lite package.
