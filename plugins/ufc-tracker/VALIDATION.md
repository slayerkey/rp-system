# Validation: UFC Tracker

Slug: `ufc-tracker` | Type: `plugin` | UUID: `com.packrat.ufc-tracker` | Researched: 2026-07-29

> **STATUS UPDATE 2026-07-29:** This research recommended the display name "MMA Tracker" to dodge the
> trademark word "UFC." Owner overrode that: ship as **"UFC Tracker"** (slug/UUID were always `ufc-tracker`
> regardless) — UFC is the dominant, most-recognized brand term for this sport, and the owner gave blanket
> risk sign-off across the whole sports-tracker slate anyway (see `docs/DECISIONS.md`). Any "MMA Tracker" /
> rebrand language below is superseded. The fighter-likeness constraint is NOT a naming question and still
> applies regardless of the product name: no fighter photos, no Octagon iconography, text-only badges,
> non-affiliation disclaimer.

Idea: Stream Deck **plugin** showing the next UFC event/fight card, a favorited fighter's record and
next-fight info, and (during a live card) fight-status, with a Property Inspector settings UI for picking
**favorite fighters** — individual-athlete-driven, the same UX shape as `tennis-tracker` (favorite
player, not favorite team), not the fixed-team-list shape of `nfl-tracker`/`nhl-tracker`/`mlb-tracker`.
Closest in-repo precedent: `plugins/screensaver-cycler/` (background-poller + config-store +
PI-probe-and-reply protocol). Sibling sports-tracker validations already on file in this roster:
`nhl-tracker`, `soccer-tracker`, `tennis-tracker` (all LEAN-GO, clustered 56.9-58.9), `mlb-tracker`
(NO-GO, 54.3) and `f1-tracker` (NO-GO, 54.9, over documented trademark-enforcement risk against the
literal word "F1"). This doc follows the same rubric and compares directly against those, especially
`tennis-tracker` (closest architectural analog) and `f1-tracker` (closest risk-shape analog).

**Task-specified competitor to investigate up front, resolved before scoring:** the deterministic scrape's
raw CSV surfaced **"Fantasy Fight LIVE Controls"** (Firesplash Entertainment, free, 523 downloads) under
the broader "fight" keyword space. Live-verified via its Elgato Marketplace listing and Firesplash's own
product page (`firesplash.tv/fflgame`): this is **not** a UFC/MMA product of any kind. It is a Stream Deck
controller for **Fantasy Fight LIVE**, a Twitch-overlay audience-engagement minigame where viewers'
fictional "heroes" duel each other using a Rock-Paper-Scissors-style Melee/Magic/Parry system, collect
customizable items, and compete in bracket tournaments — zero real fighters, zero real fight data, zero
reference to the UFC, MMA, or combat sports at all. It is a keyword false-positive on the generic word
"fight," not a competitor in any functional or namespace sense (see Competitor Analysis for the full
resolution and why this does **not** move the Competition-gap score down, unlike `f1-tracker`'s MVF1
correction).

## Score

