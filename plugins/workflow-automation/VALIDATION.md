# Validation: Workflow Automation (RE-VALIDATED 2026-08-09)

Re-run at owner's request after the Better Hotkeys calibration finding cast doubt on the original
same-day NO-GO. Idea: multi-step routine runner — sequences with delays, conditionals, and webhook calls.
Owner confirmed 2026-08-09 that game scope is acceptable, so the CLAUDE.md anti-cheat rule is treated as
resolved by owner decision and is no longer scored as a risk.

## Score (re-run, broader keyword set)

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 27.0 | Best query `multi` = popularity 50 = p89. **Read with caution:** `multi` is a loose substring match (177 hits) and is inflating this. The honest term is `macro` at popularity 35, and `workflow` is only 11. Real demand is solid but not p89-solid. |
| Competition gap (0-25) | 9.0 | The killer. **SuperMacro (BarRaider): 216,347 downloads, `last_published` 2026-08-07 — two days before this validation.** Not an abandoned incumbent; an actively maintained one. Plus Mac Automation (6,371), VBA Macro Execute (6,323), Magic Automa (3,635), Simple Macro (3,113). Tool flags both an entrenched leader and a named premium org. |
| Monetization (0-20) | 6.7 | Only 16% of comps are paid. Sole paid entrant **Humble Macro at $4.89 x 16 downloads** — the same failed-paid-utility signature as Quick Clipboard ($19.99 x 12). No one has ever monetised this category on this marketplace. |
| **Deterministic subtotal (0-75)** | **42.7** | From `tools/opportunity.py` |
| Build fit (0-15) | 9 | New plugin; no existing Packrat builder covers sequencing. Linear steps, delays, app-launch and keystroke injection are straightforward. Deduct 6 for conditionals, a sequence-builder Property Inspector (genuinely fiddly UI), and webhook/HTTP plumbing. |
| Risk (0-10) | 6 | Anti-cheat/house-rule concern **removed** per owner decision, which is what the original -6 hinged on. Remaining deduct 4: an actively-maintained 216k-download free incumbent, a category where users are firmly anchored on "this is free", and overlap with the built-in Multi-Action. Category itself is evergreen — macros are a decades-old permanently relevant concept. |
| **Qualitative subtotal (0-25)** | **15** | |
| **TOTAL (0-100)** | **57.7** | |

## Verdict: **LEAN-GO — but I was wrong to suggest calibration would rescue this**

Original verdict was NO-GO at ~54. Re-validated it is 57.7, which technically crosses into LEAN-GO.
That is a marginal move, not a vindication, and I want to correct the reasoning I gave the owner earlier.

**The Better Hotkeys calibration argument does not transfer to this product.** I argued that because
`hotkeys` scores only 48.2/75 deterministic yet Better Hotkeys is a winner, a low deterministic score
here should be discounted too. Checking that properly:

- `hotkeys` deterministic = **48.2**. Workflow Automation deterministic = **42.7** — *below* the very
  baseline I was using to defend it.
- Better Hotkeys' largest competitor was **Extended Hotkeys at 8,116 downloads**. Workflow Automation's
  is **SuperMacro at 216,347 — 26x larger, and shipping updates two days before this was validated.**

So the two situations are not analogous. Better Hotkeys entered a category with a weak native feature and
small competitors. This is a category with a large, actively maintained, free incumbent. The built-in
Multi-Action overlap really is survivable — that part of my correction stands — but the incumbent problem
is different in kind and it is the thing actually holding the score down (competition gap 9.0/25).

### What would flip it to GO

Evidence that SuperMacro users actively want conditionals or webhooks and cannot get them — competitor
review complaints, forum requests, or an unanswered feature thread. That would convert "large incumbent"
into "large incumbent with a specific unmet need", which is the only shape in which this becomes a real
opportunity. Absent that, this is entering a saturated free category against a maintained leader with
zero evidence anyone pays.

### Recommendation

**Do not build third — build it last, or not at all this cycle.** It is materially weaker than Calendar
(73.6, GO, with a *successful* paid comp) and weaker than AI Usage Tracker (68.5, backed by the owner's
own #1 paid product by velocity). Its evergreen credentials are genuinely good, but evergreen demand in a
category nobody has ever monetised is not a business case on its own.

## Recommended listing (if revived)

- **Name:** "Workflow Automation" (19 chars) or "Macro Runner" (12 chars).
- **Price:** Lite free / Pro $6.99. Note the only paid comp sits at $4.89 with 16 downloads, so there is
  no proven price point to anchor to.
- **Top 5 keywords:** `macro`, `automation`, `multi action`, `sequence`, `workflow`.
- **Risk flags:** `competition:supermacro-216k-actively-maintained`, `monetization:category-never-monetised`,
  `overlap:builtin-multi-action`.

Next step: **no build this cycle.** Revisit only with direct evidence of unmet SuperMacro user demand.
