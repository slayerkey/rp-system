# Validation: NFL Tracker

Idea: Stream Deck **plugin** (`com.packrat.nfl-tracker`) showing live NFL scores, standings, and
next-game countdown on hardware keys, with a "pick your favorite team(s)" settings UI. Live API
polling + dynamic per-key icons means this cannot be a `profiles/_build` static profile; it is a
genuine `@elgato/streamdeck` TypeScript plugin, same family as `plugins/screensaver-cycler/`.

Data freshness: deterministic score run same-day via `python tools/opportunity.py "nfl tracker" "nfl scores" --category Plugins`, no refresh needed.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 18.9 | Tool's best match is generic `tracker` (popularity 22, p63 of tracked queries) — **weak floor**, not an NFL-specific signal; the scraped query-suggestion CSV has no real "nfl" hits. Real-world signal is mixed: NFL itself is at a viewership high (2025 season averaged 18.7M viewers/game, +10% YoY, second-best on record), but that's general fan demand, not evidence Stream Deck owners specifically want this. The closest hardware-adjacent proxy is Corsair's free "Football Scores" iCUE widget (757 downloads on Xeneon Edge) — real but a different device/platform, and free widgets convert at a different rate than a paid plugin purchase decision. |
| Competition gap (0-25) | 25 | Tool found 0 competing products; **confirmed live**, `marketplace.elgato.com` search for "NFL" returns zero results. Adjacent-sport comps do exist and prove the category is viable: **Live MLB Scores** (maker ThatSportsGamer, real Stream Deck plugin, Mac+Win, v1.0.21 updated 2026-07-28 — actively maintained) and Corsair's **Baseball Scores** iCUE widget. One near-miss ruled out: **Live Score Plugin** (Live Score GmbH) is *not* a real competitor — it's a manual scoreboard-control tool for locally-created amateur scoreboards (`live-score-app.com`), not a live pro-league feed; it shares keyword space only. |
| Monetization (0-20) | 6 | No priced NFL comp exists. Live MLB Scores' price wasn't retrievable (client-side rendered, likely JS-gated); Corsair's widget is free and bundled with hardware, not a standalone sale. Deterministic tool's own read: "unproven niche, default mid-low." Treat this as the number most likely to move once v1 sales data exists. |
| **Deterministic subtotal (0-75)** | **49.9** | From `tools/opportunity.py` |
| Build fit (0-15) | 7 | Real reuse exists: `plugins/screensaver-cycler/src/scheduler.ts`'s global-ticker-in-plugin-process pattern (not per-action timers, which pause on page switch) is directly reusable for API polling; `src/pi.ts`'s PI-probe protocol (PI can't reach the filesystem/network itself, so it asks the plugin process and gets a reply) is exactly the "pick your team from a live list" pattern needed for a favorites-team dropdown. Deduct 5: dynamic per-key score/logo icon rendering has **zero precedent** in either existing plugin — screensaver-cycler only launches native `.scr` files, Better Hotkeys never draws to a key; this needs a new canvas/image-composition pipeline (team colors, live score text, redraw on tick). Deduct 3: live sports API integration is a new domain — ESPN's endpoint is undocumented, so parsing/error-handling has to be built defensively from scratch, unlike screensaver-cycler's stable OS-level registry calls. |
| Risk (0-10) | 4 | No existing IP dependency for the *plugin itself*, but real trademark exposure from **NFL team names/marks/logos** on a paid product — the repo's house rule against "copyrighted game art on keys in paid products" reads directly onto team logos. Mitigation is buildable (nominative fair-use text + team-color/abbreviation keys instead of official logos, following the precedent below) but is a hard design constraint, not optional. Deduct 3 for that. Deduct 2 for API dependency: ESPN shut down its *official* documented developer API years ago; the community-standard `site.api.espn.com` endpoint used today is undocumented, has no SLA, and could be rate-limited or pulled without notice (no confirmed takedown incidents found, but no guarantee either — this is the accepted community risk tradeoff). Deduct 1 for seasonality: real usage/support load concentrates Sept-Feb, unlike the roster's evergreen tools. **This lands at the 4 threshold** — flagging explicitly per the validation rule that anything under 4 needs sign-off regardless of total; at exactly 4 it clears, but the margin is thin enough to warrant the same conversation. |
| **Qualitative subtotal (0-25)** | **11** | |
| **TOTAL (0-100)** | **60.9** | |

## Verdict: **LEAN-GO**

60.9 sits in the 55-69 band: a confirmed, real marketplace gap (zero direct NFL competitors, verified
live) held back by unproven monetization, meaningful net-new build work (icon rendering + API layer),
and a trademark/logo constraint that has to be designed around correctly from day one, not bolted on later.

**Exact conditions that would flip this to GO (need ~+9 combined):**
1. **Monetization (+3 to +6):** find or create real pricing evidence — e.g. confirm Live MLB Scores'
   actual price (the fetch tool couldn't read it; a manual check of the live listing or a test purchase
   would resolve this), or soft-test willingness-to-pay via the existing Better Hotkeys install base
   before committing to a price.
2. **Build fit (+3 to +5):** prototype the dynamic icon-rendering pipeline first (a small script that
   draws a team-colored score card to a 72x72 PNG on a timer) before committing to the full build. If it
   reuses more of `profiles/_build/icons.py` or the `_shared/marketing_engine.py` Pillow patterns than
   expected, this deduction shrinks.
3. **Risk (+2 to +3):** finalize the no-official-logo design constraint (colors + abbreviations only,
   modeled on the nflstatsapp.com "hide logos" precedent below) as a locked v1 requirement, and run the
   ESPN endpoint in a throwaway poller for a week or two to confirm it doesn't 404 or rate-limit under
   normal use before greenlighting a full build.

If those land, this clears 70 without touching demand or competition-gap, which are already solid.

## Recommended listing

- **Name:** "NFL Tracker" (11 chars, exact-search-term style, matches the deterministic tool's own
  keyword input and reads as a direct query match rather than a novel coinage).
- **Price:** **$6.99** launch price. No priced direct comp exists to anchor against (see Monetization
  above), so this sits at the low end of the roster's plugin tier — below `screensaver-cycler` ($7.99,
  which ships three fully-built automation modes) to reflect real pricing uncertainty in an unproven
  niche, while still above free. Revisit after v1 sales data; this is the number most likely to move.

  | Comp | Price | Type | Notes |
  |---|---|---|---|
  | Live MLB Scores (ThatSportsGamer) | not retrievable | Stream Deck plugin | closest real comp; actively maintained (updated 2026-07-28) |
  | Baseball Scores (Corsair) | free | iCUE widget, not Stream Deck | bundled with hardware, different platform |
  | Live Score Plugin (Live Score GmbH) | not retrievable | Stream Deck plugin | not a real comp — manual/amateur scoreboard control, not live pro-league data |
  | `screensaver-cycler` (Packrat) | $7.99 | Stream Deck plugin | in-house anchor: multi-feature utility plugin, confirmed gap, GO-scored |
  | `streamer-starter-pack` (Packrat) | $7.99 | profile | in-house mid-tier reference point |