| Dimension | Score | Why |
|---|---|---|
| Demand | 18.9 / 30 | Deterministic tool result (given). Best-matched query is generic `tracker` (popularity 22, p63 of tracked queries); `scores` matched at popularity 17. Substring floor, not a UFC/MMA-specific signal — same caveat every sports-tracker doc in this roster carries. Real-world context is genuinely favorable (see Market Demand: Gen Z + Millennials = 61% of UFC's viewership, audience skews younger and more male than any US team sport in this roster, heavy streaming-platform overlap), but none of that is visible to the substring-matched scraper, so the number stays a floor. |
| Competition gap | **25 / 25 (naive tool output, hand-verified and kept, not corrected down)** | Tool found 0 competing products by keyword substring match. **Live-verified across three channels — Elgato Marketplace, GitHub sideload, and Corsair Xeneon Edge's iCUE widget catalog — and nothing turned up in any of them**, matching `tennis-tracker`'s "cleanest gap in the batch" finding rather than NHL/MLB's (each had a free sideload or Marketplace near-competitor) or F1's (MVF1, a real 1675-download Stream Deck plugin sharing the literal "F1" namespace). The one CSV hit, Fantasy Fight LIVE Controls, is confirmed a pure keyword false-positive on "fight" (see Competitor Analysis) with **zero token overlap** on the actual scored/recommended keywords ("ufc," "mma," "scores," "tracker") and zero functional overlap (Twitch minigame vs. real fight data) — a materially cleaner dismissal than F1-tracker's MVF1, which shared the literal "F1" string even though its function differed. Full marks held with higher confidence than any naive-25 sibling in this roster. |
| Monetization | 6 / 20 | Deterministic tool result (given). "No comps: unproven niche, default mid-low." No priced direct MMA/UFC data-tracker comp exists anywhere researched (Fantasy Fight LIVE Controls is free and not a real comp regardless). |
| **Deterministic subtotal** | **49.9 / 75** | `tools/opportunity.py "ufc tracker" "ufc scores" --category Plugins` (given in task brief, not re-run) |
| Build fit | 7 / 15 | Reuses `@elgato/streamdeck` `SingletonAction` scaffold + Rollup build + `plugins/screensaver-cycler/src/scheduler.ts`'s background-ticker pattern directly, no deduction (same as every sibling). Three new items: (1) live HTTP polling client with caching/backoff against an **unofficial** API (ESPN's hidden MMA endpoint, no community-maintained wrapper ecosystem the way NHL/soccer/F1 have — deduct 3, same magnitude as every sibling's API-client deduction). (2) Dynamic per-key icon compositing (fighter initials + weight-class color badge + live round/status, no official photos/logos) — deduct 3, matching every sibling's badge-pipeline deduction. (3) Favorite-**fighter** settings UI across several hundred active roster fighters spanning ~12 weight classes, retired/inactive/free-agent status, and catch-weight/short-notice bouts — deduct 2 (less than `tennis-tracker`'s combined ATP+WTA search burden, since the UFC roster is a single organization's single roster rather than two tours, but still a live-search/typeahead problem, not a static dropdown). **Genuinely better than every team-sport sibling on one specific axis, the reason this scores above NHL/soccer/tennis (4-5) despite three real deductions:** MMA's fight-state is structurally simpler than any sport already validated — no nested score hierarchy (no sets/games/points like tennis, no running score like NHL/soccer/NFL), just `scheduled -> round N in progress -> ended (method: KO/TKO/submission/decision, round, time)`. This is closer to F1's discrete-result simplicity than to a running-score sport, but unlike F1, a live "who's fighting right now" status during a card genuinely is a real, honest feature this product can ship (ESPN's scoreboard endpoint returns live status), so the full F1-style "drop live entirely" escape hatch doesn't apply here. **Not deducted, directly reusable:** `plugins/screensaver-cycler/src/pi.ts`'s probe-and-reply protocol extends cleanly to `{probe:"fighters", query:"<partial name>"}` -> ranked match list, the same pattern `tennis-tracker`'s validation recommended for player search; event cadence is naturally bursty-but-infrequent (roughly 1-2 UFC cards most weeks, hours of inactivity between them) rather than a daily-game cadence, a lighter overall polling burden than NHL/soccer across a full year even with live-during-event polling. |
| Risk | 2 / 10 | Two compounding vectors plus a data-sourcing gap, landing at the same worst-in-batch tier as `f1-tracker` and `tennis-tracker`, via a different combination (see Risk detail below). **Per the validation rubric, anything under 4 needs the owner's explicit sign-off regardless of total.** |
| **Qualitative subtotal** | **9 / 25** | |
| **TOTAL** | **58.9 / 100** | |

### Risk detail (2/10)

1. **Trademark enforcement on "UFC," "Ultimate Fighting," and the Octagon shape/word mark (deduct 3).**
   Zuffa, LLC holds registered word marks on "Ultimate Fighting Championship," "UFC," "The Octagon," and
   related designs, and UFC's own Terms of Use (`ufc.com/terms`, live-fetched) state plainly: "Use of the
   Trademarks of UFC® or of any other party is not authorized in any manner other than as incorporated
   into this website," and separately restrict distribution of "any part of the Service or the Content"
   without prior written authorization. Documented enforcement precedent: Zuffa sued Ubisoft in 2017 over
   "Fighter Uncaged" marketing copy using the phrase "ULTIMATE FIGHTING," and has sent cease-and-desist
   letters to apparel ventures (e.g., "Octagon Nation") over unauthorized use of the octagon shape — other
   MMA promotions have switched to circular cages specifically to avoid this trademark. **Contrast with
   `f1-tracker`'s Risk finding, per this task's explicit ask:** FOM's 2026 enforcement pattern targeted
   individual creators' *monetized branding* directly and recently (multiple named creators forced to
   rebrand in 2026) — a closer, more recent precedent for a solo-developer paid product than anything
   found for UFC, where the documented cases skew toward a AAA game publisher (Ubisoft) and physical-goods
   apparel brands, not small independent software/data tools. This is a real, material difference — UFC's
   posture is aggressive and well-documented, but the specific "targets individual creators' monetized
   product names" precedent is *weaker* here than F1's, which is why this product isn't scored as severely
   below the floor as `f1-tracker`'s dominant single vector. The literal word "UFC" in a paid product's
   display name is still the single biggest avoidable exposure in this list.
2. **Fighter likeness/publicity rights — the vector this task specifically flagged as distinct from team-sport
   trademark risk, and confirmed as real (deduct 3).** Unlike NFL/NHL/MLB, where players' unions
   collectively negotiate group-licensing rights separately from the league's own trademarks, UFC fighter
   contracts include an **"Ancillary Rights Clause"**: historically granting the UFC exclusive, perpetual,
   worldwide rights to a fighter's "name, sobriquet, image, likeness, voice, persona, signature, and
   biographical material," for merchandising, video games, broadcasts, and "all other commercial purposes"
   — later narrowed (per reporting on the current standard agreement) to end two years after contract
   termination, with a small royalty owed on non-event merchandise. The practical effect for this product:
   **UFC itself, not the fighters individually, is the counterparty that would need to authorize any
   commercial use of a fighter's name/image/likeness combination** — a materially different (and more
   concentrated) rights-holder structure than a team-sport union's group license, and one this roster
   hasn't encountered in any prior sports-tracker validation. Raw win-loss records and scheduling facts are
   not independently copyrightable (the same standard basis every sibling doc leans on), but this product
   must not use fighter photos, official headshots, or any UFC-supplied fighter imagery — text-only
   name+record+weight-class badges (house rule 4/5 already mandates this) is the only safe lane, and even
   then the product's own promotional copy should avoid implying any fighter endorsement or affiliation.
