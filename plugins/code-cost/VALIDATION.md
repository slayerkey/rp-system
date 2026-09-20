# Claude & Codex Cost Meter — Opportunity Validation

Slug: `code-cost` | Type: `plugin` | UUID: `com.packrat.codecost` | Date: 2026-08-21

Free tier: `code-cost` (Lite, $0). Paid tier: `code-cost-pro` ($7.99).

**Supersedes `plugins/api-spend/VALIDATION.md`.** That version required an organisation admin API key, which gated it to API customers. The owner holds Claude Pro and ChatGPT Plus/Pro consumer subscriptions and has no API spend, so he could not have dogfooded, screenshotted or supported his own product. This version reads local session logs instead: no key, no account, no network.

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 28.9 / 30 | `python tools/opportunity.py "claude" "claude code" "claude usage" "ai usage" "token" --category Plugins`. Best query `claude` popularity 91 = p96. All matches genuine: `claude` 91, `token` 22, `claude code` 20, `ai usage` 19, `usage` 17, `claude usage` 14. Corroborated off-marketplace: **CodeBurn (getagentseal/codeburn) has 9.6k GitHub stars, 3,400 of them in its first week**, and `ccusage` occupies the same niche. |
| Competition gap | 17.2 / 25 | 14 competing products, no entrenched leader in the *cost* sub-lane, no named premium org. This is the corrected number. An earlier pass scored 3.8 by matching on `openai`/`chatgpt`/`api`, which dragged in 31 generic AI plugins that do not compete with this. Narrowing to the Claude Code lane is the honest comparison set. |
| Monetization | 10.6 / 20 | Median paid comp $3.99 x 45 downloads; **64% of comps are paid**, the healthiest paid share of any lane examined in this research pass. |
| Build fit | 10 / 15 | Simpler than the API version it replaces. Local JSONL parsing, no network, no secrets, no auth. `plugins/_shared/` supplies the SVG key-badge renderer and view helpers; the poller watches the filesystem instead of HTTP. **Verified on the owner's machine:** 240 Claude Code session logs, 30,482 assistant turns carrying `model` plus full token breakdown, and 32 Codex session logs with 5,148 token records. **Deducted for:** a per-model price table that needs a source and a refresh story (CodeBurn pulls LiteLLM daily); no profile-builder coverage since this is a plugin; and Cursor's data lives in a SQLite `state.vscdb`, a third parser if Pro ever covers it. |
| Risk | 7 / 10 | No IP holder, no trademark, no game, no anti-cheat, no credential at rest, no ToS question since the plugin reads the user's own files on the user's own disk. **Deducted for:** the Claude Code JSONL schema is **undocumented** and Anthropic can change it without notice, which is the single biggest platform risk here; price-table drift as models and rates change; and a trend-linked category. |
| **Total** | **73.7 / 100** | **Verdict: GO** |

**This is the only GO produced in this research pass.** For reference, the entire ten-sport tracker slate topped out at NBA Tracker on 63.9, and the money-saving candidates scored 46 to 58.

---

## Recommended Listing Name

**`Claude & Codex Cost Meter`** (25 chars). Pro: **`Claude & Codex Cost Pro`** (23 chars).

Term selection is data-led. `claude` scores 91 across 42 products and `codex` scores **50 across only 24 products**, beating `openai` (38 pop, 148 products) on both popularity and crowding. `chatgpt` is the #2 query at 89 but sits in a 148-product shelf and cannot honestly appear in the name, because the plugin does not read ChatGPT app usage. It goes in keywords and the first 250 description characters instead, which stays accurate because Codex ships with ChatGPT Plus and Pro.

**Codex coverage belongs in Lite, not Pro.** It is the same log parser, so gating it would be artificial crippling. Pro differentiates on the value ratio, history and breakdowns.

## Pricing Recommendation