- **Device SKU plan:** single cross-platform plugin package (not a variant-split product like the
  keymap profiles). Unlike `screensaver-cycler` (Windows-only v1 because `SCRNSAVE.EXE` registry writes
  and `.scr` enumeration are Windows-specific), nothing about ESPN API polling or Node/Rollup plugin
  runtime is OS-specific, so **std + XL, Win + Mac all ship at v1** (all 4 combos: std_win, xl_win,
  std_mac, xl_mac). Key-count scaling (favorites grid on XL vs. std) is handled in-plugin via the
  `@elgato/streamdeck` layout APIs, not separate installable variants.
- **Top 5 keywords:** `nfl tracker`, `nfl scores`, `nfl scoreboard`, `live nfl scores`, `nfl standings`.
- **Risk flags:** `trademark:nfl-team-marks` (team names/logos; mitigated by no-official-logo design
  constraint, not eliminated), `api-risk:unofficial-espn` (undocumented endpoint, no SLA, could break
  without notice), `seasonal-demand:nfl-season` (usage/support concentrates Sept-Feb).

Next step: this is a **LEAN-GO**, not an automatic `/rat-build`. Resolve the three flip conditions above
(or get explicit sign-off given the Risk score sitting right at the 4 threshold) before moving to build.

---

## Overview