3. **Data-sourcing gap (deduct 2).** Unlike NHL/soccer, there is no well-known, actively-maintained
   community-run open API for live UFC/MMA data (no Jolpica-for-tennis or `api-web.nhle.com`-for-NHL
   equivalent found). ESPN's hidden MMA endpoint
   (`site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard`, live-fetched and confirmed working —
   returns real, current fight-card data: fighter names, records, weight classes, venue, broadcast, and
   scheduled/live/final status) is usable but carries the same profile as every sibling's ESPN dependency:
   unofficial, undocumented, no SLA, and ESPN's own ToS explicitly prohibits commercial use of its
   content/API without written approval. `ufcstats.com` (the community stats site every open-source MMA
   scraper targets — `Greco1899/scrape_ufc_stats`, `DavesAnalytics/ufcscrapeR`, and several others found
   live) is **historical-results-only, not live**, and its own scraping terms were not independently
   confirmable in this pass — treat as an unverified secondary/enrichment source, not a v1 primary. The one
   officially-licensed path, **Sportradar's UFC partnership** (confirmed live: expanded with Hard Rock Bet
   in March 2026, covering in-play strikes/takedowns/live match tracking with official fighter imagery),
   prices like every other Sportradar deal researched in this roster — **no published tiers, "starter"
   custom contracts typically $5,000-$10,000+/month with annual commitments** — the same order of magnitude
   that made a licensed feed uneconomical for both `mlb-tracker` and `tennis-tracker`. Third-party
   aggregators (Cito API, OddsMatrix, several RapidAPI MMA listings) exist but none confirm an actual
   ATP/WTA-Sportradar-style official license, and none publish clear commercial-redistribution terms in
   this research pass — same "doesn't resolve the licensing question, just changes which unlicensed vendor
   sits behind it" conclusion `tennis-tracker`'s doc reached for its own third-party options.
4. **Not deducted further, genuinely mitigating:** raw scores/records/schedules are facts, not
   independently copyrightable — the standard legal basis every sibling sports-tracker doc in this roster
   already leans on, and it holds here too. A clear non-affiliation disclaimer (market-standard mitigation
   used by every sport tracker in this batch) is available and should be used regardless of data source.

## Verdict: **LEAN-GO** (55-69 band)

58.9/100 lands in the same band as `nhl-tracker` (58.9, an exact match) and close to `soccer-tracker` /
`tennis-tracker` (56.9 each), clear of `mlb-tracker`'s and `f1-tracker`'s NO-GOs (54.3, 54.9). This is a
genuinely different risk *shape* than `f1-tracker`'s NO-GO, not a weaker version of the same problem:
F1's rejection was driven by one dominant, recent (2026), individual-creator-targeted enforcement pattern
against the literal word "F1." UFC's trademark posture is aggressive and real, but the closest documented
precedents (Ubisoft litigation, apparel-brand cease-and-desists) target larger commercial actors and
physical goods, not small independent software tools — a materially weaker direct precedent than F1's.
What UFC has that no US team sport in this roster does is the **fighter-likeness/Ancillary-Rights-Clause**
vector this task asked to investigate specifically — a real, structurally distinct risk, but one that
resolves cleanly the same way house rule 4/5 already resolves every other sport's logo risk (text-only
badges, no photos), rather than contaminating the product's core data (facts/records) the way it would if
the product's whole premise were fighter imagery.

**Exact conditions that would flip this to GO (need ~+11.1 combined):**

1. **Risk (+3):** rebrand the **display name and headline marketing copy** away from the literal word
   "UFC" — e.g. **"MMA Tracker"** or **"Fight Card Tracker"** — while keeping `ufc`, `mma`, and related
   terms in the Marketplace **keyword tags only**, the same "name for clarity/safety, tag for reach"
   pattern `f1-tracker`'s doc recommended for "F1" and `soccer-tracker`'s doc used for FIFA's "World Cup"
   phrase. This directly addresses the dominant, most-avoidable Risk deduction. Combine with a written,
   documented decision (e.g. `docs/DECISIONS.md`) to (a) never use fighter photos/official headshots/UFC
   logos or Octagon-shape iconography anywhere in the app or marketing kit, (b) carry an explicit
   non-affiliation disclaimer in the listing itself, and (c) name the specific data source chosen (ESPN's
   endpoint, accepted with its ToS risk) in writing rather than leaving it implicit — the same owner
   sign-off pattern used to flip `nhl-tracker`/`soccer-tracker`/`tennis-tracker`. Risk 2 -> ~5.
2. **Build fit (+3):** descope v1 to text-only score/status titles (no runtime image compositing),
   deferring the weight-class/fighter badge-rendering pipeline to v2 — the same flip condition every
   sibling in this batch has used. Build fit 7 -> ~10.
3. Both together land at ~64.9 — still short of 70, the same shortfall shape every sport tracker in this
   roster hits. The remaining lift has to come from Demand: re-run `tools/opportunity.py "mma tracker" "ufc
   scores" --category Plugins` (under the renamed keyword pair) close to a marquee numbered PPV event
   (the highest-attention UFC dates each year), once real MMA/UFC-specific search traffic might show up in
   the scrape, rather than today's generic `tracker`/`scores` substring match.

If none of the three land, this stays LEAN-GO and should not proceed to `/rat-build` as-is. Given Risk
sits below the 4-point sign-off floor, **owner sign-off on item 1 is mandatory regardless of the total**
before any build work starts.

## Recommended listing