| Comp | Type | Price | Downloads | Notes |
|---|---|---|---|---|
| Claude & Codex Usage (singerous) | plugin | free | 2,080 | Lane leader. Quota, not cost. |
| Burndown: AI Usage Monitor (Kuberstar) | plugin | free | 1,796 | Quota. |
| AI Usage Limits (2kit) | plugin | free | 1,629 | Quota. |
| **Claude Code Usage (AS Business Solutions)** | plugin | **$3.99** | 82 | **The real competitor.** Shows live cost for the current 5-hour billing block. See Competitor Analysis. |
| Claude Code Approver (Mlifell) | plugin | $3.99 | 67 | Adjacent, not a cost tool. |
| Burndown Pro (Kuberstar) | plugin | $7.99 | 45 | Closest Pro-tier analogue. Top of the paid band. |
| AI Token Tracker (Adx.cool) | plugin | $2.27 | 120 | Volume floor. |
| Claude Usage (Packrat) | plugin | $4.49 | 33 units / 30d | Owner's own bestseller. |

**Recommendation: Lite $0, Pro $7.99.** The direct comp band is $2.27 to $7.99 and $7.99 is its ceiling, matched exactly to Burndown Pro. **This is a deliberate reduction from the $9.99 in the superseded `api-spend` validation**, where the anchor was `market_command_center`, a different product in a different lane. The comp table here does not support $9.99. Revisit toward $9.99 after 90 days if Lite converts above Burndown's 2.5%.

## Device SKU Plan

One package, all devices (std, mini, XL, Plus), matching every plugin in this registry. Reads local files and renders SVG, nothing device-specific.

- **Windows: yes.**
- **macOS: yes, day one.** Log paths differ by OS but both resolve from the home directory. No native dependency.

## Top 5 Keywords

1. claude
2. codex
3. claude code
4. token cost
5. ai usage

## Risk Flags

- `platform-risk:undocumented-claude-code-jsonl-schema` — the log format is not a published contract. A Claude Code update can change it and silently break parsing. Mitigate with defensive parsing and a visible "cannot read logs" key state rather than a wrong number.
- `maintenance:per-model-price-table-drift` — rates and model IDs change. Needs a refresh path, not a hardcoded constant.
- `competition:incumbent-already-shows-block-cost` — Claude Code Usage at $3.99 already displays live cost for the current billing block. Differentiation is history, per-model, per-project and the value ratio, not cost itself.
- `evergreen-risk:trend-linked-category` — AI tooling demand is trend-linked.

---

## Overview

What Claude Code has actually cost, on a key. Today, this week, this month, by model, and the one number nobody else shows: what your subscription returned against what you paid for it.

## Market Demand

`claude` 91 and `claude code` 20 on the marketplace. Off-marketplace the signal is much stronger: CodeBurn at 9.6k stars with 3,400 in week one, plus `ccusage`, both solving exactly this.

**The decisive detail:** CodeBurn already ships a macOS menubar app, a Windows tray app and a GNOME Shell extension. Those exist because a TUI you must open does not satisfy the want. People want the number ambient. **There is no Stream Deck version of any of this.** That is the gap, and it is the one thing a Stream Deck does better than a terminal.

Owner corroboration: `claude_usage` is the #1 paid product by velocity in the 62-SKU catalogue at 33 units in 30 days, and the AI usage line runs $61.77/mo per SKU against $15.06 for icon packs. **Grok and Perplexity usage both sold zero**, which isolates the mechanism: buyers are people running against a limit on money already committed.

## Competitor Analysis

**Correction carried forward:** an earlier pass in this research claimed "0 of 32 competitors track billing dollars." That was a check on product *names*, not features, and it does not hold. **Claude Code Usage** ($3.99, 82 downloads) has a "Current Block" action showing live cost, tokens or percent utilisation of the active 5-hour billing window.

What no competitor found does:

| Capability | Incumbents | This product |
|---|---|---|
| Current-block cost | Claude Code Usage, $3.99 | yes |
| Historical cost (today / 7d / 30d / all time) | none | yes |
| Per-model breakdown | none | yes |
| Per-project breakdown | none | Pro |
| Codex alongside Claude, costed | none | Pro |
| **Subscription value ratio** | **none** | **yes** |

## API Recommendation

**None. No network calls at all.** Data sources verified on the owner's machine:

