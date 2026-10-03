# Home Assistant Stream Deck — release gate and accepted risk

Latest accepted pre-promotion exact-main evidence: [Rat Ship run 37088244126](https://github.com/slayerkey/rp-system/actions/runs/37088244126) at `943648d45202c4110971241d459152a46f909f71`, package SHA-256 `c1a501b0ee4f763cb1e79e1062728319e0364de6d22d3e9f1326fcb931e2ec6c`. Re-run `.github/workflows/home-assistant-streamdeck-ci.yml` on the price/readiness promotion before submission, and use the latest accepted exact package/art from canonical main.

| Gate | Outcome |
|---|---|
| Locked Windows build and deterministic product tests | PASS on exact evidence run; repeat on promotion |
| MK.2/XL/Plus/Neo editable profiles, 65 distinct ActionIDs | PASS |
| Canonical Property Inspector and key/profile visual audits | PASS |
| Official Elgato CLI validation and packaging | PASS |
| Real HA Core 2026.8.3 snapshot/live state/history/invalid-token transport | PASS — automated test environment only |
| Isolated canonical Rat Ship kit with final photographed cover and four galleries | PASS — final art explicitly accepted by operator 2026-10-03 |
| $9.99 price | APPROVED by operator 2026-10-03 |
| Physical Stream Deck and customer-style Home Assistant smoke | **DEFERRED BY OPERATOR, NOT PASSED**; complete as post-release follow-up |
| Access token in Stream Deck host global settings, not OS keychain | DISCLOSED in listing; operator expressly ACCEPTED 2026-10-03 |
| Marketplace submission or publication | NOT PERFORMED; only operator-initiated `rat ship` may submit |

Public CI retains only final review media and package hash (artifact 11260759396), never the paid binary. Generate the installable package and ship kit locally through `rat kit home-assistant-streamdeck`. Successful fixture and automated HA tests do not attest to physical Stream Deck behavior.
