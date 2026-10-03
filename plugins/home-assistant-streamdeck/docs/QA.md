# Home Assistant Stream Deck — verified release QA

## Automated evidence

The current release gate is `.github/workflows/home-assistant-streamdeck-ci.yml`. Check its **latest successful exact-head run**, not an earlier package hash, after changing any plugin, release metadata or artwork.

| Gate | Verified state |
|---|---|
| Locked Windows Node build and deterministic product tests | PASS in main CI before current cover-title patch; exact-head PR run required for this patch |
| Four editable profiles: MK.2, XL, Plus, Neo, 65 distinct action IDs | PASS in main CI; rerun on patch |
| Canonical PI and keypad/major-profile visual audit | PASS in main CI; rerun on patch |
| Official Elgato validation and .streamDeckPlugin packaging | PASS in main CI; rerun on patch |
| Real isolated HA Core 2026.8.3: WebSocket authentication, state snapshot, pushed live state, invalid-token rejection | PASS in main CI; not equivalent to physical/customer installation |
| Canonical isolated Rat Ship artwork (five frames, photographed final hero, contact sheet) | PASS in main CI; repeated platform subtitle found during manual artwork review, patch + exact-head rerun required |
| Real HA controls across user devices, reconnect, local/remote network and customer permissions | NOT VERIFIED |
| Physical Stream Deck key/PI/dial/Neo/readability testing | NOT VERIFIED; no implicit deferral |
| Final corrected cover/content visual acceptance | PENDING manual review of patch-specific CI artifact |
| Price approval | PENDING; $9.99 is a hypothesis, not an approval |
| Access-token storage | Stream Deck host-managed global settings, **not OS keychain**. Disclose and obtain operator release acceptance. |
| READY_TO_SHIP or Maker Console submission | NOT AUTHORIZED. Never treat automated PASS as publication approval. |

Only final artwork and package SHA are retained in the public CI artifact; no paid package is uploaded. Generate the actual package and SHIP_KIT through local `rat kit home-assistant-streamdeck`, after the release-gate checks have passed. `rat ship home-assistant-streamdeck` starts the authenticated submission flow; do not invoke it until the owner explicitly authorizes submission and the canonical product record is `READY_TO_SHIP`.
