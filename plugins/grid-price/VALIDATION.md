# Grid Price Key — Opportunity Validation

Slug: `grid-price` | Type: `plugin` | UUID: `com.packrat.gridprice` | Date: 2026-08-21

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 12 / 30 (tool said 28.3, corrected down) | `python tools/opportunity.py "energy" "electricity" "solar" "power" "grid" "tariff" --category Plugins` returned 28.3 on a best query of **`powerpoint` popularity 74**, with `powershell` 24 and `focus grid` 13 behind it. **All substring garbage.** The only genuine match in the entire result set is `solar` at popularity 10 against 20 products. Scored honestly at 12/30. There is **no marketplace search demand for electricity, energy, kWh or tariff.** |
| Competition gap | 8.7 / 25 | 7 competing products, but the tool found an entrenched leader at 79,104 downloads and a named premium org, both artifacts of the `powerpoint` match. On the genuine energy shelf the real comps are thin: `NETIO PDU Power Control` free 321, `Solarman` free 84, `SEMS Solar Monitoring` free 21. Nothing does grid pricing. Left at the tool's 8.7 rather than adjusted up, because adjusting both demand down and competition up on the same bad match would be double-counting in opposite directions. |
| Monetization | 5.5 / 20 | Median paid comp $4.99 x 7 downloads; only 14% of comps are paid. The energy shelf on this marketplace is essentially all free and essentially unused. |
| Build fit | 12 / 15 | **The highest build fit of the five.** Octopus Energy's public API needs **no authentication and no key at all**. `plugins/_shared/` supplies poller, renderer and view helpers wholesale. Simple time-series, colour banding, no secrets, no native code. **Deducted only for** multi-provider handling (Octopus, Nord Pool, Amber, Tibber each differ) and timezone/half-hourly bucket handling. |
| Risk | 8 / 10 | No IP, no game, no trademark holder. Public utility APIs are stable and documented. **Deducted for** geographic concentration and single-provider dependency: Octopus is one company, and if its public API closed the UK case would die with it. |
| **Total** | **46.2 / 100** | **Verdict: NO-GO** |

### Why NO-GO, and what nearby idea scores better

This is the frustrating one. It has the best Stream Deck fit and the cheapest build of anything in the research pass, and it fails on the only thing this rubric weights most heavily: nobody searches for it here.

Demand 12 plus monetization 5.5 is 17.5 out of a possible 50 on the two dimensions that measure whether buyers exist on this marketplace. Build fit 12/15 and risk 8/10 cannot rescue that.

**The savings case is the second strongest in the pass and is properly documented.** A medium-usage UK household shifting dishwasher, washing machine and EV charging into the cheap window averages roughly 17p/kWh, about **£290/year against the price cap**, and Octopus "Plunge Pricing" periods pay the user to consume. Tomorrow's 48 prices publish around 4pm the day before, so a "cheapest window tonight" key is genuinely actionable. The product idea is good. The marketplace is wrong for it.

**Nearby idea that scores better:** `api-spend` (58.2, LEAN-GO). Same live-data mechanism, same cheap build, but it attaches to real search demand.

**The one honest counter-argument, recorded so it is not re-litigated:** the smart-home audience on this marketplace is provably large. `Home Assistant` (Christoph Giesche) has **115,193 downloads** and `Philips Hue` (Elgato) has 84,044. That audience exists and is not small. What is missing is evidence it will pay, and the energy shelf specifically (Solarman 84, SEMS 21) says it does not. If that changes, revisit.

**Recommended disposition:** if built at all, build it free as a lead magnet. Build fit 12/15 means it costs very little, and `better_hotkeys___mouse` at 97 units in 5 days shows free listings do real distribution work for the Packrat name. As a paid SKU it is a no.

---

## Recommended Listing Name

If built free: **`Live Electricity Price`** (22 chars).

## Pricing Recommendation

| Comp | Type | Price | Downloads | Notes |
|---|---|---|---|---|
| NETIO PDU Power Control (VIVRE-MOTION) | plugin | free | 321 | Best performer on the energy shelf, and it is device control not pricing. |
| Solarman (tbprojects) | plugin | free | 84 | Solar monitoring, free. |
| SEMS Solar Monitoring (Neave) | plugin | free | 21 | Solar monitoring, free. |
| Home Assistant (Christoph Giesche) | plugin | free | 115,193 | Proves the smart-home audience is large. Also proves it is served free. |

**Recommendation: $0 if built.** The niche is free-dominated and strategically useful as a lead magnet, which the rubric explicitly allows: "Free is a valid verdict (lead magnet) if the niche is free-dominated but strategically valuable."

## Device SKU Plan

One package, all devices. Pure network polling. Windows and macOS day one.

## Top 5 Keywords

1. electricity price
2. energy tariff
3. octopus agile
4. smart home energy
5. solar

## Risk Flags

- `demand-risk:no-marketplace-search-signal` — all matched queries were substring noise (`powerpoint`, `powershell`, `focus grid`).
- `geo-limit:uk-nordics-au-only` — dynamic tariffs are not a global product. Most of the addressable market is outside the US, which is the marketplace's largest audience.
- `platform-risk:single-provider-public-api` — Octopus is one private company with no obligation to keep its API open.
- `monetization:free-dominated-niche-14pct-paid` — the energy shelf is all free and barely used.

---

## Overview

A key that turns green when electricity is cheap and red when it is not, so the dryer runs at the right hour without anyone thinking about it. The best physical Stream Deck fit found in this research pass, on the wrong marketplace.

## API Recommendation

Octopus Energy public API: **free, unauthenticated, no key**. Nord Pool and EPEX day-ahead spot feeds cover much of Europe. Amber (Australia) and Tibber (Nordics, Germany, Netherlands) both offer public APIs with a user token. Start with Octopus because it needs no setup at all.

## Confidence Score

**58 / 100** in the NO-GO verdict, the lowest confidence of the five. The demand and monetization numbers are solid, but they measure this marketplace only, and the off-marketplace signal for this product is genuinely strong. If Packrat ever acquires a distribution channel that is not Elgato marketplace search, this idea should be reopened first.

## Proposed registry.json Entry

```json
"grid-price": {
  "name": "Live Electricity Price", "type": "plugin", "price_usd": null,
  "status": "rejected", "version": null, "marketplace_slug": null,
  "uuid": "com.packrat.gridprice", "variants": {}, "required_variants": [],
  "paths": {"dir": "plugins/grid-price", "package": null, "marketing": null},
  "keywords": ["electricity price", "energy tariff", "octopus agile", "smart home energy", "solar"],
  "risk_flags": ["demand-risk:no-marketplace-search-signal",
                 "geo-limit:uk-nordics-au-only",
                 "platform-risk:single-provider-public-api",
                 "monetization:free-dominated-niche-14pct-paid"],
  "notes": "NO-GO 46.2/100. Best Stream Deck fit and cheapest build (12/15) of the money-saving research pass, killed by zero marketplace search demand (all matches were substring noise off 'powerpoint') and a 14-percent-paid energy shelf. Savings case is well documented at about GBP290/year on Octopus Agile. Reopen first if a non-Elgato distribution channel ever exists. If built at all, build free as a lead magnet."
}
```
