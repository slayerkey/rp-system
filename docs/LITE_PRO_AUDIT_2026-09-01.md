# PackRat Lite → Pro audit — 2026-09-01

This is the durable portfolio ledger for PackRat Lite/Free synchronization and upgrade routing.

## Rules

- Pro is the technical source of truth only for verified editions of the same product.
- Standalone free products do not receive invented Pro upsells.
- Lite preserves shared bug and stability fixes while retaining Lite feature limits.
- A Lite upsell may ship only with a verified direct public Elgato Marketplace product URL.
- Marketplace search URLs, creator pages, generic `/icue` destinations and placeholder URLs are invalid upgrade targets.
- `products/lite-pro-map.json` is the canonical commercial relationship map.

## Verified commercial pairs

The direct URLs below were recovered from Elgato's live public Marketplace API for PackRat on 2026-09-01.

| Lite / Free | Pro counterpart | Platform | Source availability |
|---|---|---|---|
| Better Hotkeys & Mouse | Better Hotkeys & Mouse Pro | Stream Deck | local source required |
| DaVinci Resolve Lite | DaVinci Resolve Pro | Stream Deck profile | local source required |
| Window Manager Lite | Window Manager Pro | Stream Deck | private source verified in `slayerkey/vcs` |
| Workflow Automation Lite | Workflow Automation Pro | Stream Deck | local source required |
| Calendar Sync Lite | Calendar Sync Pro | Stream Deck | local source required |
| Epic Pen Profile | Epic Pen Pro Profile | Stream Deck profile | local source required |
| Claude & Codex Cost Lite | Claude & Codex Cost Pro | Stream Deck | local source required |
| Clipboard Manager | Clipboard Manager Pro | Stream Deck | local source required |
| Weather Timeline Lite | Weather Timeline Pro | XENEON Edge | updated and package-verified |
| Work Session Tracker Lite | Work Session Tracker Pro | XENEON Edge | updated and package-verified |
| Desk Notes Lite | Desk Notes Pro | XENEON Edge | updated and package-verified |
| PC Power Meter Lite | PC Power Meter Pro | XENEON Edge | updated and package-verified |

Exact URLs and Marketplace UUIDs for every pair are stored in `products/lite-pro-map.json`.

## XENEON rollout completed

The four accessible XENEON Lite products now use exact Pro product pages instead of search, creator, generic or placeholder destinations.

- Weather Timeline Lite → `https://marketplace.elgato.com/product/weather-timeline-pro-160c8019-ce77-49d8-a306-8ef1764a70c5`
- Work Session Tracker Lite → `https://marketplace.elgato.com/product/work-session-tracker-pro-f8e12d94-4354-41ca-b6da-beb2297fb9e2`
- Desk Notes Lite → `https://marketplace.elgato.com/product/desk-notes-pro-3d7e3110-68be-4774-a351-755c12c95268`
- PC Power Meter Lite → `https://marketplace.elgato.com/product/pc-power-meter-pro-53e57034-588b-498f-9882-12b4a8837098`

All four Lite packages were revised to `1.0.1`.

Fresh exact-link rebuild workflow: `XENEON Lite Pro Link Rebuild`, run `33545505510`.

For every product, the workflow successfully completed:

1. canonical shipping HTML generation
2. deterministic generation check
3. exact Pro URL assertion
4. rejection of invalid Marketplace destinations
5. official `icuewidget-cli@0.4.47` validation
6. official `.icuewidget` packaging
7. package extraction and root integrity verification
8. exact URL verification inside the packaged widget
9. native iCUE property regression
10. product-local verification where present
11. Marketplace/network regression where present

Fresh package SHA-256 values:

| Product | Version | SHA-256 |
|---|---:|---|
| Weather Timeline Lite | 1.0.1 | `28acb288621d867211d692aaef29c4e324515c59d440c9f1f97347eeb79a2079` |
| Work Session Tracker Lite | 1.0.1 | `e224c89b9f4c20f7f8b204fd88fca8f85fa62750d724dcc218c93074f02a3e7b` |
| Desk Notes Lite | 1.0.1 | `8239f29e9385cd6b4d8bfa9c098e1ae314b0c347cd44131bdc839347637514da` |
| PC Power Meter Lite | 1.0.1 | `96ad147b631fc6c46f7ba2bd05b675269cc732dac1d2dea5ef00d82ce51a0eb0` |

The older Real iCUE recovery workflow was also corrected so its Version 1 guard accepts legitimate `1.x` patch revisions rather than incorrectly rejecting `1.0.1`.

## Stream Deck local-source continuation

The connected canonical repository does not contain the shipping source for these active pairs:

- Better Hotkeys & Mouse Lite / Pro
- Clipboard Manager / Pro
- Workflow Automation Lite / Pro
- Calendar Sync Lite / Pro
- Epic Pen Profile / Pro Profile
- Claude & Codex Cost Lite / Pro
- DaVinci Resolve Lite / Pro profile source

Their exact Marketplace URLs are already solved and recorded. The remaining work is local-source synchronization, restrained Lite upsell implementation, build, host testing and packaging.

CS2 is intentionally not represented as a Lite → Pro relationship because the verified PackRat catalog does not establish such an edition pair.

AI Prompts Lite remains an ambiguous multi-product funnel. Multiple paid specialist packs exist, so no singular Pro counterpart should be invented.

## Standalone free

- Discord Essentials
- PackRat Network Probe
- Retro Terminal
- To-Do List
- PackRat Discord Bridge

These have no verified same-product Pro edition and should not receive an invented upgrade route.

## Future protection

`tools/lite_pro_audit.py` checks:

- Lite/Pro registry consistency
- free Lite vs paid Pro pricing
- valid direct Marketplace product URL shape
- search, creator and generic Marketplace destinations
- placeholder markers
- missing or unregistered Pro records
- ambiguous relationships

`.github/workflows/lite-pro-audit.yml` runs the portfolio guard.

`.github/workflows/xeneon-lite-pro-link-rebuild.yml` rebuilds and validates the four accessible XENEON Lite packages with exact direct upgrade links.

`.github/workflows/marketplace-catalog-extract.yml` is a manual maintenance workflow that fetches the complete live PackRat public Marketplace catalog from Elgato's API, so future URL verification does not depend on search-engine indexing.