NFL Tracker is a paid Stream Deck plugin that surfaces live NFL scores, team/league standings, and a
next-game countdown directly on hardware keys, with a Property-Inspector settings UI for picking
favorite team(s). It targets streamers, content creators, and general NFL fans who already own a
Stream Deck for other software control and want live game state visible without alt-tabbing to a
browser or second screen — the same "don't leave your primary workflow" pitch the rest of the roster
uses (see house rule #2: benefit-focused copy, e.g. "NO MORE ALT-TABBING").

## Market Demand

- NFL is at a genuine engagement high: 2025 season averaged **18.7M viewers/game**, the second-best
  regular-season average on record, up 10% YoY and 7% vs. 2023; Thursday Night Football on Prime Video
  grew 16%; Monday Night Countdown grew 14% with a 38% jump among youth viewers. Fan interest is not
  the constraint here.
- The 2026 season starts **Wednesday, September 9, 2026** (defending-champion Seattle Seahawks host the
  opener) — roughly six weeks from today. That is a real launch-timing lever: a v1 shipped before kickoff
  captures the full season's search/purchase window; shipped after, it misses early-season interest and
  has to wait for the trade deadline / playoff push to get a second bump.
- The one directly relevant hardware-adjacent proxy is Corsair's free **"Football Scores"** iCUE widget
  (757 downloads on the Xeneon Edge smart display) — real evidence that "live NFL scores on a peripheral
  device" is a demand pattern people act on, but it's a bundled free widget on a different device
  category, not a paid Stream Deck plugin purchase decision, so treat it as directional, not conclusive.
- No Stream Deck-specific NFL demand signal exists in the scraped query data (the deterministic tool's
  18.9/30 reflects a generic `tracker`/`scores` match, not an NFL-specific one). This is the single
  biggest open unknown in this validation: real NFL fandom is enormous, but "would a Stream Deck owner
  pay for this" is unproven, unlike e.g. the Valorant/Palworld profiles where the buyer overlap (PC
  gamer with a Stream Deck) is obvious.

## Competitor Analysis

- **Live MLB Scores** (maker: ThatSportsGamer) — the closest real analog: a genuine live-sports Stream
  Deck plugin, Mac + Windows, actively maintained (v1.0.21, updated the same day as this research,
  2026-07-28). No NFL equivalent exists from this or any other maker. Its continued active maintenance
  is a positive signal that a solo-maker sports-score plugin is sustainable to run, not just to launch.
- **Baseball Scores** (Corsair) — free iCUE widget, different device ecosystem (Xeneon Edge, not Stream
  Deck). Confirms Corsair sees value in shipping sport-specific score widgets generally (they ship both
  football and baseball versions), which is a soft signal for the category, not a Stream Deck comp.
- **Live Score Plugin** (Live Score GmbH) — ruled out as a competitor after checking the underlying
  product: it controls a *manually created* scoreboard for local/amateur games (`live-score-app.com`),
  not a live NFL data feed. Shares keyword space in a marketplace search but solves a different problem,
  same category as the `barraider.com/sdscreensaver` false-positive noted in the screensaver-cycler
  validation.
- **Live marketplace search for "NFL"** (`marketplace.elgato.com`, checked directly): zero results.
  The gap is real and current, not a stale-scrape artifact.
- No ESPN companion app or browser-extension competitor changes this picture — those solve "check
  scores on my phone/browser," not "see scores without leaving my stream deck / streaming setup," which
  is the actual value proposition here.

## API Recommendation

**Use ESPN's undocumented `site.api.espn.com` endpoints as the v1 data source.** This is the
community-standard free option and the only one that has team logos, live scores, and standings without
a subscription:

- `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` — live scores/game state
- `site.api.espn.com/apis/site/v2/sports/football/nfl/teams` — team list/metadata (feeds the
  favorite-team picker via the `pi.ts`-style probe pattern)
- `site.api.espn.com/apis/v2/sports/football/nfl/standings` — league/division standings

