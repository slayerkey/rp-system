# Validation: Screensaver Cycler

Idea: Stream Deck plugin that automates screensaver behavior three ways — schedule specific
screensavers by time of day, auto-cycle through a folder of screensavers on a timed interval,
and a manual "next screensaver" button press. Windows v1, macOS as a later phase.

Data freshness: `data_age_days: 0` (same-day scrape, no refresh needed).

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 28.2 | Best match `screen` = popularity 73 (p94 of tracked queries). **Caveat:** `screen` is a loose substring match (could catch screen recording / second-screen queries, not just screensavers). The tighter match `screensavers` = popularity 40, still a solid signal on its own. |
| Competition gap (0-25) | 24.4 | Only 1 competing product matched. Confirmed by hand: [Sleep & Screensaver](https://marketplace.elgato.com/product/sleep-screensaver-8d743e60-ad87-48d6-901c-dbdd74011768) (Jake Spurlock, $4.99, 57 downloads, published 2026-03-09) is a single-button "sleep or start screensaver now" trigger — no scheduling, no cycling. Real gap: nothing in the marketplace does time-of-day or interval automation. (Also found [barraider.com/sdscreensaver](https://barraider.com/sdscreensaver.html) — not a real competitor, it's an idle-image feature for the *Stream Deck's own screen*, unrelated to the OS screensaver, but shares keyword space.) |
| Monetization (0-20) | 13.4 | Median paid comp $4.99 x 57 downloads; 100% of matched comps are paid. Ceiling pulled down by the single comp being a much simpler one-button tool. |
| **Deterministic subtotal (0-75)** | **66.0** | From `tools/opportunity.py` |
| Build fit (0-15) | 8 | This is a genuine plugin build, not a `profiles/_build/common.py` profile — no config-only path. Reusable: the `better-hotkeys` scaffold (`@elgato/streamdeck` TS plugin, win32/darwin native split via koffi, `@elgato/cli` packaging). New work required for v1 (Windows): registry write to `HKCU\Control Panel\Desktop\SCRNSAVE.EXE`, `.scr` enumeration, a background scheduler for time-of-day + interval rules, and a property-inspector UI for building schedules. Deduct 4 for "no existing builder covers this, full new plugin logic." Deduct 3 for macOS being real unknown-effort even though deferred to a later phase (Apple's screensaver APIs are far more locked down; no clean CLI path). Icons are not a constraint — Tabler covers clock/refresh/photo glyphs needed for the 3 actions. |
| Risk (0-10) | 7 | No game/app IP, no trademark exposure — this is a generic OS feature, not fan content. Deduct 3 for: (a) registry writes can trip AV/endpoint-security false positives and will silently no-op on GPO-managed corporate machines, a support-ticket magnet; (b) macOS tightens automation/accessibility permissions almost every major release, so the eventual Mac build carries recurring patch-churn risk similar to a game's anti-cheat churn, just OS-version-driven instead. |
| **Qualitative subtotal (0-25)** | **15** | |
| **TOTAL (0-100)** | **81** | |

## Verdict: **GO**

81 clears the 70 threshold comfortably, driven by real demand signal and a genuine functionality gap
against the one real competitor. The build-fit and risk deductions are both real but not disqualifying —
they're reasons to scope v1 tightly (Windows only, as already planned) rather than reasons to pass.

## Also researched

- **Free alternatives outside the marketplace:** yes — e.g. "Random Screensaver" (Windows freeware,
  shuffles up to 8 `.scr` files). The Stream Deck angle isn't novel automation, it's *not needing a
  separate background app* — schedule/cycle/trigger all live on hardware the buyer already has open.
  Lead with that in copy, not with "screensaver rotation" as if it were unprecedented.
- **Windows technical path confirmed:** OS only allows one active screensaver at a time via the
  `SCRNSAVE.EXE` registry key, so true rotation means either (a) swapping that key on a timer before
  each idle trigger, or (b) the plugin directly launching a target `.scr /s` fullscreen on its own
  schedule rather than waiting on Windows' idle detection. Latter is simpler to build and testable
  without waiting out idle timeouts.
- **macOS technical path:** confirmed materially harder — no stable CLI for swapping screensaver
  modules on modern macOS; would likely need AppleScript/System Events with accessibility permission
  grants that can break across OS updates. Supports the decision to defer Mac to a later phase.
- No upcoming platform changes found that would kill or boost this (not tied to a game patch cycle or
  app release).

## Recommended listing

- **Name:** "Screensaver Scheduler" (22 chars, exact-search-term style, leads with the higher-intent
  `screensaver` + `schedule` queries over the more novel "cycler" language buyers are less likely to type).
- **Price:** $7.99. Comp (`Sleep & Screensaver`) sets a $4.99 floor for a one-button tool; this product
  ships three real modes (schedule, cycle, manual) and durable background utility, justifying a step up
  to the mid-tier the roster already uses for multi-feature utilities (`streamer-starter-pack` $7.99).
- **Device SKU plan:** plugin, not a keymap profile — no std/xl variant split needed. Platform is the
  real variant axis: **Windows v1 only**; macOS is a v2 phase pending separate feasibility research, not
  a same-release variant.
- **Top 5 keywords:** `screensaver`, `screensavers`, `screensaver scheduler`, `auto screensaver`, `screensaver cycle`.
- **Risk flags:** `compat-risk:windows-gpo` (registry key may be overridden/blocked on managed/corporate
  machines — call this out in the description so it's not a surprise refund reason), `platform-risk:macos-permissions`
  (flag for when Mac phase starts, not a v1 blocker).

Next step: `/rat-build screensaver-cycler` (Windows-only v1).
