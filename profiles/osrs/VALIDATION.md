# Old School RuneScape — Validation

Run 2026-07-31. Data age 12 days (no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 21.0 | tool's best match was 'escape' (popularity 25) — a loose substring hit that likely isn't mostly OSRS searches (escape rooms etc.). The honest signal is the direct 'runescape' query alone: **popularity 19, only 5 total hits** — meaningfully below every other candidate validated this run (43-54 range). Demand score here overstates the real opportunity. |
| Competition gap (0-25) | 23.9 | 2 competing products, both from one org (iConCity); median competitor untouched for 635 days |
| Monetization (0-20) | 13.2 | median paid comp $6.00 x 42 downloads; 100% of comps are paid |
| **Deterministic subtotal** | **58.1 / 75 (inflated — true demand-only base is lower, see above)** | |
| Build fit (0-15) | 13 | Same builder pattern as Valorant. OSRS's UI is heavily function-key/number-key driven already (prayers, spellbook, inventory tabs) — genuinely good fit. Small deduction: OSRS players commonly customize bindings via RuneLite plugins, adding "which client/preset" scoping. |
| Risk (0-10) | 8 | Jagex's Fan Content Policy is explicitly the most commercial-friendly of anything researched this run: "Create With Confidence," permits making and selling fan works (up to defined limits for physical merch), covers OSRS by name. Only restriction is Jagex's own logo trademark, which we don't use (Tabler/nominative-text-only, same as Valorant). No automation/anti-cheat conflict for single-tap keybind mapping — this is just a keyboard remap, same as the many players who already use programmable keypads for OSRS. |
| **Qualitative subtotal** | **21 / 25** | |
| **TOTAL** | **58.1 (demand-adjusted, not the raw 79.1)** | **LEAN-GO** |

## Also researched
- Jagex's policy doesn't clearly state whether its merch-unit caps apply to an unlimited-download digital SKU like a Stream Deck profile — same ambiguity every other digital comp on this marketplace already operates under, not a blocker, just noted.
- No player-count research needed to make the call here: the marketplace query data itself is the limiting factor, not the game's health (OSRS remains a large, stable, long-running title).

## Verdict: LEAN-GO — best legal position, weakest demand signal
This has the cleanest IP risk profile of every idea validated this run (Jagex is explicitly fan-content-friendly), and build fit is strong. But the deterministic score's demand component is doing more work than it should — the tool's substring match on 'escape' inflates the real signal, and the honest 'runescape'-only popularity (19) is the thinnest of this batch. **Conditions to flip to GO:** confirm real search intent before committing full art/build budget — a cheap gut-check (e.g. checking `runescape` trend against similar recent OSRS Stream Deck content elsewhere) would de-risk this further. Price and scope conservatively; don't expect Valorant-tier volume.

## Recommended listing
- **Name:** "Old School RuneScape Profile" (29 chars)
- **Price:** $6.99 (matches the $6.00 comps; no basis to price above given the weak proven demand)
- **Device SKUs:** std_win, xl_win, std_mac, xl_mac (OSRS's client is cross-platform and Mac usage is meaningfully common in this community)
- **Top keywords:** old school runescape, osrs profile, runescape stream deck, osrs keybinds, runescape hotkeys
- **Risk flags:** `demand-signal:weak-substring-inflated`

## Registry
`status: validated`