- **Name:** **"MMA Tracker" (11 chars)**, not "UFC Tracker" — per the Risk analysis above, "MMA" (mixed
  martial arts) is a generic sport-genre term used by multiple promotions (UFC, Bellator, PFL, ONE
  Championship), not a Zuffa-owned mark, and sidesteps the single largest avoidable risk in this
  validation while the product still covers UFC's actual events and fighters as its practical v1 content
  (UFC is the dominant/only realistically-sourceable promotion via the recommended API). If shipped as-is
  under the literal "UFC Tracker" name this task was scoped to validate, treat the elevated trademark
  exposure as accepted, not resolved — do not ship that name without the owner sign-off in flip condition
  1. The technical namespace (`com.packrat.ufc-tracker`, this validation's slug) can stay as scoped; only
  the **display name and headline marketing copy** need to change, the same distinction `f1-tracker`'s doc
  drew between its slug/UUID and its recommended rebrand.
- **Price:** **$6.99** launch price, matching this roster's established "unproven sports-niche" tier
  (`nfl-tracker`, `nhl-tracker`, `soccer-tracker`, `tennis-tracker` all recommended the same number for the
  same reason — no priced direct comp exists anywhere in this niche).

  | Comp | Price | Type | Notes |
  |---|---|---|---|
  | Fantasy Fight LIVE Controls (Firesplash Entertainment) | Free | Elgato Marketplace, Stream Deck plugin | Twitch-overlay audience-engagement minigame, zero real MMA/UFC data — not a functional or pricing comp, included only because it was the task's named investigation target |
  | Sportradar (official UFC data partner) | ~$5,000-10,000+/mo, custom contract | Licensed commercial feed | Same enterprise-SaaS pricing tier that made a licensed path uneconomical for `mlb-tracker` and `tennis-tracker`; not viable against a one-time plugin price |
  | `nfl-tracker` / `nhl-tracker` / `soccer-tracker` / `tennis-tracker` (Packrat, this roster, none yet built) | $6.99 recommended each | plugin | Same "unproven sports-niche" pricing logic |
  | `screensaver-cycler` (Packrat, published) | $7.99 | plugin | In-house comp for a proven, multi-feature utility plugin |
  | `f1-tracker` (Packrat, this roster, **rejected**) | n/a (NO-GO) | plugin | Nearest precedent for a trademark-driven near-identical-score outcome, resolved differently here (LEAN-GO, not NO-GO) because the enforcement-precedent strength differs |

- **Device SKU plan:** plugin-type product, not a profile — no std/xl/win/mac `.streamDeckProfile`
  variants (`variants: {}`, `required_variants: []`, matching every sibling sports-tracker doc).
  `@elgato/streamdeck` is cross-platform and nothing in this design needs OS-specific hooks (network
  polling + text/badge rendering only) — **both Windows and Mac should ship at v1**.
- **Top 5 keywords:** `mma tracker`, `ufc scores`, `ufc fight card`, `next ufc event`, `mma results`.
  Deliberately keeps `ufc` as backend keyword metadata even under the recommended "MMA Tracker" display
  name — the same "name for safety, tag for reach" split used in `f1-tracker` and `soccer-tracker`'s docs.
- **Risk flags:** `trademark:ufc-octagon-word-marks` (Zuffa's registered "UFC"/"Ultimate Fighting
  Championship"/"Octagon" marks, with documented enforcement against a AAA game publisher and apparel
  brands — real but weaker direct precedent against small independent software than F1's 2026
  creator-targeted pattern), `likeness:fighter-ancillary-rights-clause` (UFC's own fighter contracts assign
  fighter name/image/likeness commercial rights to UFC itself, a structurally different and more
  concentrated rights-holder than a team-sport players' union — mitigated by text-only, no-photo badges,
  same as house rule 4/5 already requires), `api-risk:unofficial-mma-data` (ESPN's hidden endpoint's ToS
  prohibits commercial use; no open community API exists the way NHL/soccer have one; the one officially-
  licensed option, Sportradar, is enterprise-priced and not viable for a one-time plugin), `positioning-
  risk:live-vs-event-cadence` (UFC events are bursty and infrequent, roughly 1-2 cards most weeks with long
  idle stretches between — must not be marketed as a continuous "live score" utility the way a daily-game
  team sport can be).

Next step: this is a **LEAN-GO**, not an automatic `/rat-build`. Resolve the two flip conditions above (or
get explicit owner sign-off given Risk sitting below the 4-point threshold) before moving to build.

---

## Overview

UFC Tracker (recommended to ship as **"MMA Tracker"**, see Risk) would be a Stream Deck plugin surfacing
the next UFC event/fight card, a favorited fighter's record and next-scheduled-fight info, and (during a
live card) each fight's status, with a Property Inspector settings UI for following favorite **fighters**
— the second product in this roster built around individual athletes rather than teams or leagues, after
`tennis-tracker`. Same "don't leave your primary workflow to check a result" pitch the rest of the
roster's sports trackers use (house rule 2), targeting UFC/MMA fans who already own a Stream Deck for
streaming, working, or gaming. Built on `@elgato/streamdeck`, following `plugins/screensaver-cycler`'s
architecture (background ticker + persistent global settings + PI-probe pattern), not the
`profiles/_build` config-only pipeline.

## Market Demand

- Deterministic signal is a weak floor by design — `tracker`/`scores` are generic substring matches, same
  caveat every sibling sports-tracker doc in this roster carries (see Demand row).
- **Real-world demographic overlap with the likely Stream Deck buyer is genuinely strong, arguably the
  best fit of any sport validated in this roster to date, exactly per the task's hypothesis:** UFC's
  audience skews younger and more male than any US team sport already validated here — Gen Z and
  Millennials combine for **61% of UFC's viewership base**, the core regularly-tuning-in bracket is
  **25-54**, split roughly 30% each in the 25-34 and 35-44 brackets, and gender composition runs
  **73-90% male** depending on the measure (UFC.com's own audience: 73.76% male / 26.24% female; broader
  MMA-audience surveys: 75-90% male). UFC fans **"use streaming services more than the population at
  large,"** with 51% having used Paramount+ (UFC's new exclusive US broadcast partner). UFC's own web
  audience shows a stated interest overlap with **"Games > Video Game Consoles and Accessories"** —
  directly the gaming-hardware-adjacent buyer segment Stream Deck sells into. Digital engagement is large
  and current: UFC content generated **72 billion+ TikTok views** (2022-23), and UFC's Instagram has
  **49.9 million followers** as of 2026. Paramount+ itself specifically expects UFC's 2026 move to bring
  **"a dramatically younger audience"** to the platform.
