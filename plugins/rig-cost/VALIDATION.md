# Rig Cost Meter — Opportunity Validation

Slug: `rig-cost` | Type: `plugin` | UUID: `com.packrat.rigcost` | Date: 2026-08-21

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 28.4 / 30 | `python tools/opportunity.py "gpu" "cpu" "monitor" "hardware" "system" "watt" --category Plugins`. Best query `system` popularity 75 = p94. **Matches are genuine**: `system` 75, `monitor` 67, `hardware` 48, `cpu temperature` 35, `cpu` 34, `hardware monitor` 21, plus `gpu metrics` 17 against only 6 products. Hardware monitoring is one of the strongest real demand signals on this marketplace. **Caveat that matters: this demand is for monitoring, not for cost.** There is zero marketplace search demand for electricity, watt, kWh or energy cost. The high demand score is borrowed from an adjacent intent. |
| Competition gap | 2.2 / 25 | 44 competing products with an entrenched leader at 111,082 downloads (`System Vitals`, VIVRE-MOTION). The most crowded shelf of the five candidates by a wide margin. |
| Monetization | 9.2 / 20 | Median paid comp $7.99 x 15 downloads; 50% of comps are paid. The best monetization score of the five, which reflects that people do pay for hardware monitoring. |
| Build fit | 4 / 15 | **The lowest build fit of the five and the reason this is not the pick.** No existing plugin in this repo reads local hardware. Everything in `plugins/_shared/` is built for polling a remote HTTP API and rendering the result; none of that data-acquisition layer applies. Net new: a native or shell-out sensor path (NVML/nvidia-smi for GPU power, LibreHardwareMonitor for CPU package power), Windows-first with no clear macOS story, plus a packaging question for shipping a native dependency through Elgato review. **Deducted heavily** because this is an entirely new code lane, not a reuse. |
| Risk | 6 / 10 | NVML is free with no licensing issue and LibreHardwareMonitor is MPL-2.0, which is permissive enough to use. **Deducted for:** vendor and driver variation (NVIDIA vs AMD vs integrated graphics) creating a wide support matrix, and for direct precedent in this registry. `hwinfo` was already **rejected** for `platform:hwinfo-free-tier-12h-shared-memory-limit` and `license:gpl-adjacent-clean-room-required`. That rejection is in this exact lane and shows it carries licensing landmines. |
| **Total** | **49.8 / 100** | **Verdict: NO-GO** |

### Why NO-GO, and what nearby idea scores better

Two independent reasons, either sufficient.

1. **The shelf is full.** 44 competitors, a free incumbent at 111,082 downloads. Competition gap 2.2/25 is the worst score in this whole research pass. The money framing is a genuine differentiator, but a differentiator does not fix a discovery problem of that size.
2. **The build is a new lane, not a reuse.** Build fit 4/15. This factory's leverage comes from `plugins/_shared/` and `profiles/_build/`, and this product uses neither. It would be the most expensive of the five to build and the hardest to maintain across the GPU vendor matrix.

The savings claim is also the weakest of the five when examined honestly. An idle machine left on all year at roughly 90W is about $95/year at $0.12/kWh, and the product only captures that if the user changes behaviour. It is a real number but it is not the "saves more than it costs" case the brief was hunting.

**Nearby idea that scores better:** `api-spend` (58.2, LEAN-GO). Same "meter running against committed money" mechanism, far better competition gap, and it reuses the shared core instead of opening a native-sensor lane.

**If revisited later,** the condition that would change the answer is the arrival of a shared local-sensor module in `plugins/_shared/`. If some future product pays for that infrastructure, build fit here jumps from 4 to roughly 10 and the total lands near 56, which is LEAN-GO. That is the only realistic path.

---

## Recommended Listing Name

If ever revisited: **`PC Power Cost Meter`** (19 chars). Note it leads with a term nobody searches, which is itself part of the problem.

## Pricing Recommendation

| Comp | Type | Price | Downloads | Notes |
|---|---|---|---|---|
| System Vitals (VIVRE-MOTION) | plugin | free | 111,082 | Entrenched leader. General monitoring, no cost framing. |
| System Usage (Corrugator Inc.) | plugin | free | 556 | Free, monitoring only. |
| Median paid comp in this lane | plugin | $7.99 | 15 | Per the deterministic tool. |

**Recommendation: n/a, NO-GO.** Had it proceeded, $6.99 with a free Lite.

## Device SKU Plan

Would be Windows-only at v1 because the sensor path is Windows-native, matching the constraint that made `screensaver-cycler` Windows-only. That is a further mark against it, since `davinci-resolve-lite` notes record that every previous Windows-only Packrat listing "took 0-1 downloads".

## Top 5 Keywords

1. hardware monitor
2. gpu power
3. system monitor
4. pc power cost
5. cpu usage

## Risk Flags

- `build-fit:no-existing-local-sensor-lane` — nothing in `plugins/_shared/` applies; entirely new code path.
- `license:librehardwaremonitor-mpl-and-hwinfo-precedent` — the `hwinfo` rejection in this registry was partly a licensing call in this exact lane.
- `competition:entrenched-free-leader-111082dl` — System Vitals.
- `platform-risk:gpu-vendor-matrix` — NVIDIA, AMD and integrated graphics need separate handling.
- `demand-mismatch:monitoring-demand-not-cost-demand` — the 28.4 demand score comes from monitoring queries; zero marketplace search demand exists for energy or cost terms.

---

## Overview

What the PC costs to run, in dollars per hour, today and this month. Broad appeal and zero setup, undone by a full shelf and an expensive build.

## Confidence Score

**66 / 100** in the NO-GO verdict. The competition and build-fit numbers are hard data. The judgment call is whether the money framing could overcome 111,082 downloads of free incumbency, and the honest answer is that no evidence here says it would.

## Proposed registry.json Entry

```json
"rig-cost": {
  "name": "PC Power Cost Meter", "type": "plugin", "price_usd": null,
  "status": "rejected", "version": null, "marketplace_slug": null,
  "uuid": "com.packrat.rigcost", "variants": {}, "required_variants": [],
  "paths": {"dir": "plugins/rig-cost", "package": null, "marketing": null},
  "keywords": ["hardware monitor", "gpu power", "system monitor", "pc power cost", "cpu usage"],
  "risk_flags": ["build-fit:no-existing-local-sensor-lane",
                 "license:librehardwaremonitor-mpl-and-hwinfo-precedent",
                 "competition:entrenched-free-leader-111082dl",
                 "platform-risk:gpu-vendor-matrix",
                 "demand-mismatch:monitoring-demand-not-cost-demand"],
  "notes": "NO-GO 49.8/100. Best broad-audience concept of the money-saving research pass and the worst to actually build. Competition gap 2.2/25 (44 comps, System Vitals at 111082 dl) and build fit 4/15 (no local-sensor lane exists; hwinfo already rejected in this lane on licensing). Revisit only if a shared local-sensor module lands in plugins/_shared/, which would lift the total to roughly 56."
}
```
