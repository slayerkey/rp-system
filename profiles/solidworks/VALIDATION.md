# SOLIDWORKS — Validation

Run 2026-08-01. Source: Marketplace Gateway zero-result search feed (5 weeks, 2025-11-10 to 2025-12-15), captured to `streamdeck-market-data/no_results_searches.csv`.

## Scoring note (deviation from the standard run)

`tools/opportunity.py` cannot score demand for this idea. Its `demand_score` reads the Algolia
`products_query_suggestions` index, which only ingests queries that **returned results**. A
zero-result query is invisible to it by construction. Run as-is the tool returned demand 21.6 on
a **false substring match** against the query `solid` (popularity 26) — solid-color icons and
backgrounds, unrelated to SOLIDWORKS. Discarded per the /rat-validate rule on loose matching.

Demand below is substituted from the zero-result feed and marked as an estimate. Competition and
monetization are the tool's real output.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | ~13 *(est.)* | 54 searches/wk mean, present 4 of 5 weeks (51, 49, 66, 51, below-cutoff). Genuinely persistent, but roughly an order of magnitude under Vectorworks, our strongest prior GO. See calibration below. |
| Competition gap (0-25) | 25 | Zero competing products — not just zero Profiles, zero products in **every** marketplace category. Total whitespace. |
| Monetization (0-20) | 6 | Tool default for "no comps: unproven niche". This is the weak leg: nothing anywhere proves a SOLIDWORKS buyer converts on this marketplace. |
| **Deterministic subtotal** | **44 / 75** | |
| Build fit (0-15) | 11 | Same shape as our published DaVinci Resolve and built Vectorworks: a software shortcut profile, no plugin work, existing `profiles/_build/` builders cover it. 70+ documented default shortcuts, ample Tabler glyph coverage. **Windows-only** (SOLIDWORKS has no native macOS build), so 2 SKUs not 4 — half the variant surface of Vectorworks. Deductions: nobody here uses SOLIDWORKS, so the shortcut set needs a real subject-matter pass; and the community norm is to *customize* shortcuts (see risk note), which makes a defaults-based profile a weaker anchor than DaVinci's. |
| Risk (0-10) | 9 | Dassault Systèmes is a software vendor, not a game IP holder. Third-party shortcut guides are established nominative use, and we have direct in-house precedent with DaVinci Resolve and Vectorworks. No anti-cheat, no macros, no patch-churn drama. |
| **Qualitative subtotal** | **20 / 25** | |
| **TOTAL** | **64 / 100** | **LEAN-GO** |

## Demand calibration (why ~13 and not 27)

Vectorworks scored 27.2/30 on query popularity 54 = p90 of the tracked index. It could be scored
at all **because SideshowFX's 5 products exist** — products make a query resolvable, which is what
puts it in the suggestions index. That same fact gave Vectorworks its 15.1/20 monetization
(median paid comp $34.99, 100% paid).

SOLIDWORKS has the mirror-image profile: zero products means no demand signal *and* no
monetization proof. Absolute volumes are not directly convertible between the two feeds (the
overlap sample is uncorrelated: `hue` pop 27 and `sound` pop 94 both run ~170 searches/day), but
every query in the Gateway's daily top-20 sits at 130+/day, and Vectorworks' popularity 54 falls
inside that band's range. SOLIDWORKS at 54/**week** is far below it. Estimate is deliberately
conservative.

## Also researched

- Real hotkey-shaped intent confirmed: SOLIDWORKS forum users describe manually building Stream Deck hotkey layouts and rating the result highly ("setting hotkeys and actions with the ability to set icons to each key is amazing"). This is the opposite of the Foundry case, where searchers want live integration a profile cannot deliver.
- SOLIDWORKS ships 70+ default shortcuts across File / Edit / Sketch / View / Assembly, plus the `S`-key context toolbar. Shortcuts are user-customizable via Tools > Customize > Keyboard, and the productivity literature actively advises customizing them. Two-edged: it proves shortcut-driven workflow is the norm in this audience, but it means a shipped defaults profile competes with the user's own setup and with the `S` menu.
- Audience is B2B engineering on multi-thousand-dollar seats, so price sensitivity is low. That argues against underpricing, but with zero comps there is no evidence of *marketplace* willingness to pay.

## Verdict: LEAN-GO — do not build yet

Blocked on one thing, and it is cheap to resolve. **Vectorworks is already built and unpublished.**
It is the same product shape, the same buyer class, and a keyword with both far higher volume and
proven paid comps. Publishing it answers the exact question SOLIDWORKS cannot answer on its own:
does a CAD shortcut profile convert on this marketplace?

Conditions that flip this to GO:
1. Vectorworks ships and converts at a rate that makes a ~1/10th-volume keyword still worth a build.
2. The SOLIDWORKS default shortcut set survives a subject-matter pass (enough universally-useful, non-customized commands to fill a std layout honestly).

If Vectorworks converts poorly, this is a NO-GO and so is the rest of the zero-result CAD tail.

## Recommended listing (if it flips to GO)

- **Name:** "SOLIDWORKS Profile" (18 chars)
- **Price:** $19.99. Deliberately under Vectorworks' $29.99 despite a richer buyer: that price was anchored on a $34.99 comp median, and here there is no comp at all. Price to buy a conversion signal, not to maximize per-unit.
- **Device SKUs:** std_win, xl_win only. No Mac build of SOLIDWORKS exists.
- **Top keywords:** solidworks, solidworks profile, cad shortcuts, solidworks shortcuts, engineering stream deck
- **Risk flags:** `monetization:unproven-no-comps-anywhere`, `intent:searchers-may-want-plugin-not-profile`

## Registry

`status: validated` (gated on the Vectorworks read)
