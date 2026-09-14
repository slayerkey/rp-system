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

- `out/com.packrat.windows-settings-manager-lite.sdPlugin`
- `out/com.packrat.windows-settings-manager-pro.sdPlugin`

## Primary product surfaces

Lite:
- Lock
- Sleep
- Power Plan
- Keep Awake
- Previous Desktop
- Next Desktop

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

1. Require fresh exact-head Windows and portable product CI.
2. Require RatPack Lightweight CI, Lite Pro Portfolio Audit, and Rat Ship Marketplace Routing CI.
3. Run physical Windows/Stream Deck QA from QA.md.
4. Review deterministic Rat Art generated from the new Control Center profiles.
5. Move **Pro only** from BLOCKED to READY_TO_SHIP after all technical and physical evidence is recorded.
6. Final-sync approved branch to canonical main.
7. Publish Pro:
   `rat ship windows-settings-manager-pro`
8. Record Pro's exact direct Marketplace URL and product ID in `products/lite-pro-map.json`.
9. Stage Lite while BLOCKED:
   `rat stage windows-settings-manager-lite`
10. Save Lite draft and capture its exact direct URL and product ID.
11. Record both verified direct URLs/IDs in the relationship map.
12. Rebuild/stage Lite so its Property Inspector contains the exact Pro product URL.
13. Require:
    `python tools/lite_pro_audit.py --shipping windows-settings-manager-lite`
14. Verify the rebuilt Lite package contains the exact Pro URL and no generic/search/placeholder destination.
15. Only then move Lite to READY_TO_SHIP and publish:
    `rat ship windows-settings-manager-lite`

Do not publish Lite first. Do not invent Marketplace URLs or IDs.
