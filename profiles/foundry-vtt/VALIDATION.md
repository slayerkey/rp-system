# Foundry VTT — Validation

Run 2026-08-01. Source: Marketplace Gateway zero-result search feed (5 weeks, 2025-11-10 to 2025-12-15), captured to `streamdeck-market-data/no_results_searches.csv`.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | ~11 *(est.)* | 42 searches/wk mean, present 4 of 5 weeks (36, below-cutoff, 38, 47, 46). Persistent and real. Same substitution caveat as SOLIDWORKS: `tools/opportunity.py` returns the flat 4/30 "no query matches" floor because zero-result queries never enter the suggestions index. |
| Competition gap (0-25) | 12 | The tool reports 25 (zero marketplace products). **That number is wrong in substance.** Material Deck already owns this integration off-marketplace, and it is mature: playlist control, macro execution, combat tracker display and control, soundboard, folder structures, support for MK.1/MK.2/XL/Mini/Mobile. It distributes through Foundry's own module browser, which is exactly *why* the Elgato Marketplace shows no results. Adjusted down to reflect the real incumbent. |
| Monetization (0-20) | 6 | Tool default. Material Deck's premium tier runs on Patreon ('Material Apprentice' or higher), so willingness to pay exists in this niche — but for a live integration, not for a static profile. |
| **Deterministic subtotal** | **29 / 75** | |
| Build fit (0-15) | 4 | **This is the kill.** What "foundry" searchers want is two-way live state on the keys: current combat turn, token selection, playlist status. That requires a plugin with a websocket bridge into Foundry, which is precisely what Material Deck's companion Material Server does. `profiles/_build/` produces static hotkey profiles. We would be shipping the wrong product shape at demand that is already served better and for less. |
| Risk (0-10) | 7 | No IP or anti-cheat issue. Deductions: hard dependency on a third-party module ecosystem we do not control, and a real name collision — "Foundry" is also Foundry (Nuke, Modo, Mari), so the query intent is not cleanly attributable. The co-occurrence of `kenku` (Kenku FM, a TTRPG soundboard) in the same weekly lists is what points to the VTT reading. |
| **Qualitative subtotal** | **11 / 25** | |
| **TOTAL** | **40 / 100** | **NO-GO** |

## Verdict: NO-GO

The zero-result signal is misleading here. It does not mean unmet demand — it means the demand is
met somewhere the Elgato Marketplace cannot see. Anyone searching "foundry" on the marketplace is
looking for Material Deck and will keep looking until they find it in Foundry's module browser.
A hotkey profile does not intercept that intent; it disappoints it.

This is a useful negative result for reading the rest of the feed: **a zero-result query is only
an opportunity when the marketplace is the natural place to satisfy it.** For app-integration
queries (hd60, insta360, smartthings, lutron, focusrite) the same logic applies — the absence is
about distribution or API access, not about unserved buyers.

Nearest idea that would score better: nothing in the TTRPG cluster, unless we were willing to
build a real plugin, and then we would be entering against an entrenched, actively-maintained,
free-tier incumbent. Skip the cluster.

## Registry

`status: rejected`