- **Honest caveat, the mirror image of `tennis-tracker`'s Grand-Slam-spike finding:** UFC's event calendar
  is bursty, not continuous. Unlike NFL/NHL/MLB's long domestic seasons or soccer's overlapping year-round
  club leagues, UFC runs roughly 40+ events per year (numbered PPVs plus weekly-ish Fight Night cards), so
  "something is usually happening soon" is a reasonably true pitch — closer to soccer's evergreen framing
  than to tennis's ~8-week-a-year Grand Slam concentration — but a casual buyer's actual purchase intent
  likely still spikes around marquee numbered events (title fights, superstar headliners) rather than
  every Fight Night card equally. Ship/marketing timing should target a run-up to a high-profile numbered
  event, the same pattern every sibling sports-tracker doc uses for its own sport's peak dates.
- No free alternative *inside the Stream Deck plugin ecosystem* does this specific job (fight card /
  fighter record / next-fight) today — see Competitor Analysis. This is the cleanest confirmed gap of any
  sport validated in this roster.

## Competitor Analysis

- **"Fantasy Fight LIVE Controls" (Firesplash Entertainment) — the task's named investigation target,
  deep-dived and resolved:** live-fetched via its Elgato Marketplace listing
  (`marketplace.elgato.com/product/fantasy-fight-live-controls-...`) and Firesplash's own product page
  (`firesplash.tv/fflgame`). It is a Stream Deck controller for **Fantasy Fight LIVE**, a free Twitch
  overlay minigame: viewers' fictional "heroes" (built by collecting customizable items/body parts) duel
  each other and other viewers using a Rock-Paper-Scissors-style **Melee beats Magic / Magic beats Parry /
  Parry beats Melee** system, in best-of-X matches and knockout-bracket tournaments, with leaderboards and
  item trading. Categorized "Gaming" on the Marketplace, Windows-only, v1 released September 5, 2022, size
  21.22 MB. **There is no real fighter data, no real fight results, no UFC/MMA reference of any kind in
  this product.** It is a pure keyword false-positive on the generic English word "fight" — the raw CSV
  scrape's broader net caught it because "fight" is a substring of "UFC Tracker"'s conceptual keyword
  space, not because it competes for "ufc," "mma," "scores," or "tracker" (this product's actual scored
  keywords). **Net: zero functional overlap and, unlike `f1-tracker`'s MVF1 correction, effectively zero
  namespace overlap either** — a buyer searching "ufc tracker," "mma scores," or similar terms would not
  plausibly land on a product named "Fantasy Fight LIVE Controls." This is the reason the Competition-gap
  score stays at the tool's naive 25 rather than being corrected down.
- **Elgato Marketplace, live-searched:** no UFC/MMA-specific plugin or profile of any kind was found beyond
  the false-positive above.
- **GitHub sideload, live-searched:** no dedicated UFC/MMA Stream Deck plugin found (unlike NHL, which had
  `ThatSportsGamer/live-nhl-scores-for-stream-deck`, a free sideload tool). A generic
  `rweich/streamdeck-livescores` plugin exists ("display arbitrary match livescores on a button") but is
  sport-agnostic and not confirmed to support or be configured for MMA data — a minor, unconfirmed
  near-miss, not a real competitor, similar in spirit to the unconfirmed "Live Score Plugin" near-misses
  noted in the NHL/soccer docs.
- **Corsair Xeneon Edge (iCUE), different device ecosystem, live-searched:** Corsair's widget platform
  supports a general "live sports scores" category and a self-serve "Forge My Edge" builder, the same
  pattern noted in `tennis-tracker`'s doc, but **no dedicated UFC/MMA widget was found or confirmed** to
  exist, unlike NHL ("Hockey Scores") or F1 ("Formula One Next Race"). This is the cleanest cross-ecosystem
  gap of any sport validated in this roster — matching, not merely resembling, `tennis-tracker`'s "cleanest
  gap in the batch" finding.
- **Net:** no functional competitor exists in any of the three channels checked (Marketplace, GitHub
  sideload, Corsair Xeneon Edge). The gap is real and, per the task's own instruction to investigate
  thoroughly, is *more* confidently a true zero-competitor space after live research than it was from the
  raw keyword scrape alone, because the scrape's one apparent hit is confirmed unrelated.

## API Recommendation

Be honest up front, per this task's explicit instruction: **there is no well-known, actively-maintained,
free community API for live UFC/MMA data the way NHL has `api-web.nhle.com` or F1/tennis have Jolpica/an
ESPN-adjacent ecosystem with real open-source traction.** This niche is closer to `tennis-tracker`'s
"harder to source cleanly than any team sport" finding than to NHL's or soccer's.

- **Primary, v1 candidate: ESPN's hidden MMA API**
  (`site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard`). **Live-fetched and confirmed working during
  this research** — returned real, current UFC Fight Night fight-card data: full 13-bout card, fighter
  names, win-loss-draw records, weight classes (strawweight through heavyweight), venue, broadcast
  partner (Paramount+), scheduled times in UTC/EDT, and per-fight status. Same profile as every ESPN
  endpoint already recommended for `nfl-tracker`/`nhl-tracker`/`mlb-tracker`/`soccer-tracker`/
  `tennis-tracker`: unofficial, undocumented, no published rate limit, no authentication required — and
  **ESPN's own Terms of Service explicitly prohibit commercial use** without prior written approval, the
  same textual conflict every sibling doc in this batch has flagged and carried forward unresolved.
