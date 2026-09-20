# Elite Dangerous — Validation

Run 2026-07-31. Data age 12 days (no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 26.0 | best query 'elite dangerous' popularity 43 = p86 of all tracked queries |
| Competition gap (0-25) | 19.3 | 3 competing products; a named premium org (iConCity) competes here |
| Monetization (0-20) | 14.9 | median paid comp $15.00 x 62 downloads; 100% of comps are paid |
| **Deterministic subtotal** | **60.2 / 75** | |
| Build fit (0-15) | 12 | Same builder pattern as Valorant. Genuinely good fit — Elite is a HOTAS/panel-heavy flight sim, exactly the kind of dense-control-surface game a Stream Deck profile is built for. Small deduction only for scoping: the full control set is large (ship systems, SRV, on-foot Odyssey controls), needs an explicit "which subset ships in v1" call. |
| Risk (0-10) | 3 | Frontier's Media Usage Rules explicitly state commercial use of their assets/content requires **advance permission** ("permission is needed from Frontier in advance... email community@frontier.co.uk") — the most explicit ask-first policy of anything researched in this batch. iConCity currently operates 3 Elite Dangerous listings unimpeded (most recent published 2026-06-24, five weeks ago), so enforcement is evidently lax in practice, but the written policy is unambiguous. |
| **Qualitative subtotal** | **15 / 25** | |
| **TOTAL** | **75.2 / 100** | **GO by the numbers — overridden by risk rule** |

## Also researched
- Elite Dangerous's player base has fallen sharply: 3,940-4,534 average concurrent players in 2026 vs. a 13,326 peak in March 2025 — roughly a **70% decline**, with daily players down 37.7% YoY. This isn't reflected in the deterministic demand score, which is based on marketplace search popularity, not the underlying live player base. A shrinking audience means the addressable buyer pool is smaller than the score implies and likely still shrinking.

## Verdict: risk requires explicit sign-off, recommend LEAN-GO
Risk scored 3/10, under the rule's threshold of 4 — **this needs the owner's explicit sign-off regardless of the 75.2 total.** Combine that with the real-world player decline (a demand-durability concern the deterministic score can't see) and the honest read is LEAN-GO, not a clean GO: conditions to flip to a confident GO are (1) owner accepts Frontier's advance-permission requirement as an acceptable risk given the iConCity precedent, and (2) player-count decline stabilizes rather than continuing to fall before committing build time.

## Recommended listing (if greenlit)
- **Name:** "Elite Dangerous Profile" (24 chars)
- **Price:** $13.99 (median paid comp $15.00; undercut given the shrinking audience)
- **Device SKUs:** std_win, xl_win (PC-only for keyboard/HOTAS play; no Mac client)
- **Top keywords:** elite dangerous, elite dangerous profile, hotas, space sim stream deck, elite dangerous keybinds
- **Risk flags:** `game-ip:frontier-advance-permission-required`, `demand-trend:declining-playerbase`

## Registry
`status: validated` (owner sign-off pending per risk rule; treat as conditional)
