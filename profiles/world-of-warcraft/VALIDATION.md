# World of Warcraft — Validation

Run 2026-07-31. Data age 12 days (no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 26.9 | best query 'world of warcraft' popularity 50 = p89 of all tracked queries |
| Competition gap (0-25) | 19.9 | 2 competing products; a named premium org (iConCity) competes here |
| Monetization (0-20) | 17.7 | median paid comp $12.32 x 643 downloads; 100% of comps are paid |
| **Deterministic subtotal** | **64.5 / 75** | |
| Build fit (0-15) | 10 | Same builder pattern as Valorant. Deduct hard for scope risk: WoW's spellbook is enormous, and shipping "everything" would blur into a rotation/automation tool, which is exactly what Blizzard's anti-botting enforcement targets. v1 must be scoped tight — a utility layer (hearth, mounts, dungeon/raid finder, common macros the player already owns) mapped one-press-one-action to keys the player has already bound, never a rotation helper. That scoping work isn't covered by any existing builder config. |
| Risk (0-10) | 4 | Blizzard's Trademark Usage Guidelines state marks may be used **only for non-commercial purposes**, except under specific listed activity policies (fan site, esports tournament, custom maps) — a paid Stream Deck profile isn't one of the listed exceptions. Real legal exposure on paper. iConCity currently sells a WoW profile unimpeded ($12.65, 1062 downloads, still live as of March 2026), so marketplace enforcement in practice appears lax, but that's precedent, not permission. |
| **Qualitative subtotal** | **14 / 25** | |
| **TOTAL** | **78.5 / 100** | **GO by the numbers, flagged for sign-off** |

## Also researched
- WoW is healthy in 2026: 3-5M estimated active subscribers, The War Within/Midnight (Mar 2026) reversed the Shadowlands-era decline, ~$680M revenue in 2024 (+12% YoY). Demand durability is good.
- WoW's ToS bans macros/input automation aggressively (bots, rotation helpers) — this is the sharpest anti-automation posture of any title in this batch. The one-press-one-action rule isn't optional here, it's the whole legal position.

## Verdict: GO, with required sign-off
Risk scored exactly 4/10. Per the validate rules, anything under 4 needs explicit owner sign-off regardless of total — this sits right at the line, so treat it the same way: **flag Blizzard's explicit non-commercial clause to the owner before build**, same pattern as the sports-tracker ESPN/MLB Stats API risk sign-off already on file in `docs/DECISIONS.md`.

## Recommended listing
- **Name:** "World of Warcraft Profile" (26 chars)
- **Price:** $11.99 (median paid comp $12.32; undercut slightly)
- **Device SKUs:** std_win, xl_win, std_mac, xl_mac (WoW is fully native on Mac, unlike most of this batch — include Mac variants)
- **Top keywords:** world of warcraft, wow profile, wow stream deck, mmo hotkeys, wow macros
- **Risk flags:** `game-ip:blizzard-noncommercial-clause`, `anti-automation:strict-enforcement`

## Registry
`status: validated`
