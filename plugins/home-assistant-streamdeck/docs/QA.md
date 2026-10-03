# Home Assistant Stream Deck — release gate and accepted risk

Latest exact merged-main source/art evidence: [Rat Ship run 37143082868](https://github.com/slayerkey/rp-system/actions/runs/37143082868) on `069751db2df881668529c63af4cbd76a83dea8f6`. Full Windows release build, real HA Core test and final photo-media all green; CI reference package SHA-256 `6c14ee79a71748a699e2ee57c4f764bf969c35fb525328dd157838b5db925178`. Final five-frame artwork/contact sheet verified byte-for-byte equal to the previously approved visual set. The subsequent documentation/evidence commit does not change product source or campaign configuration.

| Gate | Outcome |
|---|---|
| Locked Windows build and deterministic product tests | **PASS: 34/34** |
| Four editable profiles: MK.2, XL, Plus, Neo; unique ActionIDs | PASS: 65 identities |
| Canonical PI design, key/profile visual audits | PASS |
| Official Elgato CLI validate and package | PASS |
| Real HA Core 2026.8.3 authenticated snapshot/live events/history/invalid-token transport | PASS — isolated test environment, not operator physical test |
| Windows Rat Art on physical-host-equivalent Windows CI | **PASS: 15/15 Canvas-generated real runtime key faces**, bypasses screenshot protocol |
| Canonical isolated Rat Ship kit, photo cover and four galleries/contact sheet | PASS; byte-identical approved artwork |
| $9.99 price | APPROVED by operator 2026-10-03 |
| Physical Stream Deck and customer-style Home Assistant smoke | **DEFERRED BY OPERATOR, NOT PASSED**; post-release follow-up |
| Access token in Stream Deck host global settings, not OS keychain | DISCLOSED in listing and ACCEPTED by operator |
| Marketplace submission/publication | NOT PERFORMED; operator initiates `rat ship` |

Public CI artifact `11280799528` retains only final review media and reference package hash. The paid binary is rebuilt and validated locally by `rat kit home-assistant-streamdeck` or `rat ship home-assistant-streamdeck`. The local package hash may differ across builds. No hardware pass is claimed.
