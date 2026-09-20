# HWiNFO monitoring — Validation

## Revision 3 (2026-07-31) — verification of rev 2's open conditions

Rev 2 landed on LEAN-GO (62.6/100) with three conditions that had to hold before any build. All three were checked against primary sources. Two resolved unfavorably, one favorably. **Net verdict: NO-GO.**

### Condition 1: does HWiNFO have a real sensor-coverage edge over LibreHardwareMonitor? RESOLVED FAVORABLY

Yes, this part is real. HWiNFO reads a broader sensor set and applies more hardware-specific calibration; LibreHardwareMonitor users report missing chipset/VRM and SSD temperatures, and LHM has a documented gap around Nuvoton embedded-controller access and eSIO internal registers. For VRM, embedded-controller and SSD/NVMe readings specifically, HWiNFO is the better data source. This was the one genuine differentiator and it survives scrutiny.

### Condition 2: what does "time-limited Shared Memory Support" mean? RESOLVED UNFAVORABLY, AND WORSE THAN FLAGGED

Confirmed from HWiNFO's own licensing terms and forum: **free/non-Pro HWiNFO limits Shared Memory support to 12 hours per day.** On hitting the limit it auto-deactivates at runtime and must be **manually re-enabled by the user the next day.** Only HWiNFO Pro (paid) removes the restriction.

This is a product-experience landmine for a paid plugin. Every customer on free HWiNFO would watch their keys go dead partway through the day, every day, unless they either buy HWiNFO Pro or remember to tick a checkbox each morning. That is a refund-and-one-star generator for a $3.99 purchase, and no amount of listing copy defuses it.

There is a documented workaround, the one 5e's HWiNFO Reader takes: read HWiNFO's **Gadgets** feature instead of Shared Memory, which sidesteps the limit entirely. But Gadgets requires the user to manually mark each sensor for gadget use inside HWiNFO before the plugin can see it. That trades a daily re-enable chore for a fiddly per-sensor setup chore, and it directly undercuts the "deep multi-sensor dashboard" pitch: a composite VRM+GPU+CPU tile means walking a non-technical buyer through tagging a dozen sensors by hand in third-party software before anything renders.

So the differentiator from Condition 1 (deep sensor coverage) is entangled with the constraint from Condition 2. The sensor path that delivers the depth cleanly is the one that dies after 12 hours.

### Condition 3: has moeilijk already closed the gap? RESOLVED UNFAVORABLY, CONFIRMED IDENTITY

Verified beyond the earlier inference:

- `moeilijk/lhm-streamdeck` v2.0.0 released **2026-06-25**, the exact date and version of the Marketplace listing "Libre Hardware Monitor" (org moeilijk, 30,111 downloads, "Version 2"). The Marketplace product and the GPL repo are the same artifact.
- Its README confirms the full depth feature set is live in that shipping product: Composite Dashboard ("2 to 4 sensor readings on a single Stream Deck key, each with its own graph"), Derived Metric ("combines 2 to 8 sensor readings"), threshold alerting with hysteresis/dwell/cooldown/sticky alerts, snooze presets, graphs with EMA smoothing, and a Stream Deck+ Dial Carousel.
- `moeilijk/hwinfo-streamdeck` README states plainly: "The plugin core has been replaced with the actively developed engine from the lhm-streamdeck sister project," and "This plugin reads HWiNFO exclusively. For Libre Hardware Monitor, remote machines, or Linux, use the lhm-streamdeck sister plugin instead." Both are GPL-3.0, same author, same engine.
- Development is not dormant. lhm-streamdeck shipped **v2.1.1 on 2026-07-29, two days before this validation.**

The HWiNFO-sourced build of that engine already exists and works. The only reason it is not on the Marketplace is that the author has not submitted it. Nothing stops them doing so at any time, for free, with a two-year head start on polish.

A plausible reading of *why* they have not: Condition 2. The 12-hour Shared Memory limit may be exactly what makes the HWiNFO variant unfit for a mass Marketplace audience while the LHM variant (no such limit, fully open-source backend) ships happily. If so, the apparent Marketplace "gap" for HWiNFO depth is not an unnoticed opening. It is a place experienced people already looked and declined to go.

### Revised score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 29.4 | unchanged. Best query 'hwinfo' popularity 109 = p97 of all tracked queries |
| Competition gap (0-25) | 13.0 | unchanged raw score. 6 competing products, entrenched leader at 124,671 downloads |
| Monetization (0-20) | 11.2 | unchanged. Median paid comp $9.49 x 119 downloads, 33% of comps paid (Runner $0.99/236 dl, Glance $18/3 dl) |
| **Deterministic subtotal** | **53.6 / 75** | `python tools/opportunity.py "hwinfo" "hardware monitor" "sensor" "system monitor" --category Plugins`, data age 12 days |
| Build fit (0-15) | 4 | down from rev 2's 6. `plugins/_shared/src/poller.ts`, `cache.ts` and `badge.ts` remain genuinely reusable, but Condition 2 adds unavoidable new scope: a Gadgets-based sensor path plus a guided per-sensor onboarding flow to make setup survivable for a non-technical buyer. Still owed: composite/gauge/sparkline badge shapes, threshold/alert state machine, pagination/view module, none of which exist in the repo. |
| Risk (0-10) | 2 | down from rev 2's 3, both new facts confirmed unfavorable. The paid product's core value depends on third-party software whose free tier disables the needed interface every 12 hours; the workaround degrades the setup experience that the depth pitch relies on; and an incumbent with the identical feature set already built, same engine, active as of two days ago, can publish it to the Marketplace for free whenever they choose. GPL-3.0 clean-room discipline required throughout. |
| **Qualitative subtotal** | **6 / 25** | |
| **TOTAL** | **59.6 / 100** | **NO-GO** |