- **Claude Code:** `~/.claude/projects/<sanitized-path>/<session-id>.jsonl`. 240 files, 30,482 turns with `model` plus `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`.
- **Codex:** `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. 32 files, 5,148 token records including `cached_input_tokens` and `reasoning_output_tokens`.

Cost is arithmetic: tokens x per-model rate, cache reads and cache writes priced separately. A price table must ship with the plugin and be refreshable.

## Technical Notes

CodeBurn is **MIT licensed**, so its approach is legally reusable, but write an independent parser rather than vendoring it. Precedent in this registry: `hwinfo` was rejected partly on `license:gpl-adjacent-clean-room-required`, so the factory already treats third-party licensing as a first-class concern.

Poll on a timer and stat the log directory for changes rather than re-parsing 240 files every tick. Cache aggregates; only parse sessions whose mtime moved.

## Feature List (v1 Lite, free)

1. Today's cost across Claude Code and Codex
2. This week's cost
3. Tap to cycle Today / 7d / 30d
4. Token count for the selected period
5. Clear "cannot read logs" state rather than a wrong number

## Premium Features (Pro, $7.99)

1. **Subscription value ratio**: cost of usage against plan price, the headline number
3. Per-model breakdown (Opus vs Sonnet vs Haiku share)
4. Per-project breakdown
5. Cache hit rate
6. Sparkline history on the key
7. Stream Deck + dial to scrub periods, touchstrip shows the breakdown
8. Budget threshold with colour alarm

## UI Ideas

A key is 72x72, so the dashboard does not shrink onto one key. It spreads across the deck: one key per stat, each a large number with a small label, tap to cycle period. A six-key row becomes the dashboard spatially. The value-ratio key is the hero and should be the product's cover image.

## Marketplace Positioning

Lite is distribution. `better_hotkeys___mouse` did **97 units in 5 days free** against Pro's 3 in the same window. Lite must fully solve the Claude Code cost case so someone can use it forever and be happy. Pro earns its price on Codex, the value ratio and history.

## Confidence Score

**76 / 100.** Higher than the superseded API version on buildability and dogfooding, lower on competitive clarity now that the incumbent is known to show block cost. Main uncertainty is whether the value-ratio framing is enough differentiation against a $3.99 product that already shows a cost number.

## Build Recommendation

**GO.** Build Lite and Pro together. The owner can dogfood immediately: 240 Claude Code sessions and 32 Codex sessions already on disk.

## Implementation Plan

1. Extract a `usage-logs` reader into `plugins/_shared/`: enumerate sessions, parse turns, emit `{ts, tool, model, tokens}`. → verify: unit test against recorded fixtures from both formats.
2. Price table module with per-model input/output/cache-read/cache-write rates and a documented refresh path. → verify: known token counts produce known dollars.
3. Aggregator: period bucketing, per-model and per-project rollups, value ratio. → verify: totals reconcile against a full re-parse.
4. Key renderer reusing the `_shared` SVG badge. → verify: renders at 72x72 and 144x144.
5. Lite actions (cost, period cycle). → verify: `streamdeck validate` clean.
6. Pro actions (value ratio, per-model, Codex, dial). → verify: `streamdeck validate` clean, separate UUID namespace.
7. `python tools/qa/qa_gate.py code-cost` and `code-cost-pro`. → verify: clean, including `package.devices` and `copy.fit`.

## Roadmap

v1.1 adds Cursor via its SQLite `state.vscdb`. v1.2 adds Gemini CLI. Both are parser work only, no new architecture.

## Proposed registry.json Entry

```json
"code-cost": {
  "name": "Claude & Codex Cost Meter", "type": "plugin", "price_usd": 0.0,
  "status": "validated", "version": "0.1.0.0", "marketplace_slug": null,
  "uuid": "com.packrat.codecost", "variants": {}, "required_variants": [],
  "paths": {"dir": "plugins/code-cost", "package": null, "marketing": "plugins/code-cost/marketing"},
  "keywords": ["claude", "codex", "claude code", "token cost", "ai usage"],
  "risk_flags": ["platform-risk:undocumented-claude-code-jsonl-schema",
                 "maintenance:per-model-price-table-drift",
                 "competition:incumbent-already-shows-block-cost",
                 "evergreen-risk:trend-linked-category"],
  "notes": "GO 73.7/100, the only GO in the money-saving research pass. Supersedes api-spend. Reads local session logs, no API key or account. Verified on owner's machine: 240 Claude Code logs / 30482 turns, 32 Codex logs / 5148 token records."
}
```
