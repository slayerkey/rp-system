# Forza — Validation

Run 2026-07-31. Data age 12 days (no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 26.0 | best query 'forza' popularity 43 = p86 of all tracked queries |
| Competition gap (0-25) | 22.8 | 4 competing products — but this count doesn't capture recency (see below) |
| Monetization (0-20) | 10.7 | median paid comp $8.99 x 39 downloads; only 50% of comps are paid |
| **Deterministic subtotal** | **59.5 / 75** | |
| Build fit (0-15) | 13 | Same builder pattern as Valorant. Racing sim with photo-mode/replay/tuning hotkeys — good fit. |
| Risk (0-10) | 7 | Microsoft/Xbox game-content rules are standard nominative-use: referential title use fine ("Tips for Forza Horizon"), no logos, no endorsement implication. Well-trodden, low-risk. Individual car-manufacturer trademarks are only a concern if depicting vehicles/logos, which we don't. |
| **Qualitative subtotal** | **20 / 25** | |
| **TOTAL** | **79.5 / 100 (numbers say GO — see verdict override)** | |

## Also researched — this is the actual finding
The competition_gap score (22.8/25, "4 competitors") reads like an open niche, but it isn't: **3 of the 4 competitors were published in the last 6 weeks.** MambaTech shipped a free "Lite" version *and* a $9.99 paid version on the same day (2026-06-16), Respawn Icons published a $7.99 competitor on 2026-06-29, and Corsair — a hardware company, not an indie dev — published a free Galleon-bundle competitor on 2026-05-22. This is a niche that just got actively contested, not one sitting open. The deterministic tool scores competition by raw count and staleness, so it can't see this clustering; a human read of the "last_published" dates is what surfaces it.

Also: a free competitor (MambaTech's own Lite tier) sits directly next to the paid comp from the *same org*, and monetization score is already soft (only 50% of comps are paid).

## Verdict: LEAN-GO, downgraded from the numeric GO
The raw total says GO, but the recency clustering is a real signal the score misses — this is a freshly and aggressively contested niche, including a hardware company (Corsair) now bundling a free competitor. **Conditions to flip to a confident GO:** wait to see if the competitive intensity here settles (i.e. this isn't still attracting new entrants next quarter), or differentiate hard enough (e.g. cover a different game in the series, like Forza Motorsport instead of Horizon, where the two current MambaTech/Respawn comps don't compete) rather than going head-to-head with three fresh listings.

## Recommended listing (if pursued)
- **Name:** "Forza Horizon Profile" (22 chars)
- **Price:** $7.99 (undercut MambaTech's $9.99, matches Respawn's $7.99)
- **Device SKUs:** std_win, xl_win (no Mac client)
- **Top keywords:** forza, forza horizon, forza profile, racing game stream deck, forza keybinds
- **Risk flags:** `competition:freshly-contested-2026-06`

## Registry
`status: validated` (LEAN-GO, treat build priority as lower than the other GOs this run)
