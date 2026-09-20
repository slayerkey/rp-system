# Validation: Soccer Tracker

Idea: Stream Deck **plugin** (`com.packrat.soccer-tracker`, not a `profiles/_build` profile) showing
live soccer/football scores, standings, and next-match info for major leagues and international
tournaments (Premier League, Champions League, La Liga, Bundesliga, Serie A, Ligue 1, World Cup, Euros),
with a Property Inspector settings UI for favorite team(s) **and** favorite league(s) — soccer's
competition structure is more fragmented than any single-league US sport already researched in this
roster (NFL/NHL/MLB), so this is a real scope decision, not a rename of those docs. Closest in-repo
precedent: `plugins/screensaver-cycler/` (background-poller + PI-probe pattern). No existing sports
plugin in the roster has shipped.

Data freshness: deterministic scores below are same-day (`data_age_days: 0`), run twice under both
candidate names — see Naming Decision for why the `soccer-tracker` run is the one carried into the
score table.

## Naming Decision: "Soccer Tracker" vs "Football Tracker"

**Final call: Soccer Tracker.** This was checked, not assumed from the seed data.

The two deterministic runs:

| Name pair | Demand | Competition gap | Monetization | Deterministic (0-75) |
|---|---|---|---|---|
| "soccer tracker" / "soccer scores" | 18.9 | 25 | 6 | 49.9 |
| "football tracker" / "football scores" | 21.6 | 25 | 6 | 52.6 |

"Football" scores 2.7 points higher purely because the scraped query-suggestion data has one real hit
on the literal term "football" (popularity 26), which "soccer" doesn't have an equivalent for. Two
things undercut that number on inspection:

1. **The "football" query's own dominant category is Icons, not Plugins/Profiles.** Most people
   searching "football" on this marketplace are after icon packs, not a live-score utility — and given
   this catalog already has a live, in-house **NFL Tracker** validation, the far more likely read is that
   "football" query volume here skews American-football icon packs, not soccer demand. Treating it as a
   soccer-specific signal would be the mistake the sibling docs (nfl-tracker, nhl-tracker) explicitly
   warn against with their own generic-query caveats.
2. **Live-searched, ecosystem-native evidence settles it independently of the scrape.** `Keep The Score`
   — a real, currently-listed Elgato Marketplace Stream Deck plugin — supports "Basketball, Baseball,
   **Football**, Hockey, **Soccer**, Volleyball, Pickleball, Badminton, Squash" as explicitly *separate*
   sport categories in its own product. That is direct, current proof that within this exact marketplace's
   own product taxonomy, "Football" already means American football and "Soccer" is the distinct label for
   the round-ball game — not a general-web guess about British vs. American usage, but this platform's
   own convention. That directly confirms the collision risk this task flagged: a soccer product named
   "Football Tracker" would sit in the same keyword space as this roster's own **NFL Tracker**, risking
   both search cannibalization and buyer confusion within Packrat's own catalog (an American user clicking
   "Football Tracker" expecting NFL; a soccer fan typing "football" and landing on the NFL product instead).