- **Historical/enrichment, not v1 primary: `ufcstats.com`.** The community's actual data source of record
  for MMA — confirmed via live search to have a large, active open-source scraper ecosystem
  (`Greco1899/scrape_ufc_stats`, `DavesAnalytics/ufcscrapeR`, `KgKevin0/UFC-Stats` (4,100+ fighter pages,
  650+ event pages scraped), `remypereira99/UFC-Web-Scraping`, and several others). This is **historical
  results only, not a live-scoring feed** — useful for building a favorited fighter's career record/history
  view, but cannot power a live "who's winning right now" status. Its own scraping terms/robots.txt
  restrictions were not independently confirmable in this research pass — treat as an unverified,
  secondary enrichment source pending a direct check, not a load-bearing v1 dependency.
- **Considered, not recommended: third-party MMA APIs (RapidAPI's "MMA API," "UFC Data," "UFC Fighters"
  listings; Cito API; OddsMatrix).** These exist and some claim live-scoring/round-by-round coverage, but
  **none confirm an official ATP/WTA-Sportradar-style license** the way Sportradar does for UFC, and none
  published clear commercial-redistribution terms discoverable in this pass. Using one doesn't resolve the
  data-licensing risk, it just changes which unlicensed intermediary sits behind it — the same conclusion
  `tennis-tracker`'s doc reached for its own third-party options.
- **The one officially-licensed option, priced out of reach for v1: Sportradar's official UFC data
  partnership.** Confirmed live (expanded with Hard Rock Bet, March 2026, adding official UFC data,
  in-play strike/takedown micro-markets, live match tracker with official fighter imagery). Sportradar
  does not publish pricing; researched comparably-scoped "starter" custom contracts run **$5,000-10,000+/
  month with annual commitments** — the same order of magnitude that ruled this out for both `mlb-tracker`
  and `tennis-tracker`. Not viable against a one-time ~$7 plugin. Flag as the long-term escape hatch only
  if a broader Packrat sports-data business scales enough to justify enterprise pricing, matching the
  conclusion every sibling doc with this same dead end has reached.
