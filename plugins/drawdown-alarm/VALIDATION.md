# Portfolio Drawdown Alarm — Opportunity Validation

Slug: `drawdown-alarm` | Type: `plugin` | UUID: `com.packrat.drawdownalarm` | Date: 2026-08-21

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 25.0 / 30 | `python tools/opportunity.py "stock" "crypto" "portfolio" "alert" "finance" --category Plugins`. Best query `stock` popularity 37 = p83. **Matches are genuine**: `stock` 37, `alerts` 23, `crypto` 19, `finance` 15, `sound alerts` 12, `stock market` 10. Note the ceiling: these are real but modest. The marketplace does not have a large finance audience, contrary to the assumption this idea started from. |
| Competition gap | 7.0 / 25 | 12 competing products, entrenched leader with 43,075 downloads, and a named premium org (BarRaider) competes here. Brutal shelf. `Stocks` (exension) free 43,075, `Stock & Currency` (BarRaider) free 24,352, `Crypto Ticker PRO` free 16,729. |
| Monetization | 7.1 / 20 | Median paid comp $9.49 x 11 downloads; only 16% of comps are paid. A free-dominated niche where the paid slice is thin. Owner's own `market_command_center` at $9.99 took 7 units in 19 days against those free incumbents. |
| Build fit | 11 / 15 | Highest build fit of the five candidates. A Finnhub client already exists in the `market-command-center` widget, and `plugins/_shared/` supplies poller, renderer and view helpers. Net new is threshold state and alarm rendering. **Deducted for:** the existing Finnhub client is iCUE widget HTML/JS, not Stream Deck TypeScript, so it needs porting rather than importing; and alert semantics (edge-trigger, re-arm, hysteresis to stop a flapping price re-alarming) are genuinely new logic. |
| Risk | 7 / 10 | No IP, no game, no trademark holder. Deducted for the already-flagged `api-risk:finnhub-free-tier-requires-user-key`, which forces user setup friction, and free-tier rate limits that constrain how many symbols can be watched. |
| **Total** | **57.1 / 100** | **Verdict: LEAN-GO** |

### LEAN-GO, exact conditions to flip to GO (need +12.9 pts)

No single condition closes this cleanly, which is the honest finding. The competition gap of 7.0 is structural: three free incumbents hold 84,000 downloads between them and none of that is going away.

1. **Competition gap 7.0 to 14+ (+7):** Only achievable by narrowing the product so the free tickers stop being comps. Score it as an alert utility, not a price display: `python tools/opportunity.py "alerts" "sound alerts" --category Plugins`. Whether that survives the substring check is untested.
2. **Monetization 7.1 to 12+ (+5):** Needs evidence that buyers pay for alerting specifically. None found.

**Recommendation: do not ship as a standalone SKU.** Ship the alarm behaviour as a feature update to the existing `market-command-center` via `/rat-update`. That captures the value without paying the discovery cost of a new listing on a shelf where three free products hold 84,000 downloads.

---

## Recommended Listing Name

If shipped standalone against the advice above: **`Stock & Crypto Alerts`** (21 chars). Leads with `stock`, the highest genuine query at 37.

## Pricing Recommendation

| Comp | Type | Price | Downloads | Notes |
|---|---|---|---|---|
| Stocks (exension) | plugin | free | 43,075 | Entrenched leader. Display only, no alerting. |
| Stock & Currency (BarRaider) | plugin | free | 24,352 | Named premium org. Display only. |
| Crypto Ticker PRO (Vincent Courcelle) | plugin | free | 16,729 | Display only. |
| Market Command Center (Packrat) | widget | $9.99 | 7 units / 19 days | Owner's own, different platform (iCUE), same data source. |
| Trading Clocks (FCAN) | plugin | $10.00 | 21 | Proves a paid finance utility can exist here, and that the ceiling is thin. |

**Recommendation: $0 as a Market Command Center feature update.** If forced standalone, $6.99, below the $9.99 anchor because the competition gap and monetization scores are both weak.

## Device SKU Plan

One package, all devices. Pure network polling. Windows and macOS day one.

## Top 5 Keywords

1. stock alerts
2. crypto alert
3. portfolio
4. price alert
5. finance

## Risk Flags

- `api-risk:finnhub-free-tier-requires-user-key` — already carried on `market-command-center`. User must obtain and paste a key, which is real setup friction on a $6.99 product.
- `competition:free-incumbents-84000dl-combined` — Stocks 43,075 plus Stock & Currency 24,352 plus Crypto Ticker PRO 16,729.
- `monetization:free-dominated-niche-16pct-paid` — only 16% of comps are paid.
- `overlap-risk:duplicates-market-command-center` — competes with the owner's own product rather than complementing it.

---

## Overview

Not a price ticker. A key that goes red when a position crosses a line the user set.

## Market Demand

Real but modest. The wedge is that free tickers **display** and do not **alert**. The loss a trader takes is rarely from missing a number on screen, it is from missing a move while doing something else, which is an argument for a physical alarm rather than another display.

## Competitor Analysis

Every meaningful competitor is free and display-only. No Stream Deck product found does threshold alerting on a portfolio. That is a genuine gap, but it sits behind 84,000 downloads of free incumbency, so discovery is the problem, not differentiation.

## API Recommendation

Finnhub free tier, already in use in `market-command-center`. Free tier rate limits cap the watchable symbol count; confirm the exact ceiling before promising a symbol count in copy.

## Feature List (v1)

1. Per-symbol upper and lower thresholds
2. Colour alarm on breach
3. Percentage-change-from-open alarm
4. Portfolio-level drawdown percentage
5. Edge-triggered alerting with re-arm, so a flapping price does not re-alarm continuously

## Confidence Score

**60 / 100.** The wedge is real and the build is cheap. The discovery problem is severe and unsolved.

## Build Recommendation

Fold into `market-command-center` via `/rat-update`. Do not open a new listing.

## Proposed registry.json Entry

```json
"drawdown-alarm": {
  "name": "Portfolio Drawdown Alarm", "type": "plugin", "price_usd": null,
  "status": "rejected", "version": null, "marketplace_slug": null,
  "uuid": "com.packrat.drawdownalarm", "variants": {}, "required_variants": [],
  "paths": {"dir": "plugins/drawdown-alarm", "package": null, "marketing": null},
  "keywords": ["stock alerts", "crypto alert", "portfolio", "price alert", "finance"],
  "risk_flags": ["api-risk:finnhub-free-tier-requires-user-key",
                 "competition:free-incumbents-84000dl-combined",
                 "monetization:free-dominated-niche-16pct-paid",
                 "overlap-risk:duplicates-market-command-center"],
  "notes": "LEAN-GO 57.1/100 as a product, rejected as a SKU. The alert wedge is real (all comps are display-only) but sits behind 84000 downloads of free incumbency. Ship the alarm behaviour as a market-command-center feature update via /rat-update instead of opening a new listing."
}
```
