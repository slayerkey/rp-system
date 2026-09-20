# Claude & OpenAI Cost Monitor — Opportunity Validation

Slug: `api-spend` | Type: `plugin` | UUID: `com.packrat.apispend` | Date: 2026-08-21

Free tier: `api-spend` (Lite, $0). Paid tier: `api-spend-pro` ($9.99).

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 28.9 / 30 | `python tools/opportunity.py "claude" "openai" "chatgpt" "api" "usage" "token" --category Plugins`. Best query `claude` popularity 91 = p96 of all tracked queries. **These are genuine matches, not substring noise**: `claude` 91, `chatgpt` 89, `openai` 38, `token` 22, `claude code` 20, `ai usage` 19, `claude usage` 14. The two highest-popularity software queries on the whole marketplace are `claude` and `chatgpt`. |
| Competition gap | 3.8 / 25 | Tool counted 31 competing products plus a named premium org. **The eyeball check the rubric mandates changes the reading.** A sweep of all 32 AI/cost-adjacent plugins found **0 of 32 frame themselves around money**: no product name contains cost, spend, bill, billing or dollar. All 31 counted competitors track subscription quota percentage. Not one tracks API billing dollars. The tool is scoring the quota lane, which this product does not enter. See flip-to-GO condition 1. |
| Monetization | 8.5 / 20 | Median paid comp $4.49 x 14 downloads; 51% of comps are paid. Understates the ceiling: the owner's own `market_command_center` runs $9.99 at 11.1 units/mo, the strongest per-SKU plugin in the catalogue. |
| Build fit | 9 / 15 | `plugins/_shared/` carries the background poller, SVG key-badge renderer and view helpers wholesale, proven across six shipped sport trackers. Net new work is two REST clients, a property-inspector secret field, and budget/projection state. **Deducted for:** profile builders (`profiles/_build/common.py`) give zero coverage since this is a plugin; secret-at-rest handling is new to this codebase and no existing Packrat plugin stores a credential; and the `cost_report` response shape is unverified against a live admin key, so the per-workspace breakdown is a hypothesis, not a promise. |
| Risk | 8 / 10 | No IP exposure, no game, no anti-cheat surface, no trademark holder to clear. Both endpoints are **documented, versioned, public** APIs, a real durability advantage over the existing Packrat quota line which depends on undocumented provider endpoints (`platform-risk:undocumented-provider-endpoints` on `ai-usage-tracker`). **Deducted for:** admin keys are org-owner scoped, shrinking the addressable pool; and AI tooling is a trend-linked category rather than evergreen. |
| **Total** | **58.2 / 100** | **Verdict: LEAN-GO** |

### LEAN-GO, exact conditions to flip to GO (need +11.8 pts)

Either one clears it alone.

1. **Competition gap 3.8 to 15+ (+11.2):** Re-run the deterministic tool on keywords that isolate the cost lane rather than the quota lane, for example `python tools/opportunity.py "api cost" "spend" "billing" "budget" --category Plugins`. The 31 counted competitors were matched on `usage` and `token`, which are quota words. Verified by direct sweep: 0 of 32 name-match on cost, spend, bill or dollar. If the competitor count collapses as expected, this alone clears GO.
2. **Owner sales-evidence override:** `registry.json` already records this exact manoeuvre for `ai-usage-tracker`: "LEAN-GO 68.5/100 by formula, TREAT AS GO on owner sales evidence". The evidence here is stronger. `claude_usage` is the #1 paid product by velocity in the 62-SKU catalogue at 33 units in 30 days, and the AI usage line runs $61.77/mo per SKU against $15.06 for icon packs.

**Recommendation: satisfy condition 1 before committing build time.** It is a two-minute tool re-run and it converts a judgment call into a number.

---

## Recommended Listing Name

**`Claude & OpenAI Cost Monitor`** (28 chars, inside the 30-char cap). Leads with `claude`, the highest-popularity query available at 91, then states the job. Pro tier: **`Claude & OpenAI Cost Pro`** (24 chars).

## Pricing Recommendation

