# Elgato Marketplace Search Intelligence

## Canonical data

PackRat maintains Marketplace search-demand history rather than relying on one permanent snapshot.

Latest compatibility snapshot:

`data/marketplace/streamdeck_search_popularity.json`

Dated history:

`data/marketplace/snapshots/YYYY-MM-DD/query-suggestions.json`

Generated trend view:

`data/marketplace/marketplace-trends.json`

Collector:

`tools/marketplace/collect-marketplace-intelligence.mjs`

Scheduled refresh:

`.github/workflows/marketplace-intelligence.yml`

The original 2026-08-29 snapshot is preserved in the dated history as the baseline for this system.

## Source

The collector reads the public Query Suggestions index used by Elgato Marketplace search:

`products_query_suggestions`

It first attempts to discover the public search-only Algolia configuration from the live Marketplace frontend. If Elgato changes frontend bundling, repository variables `PACKRAT_ALGOLIA_APP_ID` and `PACKRAT_ALGOLIA_SEARCH_KEY` can be set as a fallback without changing product code.

The public search-only key is treated as a public frontend credential, not a secret. Never use or store an Algolia admin key.

## Meaning of the fields

`popularity` is a rolling Marketplace search-demand value from the Query Suggestions index. It is not revenue, units sold, conversion rate, or a score capped at 100.

`rank` is the ordering in the captured suggestion index after normalization.

`exact_product_hits` is visible exact-result supply when the public record exposes a compatible count. It can be `null` if the current public schema stops exposing that value.

`top_exact_categories` records the visible product/result-type mix when exposed by the public record.

## Trend rules

`marketplace-trends.json` compares the newest snapshot with:

- the immediately previous saved snapshot;
- the closest saved snapshot at least 7 days older;
- the closest saved snapshot at least 30 days older.

A term is not called trending from one high popularity value. PackRat needs multiple dated captures before making a movement claim.

The generated `momentum` label is intentionally conservative:

- `rising`: at least +5 popularity points since the previous capture;
- `falling`: at least -5;
- `stable`: between those thresholds;
- `insufficient_history`: no prior saved observation.

The raw deltas remain more important than the label.

## Platform interpretation

Marketplace demand is treated as Marketplace-wide unless the live source explicitly exposes a platform-specific popularity field.

Then classify the opportunity separately:

- Stream Deck plugin/profile/icon product;
- XENEON Edge / CORSAIR iCUE Widget;
- both;
- neither.

For XENEON-specific research, restrict competitor/supply analysis to Marketplace Widgets and validate against the real current iCUE/XENEON provider ceiling.

For Stream Deck research, restrict implementation recommendations to the actual Stream Deck product types and SDK/profile constraints.

## RatPack workflow

The intended research flow is:

`sales data -> Rat Pulse -> Rat Gaps -> Rat Validate -> owner selection -> product chat -> Rat Build -> Rat QA -> Rat Art -> Rat Ship`

Use fresh Marketplace intelligence before a major product decision.

Historical snapshots are durable research evidence and should not be replaced by conversation memory.