### Verdict: NO-GO

The number lands just inside the LEAN-GO band, but the rubric's risk floor governs: 2/10 is far below the 4 that requires sign-off, and the two facts that dragged it there are confirmed, not speculative. Recommend not building.

The honest summary is that the pivot's thesis was sound and the research simply did not support it. "Differentiate on depth" assumed depth was an open Marketplace gap. It is not: the depth feature set ships today, free, in-store, from a developer who also already has the HWiNFO build of it sitting in a public repo. What is left as genuinely ours is a narrow data-quality edge (VRM, embedded controller, SSD temps) that is real but is gated behind a licensing constraint hostile to a paid consumer product.

**What would have to change to revisit:**
1. HWiNFO removes or materially relaxes the 12-hour Shared Memory limit in the free tier, or exposes a sanctioned interface without it.
2. Evidence appears that buyers will pay for hardware monitoring at all beyond the $233 of lifetime revenue the single $0.99 comp represents. The whole category's willingness-to-pay signal is currently one product with 236 downloads.
3. A wedge unrelated to sensor depth (an angle the incumbents structurally cannot copy) is identified. Depth is not that wedge.

Nearby ideas that would score better: none in this category. The category's problem is that its buyers are well served for free by mature open-source tooling, which is the same structural reason the original 2026-07-31 run rejected it. Rev 2 found better numbers by widening keywords; it did not find a better business.

### Risk flags

`competition:incumbent-holds-identical-feature-set-unpublished`, `platform:hwinfo-free-tier-12h-shared-memory-limit`, `license:gpl-adjacent-clean-room-required`

---

## Revision 2 (2026-07-31) — depth-pivot concept, superseded by rev 3

Scored a depth-focused paid plugin (multi-sensor composite dashboards, threshold alerting, combined GPU+CPU+VRM views) rather than the straight port scored in rev 1. Widening the scoring keywords from "hwinfo" alone to "hwinfo" / "hardware monitor" / "sensor" / "system monitor" (Plugins category) surfaced two paid comps the narrow original run missed (Runner - Hardware Monitor $0.99/236 dl; Glance $18/3 dl, Mac), lifting monetization from 2/20 to 11.2/20, and lifted build fit from 2/15 to 6/15 on the strength of `plugins/_shared` reuse.

It also surfaced org "moeilijk" shipping "Libre Hardware Monitor" free on the Marketplace (30,111 downloads, 2026-06-25), suspected at the time to share an engine with their GitHub-only HWiNFO fork. Rev 2 scored 62.6/100 LEAN-GO with mandatory sign-off pending (risk 3/10) and listed three conditions to verify before building. Rev 3 above verified all three and supersedes this.

---

## Revision 1 (2026-07-31) — straight-port concept, superseded

Data age 12 days (no refresh needed).

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 29.4 | best query 'hwinfo' popularity 109 = p97 of all tracked queries, the single highest popularity score of everything checked this run |
| Competition gap (0-25) | 18.3 | 2 competing products, but one is an entrenched leader with 124,671 downloads; median competitor untouched for 613 days |
| Monetization (0-20) | 2 | niche is 100% free products, no paid comp exists to price against |
| **Deterministic subtotal** | **49.7 / 75** | |
| Build fit (0-15) | 2 | This is Plugin-shaped, not Profile-shaped. None of `profiles/_build/`'s action builders apply. It would require original TypeScript plugin development reading HWiNFO's shared-memory sensor interface, a ground-up build with nothing in the current toolchain to reuse. Biggest build-fit deduction of anything checked this run. |
| Risk (0-10) | 7 | No real IP/trademark issue. HWiNFO is freeware and nominative use of the name for a compatible plugin is standard practice in this space (see the 2 existing free comps). Risk here is business, not legal. |
| **Qualitative subtotal** | **9 / 25** | |
| **TOTAL** | **58.7 / 100** | **NO-GO** |

The raw popularity number (109, highest of the whole scan) is real, but two things kill it: (1) the niche is 100% free, the entrenched leader alone has 124,671 downloads and there is no paid comp to price against, so there's no proof anyone will pay for this; (2) it's a plugin, not a profile, meaning a different production track entirely rather than something the existing profile pipeline can turn around quickly.

## Registry
`status: rejected`