| Comp | Type | Price | Downloads | Notes |
|---|---|---|---|---|
| Market Command Center (Packrat) | plugin | $9.99 | 11.1 units/mo | Best internal anchor. Owner's strongest per-SKU plugin at $110.40/mo. Proves $9.99 moves in this exact slot. |
| Burndown Pro (Kuberstar) | plugin | $7.99 | 45 | Nearest direct competitor's paid tier, converting off 1,796 free installs (2.5%). |
| Claude Code Usage (AS Business Solutions) | plugin | $3.99 | 82 | Cheap end of the quota lane. |
| AI Token Tracker (Adx.cool) | plugin | $2.27 | 120 | Volume floor. $272 lifetime gross. |
| AI Limit Lens (Olanlab) | plugin | $50.00 | 1 | Ceiling proof. $50 does not move. |
| Packrat AI usage line | plugin | $4.49 to $6.99 | 33/11/10/10/3 | Underpriced against the value claim. |

**Recommendation: Lite $0, Pro $9.99.** $9.99 sits above every AI comp and matches an ASP already proven to move units in this catalogue. Do not exceed it on v1: **price cannot be changed in Maker Console and requires emailing maker@elgato.com**, so this is close to irreversible.

## Device SKU Plan

One package, all devices (std, mini, XL, Plus), matching every other plugin in this registry (`variants` empty). Pure network polling plus SVG key rendering, nothing OS-specific.

- **Windows: yes.**
- **macOS: yes, day one.** No native dependency. Stream Deck's `setImage()` accepts an SVG string, per the build note in `plugins/nba-tracker/VALIDATION.md`.

## Top 5 Keywords

1. claude
2. openai api cost
3. api spend
4. token cost
5. ai budget

## Risk Flags

- `platform-risk:admin-key-required-org-owner-scoped` — both providers gate cost endpoints behind an organisation admin key. Trivial for a solo developer, a hard blocker for an employee inside a larger company. Sizes the addressable market down.
- `security:user-supplied-admin-key-at-rest` — the key lands in Stream Deck global settings, plaintext on disk. Must be disclosed in the listing. No existing Packrat plugin stores a credential, so this is new ground.
- `competition:free-quota-incumbents-1600-2100dl` — Claude & Codex Usage 2,080, Burndown 1,796, AI Usage Limits 1,629. None tracks dollars today, any could add it.
- `evergreen-risk:trend-linked-category` — AI tooling demand is trend-linked, not evergreen.

---

## Overview

The live dollar amount your API keys have burned today, on a key, so a runaway loop costs five minutes instead of a month.

## Market Demand

`claude` 91 and `chatgpt` 89 are the two highest-popularity software queries on the marketplace. Owner analytics (`streamdeck-mymarketplace-sold/sales_summary.json`, 2025-10-01 to 2026-07-27) put the AI usage category at $61.77/mo per SKU, the highest of any multi-SKU category, with `claude_usage` at 33 units in 30 days.

**The controlled comparison worth noting:** eight AI usage SKUs shipped with the same code, art, price band and launch window. Claude 33, Cursor 11, ChatGPT 10, Codex 10, Copilot 3, Gemini 2, **Grok 0, Perplexity 0**. The two zero-sellers are the two where the buyer is not running against a limit tied to committed money. Moving from a percentage of a quota to actual dollars strengthens that mechanism rather than weakening it.

## Competitor Analysis

Full sweep of AI/cost-adjacent Stream Deck plugins, 2026-08-07 scrape:

| Product | Price | Downloads | Tracks |
|---|---|---|---|
| Claude & Codex Usage (singerous) | free | 2,080 | quota |
| Burndown: AI Usage Monitor (Kuberstar) | free | 1,796 | quota |
| AI Usage Limits (2kit) | free | 1,629 | quota |
| Claude Peak Ticker (VROTEK) | free | 1,242 | quota |
| Codex Usage Monitor (Status Check) | free | 984 | quota |
| AI Limits (postgresql.co.kr) | free | 923 | quota |
| AI Token Tracker (Adx.cool) | $2.27 | 120 | tokens |
| Burndown Pro (Kuberstar) | $7.99 | 45 | quota |

**0 of 32 products in this lane frame themselves around money.** The dollar-billing lane is empty.

## API Recommendation

