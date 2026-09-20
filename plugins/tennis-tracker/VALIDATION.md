# Validation: Tennis Tracker

Idea: Stream Deck **plugin** (`com.packrat.tennis-tracker`, not a `profiles/_build` profile) showing
live ATP/WTA tour scores, rankings, and next-match info, with a Property Inspector settings UI for
picking **favorite players**, not favorite teams — tennis is individual-athlete-driven, which changes
the favorites UX from every other sport tracker validated in this batch (NFL/NHL/MLB/soccer all pick a
fixed team from a short static list). Closest in-repo precedent: `plugins/screensaver-cycler/`
(background-poller + config-store pattern, PI-probe dynamic-list protocol). No existing sports plugin
in the roster has shipped.

Data freshness: deterministic run below is same-day (`data_age_days: 9` per the tool's own report,
matches the number supplied in the task brief exactly on re-run — see Score table). Live web research
performed 2026-07-28 to verify the zero-competitor finding, API landscape, and trademark posture rather
than trust the CSV scan alone.

## Score table

| Dimension | Score | Why |
|---|---|---|
| Demand | 18.9 / 30 | Deterministic tool result. Best matched query "tracker" (popularity 22, p63 of tracked queries); "scores" popularity 17. Loose substring match, not "tennis"-specific — a weak floor, not a confirmed tennis-buyer signal, same caveat as every sibling sport tracker in this roster. |
| Competition gap | 25 / 25 | Deterministic tool result, `competitor_count: 0`. **Hand-verified live and it holds up better than any sibling's gap claim** — see Competitor Analysis. Unlike NHL (a free GitHub sideload tool existed) or MLB (an actively-maintained, 141-download free Marketplace plugin existed), no tennis-specific product was found on the Elgato Marketplace, on GitHub as a sideload plugin, or as a dedicated Corsair Xeneon Edge widget. This is the cleanest gap in the batch. |
| Monetization | 6 / 20 | Deterministic tool result. No comps found to anchor a price — tool defaults to "unproven niche, mid-low," the same default every sport tracker in this batch has landed on. |
| **Deterministic subtotal** | **49.9 / 75** | From `tools/opportunity.py "tennis tracker" "tennis scores" --category Plugins`, independently re-run and confirmed identical to the number supplied in the task brief. |
| Build fit | 5 / 15 | Reuses `@elgato/streamdeck` `SingletonAction` scaffold, Rollup build, and the background-ticker pattern from `plugins/screensaver-cycler/src/scheduler.ts` — no deduction, direct lift. Three genuinely new items: (1) live HTTP polling client with caching/backoff against an unofficial API, no precedent in either existing plugin — deduct 3, same as every sibling. (2) Runtime dynamic per-key image compositing (player initials/colors + score badge, no official headshots/logos) — deduct 3, same as every sibling's badge-pipeline deduction. (3) **Tennis-specific score-state domain logic is genuinely harder than any team sport already validated**: sets/games/points hierarchy, deuce/advantage state, tie-breaks, best-of-3 vs. best-of-5 (men's Grand Slams are still best-of-5, women's and all non-major men's events are best-of-3), and singles vs. doubles pairs — no NFL/NHL/MLB/soccer tracker has to render a nested set-within-match score state at all, this is new domain complexity, not "more of the same" — deduct 3. **Partial offset, and the one place this product is a *better* build-fit than its siblings:** the favorite-**player** PI flow (hundreds of active ATP+WTA players, not a fixed 32-team list) needs live search/typeahead rather than a static dropdown — but `plugins/screensaver-cycler/src/pi.ts`'s probe-and-reply protocol was built for exactly this shape (a live, variable-length list the plugin process has to enumerate on demand, there for local `.scr` files), which is actually closer to what player search needs than the static-dropdown case every team-sport sibling reduces the pattern to. Deduct only 1 for the extra typeahead/fuzzy-match wiring instead of the 2 soccer's two-axis team+league picker took. Net: -10 from 15. |
| Risk | 2 / 10 | Worse than every sport tracker validated in this batch so far, for two compounding reasons found in live research (see Risk detail below). **Per the validation rubric, anything under 4 needs the owner's explicit sign-off regardless of total.** |
| **Qualitative subtotal** | **7 / 25** | |
| **TOTAL** | **56.9 / 100** | |

### Risk detail (2/10)

