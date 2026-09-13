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
4. After technical and physical release evidence is recorded, move **Pro only** from BLOCKED to READY_TO_SHIP. Keep Lite BLOCKED on the commercial Lite-to-Pro boundary.
5. Merge the approved product branch to canonical main.
6. Publish Pro first:
   `rat ship windows-settings-manager-pro`
7. After Pro is publicly listed, record its exact direct Marketplace URL and product ID in `products/lite-pro-map.json`, mark the canonical Pro catalog status published, and keep the URL direct to the product page.
8. Stage Lite while it is still BLOCKED:
   `rat stage windows-settings-manager-lite`
   Stage is intentionally allowed for blocked products and does not publicly submit the release.
9. Save the Lite Marketplace draft, capture its exact direct product URL and product ID, and record both Lite and Pro URLs/IDs in `products/lite-pro-map.json`.
10. Rebuild/stage Lite again. Its Property Inspector must now contain the exact verified Pro URL from the relationship map.
11. Run the strict commercial preflight and require PASS:
    `python tools/lite_pro_audit.py --shipping windows-settings-manager-lite`
12. Confirm the rebuilt Lite package contains the exact Pro product URL and no search, creator, generic, or placeholder destination.
13. Only now move Lite from BLOCKED to READY_TO_SHIP and publish it:
    `rat ship windows-settings-manager-lite`

Do not publish Lite before Pro. PackRat's strict Lite shipping audit requires the paid counterpart to already be published and both direct Marketplace URLs to be recorded.
