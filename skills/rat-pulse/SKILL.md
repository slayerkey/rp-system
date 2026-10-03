---
name: rat-pulse
description: Refresh Packrat product performance and marketplace change signals using canonical data sources.
---

# Rat Pulse

Refresh available product performance data, sales data, marketplace observations, competitor changes, and review outcomes.

## Marketplace intelligence

The canonical Marketplace intelligence collector is:

`node tools/marketplace/collect-marketplace-intelligence.mjs`

The scheduled GitHub Actions workflow is:

`.github/workflows/marketplace-intelligence.yml`

It must preserve dated snapshots under:

`data/marketplace/snapshots/YYYY-MM-DD/query-suggestions.json`

and regenerate:

`data/marketplace/marketplace-trends.json`

The legacy latest-file contract remains:

`data/marketplace/streamdeck_search_popularity.json`

Treat Marketplace Query Suggestions demand as Marketplace-wide evidence. Use the current result/category mix plus technical feasibility to classify an opportunity as Stream Deck, XENEON Edge/iCUE Widget, both, or neither. Do not invent separate platform-specific search popularity unless the live source exposes it.

A term is not "trending" merely because its current popularity is high. Trend claims require movement across multiple dated snapshots. If there is insufficient history, say so.

`popularity` is demand evidence, not sales or revenue. `exact_product_hits` is visible supply evidence, not units sold.

Store snapshots in canonical versioned or approved data storage rather than conversation memory.

Highlight consequential changes and route actionable gaps into Rat Validate or Rat Update.
