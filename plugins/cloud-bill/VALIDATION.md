# Cloud Bill Watch — Opportunity Validation

Slug: `cloud-bill` | Type: `plugin` | UUID: `com.packrat.cloudbill` | Date: 2026-08-21

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 10 / 30 (tool said 19.8, corrected down) | `python tools/opportunity.py "aws" "cloud" "server" "billing" "cost" --category Plugins` returned 19.8 on a best query of **`soundcloud` popularity 23**, with `loud` 20 and `clouds` 14 behind it. **Every one of those is substring garbage**, exactly the failure the rubric warns about. The only genuine match is `server` at popularity 13. Scored honestly at 10/30. There is **no marketplace search demand for aws, cloud cost, billing or spend.** |
| Competition gap | 20.0 / 25 | 9 competing products, no entrenched leader, no named premium org. Genuinely open shelf: `Cloudflare Utilities` free 797, `AWS Monitor` (Phantas) free **19**, `AWS Deck` $1.99 **0 downloads**. |
| Monetization | 2.7 / 20 | Median paid comp $9.00 x **0 downloads**. The paid entrant in this lane has never sold a copy. This is the worst monetization signal of the five and it is not a small-sample artifact: the free AWS entrant has 19 downloads, so the whole lane is close to dead on this marketplace. |
| Build fit | 7 / 15 | `plugins/_shared/` poller and renderer apply, but the data layer does not. **Deducted for:** AWS SigV4 request signing is net new and non-trivial; a multi-provider abstraction across AWS, Vercel and Cloudflare triples the surface; and no profile builder coverage. |
| Risk | 7 / 10 | Documented stable APIs, no IP exposure. **Deducted for a real design trap:** AWS Cost Explorer `GetCostAndUsage` bills **$0.01 per request**. Hourly polling would cost the user about $7.20/month, so a cost-saving product would itself cost more than it saves. Mitigation is to use the CloudWatch `EstimatedCharges` metric, which is free, but the trap must be documented or the product is self-defeating. Also deducted for IAM setup friction. |
| **Total** | **46.7 / 100** | **Verdict: NO-GO** |

### Why NO-GO, and what nearby idea scores better

The shelf is open and nobody is buying, which is the worst combination available. Competition gap 20.0 with monetization 2.7 is the signature of a niche that is empty because there is no demand, not because nobody built it. `AWS Deck` at $1.99 with **0 downloads** and `AWS Monitor` free at **19** are the direct evidence.

That is compounded by zero marketplace search demand. Marketplace search is the discovery channel for this business, and no one is typing these words into it.

The financial problem is real and the largest in the whole research pass. Cloud bill shock is well documented, including an AWS Bedrock case reported at $30,000 to $38,000 in a month where anomaly detection did not cover the Marketplace billing path. **The pain is real, the buyers are not on this marketplace.**

**Nearby idea that scores better:** `api-spend` (58.2, LEAN-GO). Same buyer, same pain shape, but it attaches to `claude` at popularity 91 and `chatgpt` at 89 instead of to words nobody searches.

**Recommended disposition: fold into `api-spend-pro` as a v1.1 feature, not a standalone SKU.** That converts both fatal weaknesses into strengths. Discovery is inherited from a listing that ranks on `claude`, and the IAM setup friction becomes acceptable because the user has already onboarded and is already paying.

---

## Recommended Listing Name

Not recommended standalone. If ever shipped: **`AWS & Cloud Cost Monitor`** (24 chars).

## Pricing Recommendation

| Comp | Type | Price | Downloads | Notes |
|---|---|---|---|---|
| Cloudflare Utilities (Pedro Fuentes Schuster) | plugin | free | 797 | Best performer in the lane, and it is not a cost product. |
| AWS Monitor (Phantas) | plugin | free | 19 | Free and still nearly unused. |
| AWS Deck (Mlifell) | plugin | $1.99 | **0** | The only paid entrant. Zero sales. |

**Recommendation: n/a, NO-GO as a SKU.** As an `api-spend-pro` feature it carries no separate price.

## Device SKU Plan

Would be one package, all devices, Windows and macOS. Pure network polling.

## Top 5 Keywords

1. aws cost
2. cloud billing
3. server cost
4. cloudflare
5. vercel

## Risk Flags

- `demand-risk:no-marketplace-search-signal` — all matched queries were substring noise (`soundcloud`, `loud`, `clouds`).
- `monetization:paid-entrant-zero-sales` — AWS Deck $1.99, 0 downloads.
- `api-cost-trap:cost-explorer-bills-per-request` — `GetCostAndUsage` is $0.01/request; must use CloudWatch `EstimatedCharges` instead or the product costs the user money.
- `friction:iam-credential-setup-required` — materially harder than pasting one key.

---

## Overview

Estimated AWS, Vercel and Cloudflare charges this month on a key, with an alarm before the invoice rather than after. Strongest financial problem in the research pass, weakest marketplace fit.

## API Recommendation

**Use CloudWatch `EstimatedCharges` (free), not Cost Explorer.** Vercel and Cloudflare both expose usage APIs with a bearer token, which is far lower friction than AWS IAM and would be the sensible starting point if this is ever built.

## Confidence Score

**61 / 100** in the NO-GO verdict. The competition and monetization numbers are hard data. The uncertainty is whether off-marketplace demand could be reached through other channels, which is outside what this rubric measures.

## Proposed registry.json Entry

```json
"cloud-bill": {
  "name": "AWS & Cloud Cost Monitor", "type": "plugin", "price_usd": null,
  "status": "rejected", "version": null, "marketplace_slug": null,
  "uuid": "com.packrat.cloudbill", "variants": {}, "required_variants": [],
  "paths": {"dir": "plugins/cloud-bill", "package": null, "marketing": null},
  "keywords": ["aws cost", "cloud billing", "server cost", "cloudflare", "vercel"],
  "risk_flags": ["demand-risk:no-marketplace-search-signal",
                 "monetization:paid-entrant-zero-sales",
                 "api-cost-trap:cost-explorer-bills-per-request",
                 "friction:iam-credential-setup-required"],
  "notes": "NO-GO 46.7/100. Biggest real-world financial pain in the money-saving research pass, smallest marketplace presence. Open shelf (comp gap 20/25) with dead monetization (2.7/20): AWS Deck $1.99 has 0 downloads, AWS Monitor free has 19. Fold into api-spend-pro as a v1.1 feature instead, which inherits discovery from a listing ranking on claude/chatgpt."
}
```
