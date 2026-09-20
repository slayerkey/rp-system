# Validation: AI Usage Tracker (combined, paid)

Idea: a single **paid** Stream Deck plugin showing usage/limits for all AI providers at once, replacing
the current one-SKU-per-provider model. Owner's explicit preference (2026-08-09): **no Lite tier** —
a free tier would cannibalise eight already-selling paid SKUs.

Data freshness: `data_age_days: 0`. Sales data: `streamdeck-mymarketplace-sold/sales_summary.json`
(export window 2025-10-01 to 2026-07-27, 11 days stale at time of writing).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 19.0 | Best query `token` = popularity 22 (p63). Weakest *marketplace-search* demand of the candidates — but see the override below: this is the only idea where search data is not the best available evidence, because Packrat already sells in this category. |
| Competition gap (0-25) | 22.8 | 4 competing products, none entrenched. Notably **Kuberstar already runs this exact Lite-to-Pro play**: Burndown: AI Usage Monitor (free, 1,796 dl) → Burndown Pro ($7.99, 45 dl), a 2.5% conversion. Also AI Usage Limits (2kit, free, 1,629 dl) and AI Usage Monitor (Joshua Clarke, $2.99, 15 dl). |
| Monetization (0-20) | 9.7 | Median paid comp $5.49 x 30 dl; 50% of comps paid. |
| **Deterministic subtotal (0-75)** | **51.5** | From `tools/opportunity.py` |
| Build fit (0-15) | 12 | **Best build fit of anything validated.** All eight providers are already implemented and already compile into every build: `../claude-usage-streamdeck/src/providers/active.ts` holds a `REGISTRY` of claude, codex, openai, cursor, gemini, copilot, grok, perplexity, and `BUILD.id` merely selects *one* at build time. No new provider integration, no new auth work, no new parsing. Remaining work is a multi-provider action, per-key provider selection, a combined rollup view, and PI changes. Deduct 3: `package.json`'s `dist:all` currently builds only 4 of 8 providers (claude, codex, openai, cursor), so the pipeline needs extending, and the rollup view is genuinely new UI. |
| Risk (0-10) | 5 | Deduct 5, driven mainly by one structural issue: these read **undocumented, unofficial endpoints**. Per the `ai-usage` widget's own registry notes, Anthropic gates browser access behind `anthropic-dangerous-direct-browser-access`, the OAuth usage endpoint is undocumented, and the plugin authenticates with Cookie and User-Agent headers. A combined SKU multiplies that breakage surface by eight — any provider changing auth breaks one-eighth of a single paid product rather than one of eight independent products, and refunds land on the whole thing. Also counted: cannibalisation of eight live SKUs, and real competition now exists where it recently did not. |
| **Qualitative subtotal (0-25)** | **17** | |
| **TOTAL (0-100)** | **68.5** | |

## Verdict: **LEAN-GO by formula — treat as GO on owner sales evidence**

68.5 sits just under the 70 line, and this is the clearest case in the whole research pass where the
formula is the weaker instrument. Two reasons to override upward, both evidential rather than optimistic:

1. **Packrat already wins this category commercially.** `claude_usage` is the **#1 paid product by
   velocity in the entire 62-product catalogue** at 33.5 units/month. The usage family
   (claude/chatgpt/codex/cursor/copilot/gemini) accounts for the top cluster of paid velocity. Kuberstar's
   Burndown Pro has 45 lifetime downloads; `claude_usage` alone did 33 units in 30 days. The marketplace
   search score of p63 is measuring the wrong thing — buyers are arriving, they just are not arriving via
   the word "token".
2. **The scoring formula is calibrated too harshly for this class.** Running the same tool against
   `hotkeys` returns **48.2/75** — meaning Better Hotkeys, the owner's strongest free anchor (97 installs
   in its first 5 days), would score NO-GO. Any verdict near the threshold should be read with that
   correction in mind.

### SETTLED 2026-08-09: stack, do not replace

Owner's decision: the eight existing single-provider SKUs **remain on sale as the entry tier**, and the
combined all-eight SKU **sits above them at $10.99**. This makes the singles the de-facto Lite tier and
reproduces the Better Hotkeys funnel without shipping a new free product.

This **resolves the cannibalisation risk** that was the main open question — the $3.99-5.99 impulse entry
point stays intact rather than being replaced, so the combined SKU adds a tier instead of competing with
its own catalogue. The `cannibalization:eight-live-single-provider-skus` risk flag has been dropped from
the registry accordingly.

## Also researched

- **The "combined one" the owner half-remembered exists, but it is a different platform.** Registry
  `ai-usage` = "AI Usage Dashboard", **$9.99, type `widget`, status `built`, never published** — a Corsair
  iCUE Xeneon Edge widget, not a Stream Deck plugin. It is also **blocked**: its notes state it reads from
  the Stream Deck plugin over `127.0.0.1` and "the bridge endpoint does not exist yet on the plugin side."
  So it is not the product described here, and building this plugin's combined view would also be the
  natural moment to implement that `GET /usage` bridge and unblock the widget. Two products, one change.
- Registry notes already record the category as "highest-demand in the Packrat catalogue ($320 across 6
  SKUs in ~30 days on Stream Deck)" — consistent with the sales export.
- Competitive posture has shifted since those notes: two free competitors now sit at ~1,600-1,800
  downloads. Free incumbents did not stop Better Hotkeys, but they do argue against ever shipping a free
  Lite here, reinforcing the owner's call.

## Recommended listing

- **Name:** "AI Usage Tracker" (16 chars). Avoid "AI Usage Monitor" (taken by Joshua Clarke) and
  "AI Usage Limits" (taken by 2kit).
- **Price:** **$10.99**, set by owner 2026-08-09 ("the eleven"), above the $9.99 the comp table alone
  suggested. Supporting evidence: the catalogue's own highest-ASP strong seller
  (`market_command_center`, $9.99) sustains 11.2 units/month, so double-digit pricing is proven here
  rather than an untested stretch, and it sits above eight singles priced $3.99-5.99. Burndown Pro's
  $7.99 is the competitive ceiling to clear on features, not price.
  **WARNING: per CLAUDE.md, price cannot be changed in Maker Console later — only by emailing
  maker@elgato.com. Treat $10.99 as a commitment, not an experiment.**
- **Device SKU plan:** plugin, no std/xl split. Cross-platform inherits whatever the existing
  single-provider builds already support.
- **Top 5 keywords:** `ai usage`, `claude usage`, `chatgpt usage`, `token usage`, `ai limits`.
- **Risk flags:** `platform-risk:undocumented-provider-endpoints` (8x breakage surface in one SKU),
  `competition:free-incumbents-1600-1800dl`, `evergreen-risk:trend-linked-category`.

Next step: `/rat-build ai-usage-tracker` — no open questions remain.