Two stacked, compounding vectors, both worse in this niche than any sport already validated:

1. **No affordable licensed data path exists at all (deduct 4).** Sportradar holds the official ATP
   partnership for tennis data ("Powered in part by Sportradar's official ATP partnership") but its
   pricing starts at **$10,000+/month with a sales engagement and minimum annual contract** — the same
   order of magnitude that made a licensed feed uneconomical for `mlb-tracker` (which cited $50-500+/mo
   as already too high against a one-time plugin price; tennis's official-partner price is 20-200x that).
   The affordable third-party tennis APIs that do exist (`livetennisapi.com` free/$9.99/$29.99/$99.99
   tiers, `tennis-api.com`, `matchstat`'s Tennis API) are **not** confirmed as officially licensed with
   ATP/WTA — their own terms pages either don't disclose commercial-redistribution rights (livetennisapi)
   or explicitly push IP-clearance responsibility back onto the integrator (api-tennis.com: "users must
   ensure their use complies with the legal framework and arrange proof of intellectual property
   themselves"). Using one of these doesn't resolve the licensing risk, it just changes which unlicensed
   vendor sits behind it. Unlike `soccer-tracker`, which found a genuinely affordable, plausibly-clean
   commercial tier (football-data.org, ~€12-29/mo), **tennis has no equivalent escape hatch** — this
   product's risk profile on data licensing alone is closer to `mlb-tracker`'s (which went NO-GO
   substantially because of this exact gap) than to soccer's or NHL's.
2. **Six separate rights-holder regimes to track, not one or two (deduct 3).** ATP and WTA each have
   their own ToS explicitly restricting commercial use and third-party trademark use (WTA: "You may not
   modify, copy, reproduce, republish, upload, post, transmit, translate, sell, create derivative works
   of, exploit, or distribute in any manner or medium... any material from the WTA Sites unless
   explicitly authorized," personal non-commercial use only, no third-party use of WTA marks/logos
   without written consent; ATP: owns and restricts use of ATP, ATP TOUR, Nitto ATP Finals, and multiple
   other word/design marks, "Users may not use any such marks in any way" without consent). On top of
   both tours, **each of the four Grand Slams is run by a separate, independently litigious body** with
   its own IP policy: AELTC (Wimbledon), USTA (US Open), FFT (Roland Garros), Tennis Australia
   (Australian Open). That's six regimes in total (2 tours + 4 majors) vs. soccer's "FIFA + UEFA + a
   handful of national federations" or the single-body NFL/NHL/MLB comps. **Wimbledon/AELTC's posture is
   the most aggressive found in this roster's research to date** — the AELTC has gone as far as
   trademarking its own signature **purple and green color scheme**, not just word marks and logos. That
   is a materially broader IP claim than any comp researched for this roster: the standard mitigation
   used everywhere else in this catalog ("no official logo, use team/tour colors + text instead") is
   itself a live infringement vector for anything explicitly branded or marketed as Wimbledon-specific.
3. **Not deducted further, genuinely mitigating:** raw scores/results are facts, not independently
   copyrightable — the same standard legal basis the NHL/MLB/soccer docs already lean on, and it holds
   here too. A clear non-affiliation disclaimer (market-standard mitigation used by every sport tracker
   in this batch) is available and should be used regardless of which data source is chosen.

## Verdict: **LEAN-GO** (55-69 band)

56.9 lands in the same band as `nhl-tracker` (58.9) and `soccer-tracker` (56.9, an exact coincidental
match), and above `mlb-tracker`'s NO-GO (54.3) — but the reasons pull in different directions than
either of those comps. The competitive gap here is the **cleanest** found in this entire sports-tracker
batch (genuinely zero competitors anywhere, not just zero-on-Marketplace-with-a-free-sideload-tool
lurking), which is a real point in its favor. But the risk profile is the **worst** found in the batch:
no affordable licensed data path exists at all (closer to MLB's dead end than soccer's football-data.org
escape hatch), and six separate trademark/ToS regimes to track instead of one or two, including the most
aggressive single body (AELTC/Wimbledon, which trademarked its own color scheme) encountered in any of
this roster's sports research.

**Exact conditions that would flip this to GO (need ~+13.1 combined):**

1. **Build fit (+3):** descope v1 to text-only score/title keys (no runtime image compositing), the same
   flip condition every sport tracker in this batch has used. This removes the single largest Build-fit
   deduction. Build fit 5 -> 8.
2. **Risk (+3):** explicit, documented owner sign-off (e.g. in `docs/DECISIONS.md`) accepting the
   data-licensing gray area for v1 — committing in writing to (a) never using Wimbledon's trademarked
   purple/green color scheme or any Grand Slam word marks/logos in the product name, icon, or marketing
   copy, (b) a clear non-affiliation disclaimer in the listing itself, and (c) picking one specific
   unofficial data source and documenting that choice rather than leaving it implicit. This doesn't
   remove the risk, it converts an open question into an accepted one, the same pattern used to flip
   `nhl-tracker` and `soccer-tracker`'s Risk scores. Risk 2 -> 5.
3. Both together land at ~62.9 — still short of 70, same shortfall pattern every sibling in this batch
   hits. The remaining lift has to come from Demand: re-run `tools/opportunity.py "tennis tracker"
   "tennis scores" --category Plugins` close to the **2026 US Open** (the next Grand Slam on the
   calendar; Wimbledon 2026 concluded the week of this research) or ahead of the **2027 Australian Open
   (Jan 17-31, 2027)**, once real tennis-specific search traffic exists in the scrape, rather than
   today's generic `tracker`/`scores` substring match.

If none of the three land, this stays LEAN-GO and should not proceed to `/rat-build` as-is. Given Risk
sits below the 4-point sign-off floor, **owner sign-off on item 2 is required regardless of the total**
before any build work starts.

## Recommended listing

- **Name:** "Tennis Tracker" (14 chars, well under the 30-char cap, exact-search-term style, matches
  every sibling's naming convention).
- **Price:** **$6.99** launch price — same "unproven sports-niche, no priced comp" tier used for
  `nfl-tracker`, `nhl-tracker`, and `soccer-tracker`. Tennis's genuinely enormous global fanbase (see
  Market Demand: 1B+ estimated global fans, Wimbledon 2026's 138.5M unique digital audience) is a
  plausible reason this could move up faster than the single-country-league comps post-launch, but there
  is no evidence for that yet — price on the evidence, not the audience-size story.

  | Comp | Price | Type | Notes |
  |---|---|---|---|
  | (none found) | — | Elgato Marketplace | Zero tennis-specific plugins, profiles, or icon packs found live-searching the Marketplace. |
  | (none found) | — | GitHub sideload | No tennis-specific Stream Deck plugin found, unlike NHL (ThatSportsGamer's free GitHub tool) or MLB (same developer's Marketplace-listed free plugin). |
  | Corsair Xeneon Edge widgets | free | iCUE widget, not Stream Deck | 20+ free first-party widgets exist, including a general "live sports scores" category and a builder tool (Forge My Edge) for custom sport widgets — no dedicated tennis widget was confirmed to exist today. |
  | `Keep The Score` (Elgato Marketplace) | freemium | Stream Deck plugin | Manual scoreboard control, explicitly lists Basketball/Baseball/Football/Hockey/Soccer/Volleyball/Pickleball/Badminton/Squash as separate sports — **tennis is conspicuously absent** from an otherwise broad multi-sport list, a real near-miss worth noting, not a live competitor (it's manual scorekeeping, not a live data feed, same distinction the soccer-tracker doc drew). |
  | `nfl-tracker` / `nhl-tracker` / `soccer-tracker` (Packrat, this roster) | $6.99 (recommended, none yet built) | plugin | same "unproven sports-niche" pricing logic |
  | `screensaver-cycler` (Packrat, published) | $7.99 | plugin | in-house comp for a proven, multi-feature utility plugin |

- **Device SKU plan:** single cross-platform package, `variants: {}`, `required_variants: []` — no native
  OS hooks needed (network polling + rendering only, same as every sibling tracker), so **Win + Mac both
  ship at v1**.
- **Top 5 keywords:** `tennis tracker`, `tennis scores`, `live tennis scores`, `atp wta scores`, `tennis
  rankings`.
- **Risk flags:** `trademark:atp-wta-grand-slam-marks` (ATP, WTA, and all four Grand Slam bodies restrict
  third-party commercial use of their marks/content), `trademark:wimbledon-color-mark` (AELTC has
  trademarked its own purple/green color scheme — a broader IP claim than word marks/logos alone, unique
  in this roster's research), `api-risk:unofficial-tennis-data` (ESPN's hidden endpoints and the
  affordable third-party tennis APIs are all unlicensed/ToS-gray-area; the one officially-licensed source,
  Sportradar's ATP partnership, starts at $10,000+/mo and is not viable against a one-time plugin price),
  `seasonal-demand:grand-slam-spikes` (buyer purchase-intent is likely concentrated around the four majors
  rather than spread evenly across the year — see Market Demand).

Next step: this is a **LEAN-GO**, not an automatic `/rat-build`. Resolve the two flip conditions above
and get explicit owner sign-off on the Risk item (mandatory, it's below the 4-point floor) before moving
to build.

---

## Overview

Tennis Tracker would be a paid Stream Deck plugin surfacing live ATP/WTA scores, rankings, and
next-match countdowns, with a Property Inspector settings UI for following favorite **players** — the
first product in this roster built around individual athletes rather than teams or leagues. Same
"don't leave your primary workflow" pitch as the rest of the sports-tracker batch (house rule 2),
targeting streamers, creators, and tennis fans who already own a Stream Deck.

## Market Demand

- The deterministic 18.9/30 demand score is the same weak, generic-query floor every sport tracker in
  this batch has scored — the scrape cannot isolate "tennis" from "tracker"/"scores." Treat it as a
  floor, not a real signal, same caveat carried in every sibling doc.
- **Tennis's real-world audience is genuinely large:** an estimated 1 billion+ global fans, with 2025
  Wimbledon men's final viewership around 300 million globally and 2026 Wimbledon's unique digital
  audience reaching 138.5 million (up 8% year-over-year), plus a record 550,151 on-site attendance for
  the 2026 Championships. Total tennis TV viewership was cited around 1.2 billion for 2025. This is a
  larger raw audience figure than any single-league US sport in this roster (NFL/NHL/MLB), and roughly
  comparable in scale to soccer's global reach.
- **The honest, important caveat this task specifically asked to surface: usage is likely far spikier
  and more Grand-Slam-concentrated than any team sport already validated.** NFL/NHL/MLB each have a long
  domestic season with games most days for 6+ months; soccer has overlapping club leagues running
  roughly year-round. Tennis's ATP/WTA tour technically runs matches most weeks of the year, which is a
  real argument for "always something live" coverage as a v1 feature — but the buyer segment this
  product actually sells to (a casual fan who wants "scores on my desk" convenience, not a hardcore
  tour follower who already tracks every ATP 250 event) realistically only develops purchase intent
  during the ~8 combined weeks/year of the four Grand Slams, plus smaller bumps around the Masters 1000s
  and the year-end Finals. This is a materially spikier demand curve than any sibling in this batch and
  should shape both marketing timing (ship and push ahead of a major, the same pattern NHL/soccer
  already use for their season starts) and expectations for off-peak install/engagement numbers.
- **2026-27 calendar for launch timing:** Wimbledon 2026 concluded the week of this research (mid-July
  2026). The next major is the **2026 US Open** (traditionally late August-early September). Looking
  further out, the confirmed **2027 calendar**: Australian Open Jan 17-31, Roland Garros May 23-Jun 6,
  Wimbledon Jun 28-Jul 11, US Open Aug 29-Sep 12 — four distinct, well-spaced marketing/launch windows
  per year, more frequent than any single-league US sport's one-season-per-year cadence, even if each
  window itself is short.
- No tennis-specific demand signal exists in the scraped marketplace query data, same weak-floor caveat
  as every sport tracker in this batch.

## Competitor Analysis

- **Elgato Marketplace, live-searched:** a direct search for "tennis" returned zero results ("Nothing
  was found"). No tennis-specific plugin, profile, or icon pack is currently listed.
- **GitHub sideload, live-searched:** unlike NHL (`ThatSportsGamer/live-nhl-scores-for-stream-deck`,
  free, sideload-only) or MLB (the same developer's Marketplace-listed `Live MLB Scores`), no
  tennis-specific Stream Deck plugin was found on GitHub either. This is the cleanest competitive gap
  in the entire sports-tracker batch validated so far — not just "nothing on the Marketplace," but
  "nothing found anywhere in the ecosystem."
- **Corsair Xeneon Edge (iCUE), different device ecosystem:** Corsair ships 20+ free first-party widgets
  including a general live-sports-scores category, and offers "Forge My Edge," a self-serve builder for
  custom widgets (weather, stocks, crypto, **sports scores**, game server status). No dedicated,
  first-party tennis widget was confirmed to exist. It's technically possible a community member has
  built one via Forge My Edge, but none surfaced in live search — treat as an unconfirmed possibility,
  not a live competitor, and note Forge My Edge widgets aren't discoverable/monetizable the same way a
  Marketplace listing is regardless.
- **`Keep The Score` (Elgato Marketplace, referenced in the soccer-tracker validation as the
  multi-sport comp):** explicitly supports Basketball, Baseball, Football, Hockey, Soccer, Volleyball,
  Pickleball, Badminton, and Squash as separate sport categories — **tennis is not on that list**, a
  genuine near-miss worth flagging. It's manual scoreboard *control* (tap to add points/games/sets), not
  a live-fetch data feed, so it wouldn't be a direct competitor even if it added tennis, but its omission
  from an otherwise broad racket/net-sport-inclusive list (badminton, squash, pickleball are all there)
  is a mild secondary signal that tennis's individual-athlete structure and set/game/point scoring
  complexity may be why other developers have skipped it too.
- **Net:** this is a real, clean, hand-verified gap — nothing on the Elgato Marketplace, GitHub sideload
  ecosystem, or (as far as could be confirmed) Corsair's widget catalog delivers live tennis scores to a
  desk-hardware surface today.

## API Recommendation

Be honest up front: **live, real-time in-match tennis scoring is harder to source cleanly (free or paid)
than any team sport already validated in this batch**, for a structural reason — the one truly official,
ATP-partnered commercial feed (Sportradar) prices at enterprise SaaS rates, not indie-developer rates,
and every affordable alternative is an unofficial/unlicensed pass-through of the same underlying data.

- **Primary, v1 candidate: ESPN's hidden API**
  (`site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard` and
  `.../tennis/wta/scoreboard`, with a `?dates=YYYYMMDD` parameter for other days). Confirmed live via
  research: publicly accessible, unauthenticated, no API key required, returns structured match records
  (round, court, players, countries, set scores, match status) for both tours in one call per tour per
  day. Same profile as the ESPN endpoints already recommended for `nfl-tracker`/`nhl-tracker`/
  `mlb-tracker`/`soccer-tracker`: unofficial, undocumented, no SLA, and **ESPN's own terms of service
  explicitly prohibit commercial use** ("You may not... use any Content, or the ESPN API or Tools for any
  commercial purpose" without prior written approval) — the same textual conflict every sibling doc in
  this batch has flagged, carried here unchanged.
- **Considered, not recommended as primary: third-party budget tennis APIs**
  (`livetennisapi.com` — free tier: live scores, current matches, players, fixtures, 30 req/min / 1,000
  req/day, MIT-licensed per its own claim; paid tiers $9.99/$29.99/$99.99/mo add history, odds, and
  WebSocket; `tennis-api.com` and `matchstat`'s Tennis API are similar-shaped alternatives). These are
  genuinely more convenient (purpose-built for tennis's set/game/point data shape, cheap month-to-month
  pricing) than scraping ESPN by hand, but **their commercial-redistribution rights were not confirmed**
  in this research — livetennisapi's public pages don't disclose them, and `api-tennis.com`'s terms
  explicitly push IP-clearance responsibility for any copyrighted content back onto the integrator rather
  than granting it. None of these claims an official ATP/WTA license the way Sportradar does. **Verify
  the actual terms of use directly with whichever provider is chosen before committing**, same "manual
  check before final lock" caveat used elsewhere in this roster's docs.
- **The one officially-licensed option, priced out of reach for v1:** Sportradar holds "Sportradar's
  official ATP partnership" and covers 4,000+ tennis competitions including all four Grand Slams, ATP,
  WTA, ITF, Challenger, and Olympic tennis — but pricing starts at **$10,000+/month with a sales
  engagement and minimum annual contract**. This is not viable against a one-time $6.99 plugin sale by
  any margin; flag as the long-term escape hatch only if this product scales into a much larger
  multi-sport data business, not a v1 or even v2 consideration.
- **Ruled out: Jeff Sackmann's `tennis_atp` GitHub datasets.** Confirmed via research: historical only
  (rankings/results/stats compiled from 1973-present, static CSV files), no live-score capability at all.
  Useful for a hypothetical "player stats/H2H" feature but cannot power the core live-score product.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/`, not `free/better-hotkeys-mouse` (the heavier
native-OS-hook plugin — nothing here needs OS-level hooks):

- **Background polling:** one ticker in the plugin process, same shape as
  `plugins/screensaver-cycler/src/scheduler.ts`'s `startScheduler()`/`tick()` — not per-action timers,
  which pause on page switch. Step polling cadence up (20-30s) while a favorited player has a live match,
  step down (several minutes) otherwise. During Grand Slam weeks, expect several simultaneous live
  matches across favorited players; during off-major weeks, expect long idle stretches — the cadence
  logic should handle both without hammering the endpoint during quiet periods.
- **Config/favorites store:** `scheduler.ts`'s `getConfig()`/`patchConfig()` pair over
  `streamDeck.settings.getGlobalSettings()` is directly reusable, storing a favorite-**player** list
  (player ID, name, tour) instead of a team list.
- **Favorite-player PI flow — the genuinely good architectural fit flagged in Build fit above:**
  `plugins/screensaver-cycler/src/pi.ts`'s probe-and-reply protocol (the PI is a sandboxed browser window
  with no network access of its own, so it asks the plugin process and gets a reply via
  `streamDeck.ui.sendToPropertyInspector`) was built for a live, variable-length, filesystem-dependent
  list. A "search for a player by name" typeahead against a few hundred active ATP+WTA players is
  actually a closer match to that use case than the static 32-team dropdowns every other sport tracker in
  this batch reduces the pattern to — extend it to `{probe: "players", query: "<partial name>"}` ->
  ranked match list, rather than inventing a new protocol.
- **Score-state domain logic — the biggest genuinely new piece, and unique to tennis in this roster:**
  no other sport tracker validated so far has to model a nested set-within-match hierarchy. Needs its own
  small state model: sets won per player, current set's games, current game's points (including
  deuce/advantage or no-ad scoring depending on tournament), tie-break state, and match format (best-of-3
  vs. best-of-5 — men's Grand Slams are still best-of-5, every other event and all women's matches are
  best-of-3), plus singles vs. doubles (two players/teams, potentially four names to display). Scope this
  as its own small parser/state-machine layer, not an extension of any sibling tracker's score model.
- **Dynamic icons:** same net-new subsystem as every sport tracker in this batch — composite player
  initials/tour-color badge plus live set score onto the key image on each tick. No official
  headshots/logos (see Risk); this is the item the v1 flip condition proposes deferring to v2.
- **Error handling / caching:** persist last-known-good state per followed player in global settings; on
  a failed/errored call, keep showing the last cached state with a subtle staleness indicator, same
  pattern as every sibling tracker.

## Feature List (v1)

- **Player Score** action: pick a favorite player via the search-typeahead PI, key shows player
  name/initials + live set score + game/point state when live; pre-match shows opponent + start time;
  final shows the match result.
- **Rankings** action: current ATP or WTA top-N rankings view (text-based, no per-player art needed).
- **Next Match** action: next scheduled match for a favorited player with date/time.
- Favorites configured once in a settings/PI surface shared across actions, v1 text-only titles (no
  image compositing, per the Build-fit flip condition).

## Premium Features (v2+ upsell surface, not v1)

- Live point-by-point alerts (break point, set point, match point) — contingent on whichever data source
  is chosen actually exposing point-level granularity; ESPN's scoreboard endpoint returns set-level
  scores, not confirmed to include live point-by-point state, so this needs a spike before promising it.
- Next-match countdown (live-updating "T-minus" title on a key).
- Multi-player dashboard view cycling favorites automatically, useful during Grand Slam weeks when
  several favorited players may have matches on the same day.
- Doubles-pairs tracking as a distinct favorite type from singles players.
- H2H / player stats lookup — **flag as uncertain**: would likely need a separate stats source (Jeff
  Sackmann's historical datasets are a plausible fit for this specific feature, unlike for live scores),
  unresearched in depth, do not promise without a confirmed integration path.

## UI Ideas

- Button layout: honor house rule 3 (never fill all 15 slots in marketing renders) — a realistic layout
  is 3-5 favorite-player keys + 1 rankings key + 1 next-match key, rest of the deck idle/faint, same
  pattern as every other product in the roster.
- **Grand Slam mode (v2+ idea, not v1):** during major windows, a dedicated view surfacing all of a
  user's favorited players with matches that day, rather than one key per player — useful specifically
  because major weeks are when multiple favorited players are likely to be live simultaneously, unlike
  the rest of the year.
- **Dashboard/LCD widget potential (v3, not v1):** same pattern noted in the NHL/soccer docs — Corsair's
  general sports-scores widget category and Forge My Edge builder suggest a small-screen rotating
  scoreboard is a plausible v3 surface once v1 proves demand.

## Marketplace Positioning

Lead with "follow your favorite players, not just one league" (benefit-focused, matches house rule 2) —
the individual-athlete favorites model is this product's real structural differentiator from every team
sport in the roster, not a claim of exclusive data access. **Never use Wimbledon's trademarked
purple/green color scheme, and never use ATP/WTA/AELTC/USTA/FFT/Tennis Australia word marks or logos** in
the product name, icon, or headline marketing copy (see Risk) — "ATP & WTA tour" as a plain-English
descriptor of coverage scope is lower-risk than any of the individual body's registered marks, but should
still be paired with an explicit non-affiliation disclaimer in the listing description itself, the same
pattern used in every sibling doc.

## Pricing Recommendation

**$6.99** launch price (see comp table above), matching the roster's established "unproven sports-niche"
tier used for `nfl-tracker`, `nhl-tracker`, and `soccer-tracker`. No priced comp exists anywhere in this
niche to anchor higher — this is deliberately conservative rather than pricing ahead of evidence, even
though tennis's audience-size numbers (1B+ global fans) are the largest raw figures found for any sport
tracker validated in this batch. Revisit upward only after real sales data, following the same
"raise after validation" pattern used elsewhere in the roster.

## Confidence Score

**Medium-low**, in line with `nhl-tracker`/`soccer-tracker`. High confidence in: the competitive gap
(the cleanest and most thoroughly hand-verified of any sport tracker in this batch — checked Marketplace
search, GitHub sideload search, and Corsair's widget catalog, found nothing in any of the three), the
ESPN API's technical availability and its commercial-use restriction (directly sourced), the Grand Slam
calendar dates (independently confirmed for 2027), and the Sportradar official-partnership pricing floor.
Lower confidence in: the actual commercial-redistribution terms of the affordable third-party tennis APIs
(not fully disclosed in their public pages, needs a direct provider conversation before any commitment),
whether ESPN's tennis scoreboard exposes true point-by-point granularity (needed for some Premium
Features ideas, unconfirmed), and true tennis-specific buyer demand (still a substring-matched floor,
same as every sibling).

## Build Recommendation

**Do not proceed to `/rat-build` yet.** This is a LEAN-GO with Risk below the 4-point sign-off floor —
the worst Risk score of any sport tracker validated in this batch, driven by the total absence of an
affordable licensed data path (worse than soccer's football-data.org escape hatch, closer to MLB's dead
end) and six separate trademark/ToS regimes to track, including Wimbledon's unusually aggressive
color-trademark posture. Sequence:

1. Get explicit owner sign-off on the tennis data-licensing and multi-body trademark risk (document the
   decision, same as the `nhl-tracker`/`soccer-tracker` recommendation) — mandatory given the sub-4 score.
2. Pick one specific unofficial data source in writing (ESPN vs. a named third-party provider) rather than
   leaving it implicit, and get direct confirmation of that provider's commercial-use terms before
   building against it.
3. Re-scope v1 to the text-only, no-image-compositing version to bank the Build-fit flip condition.
4. Re-run the deterministic scorer close to the 2026 US Open or the 2027 Australian Open (Jan 17-31,
   2027) for a fresher, more season-aligned demand read.
5. If total clears 70 after that, proceed to `/rat-build tennis-tracker`; if not, this stays parked as
   `validated` (the gap is real and genuinely the cleanest in this batch) pending a stronger signal or a
   resolved licensing path.

## Implementation Plan (if greenlit)

1. Scaffold `plugins/tennis-tracker/` from the `screensaver-cycler` project layout (`@elgato/streamdeck`
   + Rollup + TypeScript), UUID `com.packrat.tennis-tracker`.
2. Build the chosen API client (ESPN tennis scoreboard endpoints, or a confirmed-terms third-party
   provider) with the caching/backoff layer from Technical Notes.
3. Build the tennis-specific score-state parser (sets/games/points, tie-breaks, best-of-3/5, singles vs.
   doubles) — the single biggest net-new piece, spike this early.
4. Background ticker (`scheduler.ts`-equivalent) driving live state into global settings.
5. `Player Score` action (v1 text-only titles first, per the flip-condition descope), `Rankings`, `Next
   Match` actions.
6. PI: extend `pi.ts`'s probe pattern to a player-search typeahead (`{probe: "players", query}`).
7. `streamdeck validate` / `streamdeck pack`, install-test, then QA gate.
8. Marketing kit via `gen_marketing.py` — zero official logos/marks anywhere in the kit, no Wimbledon
   purple/green color scheme, disclaimer language in the description.

## Roadmap

- **v2:** dynamic per-key player badge/score image compositing (the deferred Build-fit item), live
  break-point/set-point/match-point alerts (contingent on data-source point-level granularity), doubles
  favorites as a distinct type.
- **v3:** Dashboard/LCD widget mode for Stream Deck+/Neo, Grand Slam mode (multi-favorited-player daily
  view), H2H/player-stats lookup (possible fit for Jeff Sackmann's historical datasets), revisit a
  licensed Sportradar-tier feed if this or a broader Packrat sports-data business scales enough to
  justify enterprise pricing.

## Proposed registry.json entry

Not added to `registry.json` by this research — for the owner to add once sign-off/flip conditions are
addressed:

```json
"tennis-tracker": {
  "name": "Tennis Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.tennis-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/tennis-tracker",
    "package": "plugins/tennis-tracker/marketing/com.packrat.tennis-tracker.streamDeckPlugin",
    "marketing": "plugins/tennis-tracker/marketing"
  },
  "keywords": ["tennis tracker", "tennis scores", "live tennis scores", "atp wta scores", "tennis rankings"],
  "risk_flags": ["trademark:atp-wta-grand-slam-marks", "trademark:wimbledon-color-mark", "api-risk:unofficial-tennis-data", "seasonal-demand:grand-slam-spikes"],
  "notes": "LEAN-GO 56.9/100 per plugins/tennis-tracker/VALIDATION.md, 2026-07-28. Deterministic 49.9/75 (demand 18.9, competition_gap 25 -- confirmed live, the cleanest gap of any sport tracker in this roster: zero hits on Elgato Marketplace, GitHub sideload, or Corsair's Xeneon Edge widget catalog, unlike NHL/MLB which each had a free sideload/Marketplace competitor. Monetization 6/20, no comps to anchor to). Build fit 5/15 (live API client -3, dynamic icon compositing -3, tennis-specific sets/games/points/tie-break/best-of-3-vs-5/doubles score-state logic -3 -- new domain complexity no team-sport tracker needs; partially offset because the favorite-PLAYER search/typeahead PI flow is actually a BETTER fit for screensaver-cycler's probe-and-reply pattern than any team-sport's static dropdown, only -1). Risk 2/10, below the 4/10 sign-off floor and the worst in this batch: no affordable officially-licensed data path exists (Sportradar holds the official ATP partnership but starts at $10,000+/mo, same dead-end MLB Tracker hit; the affordable third-party tennis APIs are unlicensed pass-throughs with unconfirmed commercial terms) plus SIX separate trademark/ToS regimes (ATP, WTA, AELTC/Wimbledon, USTA, FFT, Tennis Australia) vs. one or two for other sports, including Wimbledon's own trademarked purple/green color scheme -- a broader IP claim than any comp found elsewhere in this roster. Needs mandatory owner sign-off before /rat-build per the sub-4 rule. Flip-to-GO path: descope v1 to text-only titles (no image compositing, +3 build fit), documented owner risk sign-off + a specific named data source with confirmed terms (+3 risk), and a demand rescrape near the 2026 US Open or 2027 Australian Open (Jan 17-31) -- even both flips land at ~63, still short of 70. Individual-athlete favorites model (not team-based) is a real UX differentiator from every other sport tracker in this roster. Grand-Slam-concentrated purchase-intent (~8 weeks/year across 4 majors) should drive marketing/ship timing the same way NHL/soccer target season starts."
}
```