- **Anthropic:** `GET /v1/organizations/cost_report`. USD by service and workspace, daily buckets. Admin key (`sk-ant-admin...`). Shipped mid-2025; Enterprise Analytics API with per-user cost attribution followed in March 2026.
- **OpenAI:** `GET /v1/organization/costs`. Daily granularity via `start_time`, `end_time`, `bucket_width=1d`. Admin key from platform.openai.com/settings/organization/admin-keys.

Both read-only. Both free to call with no per-request charge. This matters: see `plugins/cloud-bill/VALIDATION.md` for the opposite case, where the obvious endpoint bills $0.01 per request.

## Technical Notes

Poll every 15 minutes; cost data is daily-bucketed so faster gains nothing. Cache last-good response and render a staleness indicator on network failure, matching the offline-fallback pattern in `plugins/_shared/`. Never transmit the key anywhere except the provider.

## Feature List (v1 Lite, free)

1. Today's spend for one provider
2. Month-to-date spend
3. Last-refresh timestamp
4. Tap to cycle day / month / projection
5. Offline-safe last-good value

## Premium Features (Pro, $9.99)

1. All providers on one key
2. User-set budget with colour alarm
3. Month-end projection
4. Per-API-key and per-workspace breakdown
5. Spike detection against a 7-day baseline
6. Multi-key rotation

## Marketplace Positioning

Lite is distribution. Owner evidence is unambiguous: `better_hotkeys___mouse` did **97 units in 5 days free** against Better Hotkeys Pro's 3 in the same window. Lite must genuinely solve the basic problem, not be crippled: one provider, today plus month-to-date, usable forever. Pro compounds because budgets, projections and spike baselines all need history the user accumulates.

## Confidence Score

**82 / 100.** Deductions: admin-key gating may shrink the pool more than expected; free quota incumbents at 1,600 to 2,100 installs could add billing dollars; the category is trend-linked.

## Build Recommendation

Build after satisfying flip-to-GO condition 1. Ship Lite and Pro together so Lite can do its job.

## Implementation Plan

1. Re-run `tools/opportunity.py` on cost-specific keywords. → verify: competitor count drops and competition gap clears 15.
2. Scaffold `api-spend` and `api-spend-pro` from an existing tracker, own UUID namespace each (precedent: `better-hotkeys` / `better-hotkeys-pro`). → verify: `streamdeck validate` clean on both.
3. Anthropic `cost_report` client against a live admin key, recorded as a fixture in `plugins/_shared/`. → verify: fixture test green, response shape confirms or kills the per-workspace feature.
4. OpenAI `costs` client, same pattern. → verify: fixture test green.
5. Key renderer: dollars, colour band, staleness dot. → verify: renders at 72x72 and 144x144.
6. Property inspector with secret field and budget input. → verify: round-trips through global settings.
7. `python tools/qa/qa_gate.py api-spend` and `api-spend-pro`. → verify: clean, including `copy.fit`.

## Roadmap

v1.1 folds the cloud providers from `plugins/cloud-bill/VALIDATION.md` into Pro, converting that idea's two fatal weaknesses (zero marketplace search demand, hard IAM setup) into an upsell to an audience that has already onboarded once.

## Proposed registry.json Entry

```json
"api-spend": {
  "name": "Claude & OpenAI Cost Monitor", "type": "plugin", "price_usd": 0.0,
  "status": "validated", "version": "0.1.0.0", "marketplace_slug": null,
  "uuid": "com.packrat.apispend", "variants": {}, "required_variants": [],
  "paths": {"dir": "plugins/api-spend", "package": null, "marketing": "plugins/api-spend/marketing"},
  "keywords": ["claude", "openai api cost", "api spend", "token cost", "ai budget"],
  "risk_flags": ["platform-risk:admin-key-required-org-owner-scoped",
                 "security:user-supplied-admin-key-at-rest",
                 "competition:free-quota-incumbents-1600-2100dl",
                 "evergreen-risk:trend-linked-category"],
  "notes": "Free Lite tier. LEAN-GO 58.2/100. Deterministic competition gap 3.8/25 is an artifact: 0 of 32 AI plugins track billing dollars, the tool scored the quota lane. Flip to GO by re-running opportunity.py on cost-specific keywords."
}
```
