# Fortnite — Validation

Run 2026-07-31. Data age 12 days (no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 26.7 | best query 'fortnite' popularity 48 = p89 of all tracked queries |
| Competition gap (0-25) | 25 | 1 competing product; median competitor untouched for 771 days |
| Monetization (0-20) | 13.6 | median paid comp $6.00 x 56 downloads; 100% of comps are paid |
| **Deterministic subtotal** | **65.3 / 75** | |
| Build fit (0-15) | 11 | Same builder pattern as published Valorant (one-press-one-action default keybinds, Tabler/SimpleIcons only, no artwork on keys). Deduct: (a) Fortnite's competitive/building meta and default control scheme gets reworked most seasons — higher ongoing README/keybind maintenance than Valorant's stable comp scene; (b) the one marketplace comp ("Unreal Engine for Fortnite Profile") is a UEFN *creator* tool, not a Battle Royale *player* profile — the 'fortnite' query's popularity may be split between two different buyer intents we can't fully separate from the data. |
| Risk (0-10) | 6 | Epic's Fan Content Policy permits use of marks only "in connection with discussion of Epic products," and says not to use marks to promote your own product — stricter wording than Riot's Valorant policy we already ship under, though same shape (nominative use, no logos on keys, no endorsement claim). Epic has a more litigious history than Riot. No anti-cheat concern: single-tap default-keybind model only, no macros. |
| **Qualitative subtotal** | **17 / 25** | |
| **TOTAL** | **82.3 / 100** | **GO** |

## Also researched
- Fortnite MAU ~110-120M (Q1 2026), concurrent 1.5-3.5M, DAU dipped through early 2026 but Chapter 7 (Nov 2025) spiked DAU to 9.75M — audience is large and cyclically re-energized by chapter launches, not in structural decline.
- No upcoming rework found that would kill this; chapter cadence is actually a tailwind for repeat "new season, new keybinds" marketing.

## Verdict: GO, scoped to Battle Royale defaults first
Build the **Battle Royale default-keybind** version (largest single audience). Note in the README that Creative/Zero Build players should verify bindings before relying on the deck — do not attempt to ship all three modes in v1.

## Recommended listing
- **Name:** "Fortnite Profile" (17 chars)
- **Price:** $7.99 (comp is $6.00 but for a different product shape; price below Valorant's $8.99 since this niche has thinner proof of paid conversion)
- **Device SKUs:** std_win, xl_win (Fortnite runs on Mac but PC/Windows is the dominant competitive population; skip Mac for v1, same call as Valorant)
- **Top keywords:** fortnite, fortnite profile, battle royale, stream deck fortnite, fortnite keybinds
- **Risk flags:** `game-ip:epic`, `patch-churn:seasonal-meta`

## Registry
`status: validated`
