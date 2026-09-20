# Claude & Codex Cost Pro

Is your plan paying for itself?

## Setup

1. Install the plugin.
2. Drag **Plan Value** onto a key and set what your plan costs per month.
3. That is the whole setup. No account, no key to paste.

## The keys

- **Plan Value** - your last 30 days priced at token rates, divided by your plan price. Above
  1x the plan has paid for itself.
- **Cost** - today, 7 days or 30 days, with an optional monthly budget bar.
- **Breakdown** - top three by model or by project. Press to swap.
- **Cache Hit** - the share of your prompt served from cache and what it saved.
- **Trend** - one bar per day, up to 30.

On a Stream Deck +, the dial on the Cost action scrubs between periods.

Costs are an estimate from published token rates and will not match a bill exactly.

<!-- INTERNAL NOTES BELOW THIS MARKER -->

## Internal notes

Validation lives in `plugins/code-cost/VALIDATION.md` (covers both tiers).

Imports the Lite parser and price table by relative path (`../code-cost/src`) rather than
forking, the same idiom `plugins/_shared` uses. Changing `logs.ts` or `pricing.ts` therefore
rebuilds both products; rebuild Lite too after touching either.

Two art bugs found by rendering against real data and fixed: the breakdown rows collided
because full model ids are too wide next to a dollar figure (see `prettyModel` in
`src/faces.ts`), and cache hit read a pinned 100 percent until cache writes were added to the
denominator.

## QA waivers

2026-08-23. Four `registry.risk` warnings waived to submit. All four are inherent
characteristics of the product rather than fixable defects, and none is an IP or trademark
risk, so there is no rights holder to clear. Validation scored Risk 7/10, well above the 4/10
floor that would force a sign-off.

- `platform-risk:undocumented-claude-code-jsonl-schema`, the log format is not a published
  contract. Mitigated in code: parsing is defensive per field and an unreadable log shows a
  "NO LOGS FOUND" key rather than a wrong number.
- `maintenance:per-model-price-table-drift`, rates and model ids change. Mitigated: an unknown
  model resolves to no price and raises the incomplete marker instead of guessing a rate.
- `competition:incumbent-already-shows-block-cost`, Claude Code Usage ($3.99) already shows
  current-block cost. Accepted: differentiation is history, per-model, per-project and Plan
  Value, not the cost figure itself.
- `evergreen-risk:trend-linked-category`, AI tooling demand is trend-linked, not evergreen.
  Accepted as a category bet.
