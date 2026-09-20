# Validation: Golf Tracker

Slug: `golf-tracker` | Type: `plugin` | UUID: `com.packrat.golf-tracker` | Researched: 2026-07-29

> **STATUS UPDATE 2026-07-29:** Owner reviewed the NO-GO verdict below and gave explicit blanket sign-off
> on the risk pattern driving it (unofficial API + trademark exposure) across the whole sports-tracker
> slate — see `docs/DECISIONS.md`. `registry.json` now carries this product as **`status: "validated"`**,
> **cleared to build**. The verdict/score below is kept as-written for the research record; treat "NO-GO"
> in this file as historical, superseded by the sign-off. The lowest-in-slate build-fit score (a
> 100-156-player leaderboard's concurrent state) is NOT a risk-tolerance question — descope v1 to
> text-only leaderboard rows per the flip-condition path below rather than attempting full dynamic-icon
> rendering out of the gate.

Idea: Stream Deck **plugin** showing live PGA Tour / major-championship leaderboard position, round-in-
progress score-to-par, and tee-time info, with a Property Inspector settings UI for picking **favorite
players** (golf is individual-athlete-driven, like tennis, not team-driven like NFL/NHL/MLB/soccer/NASCAR).
Closest in-repo precedent: `plugins/screensaver-cycler/` (background-poller + config-store +
PI-probe-and-reply protocol, `src/scheduler.ts` + `src/pi.ts`). Six sibling sports-tracker validations are
already on file in this roster: `nfl-tracker`, `nhl-tracker`, `nascar-tracker` (all LEAN-GO), `soccer-tracker`
(LEAN-GO), `mlb-tracker` (NO-GO, 54.3), `tennis-tracker` (LEAN-GO, 56.9, the closest structural analog since
it also uses a favorite-**player**, not favorite-team, settings model), and `f1-tracker` (**NO-GO, 54.9**,
an extremely thin miss driven by a single dominant, documented brand-enforcement risk). This doc follows the
same rubric and, where useful, compares directly against those — most usefully `f1-tracker`, which this
research independently lands next to almost exactly, and `tennis-tracker`, whose favorite-player /
multi-rights-holder-major structure this product mirrors closely.

**No forced verdict.** This research was scored honestly against the rubric before deciding how to frame the
outcome; it happens to land at a NO-GO, same as `f1-tracker` and `mlb-tracker` before it. Recorded per SOP
convention (rejected research is an asset, not a failure) with an explicit better-nearby-idea per the rubric.

## Score

| Dimension | Score | Why |
|---|---|---|
| Demand | 18.9 / 30 | Deterministic tool result (`tools/opportunity.py "golf tracker" "golf scores" --category Plugins`). Best-matched query is generic `tracker` (popularity 22, p63 of tracked queries); `scores` matched at popularity 17. **Notably weaker evidence than every sibling in this roster except the loosest floors already flagged**: unlike `nhl tracker`/`f1 tracker`/`nascar tracker`, the word "golf" itself never appears as a matched query in the tool's own evidence block at all — the third matched row (`core`, popularity 15) is an unrelated substring hit whose dominant category is Icons, not Plugins. This deterministic number is a pure generic-word floor with **zero golf-specific signal at any confidence level**, a step below even the sibling docs' usual "weak floor, not sport-specific" caveat. Real-world context is genuinely mixed (see Market Demand) rather than a clean tailwind like F1's — golf's linear-broadcast audience is old (comparable to or worse than NASCAR's 58-average finding), but its streaming/simulator/TGL-driven digital layer is real and skews toward the Stream Deck buyer's actual age band; net effect is treated as an open question, not a lift, consistent with the brief's instruction not to assume either direction. |
| Competition gap | 25 / 25 | Tool found 0 competing products. **Hand-verified live, and ruled out correctly rather than left as a raw tool number:** no live PGA/major leaderboard or tee-time Stream Deck plugin exists on the Elgato Marketplace, on GitHub as a sideload tool, or as a Corsair Xeneon Edge widget (Corsair ships F1, hockey, and multi-league football widgets — confirmed via this roster's F1/NHL/soccer research — but no golf equivalent was found in a fresh check). `ThatSportsGamer` (the developer behind the Marketplace's `Live MLB Scores`, the closest analog paid sports-plugin business found anywhere in this roster) has no public golf product. **The one real find, per the task brief:** "Golf Simulator Shortcut Icons" ($5, Icons category, 68 downloads) — hand-confirmed as a genuine false-positive-adjacent product, not a competitor: it is a hotkey-icon pack for golf *simulator* software (GSPro/E6-style hardware setups), a different Marketplace category (Icons, not Plugins), a different use case (local sim-golf control, not live tour data), and a materially smaller download count than the crowding finds that justified F1's (-6) or soccer's (implicit) corrections in this roster. Consistent with how `nascar-tracker` and `tennis-tracker` treated similarly weak, different-category near-misses (kept at full 25 rather than corrected), this stays **uncorrected at 25** — but see the Roadmap/better-nearby-idea section below, because that $5 icon pack is the single most concrete piece of real golf-buyer evidence this research found anywhere on this marketplace, and it points at a different product than the one being scored here. |
| Monetization | 6 / 20 | Deterministic tool result, unchanged. "No comps: unproven niche, default mid-low," same default every sibling sports tracker in this roster has landed on. No priced live-golf-data comp exists anywhere researched (DataGolf, SportsDataIO, and Sportradar all sell to developers/media companies, not to end users, so there's no golf-fan-facing price point to anchor to at all — a step below even `nhl-tracker`'s "one unconfirmed adjacent comp" situation). |
| **Deterministic subtotal** | **49.9 / 75** | `tools/opportunity.py "golf tracker" "golf scores" --category Plugins`, no hand corrections applied (matches the NHL/soccer/NASCAR/tennis convention of leaving this half as tool output plus prose caveats, not the F1-style numeric correction, since the one real near-miss found here is materially weaker crowding evidence than F1's). |
| Build fit | 3 / 15 | **The tightest build fit found for any sport tracker validated in this roster to date**, for a structural reason none of the team-sport or two-person siblings share: a live golf leaderboard is a **100-156-player field** (roughly 156 for majors, 120-144 for a standard PGA Tour event), each player independently mid-round at a different hole, on a different tee-time wave (morning/afternoon splits), sorted and re-sorted continuously by score-to-par with frequent ties (golf's "T5" notation is the norm, not the exception) — a materially bigger concurrent-state problem than any sibling's single scoreline (NFL/NHL/MLB/soccer/NASCAR) or single head-to-head match (tennis). Deduct 4 for the live HTTP polling client with caching/backoff — no existing Packrat plugin talks to a network API at runtime, same standard deduction as every sibling. Deduct 3 for runtime dynamic per-key image compositing (favorited player's live score-to-par/position/thru-hole badge) — no existing plugin does this, matching the NHL/soccer/NASCAR/tennis convention. Deduct 2 for a from-scratch player-color/initials badge asset pipeline, since no official tour marks, player headshots, or sponsor logos can be used (trademark + right-of-publicity, see Risk) — matches `nhl-tracker`'s identical line item. Deduct 2, new to this product specifically, for the field-wide leaderboard rank/diff logic itself: unlike NASCAR's 40-car running order (which only deducted 1 for a comparable problem at roughly a quarter of golf's field size) or tennis's nested nested set/game/point state machine (nasty per-match, but only ever 2-4 entities at once), golf's tracker has to diff and re-rank a 3-4x larger concurrent field on every tick, while separately tracking made/missed cuts after round 2 and weather-suspension state (rain delays and darkness suspensions routinely push a round into a second day in professional golf — a real operational state no sibling tracker's data model needs). Deduct 1 for the favorite-**player** settings UI (not a fixed 32-team dropdown) — genuinely lighter than tennis's typeahead problem since the field is capped at ~156 known entrants per event rather than "any of hundreds of active ATP/WTA pros," but still needs the same probe-and-reply extension of `plugins/screensaver-cycler/src/pi.ts`'s `handlePiProbe` pattern (`{probe:"field", event}` -> live entrant list) rather than a static list. **Not deducted, genuinely reusable:** `@elgato/streamdeck` `SingletonAction` scaffold + Rollup build (direct lift, every plugin in this roster); the background-ticker shape from `scheduler.ts`'s `startScheduler()`/`tick()` (step up polling during major-championship rounds, step down between tournaments); no OS-specific hooks needed, so Win + Mac can both ship at v1 like every other sports tracker in this roster. |
| Risk | 2 / 10 | Ties `f1-tracker` and `tennis-tracker` for the worst Risk score in this roster's sports-tracker research, via a different mechanism than either: not documented enforcement against individual creators (F1) and not sheer rights-holder count (tennis), but an unusually explicit, on-point **Terms of Use clause** plus the single most aggressive golf-specific trademark enforcer found in any sport researched here. Deduct 4 for **PGA Tour's own Terms of Use, quoted directly rather than inferred:** "You shall not use or permit or facilitate others to use PGATOUR.COM by automated electronic processes, robots, spiders, scrapers, webcrawlers, or other computer programs that monitor, copy or download data" (covering "real time scoring, statistics... whether current or archival"), plus "may [not be used] for sale, license or other commercial purposes... unless expressly licensed by the PGA TOUR Parties." This is a materially more explicit, more on-point clause than any sibling's ToS in this roster — it names scraping tooling specifically and targets exactly this product's data pipeline, not a general "non-commercial personal use" clause like NHL's or a volunteer-API-sustainability problem like F1's. Deduct 3 for **major-championship trademark exposure, worse than tennis's own "worst-in-roster" AELTC/Wimbledon finding**: three of the four majors (PGA Championship/PGA of America, U.S. Open/USGA, The Open/R&A) are each run by a separate rights-holder with its own restrictive terms, but the fourth — **the Masters, run independently by Augusta National Golf Club** — is documented by IP-law trade press as maintaining one of the most extensive and aggressive trademark portfolios in all of sports: 67+ registered/pending marks including "MASTERS," "A TRADITION UNLIKE ANY OTHER" (a phrase Augusta claims despite it being coined by a CBS broadcaster), "AMEN CORNER," and a **specific Pantone shade of green registered as a trademark on the Green Jacket itself**; Augusta has litigated an auction house over green-jacket resale and fought a domain-name dispute over masters.com. No small-fan-app-specific enforcement precedent was found (Augusta's documented targets are apparel counterfeiters and auction houses, not data trackers), which is why this isn't scored below tennis/F1's floor, but the sheer breadth and documented aggressiveness of Augusta's IP posture is a real, distinct compounding factor on top of PGA Tour's own explicit anti-scraping clause. Deduct 1 for **no affordable commercial data-licensing path**, the same dead end `mlb-tracker`/`nascar-tracker`/`tennis-tracker` hit and soccer's football-data.org uniquely avoided: DataGolf requires a "Scratch Plus" membership and its terms grant only "personal, non-commercial use"; SportsDataIO's self-serve "Discovery Lab" tier (~$99-149/mo) is explicitly personal-use/non-commercial, with real commercial/resale licensing quote-only; Sportradar's Golf API (the most comprehensive, PGA/DP World/LIV/LPGA/Champions/Korn Ferry/Ryder Cup coverage) starts around $500-1,000+/mo per independent pricing research — the same "uneconomical against a one-time plugin sale" conclusion every sibling without soccer's escape hatch reached. **Per the validation rubric, this lands well under the 4-point sign-off floor** and needs explicit owner sign-off, not a passive note, regardless of total. |
| **Qualitative subtotal** | **5 / 25** | |
| **TOTAL** | **54.9 / 100** | |

## Verdict: **NO-GO** (54.9/100, threshold is <55)

This is an extremely near miss — **identical to `f1-tracker`'s score to one decimal place (54.9)**, and for a
genuinely similar shape: a real, hand-verified marketplace gap and a decent (if unremarkable) reusable-build
story, offset by the single worst risk profile and (independently, in this case) the single hardest build
in the roster. Golf gets to the same number as F1 via a different split — F1's Build fit was the *best* in
the roster (9/15, because its honest scope needed no live in-race state at all) while its Risk was the
*worst* (2/10, a documented enforcement pattern); Golf's Build fit is the *worst* in the roster (3/15,
because a live leaderboard genuinely is a harder concurrent-state problem than any sibling) while its Risk
ties for worst (2/10, via an explicit anti-scraping ToS clause plus Augusta National's documented aggressive
IP posture) rather than exceeding it. Recorded as `status: "rejected"` per SOP so it is not re-litigated from
scratch, with the exact flip conditions below, same convention as `f1-tracker` and `mlb-tracker`.

**Conditions that would flip this to LEAN-GO or better:**
1. **Descope v1 to text-only leaderboard rows** (`setTitle`/`setState` — position, score-to-par, thru-hole —
   no image compositing) and defer the player-badge-rendering pipeline to v2, the same move every LEAN-GO
   sibling in this roster used to bank its Build-fit flip condition. This removes the two largest deductions
   (runtime image compositing -3, badge asset pipeline -2). Build fit 3 -> 8 (+5).
2. **Owner explicit sign-off on the PGA Tour ToS / Augusta National trademark risk**, documented in writing
   (e.g. `docs/DECISIONS.md`), plus a locked design constraint: no official tour/major logos, no player
   headshots, no "PGA"/"Masters"/major-championship wordmarks anywhere in the app or marketing kit, and a
   prominent non-affiliation disclaimer. This doesn't resolve the risk (there is no affordable licensed path
   to fully resolve it, per the Risk row), it converts it from an open question into an accepted one — the
   same move every sub-4-Risk sibling in this roster used. Risk 2 -> 5 (+3).
3. Both together move the total from 54.9 to roughly **62.9** — solidly into LEAN-GO territory, actually
   further than F1's equivalent flip path reached (~59.9), because Golf's Build-fit ceiling has more room to
   recover once the hardest items (image compositing, badge pipeline) are deferred. Reaching 70 still needs a
   real Demand lift: the deterministic score doesn't even have a golf-specific substring match today (see
   Demand row), so re-running `tools/opportunity.py "golf tracker" "golf scores" --category Plugins` close to
   **Masters week (April 2027)** — the single highest-attention golf window of the year by a wide margin — is
   the highest-leverage next step if this is ever revisited, on the chance real golf-specific query traffic
   shows up in a refreshed scrape around that date.

If none of the three land, this stays a NO-GO and should not proceed to `/rat-build`.

**A better nearby idea:** two options, informed directly by what this research actually found, not
mutually exclusive.

- **Pivot to a Golf Simulator Companion plugin.** The one piece of *real, confirmed, transacting* golf-buyer
  evidence found anywhere in this research is "Golf Simulator Shortcut Icons" ($5, 68 downloads) — a hotkey
  icon pack for golf simulator software (GSPro, E6, The Golf Club, Creative Golf), a completely different
  product than the one scored here. A Stream Deck plugin that binds simulator-software hotkeys (club
  selection, mulligan/replay-shot, camera angle, round reset) faces **zero PGA Tour/Augusta/major-body IP
  exposure** (no tour data, no player likenesses, no tournament marks at all), reuses the far cheaper
  local-hotkey-binding architecture (`free/better-hotkeys-mouse`-style, not a live-polling plugin — no
  network client, no image compositing, no field-diffing problem), and is aimed at the same golf-adjacent
  buyer the icon pack already proved will pay. This is a materially lower-risk, lower-build-cost product in
  the same broad "golf + Stream Deck" keyword space; it should be validated as its own idea (a fresh
  `/rat-validate golf simulator hotkeys`), not assumed to inherit this doc's score.
- **Ship the reusable polling + PI-probe scaffolding as a free lead-magnet plugin first**, same move
  `f1-tracker`'s and `mlb-tracker`'s validations recommended, under generic "golf" framing with the same
  no-tour-marks, no-player-photo constraint from flip condition #2. A free tool substantially reduces the
  exposure under PGA Tour's own clause (which is explicitly aimed at "sale, license or other commercial
  purposes"), builds the real polling/config/probe pipeline this product needs anyway, and leaves room for a
  genuinely paid version later once the licensing and Augusta/major-body risk picture is de-risked or a
  cheaper commercial data tier appears.

## Recommended listing name

**"Golf Tracker" (12 chars)**, if this is ever built despite the NO-GO. Deliberately generic and safe —
per the Risk row, avoid "PGA," "PGA Tour," "Masters," or any major-championship wordmark in the product name
or headline marketing copy (the same "name for clarity/safety, tag for reach" pattern `f1-tracker` and
`soccer-tracker` used for FOM's "F1" and FIFA's "World Cup," applied here to PGA Tour's own explicit
commercial-use clause and Augusta National's documented aggressive enforcement). Do not list this product
as-is; execute the flip conditions above first if it is ever revisited.

## Price, with comp table

| Comp | Price | Type | Notes |
|---|---|---|---|
| "Golf Simulator Shortcut Icons" | $5 | Elgato Marketplace, Icons category | The only golf-adjacent product found on this marketplace, 68 downloads — a sim-golf hotkey icon pack, not a live data tracker; real evidence some golf-adjacent buyer interest exists here, but for a different use case entirely (see better-nearby-idea above) |
| `nfl-tracker` / `nhl-tracker` / `nascar-tracker` / `soccer-tracker` / `tennis-tracker` (Packrat, this roster, not yet built) | $6.99 recommended each | plugin | Same "unproven sports-niche" pricing logic every sibling sports tracker in this roster landed on |
| `mlb-tracker` / `f1-tracker` (Packrat, this roster, **rejected**) | n/a (NO-GO) | plugin | Nearest precedent for a data-licensing/branding-risk-driven rejection at almost identical scores (54.3 and 54.9 vs. this doc's 54.9) |
| DataGolf, SportsDataIO Discovery Lab, Sportradar Golf API | $0 (personal, non-commercial) / ~$99-149/mo (personal, non-commercial) / ~$500-1,000+/mo (enterprise) | Developer data feeds, not end-user products | No golf-fan-facing price point exists anywhere in this research to anchor a listing price to — informs Risk/Monetization, not a direct comp |

**If the flip conditions are met and this is rebuilt under a generic, non-tour-branded name:** price at
**$6.99**, matching the roster's established "unproven sports-niche" tier (every sibling sports tracker
recommended the same number for the same reason). No evidence anywhere in this research supports pricing
above that band without sales data. **If shipped as-is, under a name/scope that leans on "PGA"/"Masters"
branding or claims official tour data access: do not build** — the honest conclusion given the documented
anti-scraping clause and Augusta's enforcement posture is "don't," not "charge less," the same conclusion
`f1-tracker`'s and `mlb-tracker`'s docs reached for their own dominant risks.

## Device SKU plan

Plugin-type product, not a profile — no std/xl/win/mac `.streamDeckProfile` variants (`variants: {}`,
`required_variants: []`, matching every sports-tracker sibling in this roster). `@elgato/streamdeck` is
cross-platform and nothing in this design needs OS-specific hooks (network polling + text/image rendering
only, no native shell-outs like `screensaver-cycler`'s Windows-only design) — **both Windows and Mac should
ship at v1** if this is ever built.

## Top 5 keywords

`golf tracker`, `golf scores`, `golf leaderboard`, `pga tour scores`, `live golf scores`. Deliberately keeps
"pga tour" as backend keyword metadata only, never in the product name or headline copy — the same "name for
safety, tag for reach" split `f1-tracker` and `soccer-tracker` used for "F1" and "World Cup" respectively.

## Risk flags

`trademark:pga-tour-anti-scraping-clause` (severe — PGA Tour's own Terms of Use explicitly name "robots,
spiders, scrapers, webcrawlers" and require express license for any commercial use of scoring/statistics
data; the most on-point, explicit ToS clause found against this exact product shape in this roster's
research), `trademark:augusta-national-aggressive-enforcement` (severe — Augusta National holds 67+
registered/pending trademarks including a specific Pantone green shade on the Green Jacket and has litigated
over green-jacket resale and the masters.com domain; no small-fan-app precedent found specifically, but the
broadest and most aggressive golf-specific IP posture researched in this roster), `trademark:major-body-
multi-regime` (PGA Championship/PGA of America, U.S. Open/USGA, The Open/R&A each add a separate restrictive
ToS on top of PGA Tour's own and Augusta's, mirroring `tennis-tracker`'s multi-Grand-Slam risk structure),
`data-tos:no-affordable-commercial-golf-feed` (DataGolf and SportsDataIO's accessible tiers are both
personal/non-commercial-use only; Sportradar's commercial tier starts around $500-1,000+/mo, the same
dead end `mlb-tracker`/`nascar-tracker`/`tennis-tracker` hit), `build-complexity:large-concurrent-field-
state` (a 100-156-player leaderboard with per-player round/hole/tee-time-wave/cut-status state is the
largest concurrent-entity data model of any sport tracker validated in this roster), `demand-signal:no-golf-
specific-query-match` (unlike every sibling, "golf" itself never appears as a matched query in the
deterministic tool's own evidence — the Demand score is a pure generic-word floor with zero sport-specific
signal at any confidence level).

---

## Overview

Golf Tracker would be a Stream Deck plugin surfacing live PGA Tour / major-championship leaderboard
position, in-round score-to-par, and tee-time information, with a Property Inspector settings UI for
picking one or more favorite **players** (not teams — professional golf is individual-athlete-driven, the
same structural difference `tennis-tracker`'s validation flagged relative to the team-sport siblings in this
roster). Same "don't leave your primary workflow to check a score" pitch the rest of this roster's sports
trackers use (house rule 2), targeting golf fans who already own a Stream Deck for streaming, working, or
content creation. Built on `@elgato/streamdeck`, following `plugins/screensaver-cycler`'s architecture
(background ticker + persistent global settings + PI-probe pattern), not the `profiles/_build` config-only
pipeline.

## Market Demand

**Tournament cadence — investigated honestly, per the task brief, rather than assumed to look like either a
team sport or tennis:**

- Golf's cadence is genuinely a hybrid, and neither of the two patterns already in this roster (a single
  concentrated team-sport season, or tennis's four evenly-spaced majors) describes it cleanly. The 2026 PGA
  Tour schedule runs **~45 total PGA Tour-sanctioned events** (35 official FedExCup-points events plus 8
  Signature Events, some overlapping, plus the FedExCup Playoffs) essentially **weekly from January through
  August**, then a further "FedExCup Fall" stretch of additional events — a far more continuous, near-year-
  round cadence than any single-season team sport in this roster (NFL/NHL/MLB/NASCAR all carry an explicit
  `seasonal-demand` concentration flag), and comparable in density to tennis's own nearly-year-round ATP/WTA
  tour.
- **But golf's casual-fan attention is far more front-loaded than tennis's.** Tennis's four majors are spread
  roughly quarterly (Australian Open in January, French Open in May/June, Wimbledon in June/July, US Open in
  August/September). Golf's four majors — **The Masters (April), PGA Championship (May), U.S. Open (June),
  The Open Championship (July)** — are clustered into a single four-month spring/summer window, followed by
  the FedExCup Playoffs in August (the Tour's own separate ratings peak) and then a materially quieter
  September-March stretch for the casual/non-diehard golf audience even though Tour events keep running
  through that period. **Net characterization: golf has tennis's continuous weekly-tour cadence for the
  build (something is always live to poll), but a team-sport-like single clustered demand peak for the
  marketing/launch story (April-August), not tennis's evenly-spaced quarterly spikes.** This matters directly
  for a launch-timing decision if this is ever revisited: a launch aimed at Masters week (early April) would
  catch the single highest-attention golf window of the year, materially more concentrated than any other
  major.
- **Demographic fit — investigated honestly, with a genuinely mixed finding, not a clean analogy to
  NASCAR's flat "too old" conclusion or a clean pass.** Golf's traditional linear-broadcast audience is old
  (historically a median viewer age around 64 on CBS/NBC, comparable to or older than NASCAR's own
  58-average finding in that sibling's validation) — a real, distinct concern for the Stream Deck buyer
  profile (streamers, creators, PC/desk-setup enthusiasts) this roster's other sports trackers target more
  comfortably. **But golf's digital/streaming layer tells a different, younger story that NASCAR's research
  did not find an equivalent for:** streaming platforms (Peacock, ESPN+) skew 18-44; a 2023 YouGov survey
  found interest peaking at 25-34 (19%) with 18-34 the largest on-course-participation cohort; and TGL (the
  new indoor tech-driven golf league) drew an 18-34 audience that was **32% not regular PGA Tour viewers**
  per Nielsen's 2025 Global Sports Report, a direct signal of a younger, more digital-native entry point into
  golf fandom that overlaps meaningfully better with the Stream Deck buyer than the sport's broadcast-TV
  median suggests. **Net: this is a genuinely bifurcated demographic, not a uniformly bad one** — treat as an
  open question requiring a real launch test, not a demand lift or a demand penalty assumed in either
  direction.
- **Deterministic signal is the weakest floor found for any sport in this roster** (see Demand row — "golf"
  itself never matches a query in the tool's own evidence at all, only the fully generic `tracker`/`scores`).
- No free alternative *inside the Stream Deck plugin ecosystem* does this specific job today — see
  Competitor Analysis. Unlike every other sibling sport tracker in this roster, **no Corsair Xeneon Edge
  golf widget was found either**, which cuts both ways: it means there is no adjacent-hardware demand proxy
  for this specific product shape (weaker demand evidence than NHL/soccer/F1 all had from Corsair's own
  widget catalog), but it also means the "hardware-adjacent buyer already wants this" signal simply hasn't
  been tested by anyone yet, for golf specifically, rather than having been tried and found wanting.

## Competitor Analysis

- **Elgato Marketplace, live-searched:** no live PGA/major-championship leaderboard or tee-time Stream Deck
  plugin exists today. The one real find, **"Golf Simulator Shortcut Icons" ($5, Icons category, 68
  downloads)**, is a hand-confirmed false-positive-adjacent product per the task brief: it is a hotkey/icon
  pack for golf *simulator* software (GSPro/E6-style setups), not a live tour-data tool — different
  Marketplace category (Icons vs. Plugins), different use case (local sim-hardware control vs. spectator/fan
  live scores), and a materially smaller download count than the crowding evidence that justified a
  numeric correction in `f1-tracker`'s validation. Ruled out as a functional competitor, but kept as the
  single most concrete piece of real golf-buyer evidence found anywhere in this research (see better-nearby-
  idea above).
- **`ThatSportsGamer`** (the developer behind the Marketplace's `Live MLB Scores`, the closest working
  paid-sports-plugin business found anywhere in this roster's research) has **no public golf product** —
  their confirmed public pattern is baseball-only (`Live MLB Scores`, `Live MiLB Scores`), with no evidence
  of a golf sibling in a fresh search.
- **Corsair Xeneon Edge (iCUE), different device ecosystem:** confirmed widgets exist for F1 ("Formula One
  Next Race"), hockey ("Hockey Scores"), and multi-league football ("Matchday Live," "WC Football Scores")
  per this roster's own prior research — **no golf widget was found** in a fresh check of Corsair's Xeneon
  Edge widget catalog. Unlike every other sport tracker validated in this roster, golf has no adjacent-
  hardware demand proxy to point to at all (see Market Demand).
- **General web/GitHub search** for other golf Stream Deck tools turned up only generic multi-sport
  scoreboard *control* tools (`Keep The Score`, `rweich/streamdeck-livescores` — "arbitrary match livescores
  on a button," sport-agnostic and not confirmed to support golf's leaderboard shape specifically) and
  `array-carpenter/golfastr` (a "Pro Golf Data" GitHub project, not a Stream Deck integration at all) — none
  is a real, golf-specific, live-leaderboard competitor.
- **Net:** the gap is real and clean — arguably the cleanest hand-verified gap in this roster (no adjacent
  same-developer product, no stale GitHub sideload tool the way NHL had, no Corsair widget precedent) — but
  for the first time in this roster, that cleanliness cuts against demand confidence rather than only for
  it: nobody, including Corsair (which has covered four other sports on a completely different device), has
  tried this specific shape yet, so the gap being untested is a live possibility alongside the gap being a
  genuine opportunity.

## API Recommendation

- **Primary, v1: ESPN's hidden API** (`site.api.espn.com/apis/site/v2/sports/golf/{tour}/leaderboard/...`,
  with per-player detail available via `.../playersummary?season={year}&player={id}`). Same
  unofficial/undocumented/no-key/no-published-rate-limit profile as the ESPN endpoints already recommended
  for every sibling sports tracker in this roster (NFL, NHL, soccer, NASCAR) — actively used by a large
  open-source community, no confirmed takedown incidents found, no SLA. Choosing this keeps the client code
  shape consistent with any other sports tracker that gets built later in this roster, the same amortization
  argument every sibling doc makes.
- **DataGolf (`datagolf.com/api-access`)** — requires a "Scratch Plus" membership; covers player lists, tour
  schedules, field/tee-time updates, live tournament stats, and model predictions at a **45 requests/minute**
  published rate limit (an actual number to code a backoff policy against, better than ESPN's unpublished
  limit). **The blocker:** its own terms grant only "personal, non-commercial use" of the service — usable as
  a secondary/backup source for lower-risk data (schedule, field list, tee times) but not a clean commercial
  green light for the core live-scoring pipeline without a direct licensing conversation.
- **SportsDataIO Golf** — self-serve "Discovery Lab" tier (~$99-149/mo) explicitly personal-use/non-
  commercial with next-day (not live) data; real commercial/production licensing is quote-only enterprise
  sales, the same "$50-500+/mo, uneconomical against a one-time plugin sale" dead end that sank
  `mlb-tracker` and constrained `nascar-tracker`/`tennis-tracker`.
- **Sportradar Golf API** — the most comprehensive option (full hole-by-hole coverage across PGA Tour, DP
  World Tour, LIV, LPGA, Champions Tour, Korn Ferry, Ryder Cup, Presidents Cup), but independent pricing
  research puts its starting commercial cost around **$500-1,000+/month** — not viable against a one-time
  ~$7 plugin, matching every sibling doc's conclusion on enterprise-tier feeds.
- **RapidAPI aggregators** (Slash Golf's "Live Golf Data," sportcontentapi's "Golf Leaderboard Data") —
  cheaper on paper, but their own underlying legal right to redistribute PGA Tour scoring data commercially
  is unconfirmed, the same "IP-clearance responsibility pushed onto the integrator" pattern `tennis-tracker`
  found with api-tennis.com. Not recommended as a primary source for this reason, same conclusion tennis's
  doc reached for its own cheap-but-unclear third-party aggregators.
- **Longer-term escape hatch, not v1 economics:** a direct licensing conversation with PGA Tour or one of
  Sportradar's/SportsDataIO's commercial tiers would resolve the data-licensing risk cleanly at a cost tier
  that doesn't work against a one-time plugin sale, matching every sibling doc's conclusion on this point.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/`, not `free/better-hotkeys-mouse` (no OS-level hooks
needed — network polling + rendering only):

- **Background polling:** one ticker in the plugin process, same shape as `scheduler.ts`'s
  `startScheduler()`/`tick()` (not per-action timers, which pause on page switch per that file's own header
  comment). Cadence should step up during an active round of a tracked tournament (e.g. 30-60s) and step
  down between tournaments (e.g. hourly), similar in spirit to the live/idle cadence pattern every sibling
  sports tracker recommends, but with an added state: **weather-suspended play**, where a round is paused
  mid-day and resumes later or the next morning — a real operational state no team-sport or tennis sibling's
  data model needs to represent, since rain/lightning delays in professional golf routinely push a round
  into a second calendar day.
- **Config/favorites store:** `scheduler.ts`'s `getConfig()`/`patchConfig()` pair over
  `streamDeck.settings.getGlobalSettings()`/`setGlobalSettings()`, storing one or more favorite players.
- **Favorites/settings UI:** extend `plugins/screensaver-cycler/src/pi.ts`'s `handlePiProbe` probe-and-reply
  pattern (`{probe:"field", event}` -> live entrant list for the current/next tournament) rather than a
  static dropdown — golf's field changes event-to-event (sponsor exemptions, Monday qualifiers, players
  skipping events), the same reasoning `tennis-tracker`'s validation used for its own favorite-player picker,
  though genuinely lighter here since a single event's field is capped at ~156 known entrants rather than
  "any of hundreds of active tour pros" at any time.
- **Leaderboard rank/diff logic — the single biggest new subsystem in this product, and the reason Build fit
  scored lowest in this roster:** on each tick, re-sort and diff up to 156 concurrent player states (score-
  to-par, current hole, round number, tee-time wave, cut status), correctly handling ties (`T5`-style
  notation is the norm) and the after-round-2 cut. No sibling tracker in this roster manages more than a
  handful of concurrent entities (2 teams, ~20-40 cars/drivers, or a single tennis match) at once.
- **No dynamic per-key image compositing needed for a text-only v1** — the Build-fit flip condition. Player
  position, score-to-par, and thru-hole status are all `setTitle`-able text; a color-badge renderer (no
  official headshots or tour marks) is a deferred v2 item using the existing
  `profiles/_build/icons.py` / `_shared/marketing_engine.py` Pillow pipeline as a base, not a new runtime
  subsystem, matching every sibling's stated v2 path.
- **Caching / offline fallback:** keep last-known-good leaderboard state in memory; on fetch failure, keep
  showing the last good state with a staleness indicator, same pattern as every sibling doc.

## Feature List (v1)

- **Leaderboard** action: top 5 plus the favorited player(s)' exact position/score-to-par if outside the top
  5.
- **Favorite Player** action: position, score-to-par, current hole/round status, or next tee time if not yet
  started.
- **Next Tee Time** action: favorited player's next round start time and tee (front/back nine).
- Favorites (one or more players) configured once in a shared settings surface across actions, using the
  event-scoped probe pattern from Technical Notes.

## Premium Features (v2+ upsell surface, not v1)

- Player color-badge/score image compositing (the deferred Build-fit item).
- Multi-player dashboard cycling several favorited players' positions.
- Round-completion / cut-line alert (e.g., a notification when a favorited player finishes their round or
  the projected cut line moves).
- Major-championship-specific view (four-day format, cut-line prominence) distinct from a standard weekly
  event's shorter, often cut-free field for Signature Events.
- **Not promising for any version without a licensed feed:** shot-by-shot or hole-by-hole live tracer/ball-
  flight data — this is a materially deeper data tier than any of the recommended v1 sources reliably expose
  at a workable cost.

## UI Ideas

- Button layout: honor house rule 3 (never fill all 15 slots in marketing renders) — a realistic v1 layout
  is 2-3 favorite-player keys, 1 leaderboard key, 1 next-tee-time key, with the rest of the deck shown
  idle/faint, matching every other product in the roster.
- **Dashboard/LCD widget potential (v3, not v1):** no Corsair Xeneon Edge precedent exists for golf yet
  (unlike hockey/football/F1), which is either an open opportunity or a sign the shape hasn't proven out on
  a small always-visible screen — worth a scoping pass only after a Stream Deck v1 (if ever built) proves
  real demand, not before.

## Marketplace Positioning

Lead with "know where your favorite golfers stand, without leaving your deck" (benefit-focused, house rule
2). **Do not use "PGA," "PGA Tour," "Masters," or any major-championship wordmark in the product name or
headline copy** — per the Risk section, PGA Tour's own Terms of Use explicitly restricts commercial use of
its data and marks, and Augusta National's trademark portfolio is the most aggressive golf-specific
enforcement posture found in this roster's research. A prominent non-affiliation disclaimer and zero
official tour/major logos or player headshots anywhere in the app or marketing kit are non-negotiable if
this is ever built, the same "name for safety, tag for reach" pattern `f1-tracker` and `soccer-tracker` used
for FOM's "F1" and FIFA's "World Cup."

## Pricing Recommendation

No confirmed golf-fan-facing price point exists anywhere in this research (DataGolf/SportsDataIO/Sportradar
all sell to developers and media companies, not end users). If rebuilt under a safe, generic name per the
flip conditions: **$6.99**, matching this roster's established "unproven sports-niche" tier used by every
sibling sports tracker (`nfl-tracker`, `nhl-tracker`, `nascar-tracker`, `soccer-tracker`, `tennis-tracker`).
**Under a name/scope that leans on PGA Tour or major-championship branding, as scoped for this validation:
do not build**, the same "don't, not charge less" conclusion `f1-tracker`'s and `mlb-tracker`'s docs reached
for their own dominant risks.

## Confidence Score

**Medium-low**, the lowest of any sport tracker validated in this roster to date. High confidence, directly
sourced this pass: PGA Tour's Terms of Use text (fetched and quoted directly, not inferred), Augusta
National's trademark portfolio and enforcement history (multiple independent IP-law sources agree), the data
API landscape and its personal-use/non-commercial ceilings (DataGolf, SportsDataIO both confirmed directly),
and the clean marketplace/GitHub/Corsair-widget competitor gap. Lower confidence on: true golf-specific
Marketplace demand (the weakest deterministic floor found in this roster — zero golf-specific query match at
any level, not just a loose one), the demographic-fit question (genuinely bifurcated evidence, not a clean
answer either way, and no direct Stream-Deck-buyer survey data exists to resolve it), and whether Augusta
National's documented enforcement pattern (aimed at counterfeit merchandise and domain disputes) would
actually extend to a small, non-affiliated data-only fan plugin — directionally relevant but not a precisely
matched precedent, the same caveat `f1-tracker`'s doc carried for FOM's creator-branding C&D pattern.

## Build Recommendation

**Do not build under the scope validated here.** This is a NO-GO at 54.9/100, an extremely thin miss (tied
with `f1-tracker` to one decimal place) with both the hardest build and one of the two worst risk profiles
found in this roster's sports-tracker research to date. Sequence if this is ever revisited:
1. Decide, in writing (e.g. `docs/DECISIONS.md`), whether to (a) execute the LEAN-GO flip conditions above
   under a generic, non-tour-branded name and scope, (b) ship a free, non-branded lead magnet first, or (c)
   pivot to the Golf Simulator Companion idea instead, which is a genuinely different, lower-risk product
   and should be validated fresh, not assumed to inherit this doc's score.
2. If (a): execute the text-only-v1 descope + risk-sign-off flip conditions, then re-run
   `tools/opportunity.py` under the revised keyword pair, ideally close to Masters week (April 2027) for a
   real demand signal given golf's uniquely front-loaded casual-fan attention window.
3. Only proceed to `/rat-build` once the total clears 70 under the revised name/scope.

## Implementation Plan (if greenlit under a revised name/scope)

1. Scaffold `plugins/<slug>/` from the `screensaver-cycler` project layout (`@elgato/streamdeck` + Rollup +
   TypeScript), new UUID if the product is renamed away from `com.packrat.golf-tracker`.
2. Build the ESPN hidden-API client (leaderboard, per-player summary, schedule/tee-times) with the
   caching/backoff layer from Technical Notes.
3. Background ticker (`scheduler.ts`-equivalent) with the tournament-aware, weather-suspension-aware cadence
   described above.
4. Leaderboard, Favorite Player, Next Tee Time actions — all text-only for v1, no image compositing.
5. PI: event-scoped field probe (extends `pi.ts`'s probe-and-reply pattern) for favorite-player selection.
6. `streamdeck validate` / `streamdeck pack`, install-test, then QA gate.
7. Marketing kit via `gen_marketing.py` — zero official tour/major logos or player headshots anywhere in the
   kit, disclaimer language in the description, no "PGA"/"Masters" wordmarks in headline copy.

## Roadmap

- **v2:** player color-badge/score image compositing (the deferred Build-fit item), multi-player dashboard,
  round-completion/cut-line alerts.
- **v3:** major-championship-specific view, Dashboard/LCD widget mode for Stream Deck+/Neo (untested for
  golf specifically — no Corsair precedent exists yet, unlike this roster's other sports), expansion beyond
  PGA Tour/majors to LPGA/DP World Tour if licensing and demand both support it.

## Proposed registry.json entry

Not added to `registry.json` by this research — for the owner to add if they want the rejection on record,
same pattern as `f1-tracker`/`mlb-tracker`:

```json
"golf-tracker": {
  "name": "Golf Tracker",
  "type": "plugin",
  "price_usd": 0,
  "status": "rejected",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.golf-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/golf-tracker",
    "package": "plugins/golf-tracker/marketing/com.packrat.golf-tracker.streamDeckPlugin",
    "marketing": "plugins/golf-tracker/marketing"
  },
  "keywords": ["golf tracker", "golf scores", "golf leaderboard", "pga tour scores", "live golf scores"],
  "risk_flags": [
    "trademark:pga-tour-anti-scraping-clause",
    "trademark:augusta-national-aggressive-enforcement",
    "trademark:major-body-multi-regime",
    "data-tos:no-affordable-commercial-golf-feed",
    "build-complexity:large-concurrent-field-state",
    "demand-signal:no-golf-specific-query-match"
  ],
  "notes": "NO-GO 54.9/100 (near-miss, LEAN-GO is 55; tied with f1-tracker to one decimal place; see plugins/golf-tracker/VALIDATION.md). Deterministic 49.9/75 (demand 18.9 -- weakest floor in the roster, 'golf' itself never matches a query in the tool's own evidence; competition_gap 25, hand-verified clean gap, the one near-miss found ('Golf Simulator Shortcut Icons', $5 Icons-category sim-hotkey pack, 68 downloads) is a confirmed false positive, different category and use case; monetization 6, no golf-fan-facing price point exists anywhere researched). Build fit 3/15, the lowest of any sport tracker in this roster: live HTTP client (-4), runtime image compositing (-3), badge asset pipeline (-2), field-wide 100-156-player leaderboard rank/diff logic each tick plus weather-suspension state (-2, a bigger concurrent-state problem than any sibling's 2-team score or NASCAR's ~40-car running order), favorite-player probe UI (-1). Risk 2/10, tied for worst in the roster with f1-tracker and tennis-tracker: PGA Tour's own Terms of Use explicitly bans 'robots, spiders, scrapers, webcrawlers' and requires express license for commercial use of scoring data (quoted directly, the most on-point ToS clause found against this product shape in this roster); Augusta National (The Masters) holds 67+ trademarks including a specific Pantone green on the Green Jacket and has litigated over green-jacket resale -- the most aggressive golf-specific IP posture found, though no small-fan-app enforcement precedent was found specifically; no affordable commercial data-licensing path exists (DataGolf/SportsDataIO both personal-use-only, Sportradar $500-1000+/mo). Demand characterization done honestly per task brief: golf's tournament cadence is a hybrid of tennis's near-year-round weekly tour plus a team-sport-like single clustered casual-fan peak (the four majors run April-July, unlike tennis's quarterly spread); demographic fit is genuinely bifurcated, not uniformly bad like nascar-tracker's finding -- linear-TV audience skews old (~64 median, comparable to NASCAR's 58-average finding) but streaming/TGL/simulator-driven digital audience skews notably younger (18-34 largest cohort, TGL drawing 32% non-traditional-golf viewers per Nielsen 2025), a real overlap with the Stream Deck buyer that NASCAR's research did not find an equivalent for. Flip-to-LEAN-GO path: descope v1 to text-only leaderboard rows (+5 build fit) + owner risk sign-off with locked no-tour-marks/no-player-photo constraint (+3 risk) reaches ~62.9, LEAN-GO. Better nearby idea: pivot to a Golf Simulator Companion plugin (hotkey control for GSPro/E6-style sim software, zero PGA Tour/Augusta IP exposure, reuses free/better-hotkeys-mouse-style local-hotkey architecture instead of a live-polling plugin) -- directly informed by the one real transacting golf-buyer evidence found on this marketplace ('Golf Simulator Shortcut Icons'); validate this as its own fresh idea, not an inherited score. Secondary option: ship the polling/PI scaffold as a free, non-branded lead magnet first, same move f1-tracker/mlb-tracker recommended."
}
```