- **No official UFC public API or developer program was found.** UFC's own stats presence
  (`ufc.com/statistics`, the UFC app) is a consumer-facing product, not a documented developer API; its
  Terms of Use (live-fetched) explicitly prohibit redistribution of Content without written authorization.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/` and, more directly, `plugins/tennis-tracker/`'s
individual-athlete pattern (not `free/better-hotkeys-mouse` — nothing here needs OS-level hooks, network
polling + text/badge rendering only):

- **Background polling:** one ticker in the plugin process, same shape as `scheduler.ts`'s
  `startScheduler()`/`tick()` (not per-action timers, which pause on page switch). Cadence should be idle
  most of the time (events are roughly weekly-ish, not daily) and step up during an actual live card
  (e.g., 20-30s while a favorited fighter's bout window is active) — a lighter average annual polling
  burden than NHL/soccer's daily-game cadence, but with genuine live-during-event bursts unlike F1's
  fully-historical framing.
- **Config/favorites store:** `scheduler.ts`'s `getConfig()`/`patchConfig()` pair over
  `streamDeck.settings.getGlobalSettings()`/`setGlobalSettings()`, storing a favorite-**fighter** list
  (fighter ID/name, weight class) instead of a team list — same shape `tennis-tracker`'s doc recommended
  for favorite players.
- **Favorite-fighter PI flow:** extend `plugins/screensaver-cycler/src/pi.ts`'s probe-and-reply protocol
  to `{probe: "fighters", query: "<partial name>"}` -> ranked match list, the same reuse pattern
  `tennis-tracker`'s doc used for ATP/WTA player search. The UFC roster (several hundred active fighters
  across ~12 weight classes, plus retired/released fighters a user might still want to track historically)
  is a single organization's roster rather than two separate tours, a slightly smaller search space than
  tennis's combined ATP+WTA field.
- **Fight-state domain logic — simpler than tennis, closer to F1's discrete-result simplicity:** no nested
  set/game/point hierarchy to model. A bout's state is `scheduled -> round N in progress -> ended`, with an
  ended bout carrying a method (KO/TKO/submission/decision — unanimous/split/majority — or draw/no
  contest), the round, and time. This is genuinely less domain complexity than tennis's
  best-of-3-vs-5/deuce/tie-break model or soccer's three competition-format shapes, the reason Build fit
  scores above those siblings despite still needing new API-client and icon-compositing work.
- **Dynamic icons:** same net-new subsystem as every sport tracker in this batch — composite a fighter
  initials + weight-class-color badge plus live round/status onto the key image on each tick. **No
  official fighter photos, headshots, or UFC-supplied imagery** — this is not just the standard house-rule
  4/5 logo mitigation every sibling carries, it is also the direct mitigation for the fighter-likeness/
  Ancillary-Rights-Clause risk found specifically for this sport (see Risk). The v1 descope flip condition
  proposes deferring this whole subsystem to v2 and shipping text-only titles first.
- **Caching / offline fallback:** persist last-known-good fight-card/fighter-record state in global
  settings; on a failed/errored call, keep showing the last cached state with a subtle staleness
  indicator, the same pattern every sibling tracker in this roster recommends, especially relevant given
  ESPN's no-SLA, unofficial status.
- **Error handling:** exponential backoff on non-2xx/timeout, self-throttled since ESPN publishes no rate
  limit (same posture as the NHL/soccer/tennis docs' ESPN dependencies).

## Feature List (v1)

- **Fighter Record** action: pick a favorite fighter via the search-typeahead PI, key shows name/initials
  + current win-loss-draw record + weight class; if a fight is scheduled, shows opponent + date; if a
  fight is live, shows round/status; if just concluded, shows the result and method.
- **Next Event** action: next scheduled UFC card (event name, venue, date), press opens the event page in
  a browser.
- **Fight Card** action: current/next card's full bout order (main card / prelims), text-based.
- Favorites (one or more fighters) configured once in a shared settings surface across actions, v1
  text-only titles (no image compositing, per the Build-fit flip condition).

## Premium Features (v2+ upsell surface, not v1)

- Dynamic per-key fighter badge/status image compositing (the deferred Build-fit item).
- Live round-by-round status alerts (e.g., a notification when a favorited fighter's bout starts or ends)
  — feasible against ESPN's scoreboard status field, not yet spiked.
- Career-record/history lookup using `ufcstats.com`-sourced historical data (contingent on independently
  confirming its scraping terms before shipping — flag as uncertain, not promised without that check).
- Multi-fighter dashboard cycling several favorited fighters' next-fight/record status, useful around a
  stacked marquee card the same way `tennis-tracker`'s "Grand Slam mode" idea handles multiple favorited
  players being live simultaneously.
- **Not promising for any version without a licensed feed:** live strike/takedown/grappling statistics or
  betting-odds-adjacent data — this is exactly the category Sportradar's official partnership occupies
  under enterprise pricing, and third-party alternatives don't confirm clean commercial rights to it.

## UI Ideas

- Button layout: honor house rule 3 (never fill all 15 slots in marketing renders) — a realistic v1 layout
  is 2-4 favorite-fighter keys + 1 next-event key + 1 fight-card key, rest of the deck shown idle/faint,
  matching every other product in the roster.
- **Marquee-card mode (v2+ idea, not v1):** during a stacked numbered PPV card, a dedicated view surfacing
  all of a user's favorited fighters with bouts that night, mirroring `tennis-tracker`'s "Grand Slam mode"
  concept for its own multi-favorite-concurrent-event case.
- **Dashboard/LCD widget potential (v3, not v1):** no confirmed Corsair Xeneon Edge UFC/MMA widget exists
  today (see Competitor Analysis) — a genuine, currently-open opportunity on that device ecosystem too,
  worth a scoping pass once v1 (if built) proves demand on Stream Deck itself.

## Marketplace Positioning

Lead with "follow your favorite fighters, without leaving your deck" (benefit-focused, house rule 2) — the
individual-fighter favorites model is this product's structural differentiator, the same framing
`tennis-tracker`'s doc used for its player-based pitch. **Do not use the bare word "UFC" in the display
name or headline copy** (see Risk/Recommended listing) — "MMA Tracker" with UFC/MMA terms as backend
keywords is the safer lane, the same "name for safety, tag for reach" pattern used in `f1-tracker` and
`soccer-tracker`'s docs. Never depict fighter photos, official UFC logos, or Octagon-shape iconography
anywhere in the app or marketing kit; carry an explicit non-affiliation disclaimer in the listing
description itself.

## Pricing Recommendation

No priced direct comp exists anywhere in this niche (Fantasy Fight LIVE Controls is free and not a
functional comp regardless). Recommend **$6.99** launch price, matching this roster's established
"unproven sports-niche" tier used by `nfl-tracker`, `nhl-tracker`, `soccer-tracker`, and `tennis-tracker`
— deliberately conservative rather than pricing ahead of evidence, even though the audience-overlap case
(younger, more male, more streaming-platform-engaged than any US team sport in this roster) is arguably the
strongest demographic argument found in this entire batch. Revisit upward only after real sales data,
following the same "raise after validation" pattern used elsewhere in the roster.

## Confidence Score

**Medium.** High confidence, directly sourced this pass: the Fantasy Fight LIVE Controls resolution
(fetched both its Marketplace listing and Firesplash's own product page — unambiguous, not a real
competitor), ESPN's MMA scoreboard endpoint's live functionality (fetched directly, confirmed real
current fight-card data), UFC's Terms of Use trademark/distribution language (fetched directly), the
Ancillary Rights Clause's existence and rough scope (multiple independent legal/journalism sources agree
on the mechanism, though the exact current contract language is not independently reviewed — UFC's
standard agreement is not public), the Sportradar UFC partnership's existence and rough enterprise pricing
tier (consistent with the same pricing floor found for tennis and MLB), and the demographic/streaming-
overlap data (multiple independent sources: UFC.com's own audience analytics, Statista, industry
viewership reports). Lower confidence on: true UFC/MMA-specific Marketplace demand (still a
substring-matched floor, same as every sibling); `ufcstats.com`'s actual scraping terms (not independently
confirmed); the precise current wording of UFC's Ancillary Rights Clause in today's standard fighter
contract (reporting agrees on the mechanism and a since-narrowed scope, but the exact current text is not
public); and the true likelihood UFC would pursue a small, non-affiliated data-only plugin the way it
pursued Ubisoft or apparel brands — directionally relevant but not a perfectly matched precedent.

## Build Recommendation

**Do not proceed to `/rat-build` yet.** This is a LEAN-GO with Risk below the 4-point sign-off floor,
the same posture as `nhl-tracker`/`soccer-tracker`/`tennis-tracker`. Sequence:

1. Get explicit owner sign-off on (a) shipping under a non-"UFC"-branded display name ("MMA Tracker"
   recommended) with "ufc"/"mma" as keywords only, (b) the fighter-likeness/Ancillary-Rights-Clause risk
   and the text-only-badge mitigation, and (c) the chosen data source (ESPN's endpoint, accepted with its
   ToS risk) — document the decision, e.g. in `docs/DECISIONS.md`.
2. Re-scope v1 to the text-only, no-image-compositing version to bank the Build-fit flip condition.
3. Re-run the deterministic scorer under the renamed keyword pair (`"mma tracker" "ufc scores"`) close to
   a marquee numbered UFC event for a fresher demand read.
4. If total clears 70 after that, proceed to `/rat-build ufc-tracker` (technical slug can stay as scoped;
   only the display name changes); if not, this stays parked as `validated` (the gap and demographic
   overlap are both genuinely strong) pending a stronger signal.

## Implementation Plan (if greenlit)

1. Scaffold `plugins/ufc-tracker/` from the `screensaver-cycler` project layout (`@elgato/streamdeck` +
   Rollup + TypeScript), UUID `com.packrat.ufc-tracker` (namespace unchanged even if the display name
   ships as "MMA Tracker," matching `f1-tracker`'s slug-vs-display-name distinction).
2. Build the ESPN MMA scoreboard API client with the caching/backoff layer from Technical Notes.
3. Background ticker (`scheduler.ts`-equivalent) with the event-bursty, mostly-idle cadence described
   above.
4. `Fighter Record` action (v1 text-only titles first, per the flip-condition descope), `Next Event`,
   `Fight Card` actions.
5. PI: extend `pi.ts`'s probe pattern to a fighter-search typeahead (`{probe: "fighters", query}`).
6. `streamdeck validate` / `streamdeck pack`, install-test, then QA gate.
7. Marketing kit via `gen_marketing.py` — zero official UFC/fighter photos, logos, or Octagon-shape
   iconography anywhere in the kit, disclaimer language in the description, "MMA Tracker" (or equivalent
   non-"UFC" name) in headline copy per the Risk mitigation.

## Roadmap

- **v2:** dynamic per-key fighter badge/status image compositing (the deferred Build-fit item), live
  round-start/round-end status alerts, multi-fighter marquee-card dashboard.
- **v3:** career-record/history lookup (contingent on independently confirming `ufcstats.com`'s terms),
  Dashboard/LCD widget mode for Stream Deck+/Neo (a genuinely open gap on Corsair's Xeneon Edge too, per
  Competitor Analysis), revisit a licensed Sportradar-tier feed if this or a broader Packrat sports-data
  business scales enough to justify enterprise pricing, the same escalation path `tennis-tracker`'s doc
  left open.

## Proposed registry.json entry

Not added to `registry.json` by this research — for the owner to add once sign-off/flip conditions are
addressed, same pattern as every other LEAN-GO sports-tracker doc in this roster:

```json
"ufc-tracker": {
  "name": "MMA Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.ufc-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/ufc-tracker",
    "package": "plugins/ufc-tracker/marketing/com.packrat.ufc-tracker.streamDeckPlugin",
    "marketing": "plugins/ufc-tracker/marketing"
  },
  "keywords": ["mma tracker", "ufc scores", "ufc fight card", "next ufc event", "mma results"],
  "risk_flags": ["trademark:ufc-octagon-word-marks", "likeness:fighter-ancillary-rights-clause", "api-risk:unofficial-mma-data", "positioning-risk:live-vs-event-cadence"],
  "notes": "LEAN-GO 58.9/100 per plugins/ufc-tracker/VALIDATION.md, 2026-07-29. Deterministic 49.9/75 (demand 18.9, competition_gap 25 -- hand-verified across Marketplace/GitHub/Corsair Xeneon Edge, the cleanest gap in this roster alongside tennis-tracker; the task's named competitor 'Fantasy Fight LIVE Controls' (Firesplash Entertainment, free, 523 downloads) confirmed via live fetch to be an unrelated Twitch-overlay Rock-Paper-Scissors audience minigame with zero real MMA/UFC data or namespace overlap, a keyword false-positive on the generic word 'fight,' not a real competitor -- score kept at naive 25, not corrected down. Monetization 6/20, no comps). Build fit 7/15 (API client -3, dynamic icon compositing -3, favorite-fighter typeahead across a few hundred active roster fighters -2; scores above NHL/soccer/tennis (4-5) because MMA's fight-state -- scheduled/round-in-progress/ended-by-method -- has no nested set/game/point hierarchy, simpler than tennis or soccer, though a real live-during-event status feature (unlike F1's fully historical framing) keeps it below F1's 9). Risk 2/10, tied with f1-tracker/tennis-tracker for worst in this roster, below the 4/10 sign-off floor, via two compounding vectors distinct from any team-sport sibling: (1) Zuffa's documented, aggressive UFC/Octagon trademark enforcement (2017 Ubisoft suit, apparel-brand cease-and-desists) -- real but a weaker direct precedent against small independent software than FOM's 2026 individual-creator-targeted pattern that drove f1-tracker's NO-GO, the reason this scores LEAN-GO rather than NO-GO despite a similar total; (2) UFC's fighter contracts include an Ancillary Rights Clause assigning fighter name/image/likeness commercial rights to UFC itself (not a players'-union-style group license), a structurally distinct risk this task specifically asked to investigate, mitigated the same way house rule 4/5 already requires (text-only badges, no fighter photos); plus (3) no open community MMA API exists (ESPN's hidden endpoint works, live-confirmed, but its ToS bars commercial use; the officially-licensed Sportradar UFC partnership prices at the same $5-10k+/mo enterprise tier that ruled out mlb-tracker and tennis-tracker's licensed paths). Needs mandatory owner sign-off before /rat-build. Flip-to-GO path: rebrand display name away from the literal word 'UFC' to 'MMA Tracker' (keep ufc/mma as keyword tags only, mirroring f1-tracker's F1 rebrand and soccer-tracker's World Cup workaround) + no-fighter-photo/no-Octagon-iconography written decision (+3 risk), descope v1 to text-only titles (+3 build fit) -- lands at ~64.9, still short of 70; remaining lift needs a demand rescrape under the renamed keyword pair near a marquee numbered UFC event. Real-world demographic overlap (61% Gen Z+Millennial viewership, 73-90% male audience, 51% Paramount+ usage, stated interest overlap with gaming-console content) is the strongest buyer-demographic fit found for any sport tracker in this roster to date, though not visible in the deterministic scrape's generic-query floor."
}
```
