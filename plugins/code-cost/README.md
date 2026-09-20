# Claude & Codex Cost Lite

See what your AI coding actually costs, on a key, without opening a terminal.

## Setup

1. Install the plugin.
2. Drag **Cost** onto a key.
3. That is the whole setup. There is no account to create and no key to paste.

The figure appears within a minute. Press the key to switch between today, 7 days and 30 days,
or set the period and the tool filter in the key's settings panel.

## What it reads

Claude Code and Codex both save a session file for every conversation on your own computer.
This plugin reads those files and prices the tokens in them against published rates.

- Claude Code: `~/.claude/projects/`
- Codex: `~/.codex/sessions/`

Nothing is uploaded. Nothing is sent anywhere. The plugin makes no network requests at all.

## Reading the key

- The large figure is the estimated spend for the selected period.
- The small line underneath names the tool filter, when one is set.
- A red dot in the top corner means one of the models you used has no price on file, so the
  real figure is higher than the one shown.

Costs are an estimate from published token rates and will not match a bill exactly.

<!-- INTERNAL NOTES BELOW THIS MARKER -->

## Internal notes

Validation: `plugins/code-cost/VALIDATION.md`. GO 73.7/100, the only GO in the money-saving
research pass of 2026-08-21.

### Two traps that were live during the build

1. **Codex `total_token_usage` is cumulative per session.** Summing it across a session
   multiplies the real figure by the turn count. `last_token_usage` is the per-turn delta and is
   the only field safe to add. An early throwaway scan that summed the cumulative field reported
   20.4B tokens against a true figure near 4.9B.
2. **Codex `input_tokens` already includes the cached portion.** Subtract `cached_input_tokens`
   before pricing, or cached reads get charged at the full input rate.

### The price table is the maintenance liability

`src/pricing.ts` carries per-model rates, verified 2026-08-21. Anthropic rates come from the
bundled `claude-api` skill reference; cache write is 1.25x input and cache read is 0.1x input at
the standard TTL. OpenAI rates come from public pricing pages.

Unknown models resolve to `null` and raise the partial marker. Do not fill a gap with a guess:
a silently wrong dollar figure is worse than an obviously incomplete one. `codex-auto-review` is
a known unpriced label, a Codex internal sub-agent rather than a billable model, and accounts for
about 1 percent of turns on the owner's own logs.

### Verified on the owner's machine, 2026-08-22

240 Claude Code session logs and 32 Codex session logs. 30 day window: $3,660.58 across 24,073
turns and 4.87B tokens. By model: opus-5 $2,666.27, sonnet-5 $645.06, opus-4-8 $216.94,
gpt-5.6-sol $131.63.

### Not built yet

`code-cost-pro` ($7.99) is validated but not started. Its hero feature is the plan value
ratio (cost of usage against plan price), plus per-model and per-project breakdown, cache hit
rate, sparkline history and a Stream Deck + dial. The per-model and per-project rollups are
already computed in `total()` in `src/logs.ts` and are unused by Lite.

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
