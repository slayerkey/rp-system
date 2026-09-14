# Windows Settings Manager Release

## Product names

- Windows Settings Manager Lite
- Windows Settings Manager Pro

Family title: Windows Settings Manager

Pro positioning line: **Windows Control Center for Stream Deck**

## Price

- Lite: Free
- Pro: $7.99

## Source

Shared implementation:

`products/windows-settings-manager/plugin`

Generated bundles:

- `out/com.packrat.windows-settings-manager-lite2.sdPlugin`
- `out/com.packrat.windows-settings-manager-pro2.sdPlugin`

## Primary product surfaces

Lite — free everyday Windows essentials:
- Lock
- Sleep
- Power Plan
- Keep Awake
- Previous Desktop
- Next Desktop

Lite solves one smaller, coherent problem: control the Windows basics you are most likely to reach for without opening Settings or leaving the task in front of you. It is intentionally the minimum useful edition, not a crippled Pro demo.

Pro standard 5x3:
- Lock
- Sleep
- Hibernate
- Restart
- Shutdown
- Wi-Fi
- Bluetooth
- Power Plan
- Keep Awake
- Light / Dark Theme
- Previous Desktop
- Next Desktop
- New Desktop
- Close Desktop
- Current Desktop

PC Modes and older HDR/display/timeout controls are optional advanced actions, not primary Marketplace positioning.

## Compatibility

- Windows 10 / 11, subject to capability and QA matrix.
- Stream Deck 7.3+.
- Profiles: Stream Deck, Mini, XL, Stream Deck +, Neo, Galleon 100 SD, Stream Deck + XL.

## Branch

`product/windows-settings-manager`

## Release sequence

Both editions are now QA-passed / READY_TO_SHIP as product candidates. Public Marketplace sequencing still matters because Lite's upgrade path must point at a real Pro listing.

1. Final-sync the approved branch to canonical main.
2. Generate/upload Pro first:
   `rat ship windows-settings-manager-pro`
3. Create/save the Pro listing and capture its exact direct Marketplace URL + product ID.
4. Generate/upload Lite:
   `rat ship windows-settings-manager-lite`
5. Save the Lite listing as a draft and capture its exact direct Marketplace URL + product ID.
6. Record both verified direct URLs/IDs in `products/lite-pro-map.json`.
7. Rebuild Lite so its Property Inspector contains the exact Pro product URL.
8. Require:
   `python tools/lite_pro_audit.py --shipping windows-settings-manager-lite`
9. Verify the rebuilt Lite package contains the exact Pro URL and no generic/search/placeholder destination.
10. Final-submit/publish Lite only after that strict audit passes.

Lite is allowed to be uploaded before its final public submission. Do not publicly publish Lite before Pro, and do not invent Marketplace URLs or IDs.