Reliability and licensing context:
- These are **undocumented, not the official ESPN developer API** (ESPN discontinued issuing public
  keys for its documented API years ago; that shutdown is old news that keeps resurfacing in search
  results and should not be confused with today's situation). The hidden `site.api.espn.com` endpoints
  are a separate thing: actively used by a large community (multiple maintained GitHub repos/gists,
  an MCP server, hundreds of downstream projects) as of 2026, with no confirmed takedown or
  cease-and-desist incidents found against apps using them.
- No official rate limit is published; community consensus estimates are informal (figures like
  "~1500 calls/day" circulate but aren't ESPN-confirmed). Design for graceful degradation, not a
  guaranteed quota.
- **Consensus risk framing:** fine for personal projects, hobby tools, and — by extension — small paid
  add-ons like this, but there is no SLA and no support channel if it changes. Build the offline/stale-
  data fallback (below) as a first-class feature, not an afterthought, because this is the plugin's
  single largest single point of failure.
- **Alternatives considered and rejected for v1:** SportsDataIO has real NFL coverage but its
  self-serve "Discovery Lab" tier runs $99-149/month with next-day-delayed data — that cost alone breaks
  the unit economics of a one-time $6.99 purchase. TheSportsDB has free team-logo/badge assets but is
  positioned for non-commercial use and lacks live real-time scoring depth. Neither beats free-and-live
  ESPN despite the reliability tradeoff; revisit SportsDataIO only if this product's revenue justifies a
  recurring data-cost line item.

## Technical Notes

- **Polling/refresh cadence:** reuse `plugins/screensaver-cycler/src/scheduler.ts`'s pattern directly —
  one global `setInterval` ticker living in the plugin process (not per-action timers, which pause the
  moment the user switches Stream Deck pages, per that file's own header comment). Poll the scoreboard
  endpoint on a short interval during live windows (e.g. every 15-30s while a favorited team's game is
  in progress) and back off to a much slower interval (every few minutes) when no favorited game is live,
  to stay well inside any informal rate limit.
- **Caching/offline fallback:** persist the last-known good response (scores, standings) in global
  settings via `streamDeck.settings.setGlobalSettings`, same storage mechanism `scheduler.ts` already
  uses for `GlobalConfig`. On a failed/errored API call, keep showing the last cached state with a subtle
  "stale" indicator rather than a broken key — this is the single most important resilience feature
  given the API has no reliability guarantee.
- **Error handling:** wrap all API calls defensively (undocumented JSON shape can change without
  notice); log failures via `streamDeck.logger` the same way `scheduler.ts`'s `applySafe()` wraps its
  OS calls, so one bad response doesn't crash the ticker loop.
- **Favorites/settings UI:** reuse `plugins/screensaver-cycler/src/pi.ts`'s PI-probe protocol almost
  directly — the Property Inspector can't reach the network itself, so it sends `{ probe: "list" }` and
  the plugin process replies with the live team list fetched from the ESPN teams endpoint via
  `streamDeck.ui.sendToPropertyInspector`. This is exactly the mechanism needed for a "pick your
  favorite team(s) from a live dropdown" settings screen; no new protocol design required, just a new
  data source behind it.
- **Dynamic icon rendering (the genuinely new piece):** no existing Packrat plugin draws a live-updating
  image to a key. This needs a small canvas/image-composition step (team color background + score text,
  redrawn on each tick) — closer in spirit to `profiles/_build/icons.py`'s generation approach or the
  `_shared/marketing_engine.py` Pillow renderer than to anything in the plugin codebase today. Scope this
  as its own build task, not an extension of existing plugin code.

## Feature List

- Live score display for a chosen favorite team (score, quarter/clock, possession if available from the
  API's `situation` data).
- Next-game countdown (kickoff date/time from the scoreboard/schedule data).
- Division/conference standings view for the favorite team.
- Manual refresh action alongside the background poller, for "check right now" certainty.
- Multi-team favorites (grid of several teams' current scores, sized to fit std vs. XL key count).

## Premium Features

Scoped to what ESPN's scoreboard/standings data can actually support — no invented capabilities:

- **Favorite team score key** with live clock/quarter.
- **Next-game countdown** key.
- **Standings** key (division rank, record).
- **Red-zone/scoring-play indicator** — the scoreboard endpoint's `situation` object does expose
  down/distance and red-zone flags for in-progress games in community documentation, so a "team is in
  the red zone" visual state is plausible; treat as a v1 stretch goal to confirm against live data
  before promising it in marketing copy, not a guaranteed launch feature.
- **NOT promising:** win-probability, since that requires ESPN's separate probabilities/predictor
  endpoints which are less consistently documented/available than the core scoreboard, and injury
  reports, which sit behind endpoints that are thinner and less reliably populated in community
  references. Both are v2 research items, not v1 commitments.

## UI Ideas

- **Std (15-key) layout:** one key = favorite team score, one key = next-game countdown, remaining keys
  for 1-2 more favorited teams or a standings key. Per house rule #3, never fill all key slots — leave
  idle-glow empty keys for the user's own actions.
- **XL (32-key) layout:** room for a small "scoreboard row" of 4-6 favorited teams plus dedicated
  standings/countdown keys, still leaving headroom unfilled.
- **Later potential:** the repo has no Stream Deck+ / dashboard-LCD-widget precedent yet, but a
  scrolling ticker or a larger single-panel scoreboard view is a natural v2/v3 fit for that surface if
  Packrat expands into it — note only, not a v1 scope item.

## Marketplace Positioning

Lead with "live NFL scores without leaving your stream deck" (benefit-focused, matches house rule #2),
not with backend framing like "ESPN API integration." Position against the real gap: nothing NFL-specific
exists on the Marketplace today, and the one real analog (Live MLB Scores) proves the category works for
a single-sport, single-maker plugin. Do not claim "official NFL" anything in copy — use the
nflstatsapp.com-style disclaimer pattern (independent, not affiliated with/endorsed by the NFL) in the
listing description itself, not just buried in a legal page.

## Pricing Recommendation

$6.99 launch price (see comp table above). No direct paid comp is confirmably priced, so this sits
deliberately conservative rather than matching `screensaver-cycler`'s $7.99 (which had a priced comp to
anchor against). Reassess after the first month of live-season sales data — this is a monetization
number built on the weakest evidence in this whole validation, and should move in either direction based
on real sell-through rather than staying fixed by default.

## Confidence Score

**Medium-low.** High confidence in the demand-side context (NFL viewership growth, real season-timing
window, confirmed zero direct competitors) and in the technical path (both required patterns —
background poller, PI-probe dynamic list — already exist in-repo). Low confidence in monetization
(literally no priced comp found) and moderate concern on the trademark/logo constraint and unofficial-API
dependency, both of which are manageable but non-optional design constraints rather than solved problems.

## Build Recommendation

Do not go straight to `/rat-build`. Spend a short, scoped research/prototype pass first (the three flip
conditions above: a throwaway ESPN poller run for reliability, a quick icon-rendering spike, and a
firm no-official-logo design lock) before committing full build time, given the LEAN-GO verdict and the
Risk score sitting exactly at the sign-off threshold.

## Implementation Plan

1. Scaffold from `plugins/screensaver-cycler/` (package.json, rollup config, `@elgato/cli` tooling) —
   same TypeScript/`@elgato/streamdeck`/vanilla-HTML-PI stack, no new tooling decisions needed.
2. Build the ESPN API client (scoreboard, teams, standings) with defensive parsing and the
   caching/fallback layer described above; run it standalone for a week or two as a flip-condition check
   before wiring it into the plugin.
3. Port `scheduler.ts`'s ticker pattern to poll the API on the live/idle cadence described above.
4. Port `pi.ts`'s probe pattern for the favorite-team picker, backed by the ESPN teams endpoint.
5. Build the dynamic icon-rendering pipeline (team colors + score/clock text; no official logos) as its
   own task, prototyped early per the Build-fit flip condition.
6. Actions: favorite-team score key, next-game countdown key, standings key, manual refresh action.
7. QA gate + `streamdeck validate`/`pack`, same as `screensaver-cycler`; target ship date before
   September 9, 2026 kickoff to capture the full season window.

## Roadmap

- **v2:** red-zone/scoring-play state (pending live-data confirmation), multi-team favorites grid
  refinement, injury-report key if ESPN's data proves reliable enough in practice.
- **v3:** Stream Deck+ / dashboard-LCD-widget scoreboard view if Packrat builds out that surface
  generally; potential expansion to other leagues (NCAA football) reusing the same ESPN-endpoint pattern
  if NFL Tracker proves the model out.

## Proposed registry.json entry

```json
"nfl-tracker": {
  "name": "NFL Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.nfl-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "profiles/nfl-tracker",
    "package": "profiles/nfl-tracker/com.packrat.nfl-tracker.streamDeckPlugin",
    "marketing": "profiles/nfl-tracker/marketing"
  },
  "keywords": ["nfl tracker", "nfl scores", "nfl scoreboard", "live nfl scores", "nfl standings"],
  "risk_flags": ["trademark:nfl-team-marks", "api-risk:unofficial-espn", "seasonal-demand:nfl-season"],
  "notes": "LEAN-GO (60.9/100) per profiles/nfl-tracker/VALIDATION.md, 2026-07-28. Not yet building: three flip conditions to GO listed in that file (monetization evidence, icon-rendering prototype, ESPN endpoint reliability check + locked no-official-logo design constraint). Risk score (4/10) sits exactly at the sign-off threshold -- flag for explicit owner confirmation before /rat-build. Plugin, not a profiles/_build product; scaffold from plugins/screensaver-cycler/ (background-poller + PI-probe patterns), dir path uses profiles/ for VALIDATION.md placement only per task instructions, actual plugin source should live under plugins/nfl-tracker/ at build time matching the screensaver-cycler precedent -- reconcile this path once build starts."
}
```

**Note on the registry path field above:** this validation file was placed at `profiles/nfl-tracker/VALIDATION.md`
per the task's explicit instruction, but the repo's own convention (per `CLAUDE.md`'s project map) puts
paid *plugins* under `plugins/<slug>/`, not `profiles/<slug>/` (`profiles/` is for static
`profiles/_build` keymap products). The registry entry's `paths.dir` above is left as `profiles/nfl-tracker`
to match where this file actually lives, but flag this for correction to `plugins/nfl-tracker` when the
entry is actually added to `registry.json` and the build starts, so the plugin source doesn't end up
under the wrong top-level directory.