3. **The cited counter-evidence (Corsair naming a soccer widget "WC Football Scores", and a second Corsair
   widget "Matchday Live") is real but from a different ecosystem** — Xeneon Edge/iCUE, not the Stream
   Deck Marketplace, and Corsair has no NFL-named product there to collide with. It shows "football" is a
   live, natural word for soccer in a global/European buyer base generally (a real point in Football
   Tracker's favor for pure searchability), but it does not carry into a catalog where an NFL Tracker
   already exists. Corsair choosing "WC" (an abbreviation) rather than spelling out "World Cup" in that
   product's own name is also a mild secondary data point that even Corsair's copy is being careful around
   FIFA's aggressively enforced "World Cup" phrase — see Risk below.

**Resolution used in the listing:** name the product **Soccer Tracker** (avoids the in-catalog collision,
matches this marketplace's own established Football/Soccer split), but do not concede the "football"
search traffic — carry `live football scores` and similar football-worded phrases in the **keyword list**
and listing description body copy, which is exactly what SEO-style marketplace keywords are for. This is
the same "name for clarity, tag for reach" pattern, not a compromise that weakens either goal.

The deterministic score table below therefore uses the **soccer-tracker run (49.9/75)**, not the higher
football-tracker run, because the final listing name is Soccer Tracker and the rubric ties the
deterministic subtotal to the actual product being scored.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 18.9 | Best match is generic `tracker` (popularity 22, p63 of tracked queries) — a **weak floor**, not a soccer-specific signal, same caveat as every other sport in this batch. Real-world context is genuinely strong, though: the actual 2026 FIFA World Cup ran June 11 - July 19, 2026 (concluded 9 days before this research), the Premier League 2026/27 season kicks off Aug 21, 2026, and the Champions League's new league-phase format starts Sept 8, 2026 — soccer has more concentrated calendar demand triggers per year (multiple leagues + two-yearly international tournaments) than any single-league US sport already validated, but none of that shows up in the scrape's substring-matched floor. |
| Competition gap (0-25) | 25 | Tool found 0 competing products. **Hand-verified, live:** no dedicated live soccer score keypad plugin exists on the Elgato Marketplace today — see Competitor Analysis for the near-misses ruled out (Keep The Score is manual/multi-sport scoreboard control, not a live data feed; Live Score Plugin's sport coverage couldn't be confirmed and its listing is stale since 2023; Football Manager 24 Profiles is unrelated, a video-game icon/profile pack). The gap is real today. |
| Monetization (0-20) | 6 | No priced direct soccer comp exists (matches the pattern for every sport tracker validated so far — NFL, NHL both landed at 6 for the same reason). Tool's own read: "unproven niche, default mid-low." Soccer's larger global addressable audience (vs. a single-country league) is a real reason this number could move up faster than its US-sport siblings once any sales data exists, but there's no evidence for that yet — score as unproven, not optimistically. |
| **Deterministic subtotal (0-75)** | **49.9** | From `tools/opportunity.py "soccer tracker" "soccer scores" --category Plugins` |
| Build fit (0-15) | 4 | Same three novel-build items every sport tracker in this batch deducts for — network API client with no precedent, runtime dynamic per-key image compositing with no precedent (deduct 4 combined, matching nhl-tracker/mlb-tracker's equivalent deductions), and a new colors+abbreviation badge asset pipeline since official crests are off the table (deduct 2). **Additional deduction unique to this product (deduct 5):** soccer's competition structure genuinely is more fragmented than any single-league US sport already scored — the settings UI needs **two** selection axes (favorite team **and** favorite league), not one, and the API layer has to normalize at least three structurally different data shapes (a round-robin league table, the Champions League's new Swiss-style league-phase standings, and a World Cup/Euros group-plus-knockout bracket), where NFL/NHL/MLB each only ever return one shape. This is real net-new normalization work, not just "more of the same" scaled up. **Not deducted, genuinely reusable:** `@elgato/streamdeck` `SingletonAction` scaffold, Rollup build, vanilla-HTML/JS PI — all direct lifts from `plugins/screensaver-cycler/`; the PI-probe protocol in `plugins/screensaver-cycler/src/pi.ts` extends cleanly to a two-level probe (`{probe:"leagues"}` then `{probe:"teams", league}`) without a new protocol design, which is a real point in this product's favor relative to inventing something from scratch. |
| Risk (0-10) | 3 | Three stacked vectors. **Trademark/logo (deduct 3):** FIFA is documented as one of the most aggressive trademark enforcers of any sports body researched for this roster — it actively monitors and sends cease-and-desists over unauthorized use of "FIFA," "FIFA World Cup," and official emblems, a materially harsher enforcement posture than the NFL/NHL/MLB comps already validated. Club and league marks (Premier League, UEFA, national federations) carry the same standard no-official-logo mitigation as every other sport in this roster (house rule 5), but FIFA's specific aggressiveness around the literal phrase "World Cup" is its own separate constraint — recommend never using that exact phrase in the product name or headline marketing copy; "international tournaments" is the safer framing (notably, even Corsair's own soccer widget abbreviates to "WC Football Scores" rather than spelling it out, a mild secondary signal the same caution is already market-standard). **Data licensing (deduct 2):** every realistic free data source has a commercial-use catch — ESPN's hidden API carries the same no-SLA/ToS-restricts-commercial-use profile as its NFL/NHL/MLB siblings, and football-data.org's free tier explicitly states free-tier use is non-commercial only. Genuinely mitigating factor this niche has that MLB Tracker's validation did not find: football-data.org sells an **affordable** commercial tier (~€12-29/mo) that would fully resolve this, unlike MLB's realistic paid options which start around $50-500+/mo and made a licensed path uneconomical for a one-time plugin sale. **Multi-jurisdiction surface (deduct 2):** unlike a single US league with one governing body, soccer spans FIFA, UEFA, and separate national federations/leagues (Premier League, LaLiga, DFL, Serie A, LFP), each with its own ToS/trademark policy to track — no single one is worse than the NFL/NHL/MLB comps individually, but there are more of them to stay correct against simultaneously. **Per the validation rubric, this lands under the 4-point sign-off floor** — flag for explicit owner sign-off regardless of total. |
| **Qualitative subtotal (0-25)** | **7** | |
| **TOTAL (0-100)** | **56.9** | |

## Verdict: **LEAN-GO**

56.9 sits in the 55-69 band, just above `nhl-tracker` (58.9 — comparable) and clear of `mlb-tracker`'s
NO-GO (54.3), for a specific reason: MLB Tracker's Risk score collapsed because *no* affordable commercial
data-licensing path existed at all; soccer has one (football-data.org's paid tier), which is the single
biggest structural difference between this validation and the one sport in this batch that was rejected.
What's holding this back from GO is real: a confirmed marketplace gap (0 direct competitors, hand-verified)
weighed against the most fragmented build scope of any sport tracker validated so far (two-axis
team+league settings, three competition-format shapes to normalize) and the most aggressive single-body
trademark enforcer (FIFA) in the roster's research to date.

**Exact conditions that would flip this to GO (need ~+13 combined):**
1. **Build fit (+4):** descope v1 the same way `nhl-tracker`'s flip condition did — text-only score/title
   keys first (no runtime image compositing), deferring the badge-rendering pipeline to v2. This removes
   the single largest Build-fit deduction. Build fit 4 -> 8.
2. **Risk (+3):** commit to football-data.org's paid commercial tier from day one (~€12-29/mo, a real
   recurring cost but a small one against a one-time plugin sale, and the thing MLB Tracker's validation
   didn't have available) instead of leaning on ESPN's unofficial endpoint alone, plus lock a written
   no-"World Cup"-phrase-in-marketing-copy and no-official-logo design constraint as an explicit,
   documented decision (e.g. in `docs/DECISIONS.md`). This converts the dominant Risk deductions from open
   questions into accepted, mitigated ones. Risk 3 -> 6.
3. Both together land at ~63.9 — still short of 70. The remaining lift has to come from Demand: re-run
   `tools/opportunity.py "soccer tracker" "soccer scores" --category Plugins` close to the **Aug 21, 2026**
   Premier League kickoff or the **Sept 8, 2026** Champions League league-phase start, once real
   season-driven search traffic exists in the scrape, rather than today's generic `tracker` substring
   match. If that shows a materially tighter soccer-specific signal, Demand can move independently of
   anything above.

If none of the three land, this stays LEAN-GO and should not proceed to `/rat-build` as-is.

## Recommended listing

- **Name:** "Soccer Tracker" (14 chars, exact-search-term style; see Naming Decision above for the full
  reasoning against "Football Tracker").
- **Price:** **$6.99** launch price, matching this roster's established "unproven sports-niche" tier
  (`nfl-tracker`, `nhl-tracker` both recommended the same number for the same reason — no priced direct
  comp exists). Soccer's larger global buyer base is a plausible reason to move this up faster than its
  US-sport siblings post-launch, but there's no evidence yet to price ahead of that.

  | Comp | Price | Type | Notes |
  |---|---|---|---|
  | Keep The Score | freemium subscription | Elgato Marketplace, Stream Deck plugin | multi-sport manual scoreboard *control*, not a live-fetch score feed; premium features (custom logos) require a paid subscription, not a one-time price |
  | Live Score Plugin (Live Score GmbH) | not retrievable | Elgato Marketplace, Stream Deck plugin | listing dated 2023, sport coverage not confirmed via live search; likely stale |
  | Corsair "Matchday Live" (iCUE widget) | free | Xeneon Edge, not Stream Deck | multi-league year-round football scoreboard; different device ecosystem |
  | Corsair "WC Football Scores" (iCUE widget) | free | Xeneon Edge, not Stream Deck | World-Cup-only, narrower scope, launched after Matchday Live already existed — supports the v1 scope decision below (year-round club leagues, not tournament-only) |
  | `nfl-tracker` / `nhl-tracker` (Packrat, this roster) | $6.99 (recommended, not yet built) | plugin | same "unproven sports-niche" pricing logic |
  | `screensaver-cycler` (Packrat, published) | $7.99 | plugin | in-house comp for a proven, multi-feature utility plugin |

- **Device SKU plan:** single cross-platform package, `variants: {}` — no native OS hooks needed (network
  polling + rendering only, unlike `screensaver-cycler`'s Windows-only registry writes), so **Win + Mac
  both ship at v1**.
- **Top 5 keywords:** `soccer tracker`, `soccer scores`, `live football scores`, `premier league scores`,
  `champions league tracker`. Deliberately mixes the chosen name (`soccer`) with football-worded long-tail
  phrases to capture that search traffic without owning the ambiguous "football" namespace in the product
  name itself (see Naming Decision).
- **Risk flags:** `trademark:fifa-uefa-club-marks`, `trademark:fifa-world-cup-phrase` (FIFA's documented
  aggressive enforcement around the literal phrase/emblem — avoid in name and headline copy),
  `api-risk:unofficial-soccer-data` (ESPN hidden endpoints + free-tier ToS both restrict commercial use;
  football-data.org's paid tier is the realistic mitigation), `seasonal-demand:club-season-plus-tournament-cycle`
  (usage should stay more evergreen than NFL/NHL's single-season pattern thanks to overlapping club
  leagues, but still has real peaks around Champions League/World Cup windows).

Next step: this is a **LEAN-GO**, not an automatic `/rat-build`. Resolve the two flip conditions above (or
get explicit owner sign-off given Risk sitting below the 4-point threshold) before moving to build.

---

## Overview

Soccer Tracker would be a paid Stream Deck plugin surfacing live scores, standings, and next-match
countdowns for major club leagues and international tournaments, with a Property Inspector settings UI
for picking favorite team(s) **and** favorite league(s) — soccer fandom is structured around both axes in
a way NFL/NHL/MLB fandom (pick one team, follow one league) is not. Same "don't leave your primary
workflow" pitch as the rest of the roster (house rule 2), targeting streamers, creators, and general
soccer fans who already own a Stream Deck.

## Market Demand

- The actual **2026 FIFA World Cup ran June 11 - July 19, 2026** (hosted by the US, Mexico, and Canada —
  Elgato's own home market for a large share of its buyer base), and concluded just **9 days before this
  research**. That window is already gone for a v1 launch; the practical near-term demand triggers are the
  **Premier League 2026/27 season (kicks off Aug 21, 2026)** and the **Champions League's new league-phase
  format (starts Sept 8, 2026)** — both roughly a month out from today, a real and buildable launch-timing
  window similar in spirit to `nfl-tracker`'s pre-kickoff timing argument.
- No Stream Deck-specific soccer demand signal exists in the scraped query data — same weak-floor caveat
  as every sport tracker validated in this batch (see Demand row).
- Category-level, hardware-adjacent proof of demand is real: Corsair independently built **two** separate
  football/soccer widgets for its Xeneon Edge LCD — "Matchday Live" (a year-round, multi-league scoreboard)
  and "WC Football Scores" (a narrower, World-Cup-only scoreboard launched after Matchday Live already
  existed). That two-widget pattern is itself a useful signal: Corsair judged the tournament-only version
  worth shipping *in addition to*, not instead of, the year-round club-league version — directly supporting
  this validation's scope recommendation below (cover club leagues year-round, not just international
  tournaments).
- Soccer's structurally different calendar (overlapping domestic leagues running roughly Aug-May, plus
  Champions League/Europa League continental competition, plus a World Cup or continental championship most
  summers) gives it more evenly-distributed demand across the year than a single-season US sport — a
  genuine differentiator from the NFL/NHL/MLB trackers, each of which carries an explicit
  `seasonal-demand` risk flag for a concentrated few months.

## Competitor Analysis

- **Elgato Marketplace, live-searched:** no dedicated, live-fetch soccer score keypad plugin found.
  Near-misses ruled out by hand, same pattern as the false-positives noted in sibling validations
  (`barraider.com/sdscreensaver` for screensaver-cycler, "Live Score Plugin" for nfl-tracker):
  - **Keep The Score** — a real, currently-listed Elgato Stream Deck plugin, but it's manual scoreboard
    *control* (tap buttons to add goals/fouls/timeouts to a scoreboard you're running), not a live data
    feed from real matches, and it explicitly lists "Football" and "Soccer" as separate sport categories
    (see Naming Decision — this is the decisive naming evidence, not just a ruled-out competitor).
  - **Live Score Plugin** (Live Score GmbH) — listing dated to a March 2023 release (v1.1), Windows only;
    sport coverage could not be confirmed via live fetch (the page's content didn't render sport-specific
    detail). Treat as stale/unconfirmed, not a proven live competitor, pending a manual listing check.
  - **Football Manager 24 Profiles** — an icon/profile pack themed around the *Football Manager* video
    game, unrelated to live match data. A keyword-space false positive, not a real competitor.
  - **"Scoreboard" plugin** (statsnscore) — controls American-football-style scoreboards (down & distance,
    clock, timeouts), not soccer.
- **Corsair Xeneon Edge (iCUE), different device ecosystem, hand-verified:** "Matchday Live" (year-round
  multi-league football scoreboard, free) and "WC Football Scores" (World-Cup-only, free, "pick a favorite
  country and keep their matches pinned nearby"). Real evidence the category has hardware-adjacent demand,
  not a Stream Deck comp.
- **"Overlays.uno Soccer Icons"** (per this task's seed data, an icon pack, 11 downloads) — Overlays.uno
  does maintain a multi-pack icon strategy on the Marketplace (confirmed live: "Overlays.uno Icons" and
  "Overlays.uno Gaming Icons" both exist as separate listings today), which makes a dedicated soccer pack
  plausible and consistent with their pattern, but a live search could not independently pull up that exact
  SKU to re-confirm the download count. Treat as directionally likely, not independently re-verified — an
  icon pack wouldn't compete with a live-data plugin regardless.
- **ThatSportsGamer (the developer behind `Live MLB Scores` / `Live MiLB Scores`, referenced in the
  nfl/nhl/mlb tracker validations):** no soccer/football sibling product or GitHub repo was found for this
  developer in live search. Their public pattern so far is US-sport-only (MLB, MiLB); no evidence they've
  extended into soccer. The GitHub-only NHL tool discovered during NHL research
  (`ThatSportsGamer/live-nhl-scores-for-stream-deck`) also has no soccer equivalent found.
- **Net:** the gap is real and current — nothing on the Elgato Marketplace fetches live soccer match data
  onto a Stream Deck key today — but it is not structurally defended any more than the NFL/NHL gaps are;
  any of the above developers, or a new entrant, could fill it.

## API Recommendation

Soccer data is more fragmented across providers than any single US sport already researched. Compared:

- **Primary, v1: ESPN's hidden API** (`site.api.espn.com/apis/site/v2/sports/soccer/:league/scoreboard`,
  plus `/teams` and `/standings` variants), using ESPN's own league codes (`eng.1` Premier League,
  `uefa.champions` Champions League, `esp.1` La Liga, `ger.1` Bundesliga, `ita.1` Serie A, `fra.1` Ligue 1,
  `fifa.world` World Cup). Same unofficial/undocumented/no-key/no-published-rate-limit profile as the
  ESPN endpoints already recommended for `nfl-tracker` and `nhl-tracker` — actively used by a large
  open-source community, no confirmed takedown incidents found, no SLA. Choosing this keeps the client code
  shape consistent with any NFL/NHL/MLB tracker that gets built later, a real (if currently theoretical,
  since none of those are built yet) amortization opportunity.
- **football-data.org** — free tier covers 12 real competitions (Champions League, Premier League, La
  Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Championship, Brazilian Série A, World
  Cup, Euros) but **scores are delayed on the free tier** (not viable as the primary live-score source) and
  capped at 10 requests/minute; free-tier use is explicitly non-commercial only. **The genuinely useful
  part:** its paid tier starts around **€12/month for live scores**, which is a real, affordable commercial
  license — the mitigation this niche has that MLB Tracker's validation didn't find (MLB's realistic
  licensed options started at $50-500+/month, uneconomical against a one-time plugin sale). Recommend using
  this as the **backup/fallback data source in v1** and the **primary source once/if the paid tier is
  adopted** per the Risk flip condition above.
- **API-Football (RapidAPI or direct)** — broadest raw coverage (1,200+ leagues) but the free tier caps at
  roughly 100 requests/day, which a multi-league live-polling plugin exhausts within an hour by the
  provider's own published example math — not viable for this product's free tier. Its terms also state it
  "does not grant any commercial rights on competitions" regardless of paid tier, pushing licensing
  responsibility onto the integrator without football-data.org's clean paid-tier resolution. Considered and
  not recommended as primary or fallback for this reason.
- **TheSportsDB** — same conclusion as the NFL Tracker validation reached for US sports: useful for
  reference-only team metadata, positioned for non-commercial use, and lacks live-scoring depth. Not a
  serious contender here either.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/`, not `free/better-hotkeys-mouse` (the heavier
native-OS-hook plugin, per `CLAUDE.md`'s project map — nothing here needs OS-level hooks):

- **Background polling:** one ticker in the plugin process, same shape as
  `plugins/screensaver-cycler/src/scheduler.ts`'s `startScheduler()`/`tick()` — not per-action timers,
  which pause the moment a user switches Stream Deck pages (per that file's own header comment). Step up
  polling cadence (e.g. 20-30s) while a favorited team's match is live; step down (several minutes) when
  nothing favorited is live, across however many leagues are favorited.
- **Config/favorites store:** `scheduler.ts`'s `getConfig()`/`patchConfig()` pair over
  `streamDeck.settings.getGlobalSettings()`/`setGlobalSettings()` is directly reusable, extended to store
  **two** favorite lists (teams and leagues) instead of one.
- **Favorites/settings UI — the genuinely new PI work:** `plugins/screensaver-cycler/src/pi.ts`'s
  probe-and-reply protocol (the PI is a sandboxed browser window with no network access of its own, so it
  asks the plugin process and gets a reply via `streamDeck.ui.sendToPropertyInspector`) extends cleanly to
  a **two-level probe** — `{probe:"leagues"}` returns the configured league list, then
  `{probe:"teams", league}` returns that league's teams — rather than requiring a new protocol design.
  This is a real point of reuse this product has that a from-scratch build wouldn't.
- **Competition-format normalization — the biggest genuinely new piece:** unlike NFL/NHL/MLB (each always
  one shape: a single league table), soccer's API responses come in at least three structurally different
  shapes that need separate parsing/UI treatment: a standard round-robin **league table** (Premier League,
  La Liga, etc.), the Champions League's new **Swiss-style league-phase standings**, and a **group-stage-
  plus-knockout-bracket** shape for the World Cup/Euros. Scope this as its own small adapter layer per
  competition type, not one universal parser.
- **Dynamic icon rendering:** same net-new subsystem every sport tracker in this batch needs — no existing
  Packrat plugin draws a live-updating image to a key. Team-color-plus-abbreviation badge composited on
  each tick, closer in spirit to `profiles/_build/icons.py`/`_shared/marketing_engine.py`'s Pillow
  rendering approach than to anything in the plugin codebase today. The v1 descope flip condition (Build
  fit) proposes shipping text-only titles first and deferring this.
- **Error handling / caching:** persist last-known-good state per competition in global settings; on a
  failed/errored call, keep showing the last cached state with a subtle staleness indicator, same pattern
  recommended for `nfl-tracker`/`nhl-tracker`, now across more concurrent data sources (multiple leagues)
  than either of those single-league products.

## Feature List (v1)

- Live score display for favorited team(s): score, match clock/half, opponent.
- Next-match countdown (kickoff date/time) per favorited team.
- League table / standings view for a favorited league, matching its actual format (table vs. bracket).
- Manual refresh action.
- Multi-team, multi-league favorites, sized to fit std vs. XL key count.

## Premium Features

Scoped to what the chosen API can actually support — no invented capabilities:

- **Favorite team score key** with live clock/half.
- **Next-match countdown** key.
- **League table / standings** key, format-aware (round-robin table, Champions League league-phase
  standings, or World Cup/Euros group-and-knockout view).
- **Multi-league dashboard** — several favorited teams across different leagues on one grid, a
  differentiator no single-league US sport tracker in this roster needs to offer.
- **NOT promising for v1:** goal-alert push notifications and red-card/substitution event feeds — both
  depend on higher-frequency event-level data that the recommended free/entry-tier APIs don't reliably
  expose; treat as a v2 research item once a data tier is locked in, not a v1 commitment.

## UI Ideas

- **Std (15-key) layout:** one key = top favorite team's live score, one key = next-match countdown,
  remaining keys for 1-2 more favorited teams or a standings key. Per house rule 3, never fill all key
  slots in marketing renders — leave idle-glow empty keys.
- **XL (32-key) layout:** room for a small multi-league "scoreboard row" (4-6 favorited teams across
  different leagues) plus dedicated standings/countdown keys.
- **Later potential:** a Stream Deck+ / dashboard-LCD scoreboard view (Corsair's own iCUE widgets already
  prove this exact shape works for football on a small screen) is a natural v3 fit if Packrat expands into
  that surface — note only, not a v1 scope item.

## Marketplace Positioning

Lead with "follow every league you care about, without leaving your deck" (benefit-focused, matches house
rule 2) — the multi-league favorites feature is this product's real differentiator over a single-league
tool, not a claim of exclusive access to soccer data. Never use the literal phrase "World Cup" or FIFA's
emblem in the product name or headline copy (see Risk); "major tournaments" is the safer framing. Do not
claim "official Premier League/UEFA/FIFA" anything — carry an explicit non-affiliation disclaimer in the
listing description itself, the same pattern recommended for `nfl-tracker` and `nhl-tracker`.

## Pricing Recommendation

**$6.99** launch price (see comp table above), matching the roster's established "unproven sports-niche"
tier used for `nfl-tracker` and `nhl-tracker`. No priced direct soccer comp exists to anchor higher, and
this is deliberately conservative rather than pricing ahead of evidence. Soccer's broader global buyer base
is the most plausible reason among the sport-tracker batch for this number to move up post-launch, but
that's a reason to revisit after real sales data, not to price higher today.

## Confidence Score

**Medium-low**, in line with `nhl-tracker`. High confidence in: the confirmed live-competitor gap, the
technical reuse story (`screensaver-cycler`'s ticker and probe patterns both extend cleanly), the season-
timing calendar (Premier League/Champions League dates independently verified), and the naming decision
(directly confirmed via a live, ecosystem-native comp rather than general web knowledge). Lower confidence
in: true soccer-specific demand (still a substring-matched floor, same as every sibling), and the exact
severity of FIFA's enforcement posture toward a small paid utility specifically (the aggressive-enforcement
evidence found is real but skews toward high-profile commercial/marketing misuse cases, not small
utility-app precedent either way).

## Build Recommendation

**Do not proceed to `/rat-build` yet.** This is a LEAN-GO with Risk below the 4-point sign-off floor,
same posture as `nhl-tracker`. Sequence:
1. Get explicit owner sign-off on the FIFA/UEFA trademark posture and the soccer-data licensing risk
   (document the decision, same as the nhl-tracker recommendation).
2. Re-scope v1 to text-only score/title keys (no image compositing) to bank the Build-fit flip condition.
3. Decide, in writing, whether v1 launches on ESPN's free/unofficial endpoint alone or commits to
   football-data.org's paid tier from day one — this materially changes the Risk score and should not be
   left implicit.
4. Re-run the deterministic scorer close to the Aug 21, 2026 Premier League kickoff for a fresher demand
   read.
5. If total clears 70 after that, proceed to `/rat-build soccer-tracker`; if not, this stays parked as
   `validated` (the gap and reusable scaffolding are both real) pending a stronger signal.

## Implementation Plan (if greenlit)

1. Scaffold `plugins/soccer-tracker/` from the `screensaver-cycler` project layout (`@elgato/streamdeck` +
   Rollup + TypeScript), UUID `com.packrat.soccer-tracker`.
2. Build the chosen API client(s) (ESPN hidden endpoints and/or football-data.org) with per-competition
   adapters for the three format shapes (league table, Champions League league-phase, tournament
   group+knockout), plus the caching/fallback layer from Technical Notes.
3. Port `scheduler.ts`'s ticker pattern for live/idle-cadence polling across multiple favorited
   leagues/teams simultaneously.
4. Port `pi.ts`'s probe pattern, extended to the two-level league-then-team protocol.
5. Actions (v1, text-only): favorite-team score key, next-match countdown key, standings key, manual
   refresh action.
6. Defer dynamic icon-rendering pipeline to v2 per the Build-fit flip condition; spike it early if pursued
   sooner.
7. QA gate + `streamdeck validate`/`pack`, same as `screensaver-cycler`; target ship date ahead of the
   Aug 21, 2026 Premier League kickoff or Sept 8, 2026 Champions League league-phase start to catch real
   season-driven interest.

## Roadmap

- **v1 league scope (decision, not deferred):** launch with **Premier League + Champions League +
  major international tournaments (World Cup/Euros, "major tournaments" framing)** — the highest global
  recognition set and the smallest defensible PI dropdown/testing surface, all servable from the same
  ESPN league-code family (`eng.1`, `uefa.champions`, `fifa.world`) with no per-league architecture change.
  Deliberately **not** limited to tournaments-only (Corsair's own two-widget split — a year-round
  "Matchday Live" alongside a narrower "WC Football Scores" — is direct evidence that a tournament-only
  scope undersells a year-round club-season product; build the club-league support first, not as an
  afterthought).
- **v1.1/v2:** add La Liga, Bundesliga, Serie A, Ligue 1 (all covered by the same ESPN/football-data.org
  league-code pattern, low marginal build cost once the adapter layer exists), dynamic per-key badge/score
  image compositing (the deferred Build-fit item), goal-alert notifications if event-level data proves
  reliable.
- **v3:** Dashboard/LCD widget mode for Stream Deck+/Neo (Corsair's iCUE widgets already prove this shape
  works for football on a small screen), MLS/Liga MX coverage (a natural fit given the World Cup's
  US/Mexico/Canada hosting and any residual fan interest it leaves behind), reuse the polling +
  runtime-icon pipeline across NFL/NHL/MLB trackers if any of those get built, amortizing the build cost
  flagged in each of those docs.

## Proposed registry.json entry

Not added to `registry.json` by this research — for the owner to add once sign-off/flip conditions are
addressed:

```json
"soccer-tracker": {
  "name": "Soccer Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.soccer-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/soccer-tracker",
    "package": "plugins/soccer-tracker/marketing/com.packrat.soccer-tracker.streamDeckPlugin",
    "marketing": "plugins/soccer-tracker/marketing"
  },
  "keywords": ["soccer tracker", "soccer scores", "live football scores", "premier league scores", "champions league tracker"],
  "risk_flags": ["trademark:fifa-uefa-club-marks", "trademark:fifa-world-cup-phrase", "api-risk:unofficial-soccer-data", "seasonal-demand:club-season-plus-tournament-cycle"],
  "notes": "LEAN-GO 56.9/100 per plugins/soccer-tracker/VALIDATION.md, 2026-07-28. Named 'Soccer Tracker' not 'Football Tracker' to avoid catalog/search collision with the in-house NFL Tracker validation -- confirmed via live research that Elgato-published plugin 'Keep The Score' already treats Football and Soccer as two distinct sport categories on this exact marketplace, which is the deciding evidence, not a general-web guess. Deterministic 49.9/75 (demand 18.9, competition_gap 25, monetization 6 -- the soccer-tracker run, not the higher football-tracker run, per the naming decision). Build fit 4/15 (network API client + runtime icon rendering + badge pipeline, matching nhl/mlb-tracker's deductions, PLUS extra deduction for soccer-specific two-axis team+league settings and three competition-format shapes to normalize -- league table, Champions League league-phase, World Cup/Euros group+knockout). Risk 3/10, below the 4/10 sign-off floor: FIFA is a documented aggressive trademark enforcer especially around the literal 'World Cup' phrase/emblem, and free soccer-data APIs (ESPN hidden endpoints, football-data.org free tier) restrict commercial use -- but football-data.org's paid tier (~EUR12-29/mo) is a real, affordable commercial-license path this niche has that MLB Tracker's validation did not find (MLB's realistic licensed options started at $50-500+/mo). Needs owner sign-off before /rat-build. Flip-to-GO path: descope v1 to text-only titles (no image compositing, +4 build fit), commit to a licensed data tier from day one + written no-'World Cup'-phrase/no-official-logo constraint (+3 risk), and re-run the deterministic scorer near the Aug 21 2026 Premier League kickoff or Sept 8 2026 Champions League league-phase start for a fresher demand read. v1 league scope: Premier League + Champions League + major international tournaments only; La Liga/Bundesliga/Serie A/Ligue 1 are v1.1/v2 additions on the same adapter pattern."
}
```
