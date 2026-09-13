# Windows Settings Manager Release

## Product names

- Windows Settings Manager Lite
- Windows Settings Manager Pro

Family title: Windows Settings Manager

Pro positioning line: PC Modes & System Controls for Stream Deck

## Price

- Lite: Free
- Pro: $7.99

## Source

Shared implementation:
`products/windows-settings-manager/plugin`

Generated bundles:
- `out/com.packrat.windows-settings-manager-lite.sdPlugin`
- `out/com.packrat.windows-settings-manager-pro.sdPlugin`

## Compatibility

- Windows 10 / 11, subject to the QA matrix
- Stream Deck 7.3 or later
- Bundled profiles: Stream Deck, Mini, XL, Stream Deck +, Neo, Galleon 100 SD, Stream Deck + XL

## Branch

`product/windows-settings-manager`

## Release sequence

1. Complete automated CI: locked install, strict TypeScript compile, policy tests, Windows backend smoke, official Elgato validation, and package creation.
2. Run the physical Windows QA matrix in QA.md.
3. Run and review deterministic Rat Art.
4. Change the release records from BLOCKED to READY_TO_SHIP only after release evidence is recorded.
5. Merge the approved product branch to canonical main.
6. Publish Pro first:
   `rat ship windows-settings-manager-pro`
7. After Pro is publicly listed, record its exact direct Marketplace URL and product ID in `products/lite-pro-map.json`, and mark the canonical Pro catalog status published.
8. Create/save the Lite Marketplace draft and capture its exact direct product URL and product ID. Record both Lite and Pro URLs/IDs in `products/lite-pro-map.json`.
9. Rebuild Lite. Its Property Inspector injects the Pro URL only from the verified Lite/Pro map; with no verified URL the upsell is hidden.
10. Run the strict commercial preflight and require PASS:
    `python tools/lite_pro_audit.py --shipping windows-settings-manager-lite`
11. Confirm the rebuilt Lite package contains the exact Pro product URL and no search, creator, generic, or placeholder destination.
12. Publish Lite:
    `rat ship windows-settings-manager-lite`

Do not publish Lite before Pro. PackRat's strict Lite shipping audit requires the paid counterpart to already be published and both direct Marketplace URLs to be recorded.
