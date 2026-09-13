# Wireless Device Manager QA

## Current state

**TESTING — not READY_TO_SHIP.**

The hardware-free source/model/profile/media gates and GitHub-hosted Windows release gate have now passed. Real Bluetooth hardware behavior remains the release blocker before READY_TO_SHIP.

## Hardware-free evidence completed

- [x] 51 model/package/profile/catalog regression cases are currently defined in the hardware-free suite
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
- [x] all ten generated profile archives use valid device-grid coordinates
- [x] Mini Pro is an explicit 3 x 2 compact layout
- [x] Stream Deck+ and Neo Pro are explicit 4 x 2 key-only layouts prioritizing ALL DEVICES / CONNECT / CYCLE / GAMING
- [x] generated profiles are parsed in tests and all key coordinates are enforced within 5 x 3 / 3 x 2 / 8 x 4 / 4 x 2 device bounds
- [x] Pro bundled device slots seed favorites and example multi-group memberships
- [x] bundled HEADPHONES status/control keys share one logical slot and identical seed metadata regardless of configuration order
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
- [x] fixture/package suite in the canonical checkout — 51/51 pass
- [x] official Elgato validation: Lite
- [x] official Elgato validation: Pro
- [x] official Elgato packaging: Lite
- [x] official Elgato packaging: Pro
- [x] packaged structure contains x64 + ARM64 bundled bridges and no separate installer/cloud credential
- [x] deterministic Marketplace media generation in the canonical checkout
- [x] release artifact hashes captured

### Hosted Windows release evidence

GitHub Actions run `34785291188` on commit `95ce3902bd6a49f4b5d2b196fd5fd7d26334a30a` completed successfully on GitHub-hosted Windows.

- Test suite: **51 passed / 0 failed**
- Persistent bridge smoke: PASS with `adapterAvailable=false` on the runner, as expected
- Lite package: `com.packrat.wireless-device-manager.streamDeckPlugin`
  - size: **70,949,723 bytes (67.66 MiB)**
  - SHA-256: `AE8BB54B95E2FBF31DE45A61E7E44C51DF27E5DC5D9584CA4A152C67FE8F1053`
- Pro package: `com.packrat.wireless-device-manager-pro.streamDeckPlugin`
  - size: **70,951,706 bytes (67.66 MiB)**
  - SHA-256: `ED3231F67576FA1FC6AEE47795FFEC94D195D9B936CB211FE6CEDB4DEA818815`
- Uploaded workflow artifact: `wireless-device-manager-family`
  - artifact ID: `10326163681`
  - artifact ZIP SHA-256: `202939D672004DD10934634E9C7CB07C014524D5314C84C01F059D2BD308ECFD`
  - uploaded size: **142,905,650 bytes**

The hosted runner has no paired Bluetooth hardware, so this proves compile/package/runtime-startup behavior but does not replace the physical device matrix.

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
