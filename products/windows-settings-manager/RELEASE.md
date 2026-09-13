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

## Branch

`product/windows-settings-manager`

## Release sequence

1. Complete automated CI.
2. Run the physical Windows QA matrix in QA.md.
3. Run and review deterministic Rat Art.
4. Change both product records from BLOCKED to READY_TO_SHIP only after the release evidence is recorded.
5. Merge the approved product branch to canonical main.
6. Run:
   `rat ship windows-settings-manager-lite windows-settings-manager-pro`
