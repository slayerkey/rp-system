# Validation: To-Do List

Idea: Stream Deck plugin showing tasks on keys — tap to complete, visual progress, daily reset.
Lite = local task list; Pro = sync with Todoist / Notion / Microsoft To Do.

Data freshness: `data_age_days: 0`.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 14.7 | Best query `task` = popularity 17 = **p49** — literally median. `todo`, `to do list` and `todo list` return no meaningful tracked query volume at all. This is the weak point and it is not recoverable by reframing: people are not searching the Stream Deck marketplace for task management. |
| Competition gap (0-25) | 25.0 | **0 competing products.** Maximum score — but read this honestly: with p49 demand, an empty field is at least as likely to mean "nobody wants this here" as "nobody has built it yet." An empty category is only an opportunity when demand is independently proven, and here it is not. |
| Monetization (0-20) | 6.0 | Tool's own words: "no comps: unproven niche, default mid-low." There is no evidence anyone has ever paid for this on this marketplace. |
| **Deterministic subtotal (0-75)** | **45.7** | From `tools/opportunity.py` |
| Build fit (0-15) | 12 | Easiest build of any candidate. Lite is local state plus key rendering — no native code, no OAuth, no polling. `plugins/_shared`'s SVG key-badge renderer handles task text on keys directly. Deduct 3 for Pro's third-party sync (Todoist/Notion/MS To Do each mean separate auth and API work, and Notion in particular is rate-limited and awkward). |
| Risk (0-10) | 8 | Very clean. No IP, no trademark, no anti-cheat, no undocumented endpoints, no OS API churn. Deduct 2 only for Pro's dependency on third-party APIs that can change terms or rate limits. |
| **Qualitative subtotal (0-25)** | **20** | |
| **TOTAL (0-100)** | **65.7** | |

## Verdict: **LEAN-GO — but the weakest evidence of any candidate**

65.7 lands in the LEAN-GO band, and I want to be precise about *why*, because the number flatters it:
**the score is carried almost entirely by ease of building and absence of risk, not by evidence that
anyone wants it.** Demand is p49 and monetization is a default placeholder for "unknown." Strip the
build-fit and risk points and there is a 45.7 underneath with no proof of demand.

This is the opposite shape from Calendar, which scores well because of demand (p93) and a *successful*
paid competitor. Here there is no competitor because there may be no market.

It also fits the owner's own winning pattern only weakly. Every top-velocity paid product in the
catalogue is **live data arriving from somewhere else** that the user glances at repeatedly. A to-do list
is data the user has to type in first. That is a meaningfully different, higher-friction product, and the
one static-utility data point in the catalogue (`autorun`, 4.3 units/month, $9.98 lifetime) is
discouraging.

### What would flip it to GO

Genuine external evidence of demand, since the marketplace data cannot supply it: Stream Deck community
requests for task display, or the existence of a *successful* to-do plugin on a comparable device
ecosystem. Absent that, this is a coin-flip dressed up as a 65.

### Cheaper way to test the same instinct

The appeal here is probably "glanceable personal state on a key," which **Calendar already delivers with
proven demand**. If Calendar ships and its agenda view lands well, a task list becomes a natural Pro
feature or sibling with a warm audience and near-zero marginal build cost — rather than a standalone bet
placed on p49 demand. Recommend deferring rather than rejecting.

## Recommended listing

Deferred, not rejected. If revived: name "To-Do List" (10 chars), Lite free / Pro $4.99-6.99, keywords
`todo`, `task list`, `to do list`, `tasks`, `productivity`. Note that no keyword in this set carries
meaningful search volume, so this product would have to be discovered by browsing or by cross-sell from
an existing Packrat plugin — which is another argument for shipping it attached to Calendar rather than
alone.

- **Risk flags:** `demand-risk:unproven-p49-no-comps` (zero competitors AND median search volume — empty
  category with no proof of appetite), `friction:user-must-input-data` (unlike every top-velocity product
  in the catalogue, the data does not arrive on its own).

Next step: **no build.** Revisit after Calendar ships, as a Calendar Pro feature or attached sibling.
