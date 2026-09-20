# Validation: NASCAR Tracker

Idea: Stream Deck **plugin** (`com.packrat.nascar-tracker`, not a `profiles/_build` profile) showing
live NASCAR Cup Series race schedule, live running order/results, and driver standings on Stream Deck
keys, with a favorite-driver picker in the Property Inspector. Closest in-repo precedent:
`plugins/screensaver-cycler/` (background-poller + persistent-config pattern, PI-probe dynamic-list
protocol) over `free/better-hotkeys-mouse/` (heavier native-OS-hook plugin, wrong shape for this product).
No existing motorsport plugin in the roster; two sibling stick-and-ball validations already exist
(`plugins/nhl-tracker/VALIDATION.md`, `plugins/soccer-tracker/VALIDATION.md`) and this doc follows their
scoring calibration directly.

Data freshness: deterministic run below is same-day (`data_age_days: 0`), same generic-query caveat as
every sport tracker validated in this roster so far — see the Demand "why" line.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 18.9 | Best match is generic `tracker` (popularity 22, p63 of tracked queries) and `scores` (popularity 17) — the scrape's substring matcher cannot isolate "NASCAR" demand specifically, same weak-floor caveat as every sibling in this batch. Real-world context cuts both ways here in a way the other trackers didn't have to weigh: NASCAR's fanbase is large and TV-engaged, but its average fan age is **58**, materially older than IndyCar (44) or F1 (32), and its digital/streaming audience skews older and more rural than the Elgato buyer profile (streamers, creators, PC/desk-setup enthusiasts) that every other sport tracker in this roster targets more comfortably. See Market Demand for the full honest treatment — this is a real, distinct risk to the Demand story, not just a scrape-floor caveat, even though it can't move the deterministic number. |
| Competition gap (0-25) | 25.0 | Tool found 0 competing products. **Hand-verified, live, two ways:** (1) no NASCAR-specific plugin, profile, or icon pack is listed on the Elgato Marketplace today (only generic "Motorsport"/"Racing & Offroad" icon packs and `iRaceDeck`, a sim-racing telemetry plugin for the *iRacing* game, not real-world NASCAR data — see Competitor Analysis); (2) an independent grep of this repo's own full market scrape (`streamdeck-market-data/ALL_products_combined.csv`) for "nascar"/"motorsport"/"stock car" turns up zero NASCAR rows of any kind, confirming the seed data's claim rather than just repeating it. The gap is real and, unlike NHL/soccer, there is not even an adjacent single-developer paid comp (no `Live MLB Scores`-style precedent) pointing at this niche. |
| Monetization (0-20) | 6.0 | No comps found by the scrape or by hand — tool defaults to "unproven niche, mid-low," same as every sibling. Unlike NHL/soccer there is no adjacent paid sports-plugin developer (`ThatSportsGamer`) with any public motorsport product to anchor expectations to, and no motorsport widget was found on Corsair's Xeneon Edge catalog either (it has an F1 "Next Race" widget but no NASCAR equivalent, confirming the prompt's premise) — one fewer data point than the other trackers had, not a reason to score below their floor. |
| **Deterministic subtotal (0-75)** | **49.9** | From `tools/opportunity.py "nascar tracker" "nascar scores" --category Plugins` |
| Build fit (0-15) | 5 | Same core novel-build items as every sibling tracker: network API client with no precedent in this roster (deduct 4, matching nhl/soccer-tracker), a from-scratch driver-badge/number rendering pipeline since official liveries, sponsor logos, and team marks are all off the table (deduct 3, see Risk), and a wider settings/UI surface — favorite-driver picker, live running order, next-race view (deduct 2). **One point deducted that's specific to motorsport, not carried from the siblings:** NASCAR's live data shape is a full 40-car running order that reorders every lap, not a two-team score — the "live state" a background ticker has to track and diff is structurally bigger than a score/period tuple (deduct 1). **Not deducted, genuinely reusable:** `@elgato/streamdeck` `SingletonAction` scaffold + Rollup build + vanilla-HTML/JS PI (direct lift from `plugins/screensaver-cycler/`); the background-ticker pattern in `src/scheduler.ts` extends cleanly to "poll fast during a live race, slow down between race weekends"; the PI-probe protocol in `src/pi.ts` is a clean fit for a driver-select list (NASCAR's ~36-40 chartered Cup drivers is a similarly small, mostly-static list to NHL's 32 teams); and unlike soccer, NASCAR has **one** primary series structure to normalize (Cup Series leaderboard/points), not three competition-format shapes — this is a single-league-shape build like NHL/NFL/MLB, not soccer's fragmented one. |
| Risk (0-10) | 3 | Three stacked vectors, landing at the same sub-4 sign-off floor as nhl-tracker and soccer-tracker but for a distinct mix of reasons. **Trademark/likeness (deduct 3):** NASCAR's own Terms of Use state it grants no license to use its trademarks, trade names, or logos, and NASCAR has active, current trademark-infringement litigation underway (a 2026 lawsuit against multiple e-commerce sellers). Motorsport adds a wrinkle the other trackers don't have: even a "no official logo" badge design isn't automatically clean the way a team-color-block is for NHL/soccer, because a driver's identity on a race card is inseparable from **sponsor branding and paint-scheme livery** (separately trademarked/licensed by sponsors, not just NASCAR itself) and from the **driver's own right of publicity** (name/likeness) — this product needs a stricter design constraint than its siblings: number + driver name + team-assigned color only, zero car/livery art, zero sponsor logos, zero driver photos. **Data licensing (deduct 3, the single worst mark in this batch):** no affordable commercial-use path was found. NASCAR's own semi-official CDN feed (`cf.nascar.com/cacher/...`) and ESPN's hidden endpoint are both free but unofficial/no-SLA/commercial-use-unclear, same shape as the other trackers' fallbacks — but the *licensed* alternative (SportsDataIO) only offers a ~$99-149/mo "Discovery Lab" **personal-use, non-commercial** tier publicly; real commercial/resale pricing is quote-only enterprise sales, the same "$50-500+/mo, uneconomical against a one-time plugin sale" dead end that sank `mlb-tracker` to NO-GO, not soccer's football-data.org-style affordable middle path. **Unofficial-feed durability (deduct 1):** both free sources are undocumented and history elsewhere in this roster's research (NHL's full retirement of `statsapi.web.nhl.com` in Sept 2023) shows this pattern of unannounced breakage is real, not hypothetical, for sports-league CDN feeds generally. **Per the validation rubric, anything under 4 needs the owner's explicit sign-off regardless of total.** |
| **Qualitative subtotal (0-25)** | **8** | |
| **TOTAL (0-100)** | **57.9** | |

## Verdict: **LEAN-GO** (55-69 band)

57.9 lands just below `nhl-tracker` (58.9) and just above `soccer-tracker` (56.9) — consistent with this
being a genuinely comparable build to its stick-and-ball siblings, with the competitive gap holding up even
better under hand-verification (zero adjacent comps at all, not even an unlisted GitHub-only tool or a
same-developer paid sibling product) but Risk landing at the bottom of the pack because motorsport lacks
soccer's affordable-commercial-license escape hatch and adds a driver-likeness/sponsor-livery wrinkle team
sports don't have.

**Exact conditions that would flip this to GO:**
1. **Descope v1 to text-only running-order/results** (`setTitle`/`setState` on the native key title — driver
   name, position, gap to leader — no image compositing) and defer the number/badge-rendering system to v2.
   Removes the single largest Build-fit deduction. Build fit 5 -> 9 (+4).
2. **Owner explicit sign-off on the NASCAR trademark/data-licensing risk**, documented in
   `docs/DECISIONS.md`, plus a written, permanent design constraint: driver name + car number + team-color
   block only, never a car livery, sponsor logo, or driver photo anywhere in the product or its marketing,
   and a clear non-affiliation disclaimer in the listing copy. This converts the risk from an open question
   into an accepted one, which is what the rubric asks for below a 4. Risk 3 -> 6 (+3).
3. Both together land at **~64.9** — still short of 70. The remaining lift has to come from Demand: re-run
   `tools/opportunity.py "nascar tracker" "nascar scores" --category Plugins` close to a real NASCAR
   calendar spike — the **2026 Cup Series Playoffs open at Darlington on Sept 6, 2026** and run through the
   **championship race at Homestead-Miami on Nov 8, 2026** — once real NASCAR-specific search/query traffic
   exists in the scrape, rather than today's generic `tracker`/`scores` substring match. If the refreshed
   scrape shows a materially tighter NASCAR-specific match, Demand can move independently of anything above.

If none of the three land, this stays LEAN-GO and should not proceed to `/rat-build` as-is. **Unlike its
siblings, this verdict also carries a real, unresolved demand-confidence question (fanbase age/demographic
skew vs. the Stream Deck buyer, see Market Demand) that a higher deterministic Demand score would not fix
by itself** — worth weighing before committing build time even if the numeric flip conditions above are met.

## Recommended listing

- **Name:** "NASCAR Tracker" (14 chars, exact-search-term style, matches the roster's `NHL Tracker` /
  `Soccer Tracker` naming convention).
- **Price:** **$6.99** launch price, matching this roster's established "unproven sports-niche" tier.

  | Comp | Price | Type | Notes |
  |---|---|---|---|
  | `nfl-tracker` / `nhl-tracker` / `soccer-tracker` (Packrat, this roster, not yet built) | $6.99 (recommended) | plugin | same "unproven sports-niche, no priced comp" pricing logic |
  | `screensaver-cycler` (Packrat, published) | $7.99 | plugin | in-house comp for a proven, multi-feature utility plugin |
  | `iRaceDeck` (Elgato Marketplace) | not confirmed | plugin | sim-racing (iRacing telemetry) plugin, not real-world NASCAR data — nearest Marketplace neighbor by category, not a direct comp |
  | SportsDataIO NASCAR "Discovery Lab" | ~$99-149/mo | data API, personal-use tier | proves there's a real (if not cheap) commercial data market around NASCAR stats; not a retail-price comp |

  No direct paid NASCAR-tracker comp exists anywhere (Marketplace or adjacent widget ecosystems), so this is
  judgment-anchored to the roster's own tier, same as every sibling tracker, not a true market comp.
- **Device SKU plan:** single cross-platform package, `variants: {}` — no native OS hooks needed (network
  polling + rendering only, same as nhl/soccer-tracker), so **Win + Mac both ship at v1**.
- **Top 5 keywords:** `nascar tracker`, `nascar scores`, `nascar standings`, `live nascar scores`,
  `nascar race schedule`.
- **Risk flags:** `trademark:nascar-marks-liveries-sponsor-logos` (NASCAR's own marks, plus separately
  trademarked/licensed sponsor branding and car livery art — a stricter no-art-asset constraint than any
  team-sport sibling), `publicity-rights:driver-likeness` (no driver photos; name/number/team-color only),
  `api-risk:unofficial-nascar-feed-no-affordable-commercial-tier` (both free sources are undocumented/no-SLA,
  and unlike soccer's football-data.org there is no confirmed affordable paid-commercial escape hatch),
  `demand-risk:fanbase-demographic-skew` (58 avg fan age vs. the Stream Deck buyer's younger
  streamer/creator/PC-enthusiast profile — a distinct, not-fully-deterministic-captured risk to real sales).

Next step: this is a **LEAN-GO**, not an automatic `/rat-build`. Resolve the two flip conditions above (or
get explicit owner sign-off given Risk sitting below the 4-point threshold) before moving to build, and
weigh the demographic-fit question honestly regardless of what the numeric flip conditions do.

---

## Overview

A Stream Deck plugin for NASCAR fans who want live running order, race results, and driver standings
without alt-tabbing to a browser, second screen, or NASCAR's own app while streaming, working, or watching.
Favorite-driver picker in the Property Inspector; keys can be bound to a driver's live position, the race
leaderboard, or the next-race countdown. Built on `@elgato/streamdeck`, following the `screensaver-cycler`
architecture (background ticker in the plugin process + persistent global settings), not the
`profiles/_build` config-only pipeline — this product does not exist without new plugin code, same as every
sibling sport tracker.

## Market Demand

- Deterministic signal is a weak floor by design, same caveat as every sibling — the scrape cannot isolate
  "NASCAR" from generic "tracker"/"scores" queries.
- **The honest, distinct concern for this product (not present in the NHL/soccer docs):** NASCAR's own fan
  data shows an average fan age of **58**, against 44 for IndyCar and 32 for Formula 1 — notably, F1's much
  younger, more urban fanbase is exactly the demographic that has driven its recent global boom (Drive to
  Survive, F1 Academy, US race expansion), and it is also the demographic that best overlaps with Stream
  Deck's actual buyer base (streamers, content creators, PC/desk-setup enthusiasts). NASCAR's audience
  skews older and more rural, which is a real, structural reason to expect softer conversion than NFL, NBA,
  or even soccer for the *same* kind of "keep the score on my deck" utility — this is a demand-quality
  concern the deterministic score cannot see or correct for. It should not be read as "no demand" (see the
  competitive/engagement counter-evidence below), but the fit is genuinely weaker than this roster's other
  sport trackers, and that should be said plainly rather than smoothed over.
- Counter-evidence the fit isn't hopeless: NASCAR's 18-29 fan segment is still a real 26% of its base
  (not trivial in absolute terms given NASCAR's overall scale), digital/second-screen engagement is
  explicitly described as "a core part of the fan experience" in current NASCAR audience research, and
  NASCAR's own official video game ("NASCAR 25") has an active Twitch streamer community as of July 2026 —
  direct if narrow evidence some part of the NASCAR fan/gamer overlap already exists in exactly the
  platform (Twitch/streaming) this product's buyers live on.
- TV ratings context is mixed, not a straightforward tailwind: the 2026 Cup Series season logged its
  **fourth consecutive year of decline** on Fox (avg. 3.11M viewers, the worst Fox-era Cup season on record),
  though NASCAR on Prime Video grew viewership for its second season, with gains specifically concentrated
  in younger streaming-native viewers — a small, real signal in this product's favor even inside an overall
  declining-linear-ratings story.
- Calendar-driven demand triggers for a launch window: the 2026 regular season finale is at Daytona on
  **Aug 29, 2026**, the **playoffs open at Darlington on Sept 6, 2026** (16-driver elimination "Chase"
  format across three rounds), and the championship race is at **Homestead-Miami on Nov 8, 2026** — a
  concentrated, high-stakes ~10-week playoff window is this product's natural marketing/launch hook, similar
  in spirit to `nfl-tracker`'s pre-kickoff timing argument, and notably sooner than waiting for the next
  Daytona 500 season-opener.
- No free alternative *inside the Stream Deck plugin ecosystem* was found that is Marketplace-listed and
  NASCAR-specific (see Competitor Analysis). Outside the ecosystem, NASCAR.com, the NASCAR app, and general
  sports apps (ESPN) are the obvious free substitute — same "stays on hardware I already have open" pitch
  the rest of the roster uses, not "novel access to results."

## Competitor Analysis

- **Elgato Marketplace, live-searched:** no NASCAR-specific plugin, profile, or icon pack found. Near
  misses ruled out by hand: `iRaceDeck` (a real, currently-listed Stream Deck plugin, but it's iRacing
  **sim-racing telemetry** — lap times/fuel/tire data from the video game, not real-world NASCAR race
  results — a different product category entirely, not a competitor); `Racing & Offroad Icon Pack` and
  `Lovely Sim Racing Icons` (static icon packs, not live-data plugins); `Motorsport Icon Pack` / `Motorsport
  APEX` (also icon packs, confirmed via this repo's own `streamdeck-market-data/ALL_products_combined.csv`
  scrape, 121 and 27 downloads respectively — the closest anything in the local market data comes to a
  "motorsport" product, and neither is NASCAR-specific or live-data).
- **Independent verification of the seed data's zero-competitor claim:** a direct grep of this repo's own
  `streamdeck-market-data/ALL_products_combined.csv` for "nascar", "motorsport", and "stock car" returns
  zero rows containing "nascar" in any field. This confirms the claim by hand rather than trusting the
  scrape's own keyword match, per the task's explicit ask to double-check a 0-competitor result.
- **Adjacent widget ecosystem, hand-verified:** Corsair's Xeneon Edge/iCUE widget catalog (the same
  ecosystem the NHL/soccer docs found "Hockey Scores"/"Matchday Live" comps in) has an **"F1 Next Race"**
  widget (a live countdown to the next Formula 1 race weekend) but **no NASCAR equivalent** — direct,
  current confirmation of the prompt's premise that even hardware makers actively building motorsport
  widgets have covered F1, not NASCAR. This is a genuine gap-widening data point but also a mild
  demand-quality signal in the other direction: it's plausible Corsair judged F1's audience (younger,
  more global, more PC-hardware-adjacent) the better bet over NASCAR's, consistent with the demographic
  concern raised in Market Demand above.
- **No sideload-only GitHub tool equivalent to NHL's `ThatSportsGamer/live-nhl-scores-for-stream-deck` was
  found for NASCAR + Stream Deck specifically** — the GitHub NASCAR projects that exist (see API
  Recommendation) are general-purpose data trackers/dashboards (web apps, Python scripts), not Stream
  Deck plugins. This means the hard technical problem (NASCAR data -> per-key live state) is *not* already
  solved and public the way it was for NHL — a small net-negative for Build fit already reflected above, but
  also means there's no existing free alternative already trained onto this exact hardware, unlike NHL.
- **Net:** the gap is the cleanest of any sport tracker validated in this roster so far — no Marketplace
  comp, no adjacent same-category paid developer, no widget-ecosystem comp, no free sideload tool — but a
  clean gap in a smaller, older-skewing niche is not automatically a better opportunity than a contested
  niche with a bigger, younger buyer overlap; see Verdict.

## API Recommendation

NASCAR does not have a documented, community-standard open API the way NHL (`api-web.nhle.com`) or MLB
(`statsapi.mlb.com`) do — this is a genuinely harder data-sourcing problem than the stick-and-ball sports
already validated, and that's reflected directly in Build fit and Risk above, not glossed over.

- **Primary: NASCAR's own semi-official CDN feed, `cf.nascar.com/cacher/...`** (paths like
  `/{year}/{series}/{race_id}/lap-times.json`, plus schedule, live-feed, loop-data, and points-standings
  equivalents per the pattern documented by multiple independent open-source clients —
  `Dennist03/nascar-tracker`, `RRoberts4382/rNascar23.Sdk`, `jemorriso/nascar`). This is genuinely NASCAR's
  **own first-party infrastructure** (the same data their own second-screen products draw from), which is a
  meaningfully different trust posture than NHL/soccer's reliance on ESPN's hidden API alone — but it is
  completely undocumented, unversioned, and carries no public terms of use for third-party integrators, and
  no rate limit or SLA is published. `Dennist03/nascar-tracker`'s own README states "no API keys required,
  all endpoints are free and public" with no reliability caveats, which should be read as "currently
  works," not "guaranteed to keep working" — self-throttle polling regardless.
- **Verified fallback: ESPN's hidden API, `site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard`**
  (and `/news`). **Directly confirmed live** by fetching this exact path during this research: it returns
  valid, current JSON — full 2026 Cup Series calendar (42 events, Feb-Nov), race results with driver
  finishing order and athlete profile links, for date-specific queries. Some secondhand search results
  claimed "NASCAR is no longer available on ESPN's API," which this live fetch directly contradicts for
  this specific endpoint as of this research date — worth re-verifying again close to build time in case
  that claim reflects a change in progress elsewhere in ESPN's racing coverage, but do not treat it as
  settled without a fresh check. Same unofficial/no-SLA profile as the primary source.
- **Licensed/commercial option, not viable for v1 economics:** SportsDataIO offers a real NASCAR API
  product, but its only publicly-priced tier ("Discovery Lab," ~$99-149/mo) is explicitly **personal-use,
  non-commercial**; genuine commercial/resale licensing is quote-only enterprise sales with no published
  floor. This is the same "$50-500+/mo, uneconomical against a one-time plugin sale" dead end that sank
  `mlb-tracker` to NO-GO — flag as the escape hatch if NASCAR enforcement or free-feed reliability ever
  becomes a real post-launch problem, not a v1 requirement, and not the affordable middle path soccer's
  football-data.org provided.
- **RapidAPI "Nascar Motorsport API"** — exists, but is a paid, API-key-gated wrapper of unknown/undisclosed
  underlying data source per its own documentation; no clear advantage over the two free sources above and
  an added unknown-provenance risk. Not recommended.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/`, not `free/better-hotkeys-mouse` (the heavier
native-OS-hook plugin — nothing here needs OS-level hooks):

- **Background polling:** one ticker in the plugin process (not per-action timers, which pause on page
  switch), same pattern as `plugins/screensaver-cycler/src/scheduler.ts`'s `startScheduler()`/`tick()`.
  Cadence should step up sharply during a live race (e.g. 15-30s, matching the granularity of a
  lap-by-lap-reordering leaderboard) and step down hard between race weekends (e.g. hourly, just enough to
  catch schedule changes) — NASCAR's calendar has longer gaps between events than a weekly NFL slate or a
  nightly NHL/MLB schedule, so the "idle" cadence can be much lower-frequency than either sibling doc
  recommended.
- **Config/favorites store:** persistent global settings via `streamDeck.settings.getGlobalSettings()` /
  `setGlobalSettings()`, same shape as `scheduler.ts`'s `getConfig()`/`patchConfig()` — favorite driver(s)
  live here, not per-action settings.
- **Live-state shape is the real net-new piece relative to NHL/MLB/NFL:** a two-team score is a small,
  stable tuple; a NASCAR running order is up to ~40 cars re-ranking every lap. Store only what's needed per
  favorited driver (position, gap-to-leader, lap, flag state) rather than caching the full field on every
  tick, to keep the diffing/render cost bounded regardless of field size.
- **Caching / offline fallback:** keep last-known-good response per endpoint; on fetch failure, keep
  showing the last good state with a staleness indicator once data is older than ~2x the expected poll
  interval, same pattern as nhl/soccer-tracker — the standard mitigation for an unofficial, no-SLA API,
  doubly important here since NASCAR's feed has no public documentation to confirm behavior against at all.
- **Error handling:** exponential backoff on non-2xx/timeout, capped retry rate (self-imposed, no published
  rate limit to respect from either source).
- **Favorites/settings UI:** NASCAR's Cup Series field is a small, mostly-static list (~36-40 chartered
  drivers per season) — same shape as NHL's 32-team list, so a static `<select>`/searchable list in the PI
  HTML/JS is sufficient for v1; the probe-protocol pattern from `screensaver-cycler/src/pi.ts` is worth
  keeping in reserve if a future version needs to reflect mid-season driver/team changes dynamically.
- **Dynamic icons (deferred per the Build-fit flip condition):** composite driver number + driver
  last-name/abbreviation + team-assigned color block onto the key, updating on each live-state tick.
  Explicitly **do not** render car liveries, sponsor logos, or driver photos — see Risk.

## Feature List (v1)

- **Driver Watch** action: pick a driver in the PI, key shows current position, gap to leader, and flag
  state (green/yellow/red) during a live race; shows next scheduled race + start time between races; press
  opens the race on NASCAR.com in the browser.
- **Leaderboard** action: cycles through the current top-N running order (text-based, no per-driver art
  needed for v1).
- **Next Race** action: shows the next scheduled Cup Series race with date/time and track name.
- Favorites configured once in a settings/PI surface shared across actions.

## Premium Features (v2+ upsell surface, not v1)

- Live position-change alerts (a favorited driver moving into/out of the top 10, or a caution flag) — new
  work, no existing precedent in this roster's plugins.
- Pit-stop notifications (NASCAR's loop-data/pit-stop feeds, per the open-source SDK docs referenced above,
  appear to expose this) — **flag as unconfirmed**: not independently verified against a live endpoint
  during this research, do not promise without confirming the exact field/cadence first.
- Multi-driver dashboard view cycling favorites automatically.
- Points/standings-race countdown ("X points back of the cutline" during playoffs) — a genuinely
  motorsport-native hook the stick-and-ball trackers don't have, worth prioritizing in v2 given the
  Sept-Nov playoff elimination format is inherently more dramatic/shareable than a regular-season standings
  table.

## UI Ideas

- Button layout: honor house rule 3 (never fill all 15 slots in marketing renders) — a realistic layout is
  3-5 favorite-driver keys + 1 leaderboard key + 1 next-race key, rest of the deck idle/faint in marketing
  art, same as every other product in the roster.
- **Dashboard/LCD widget potential (v3, not v1):** Corsair's Xeneon Edge already has an "F1 Next Race"
  widget proving this exact shape works for motorsport on a small screen — a NASCAR equivalent is an
  unclaimed adjacent-ecosystem opportunity worth a scoping pass once v1 (if built) proves demand.

## Marketplace Positioning

Lead with "keep the running order on your deck, not a second tab" (benefit-focused, matches house rule 2 —
never "100% LOCAL" backend framing, no pricing/subscription framing in listing copy). Do not lead with
"NASCAR data access" as if novel; free alternatives (NASCAR.com, the NASCAR app, browser tabs) are the
obvious substitute. Never use official team liveries, sponsor logos, or driver photos anywhere in the
listing or marketing kit (house rule 5 + this product's specific driver-likeness/sponsor-branding risk,
stricter than any sibling tracker) — carry an explicit non-affiliation disclaimer in the listing description
itself, same pattern recommended for `nfl-tracker`/`nhl-tracker`/`soccer-tracker`.

## Pricing Recommendation

No priced comp exists anywhere in this niche (Marketplace, adjacent widget ecosystems, or a same-developer
paid sibling product) — the weakest monetization evidence base of any sport tracker validated in this
roster, though the deterministic score (6/20) already reflects "unproven niche" at the same floor as its
siblings. Recommend the same conservative **$6.99** launch price used for `nfl-tracker`/`nhl-tracker`/
`soccer-tracker`, with no basis in this research to price above that tier, and a real possibility (given the
demographic concerns above) that this niche validates slower post-launch than its stick-and-ball siblings.

## Confidence Score

**Medium-low.** High confidence in: the API landscape (both the first-party NASCAR CDN feed and the ESPN
fallback were independently verified — the ESPN endpoint by a live fetch during this research, not just
secondhand claims), the competitive gap (verified two ways: live Marketplace/web search and an independent
grep of this repo's own market-data scrape), and the playoff-calendar dates (independently sourced,
consistent across multiple outlets). Genuinely lower confidence than the NHL/soccer docs in two places this
research surfaced honestly rather than smoothing over: (1) **data-sourcing is harder** — no documented
open API exists, both viable sources are undocumented first-party/hidden endpoints with no public ToS for
integrators, and the licensed fallback has no affordable commercial tier (worse than soccer's
football-data.org situation, comparable to MLB's NO-GO-driving problem); (2) **demand-quality is the
weakest of any sport tracker validated so far** — NASCAR's fanbase skews notably older/more rural than the
Stream Deck buyer profile (58 avg fan age vs. F1's 32), a real business-fit question the deterministic
Demand score cannot see or correct for.

## Build Recommendation

**Do not proceed to `/rat-build` yet.** This is a LEAN-GO, and Risk scored 3/10 — below the rubric's 4-point
sign-off floor, same posture as `nhl-tracker`/`soccer-tracker` but for a distinct reason (no affordable
commercial-licensing fallback, plus the sponsor-livery/driver-likeness wrinkle). Sequence:
1. Get explicit owner sign-off on the NASCAR trademark/driver-likeness/data-licensing risk (document the
   decision, e.g. in `docs/DECISIONS.md`), including the stricter "no livery, no sponsor logo, no driver
   photo" design constraint.
2. Re-scope v1 to the text-only, no-image-compositing version to bank the Build-fit flip condition.
3. Re-run the deterministic scorer close to the **Sept 6, 2026 playoff opener at Darlington** for a fresher
   demand read, and treat any refreshed number alongside the demographic-fit question above, not as a
   standalone green light.
4. Explicitly weigh the demand-quality concern (fanbase age/demographic skew) against the unusually clean
   competitive gap before committing build time — this is the one sibling doc in the batch where "no
   competitors" and "confident this converts to sales" pull in different directions rather than the same
   one.
5. If total clears 70 after (1)-(3) and (4) doesn't raise a stop-ship concern, proceed to
   `/rat-build nascar-tracker`; if not, this stays parked as `validated` pending a stronger signal.

## Implementation Plan (if greenlit)

1. Scaffold `plugins/nascar-tracker/` from the `screensaver-cycler` project layout (`@elgato/streamdeck` +
   Rollup + TypeScript), UUID `com.packrat.nascar-tracker`.
2. Build the `cf.nascar.com/cacher` client (schedule, live-feed, points/standings) with ESPN's
   `nascar-premier` endpoint as a documented fallback, plus the caching/backoff layer from Technical Notes.
3. Background ticker (`scheduler.ts`-equivalent) with race-live/idle cadence stepping, driving live state
   into global settings, storing only per-favorited-driver fields (not the full field) to bound render cost.
4. `Driver Watch` action (v1 text-only titles first, per the flip-condition descope), `Leaderboard`,
   `Next Race` actions.
5. PI: static/searchable driver-select list (no probe protocol needed for v1).
6. `streamdeck validate` / `streamdeck pack`, install-test, then QA gate.
7. Marketing kit via `gen_marketing.py` (plugin-aware per `screensaver-cycler`'s registry notes) — zero
   liveries/sponsor logos/driver photos anywhere in the kit, disclaimer language in the description.

## Roadmap

- **v2:** dynamic per-key driver-badge (number + name + team color, no livery/logo/photo) image compositing
  (the deferred Build-fit item), position-change/caution-flag alerts, points-back-of-cutline countdown
  during playoffs.
- **v3:** Dashboard/LCD widget mode for Stream Deck+/Neo (Corsair's own "F1 Next Race" widget already
  proves this shape works for motorsport on a small screen — a NASCAR equivalent is an open adjacent-market
  slot); investigate whether a broader **"Motorsports Tracker"** covering NASCAR + F1 + IndyCar on one
  shared polling/rendering architecture is a better business than three separate single-series plugins —
  F1's younger, more Stream-Deck-aligned fanbase could carry the bundle's demand story while NASCAR/IndyCar
  ride along on the same build cost, worth a dedicated validation pass of its own rather than a NASCAR-only
  sequel if this v1 underperforms; investigate a licensed data feed if NASCAR API reliability or enforcement
  posture changes.

## Proposed registry.json entry

Not applied — for the owner to add once sign-off/flip conditions are addressed:

```json
"nascar-tracker": {
  "name": "NASCAR Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.nascar-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/nascar-tracker",
    "package": "plugins/nascar-tracker/marketing/com.packrat.nascar-tracker.streamDeckPlugin",
    "marketing": "plugins/nascar-tracker/marketing"
  },
  "keywords": ["nascar tracker", "nascar scores", "nascar standings", "live nascar scores", "nascar race schedule"],
  "risk_flags": ["trademark:nascar-marks-liveries-sponsor-logos", "publicity-rights:driver-likeness", "api-risk:unofficial-nascar-feed-no-affordable-commercial-tier", "demand-risk:fanbase-demographic-skew"],
  "notes": "LEAN-GO 57.9/100 per plugins/nascar-tracker/VALIDATION.md, 2026-07-28. Deterministic 49.9/75 (demand 18.9, competition_gap 25, monetization 6), same shape as nhl/soccer-tracker. Competition gap independently hand-verified two ways: live Marketplace/web search (only iRacing sim-telemetry plugin and generic motorsport icon packs found, no NASCAR-specific product) and a direct grep of this repo's own streamdeck-market-data/ALL_products_combined.csv (zero nascar rows). Build fit 5/15: network API client + dynamic driver-badge rendering + settings UI (matching nhl-tracker's deductions), plus one extra deduction for NASCAR's full-field running-order live-state shape (bigger than a two-team score tuple); NOT penalized for multi-format normalization the way soccer-tracker was, since NASCAR Cup Series is a single-series structure. Risk 3/10, below the 4/10 sign-off floor -- worse than nhl-tracker's 4 and soccer-tracker's 3 for a distinct reason: no affordable commercial data-licensing path was found (SportsDataIO's only public tier is personal-use-only; real commercial pricing is quote-only enterprise, the same dead end that sank mlb-tracker to NO-GO), plus a driver-likeness/sponsor-livery constraint stricter than any team-sport sibling (no car liveries, no sponsor logos, no driver photos, ever). API: primary is NASCAR's own semi-official CDN (cf.nascar.com/cacher/...), a genuinely first-party feed (stronger provenance than ESPN-only reliance) but fully undocumented; ESPN's site.api.espn.com/apis/site/v2/sports/racing/nascar-premier/scoreboard endpoint was directly live-fetched and confirmed working during this research as the documented fallback. Needs owner sign-off before /rat-build. Flip-to-GO path: descope v1 to text-only titles (+4 build fit), owner risk sign-off + written no-livery/no-sponsor-logo/no-driver-photo constraint (+3 risk), re-run the deterministic scorer near the Sept 6 2026 Darlington playoff opener for a fresher demand read -- reaches only ~64.9, still short of 70. Distinct, non-numeric concern flagged for the owner: NASCAR's average fan age (58) skews notably older/more rural than the Stream Deck buyer base (streamers/creators/PC enthusiasts) compared to F1's much younger (32 avg) and more Stream-Deck-aligned fanbase -- the cleanest competitive gap of any sport tracker validated in this roster does not by itself guarantee this converts to sales the way it might for a younger-skewing sport. v3 roadmap idea if this underperforms: consider a broader Motorsports Tracker (NASCAR+F1+IndyCar, shared architecture) instead of a NASCAR-only sequel."
}
```
