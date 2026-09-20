# Validation: F1 Tracker

Slug: `f1-tracker` | Type: `plugin` | UUID: `com.packrat.f1-tracker` | Researched: 2026-07-28

> **STATUS UPDATE 2026-07-29:** Owner reviewed the NO-GO verdict below and gave explicit blanket sign-off
> on the risk pattern driving it (unofficial API + trademark exposure) across the whole sports-tracker
> slate — see `docs/DECISIONS.md`. `registry.json` now carries this product as **`status: "validated"`**,
> **cleared to build**. The verdict/score below is kept as-written for the research record; treat "NO-GO"
> in this file as historical, superseded by the sign-off. The framing correction (schedule/results/standings,
> never "live") and the no-official-livery/logo design constraint still apply — those aren't risk-tolerance
> questions, they're what the plugin can actually deliver and a cheap mitigation either way.

Idea: Stream Deck **plugin** showing Formula 1 schedule, results, standings, and next-session info,
with a favorite-driver/team picker in the Property Inspector. Closest in-repo precedent:
`plugins/screensaver-cycler/` (background-poller + persistent-config + PI-probe pattern). Sibling
sports-tracker validations already on file in this roster: `nfl-tracker`, `nhl-tracker`, `soccer-tracker`
(all LEAN-GO) and `mlb-tracker` (NO-GO, 54.3/100). This doc follows the same rubric and, where useful,
compares directly against those.

**Framing correction made during this research, before any scoring:** the brief that kicked this off
describes a "live" tracker. The best free F1 data API (Jolpica, researched below) and essentially every
realistic free/cheap alternative are **historical/results-after-the-fact**, not lap-by-lap live timing.
True live timing is a metered, subscription-gated F1TV product that fan tools use only in an explicit
non-commercial capacity (see API Recommendation and Risk). This doc scores the product as it can
actually be built: **schedule / results / standings / next-session countdown**, not live lap timing.
Marketing copy and the product name should say so plainly rather than imply live in-race telemetry.

## Score

| Dimension | Score | Why |
|---|---|---|
| Demand | 18.9 / 30 | Deterministic tool result. Best-matched query is generic `tracker` (popularity 22, p63 of tracked queries); `formula` alone matched at popularity 19. Substring floor, not an F1-specific signal — same caveat every sibling sports-tracker doc in this roster carries. The **real-world** demand context is unusually strong for this one (see Market Demand: 831M global F1 fans, US fanbase up 11% YoY, record 2026 US TV ratings under Apple's new deal, Cadillac's grid entry) but none of that is visible to the substring-matched scraper, so the deterministic number stays a floor, not a ceiling. |
| Competition gap | **19 / 25 (corrected from the tool's naive 25)** | The tool found 0 competing products by keyword substring match. **Hand-verified correction, per this task's explicit instruction to adjust this number (not left as tool output, unlike the nhl/mlb/soccer docs' convention of caveating in prose only):** no functional live-schedule/results/standings competitor exists on the Elgato Marketplace today, so a full-gap 25 would overstate the picture in a different way — deduct 3 for **MVF1** (F1-Tools' free Stream Deck plugin, 1675 downloads, the single most-downloaded F1-branded item found in this entire research pass) occupying the "F1" + "Stream Deck" search space a buyer would land in, even though it does something completely different (see Competitor Analysis); deduct another 3 for **iConCity's "F1 2024"/"F1 25" Profiles** ($10 each) and "F1 25 for Galleon" ($10) already selling under the literal "F1" keyword on this exact marketplace, proving the namespace is not a clean blue ocean even though those are game-shortcut profiles, not data trackers. Net: **19/25** — a real gap for the specific job this product does, inside a keyword space that is more crowded (by non-functional near-misses) than any other sport validated in this roster. |
| Monetization | 6 / 20 | Deterministic tool result, left as-is per the tool-output convention used in every sibling doc. "No comps: unproven niche, default mid-low." Note for color, not score: iConCity's $10 F1-branded profiles are the first *paid* precedent under the literal "F1" keyword found anywhere in this roster's research — informs the Pricing Recommendation below even though it doesn't move this row. |
| **Deterministic subtotal** | **43.9 / 75** (raw tool output was 49.9/75; the 6.0-point gap is entirely the Competition-gap correction above) | `tools/opportunity.py "f1 tracker" "formula 1 tracker" --category Plugins`, competition_gap hand-corrected per task instruction |
| Build fit | 9 / 15 | **Genuinely better than every sibling sports tracker in this roster (NHL 5, MLB 6, soccer 4), for a specific structural reason:** because the recommended API is results/standings-only, not live lap timing, there is no live-game state to poll aggressively or composite onto a key in real time — the single biggest build-fit cost in every sibling doc (runtime dynamic per-key image rendering of a *live, second-by-second* score) simply isn't required for this product's honest v1 scope. A next-race countdown, last-result line, and standings table are all `setTitle`-able text, no image compositing needed at all. Deduct 4 (matching every sibling) for the one genuinely new subsystem this product still needs that no existing Packrat plugin has: an HTTP client against a live third-party API with caching/backoff. Deduct 1 for season-to-season schema drift (grid size changes — 2026 adds an 11th team, Cadillac, the first new entrant in a decade — the driver/team list isn't static across seasons the way NHL's 32 teams are). Deduct 1 for the season-aware settings UI: favorite driver + optional favorite constructor, best served by extending `plugins/screensaver-cycler/src/pi.ts`'s probe-and-reply pattern (`{probe:"drivers", season:"current"}`) to fetch the live roster from Jolpica rather than hardcoding a list that goes stale every driver-market shuffle — genuinely reusable, not new protocol design. **Not deducted, i.e. directly reusable:** `@elgato/streamdeck` `SingletonAction` scaffold + Rollup build (same as every plugin in this roster); the global-settings config store and background ticker shape from `scheduler.ts`, here running an even *lighter* cadence than any live-score sibling (hourly-ish most of the year, stepping up only around a race weekend to catch session-result updates, never a 20-30s live-game cadence); Jolpica publishes actual rate-limit numbers to code against (4 req/s burst, 500/hr sustained) — unlike the unofficial, undocumented endpoints every sibling sport had to self-throttle blind against. |
| Risk | 2 / 10 | Three stacked vectors, the first materially worse than anything found in the NHL/MLB/soccer siblings. **Trademark/brand-name enforcement on the literal word "F1" (deduct 4, the dominant factor):** Formula One Management has been actively sending cease-and-desist letters *in 2026* to individual content creators over commercial/monetized use of "F1" in their branding (multiple named creators forced to rebrand, e.g. "F1r The Girls" -> "Paddock Project"). This is not a hypothetical ToS clause like the NHL/MLB/FIFA risks in the sibling docs — it is **documented, ongoing enforcement against exactly this fact pattern**: an individual monetizing a product/brand carrying the literal "F1" name. A paid plugin literally titled "F1 Tracker" sits squarely inside that pattern. **Data-sourcing/platform-continuity (deduct 3):** the recommended API lineage (Ergast -> Jolpica) already died once — Ergast's Dec 2024 shutdown was volunteer burnout and un-funded infrastructure, not an FOM takedown, but it proves this exact category of API has no commercial backing or SLA and has a real precedent of total, sudden discontinuation; Ergast's own historical ToS was explicit "non-commercial purposes" and OpenF1 (the live-adjacent fallback) explicitly states commercial use "require[s] contacting the OpenF1 team" — neither is a clean green light for a paid product's core data pipeline. **Team/driver/circuit trademark and livery (deduct 1, the only cleanly mitigable item):** standard house-rule-5 mitigation (no official logos, liveries, or driver likenesses on keys) resolves this the same way it does for every other licensed-sport product in the roster. **Per the validation rubric, this lands well under the 4-point sign-off floor** — the most severe Risk score of any sport tracker validated in this roster so far, and it needs explicit owner sign-off, not a passive note, regardless of total. |
| **Qualitative subtotal** | **11 / 25** | |
| **TOTAL** | **54.9 / 100** | |

## Verdict: **NO-GO** (54.9/100, threshold is <55)

This is an extremely near miss — 0.1 point off the LEAN-GO floor, the same near-miss shape as `mlb-tracker`
(54.3/100, also NO-GO). The two docs get there by almost opposite paths: MLB's build was architecturally
identical to its live-score siblings and its risk was "ToS text says non-commercial"; F1 Tracker's build is
genuinely *easier* than every live-score sibling (Build fit 9, the best in the roster) but its risk is
worse than any of them, because FOM's enforcement against monetized "F1" branding is documented and
ongoing, not a clause that might theoretically be enforced. Recorded as `status: "rejected"` per SOP so it
is not re-litigated from scratch, but the margin is thin enough to list exactly what would flip it, same as
`mlb-tracker`'s doc did.

**Conditions that would flip this to LEAN-GO or better:**
1. **Rebrand away from the literal word "F1" in the product name and all headline marketing copy** — e.g.
   "GP Tracker," "Grand Prix Tracker," or "Race Weekend Tracker" — while keeping `f1`, `formula 1`, and
   similar terms in the Marketplace **keyword tags only** (not the display name or cover art), the same
   "name for clarity/safety, tag for reach" pattern `soccer-tracker`'s validation used to route around
   FIFA's aggressive enforcement of the literal "World Cup" phrase. This directly resolves the dominant
   Risk deduction, since the documented cease-and-desist pattern targets branded monetization of the word
   "F1" specifically. Risk 2 -> ~6 (+4).
2. **Ship a clear, prominent non-affiliation disclaimer and zero official team livery/driver-likeness/F1
   wordmark styling anywhere in the app or marketing kit** (standard house-rule-5 mitigation, already
   assumed as a baseline in every sibling doc, worth locking as an explicit written decision here given the
   elevated risk profile). Risk 6 -> ~7 (+1).
3. Both together move the total from 54.9 to roughly **59.9** — LEAN-GO territory, not GO. Reaching 70
   needs a real Demand lift: the deterministic score is still a generic-query floor despite genuinely
   strong real-world tailwinds (831M global fans, US fanbase +11% YoY, record 2026 US ratings, Cadillac's
   grid entry — see Market Demand). Re-running `tools/opportunity.py "f1 tracker" "formula 1 tracker"
   --category Plugins` (or the renamed product's actual keyword pair) close to the **2027 preseason
   testing window** or after a full 2026 season of Apple's new US broadcast push, once real F1-specific
   query traffic might show up in the scrape, is the highest-leverage next step if this gets revisited.

If none of the three land, this stays a NO-GO and should not proceed to `/rat-build`.

**A better nearby idea:** two options, not mutually exclusive.
- **Ship the reusable polling + PI scaffolding as a free lead-magnet plugin first** (same move
  `mlb-tracker`'s validation recommended, and the same trajectory this roster already used for
  `better-hotkeys` -> `better-hotkeys-pro`), under a non-"F1"-branded name. A free tool sidesteps almost
  all of the branding-enforcement risk (the documented C&D pattern targets *monetized* use of "F1"), builds
  the real polling/config/probe pipeline this product needs anyway, and leaves room for a genuinely paid
  "Pro" tier later once the naming and data-licensing picture is de-risked.
- **Broaden scope to a multi-series "Motorsport Tracker"** (F1 + IndyCar + WEC, all covered by broadly
  similar open data ecosystems) rather than over-indexing the entire product's brand identity on the single
  most litigious rights holder found anywhere in this roster's research to date. This also directly
  amortizes the Build fit investment across three series instead of one, the same amortization logic
  `mlb-tracker`'s doc used to justify a second-sport build.

## Recommended listing name

**"F1 Tracker" (11 chars)** is the name this research was scoped to validate, and it is well under the
30-char cap — but per the Risk row above, **this exact name is the single largest risk factor in this
entire validation**, not a cosmetic choice. If this product is ever built, do not ship it under this name
without first executing flip condition #1 above. Do not list this product as-is.

## Price, with comp table

| Comp | Price | Type | Notes |
|---|---|---|---|
| iConCity "F1 2024" / "F1 25" Profiles | $10 each | Elgato Marketplace, Stream Deck profile | Game-shortcut profiles for the *F1* video game (a `type: profile` product, not live data) — the first confirmed paid precedent under the literal "F1" keyword on this marketplace |
| iConCity "F1 25 for Galleon" | $10 | Corsair Galleon 100 SD profile | Only 3 downloads — weak traction for that specific SKU, but confirms Galleon already accepts normal Stream-Deck-style profile builds from this repo's existing `profiles/_build` pipeline (no new Xeneon-Edge-style widget toolchain needed if a profile variant is ever built) |
| MVF1 (F1-Tools) | Free | Elgato Marketplace, Stream Deck plugin | MultiViewer desktop-app controller (camera/audio/sync), not a data tracker — 1675 downloads, strongest F1-branded Stream Deck traction found in this pass, zero functional overlap with this product |
| Corsair "Formula One Next Race" | Free | iCUE Xeneon Edge widget | Different device ecosystem; live countdown to next race weekend — 1136 downloads, the single most-downloaded sport widget found across this roster's entire research history |
| `nfl-tracker` / `nhl-tracker` / `soccer-tracker` (Packrat, this roster, not yet built) | $6.99 recommended each | plugin | Same "unproven sports-niche" pricing logic every sibling sports tracker in this roster landed on |
| `mlb-tracker` (Packrat, this roster, **rejected**) | n/a (NO-GO) | plugin | Nearest precedent for a data-licensing/branding-risk-driven rejection at almost the identical score (54.3 vs. 54.9) |

**If the flip conditions are met and this is rebuilt under a non-"F1" name:** price at **$6.99**, matching
the roster's established "unproven sports-niche" tier (same number every sports-tracker sibling
recommended). The simpler, lower-maintenance data shape (no live cadence, no runtime image compositing)
is a mild argument for pricing at the top of that band rather than below it, but there's no direct evidence
to justify pricing ahead of the roster's own precedent, so **do not price above $6.99-$7.99** without sales
data. **If shipped as-is, under the literal "F1" name, for money:** do not build — the honest price given
the documented brand-enforcement pattern is "don't," not "charge less," the same conclusion `mlb-tracker`'s
doc reached for its own dominant risk.

## Device SKU plan

Plugin-type product, not a profile — no std/xl/win/mac `.streamDeckProfile` variants (`variants: {}`,
`required_variants: []`, matching `better-hotkeys`, `screensaver-cycler`, and every sibling sports-tracker
doc). `@elgato/streamdeck` is cross-platform and nothing in this design needs OS-specific hooks (network
polling + text rendering only, no `reg.exe` shell-outs like `screensaver-cycler`'s Windows-only design) —
**both Windows and Mac should ship at v1** if this is ever built.

## Top 5 keywords

`f1 tracker`, `formula 1 tracker`, `f1 standings`, `next f1 race`, `f1 results`. Deliberately keeps the
literal "f1"/"formula 1" search terms as backend keyword metadata even under the recommended rebrand (flip
condition #1) — the same "name for safety, tag for reach" split `soccer-tracker` used for "football" vs.
FIFA's "World Cup" phrase. Metadata tags carry materially lower branding-enforcement exposure than a
product's display name or cover art.

## Risk flags

`trademark:f1-brand-name-cd-precedent` (severe — FOM has sent cease-and-desist letters to individual
creators in 2026 over monetized use of the literal word "F1" in branding; the dominant, below-sign-off-floor
risk driver for this product), `trademark:team-driver-livery-logos` (mitigable — colors/abbreviations/text
only, no official liveries, logos, or driver likenesses, standard house-rule-5 pattern),
`data-tos:jolpica-openf1-noncommercial-history` (the Ergast->Jolpica API lineage has an explicit
non-commercial ToS history and one full prior shutdown from lack of commercial backing; OpenF1's ToS
explicitly requires contacting them before commercial use), `positioning-risk:live-tracker-framing-mismatch`
(the "live tracker" pitch this idea started from does not match what the realistic free data sources
actually provide — schedule/results/standings/next-session, not lap-by-lap live timing — must be corrected
in any listing copy to avoid both a false-advertising problem and unnecessary proximity to F1TV's
subscription-gated live product).

---

## Overview

F1 Tracker would be a Stream Deck plugin surfacing the next race weekend (with countdown), the last
session's result for a favorited driver, and driver/constructor championship standings, with a
Property Inspector settings UI for picking a favorite driver and optionally a favorite constructor. Same
"don't leave your primary workflow to check a score" pitch the rest of this roster's sports trackers use
(house rule 2), targeting F1 fans who already own a Stream Deck for streaming, working, or sim racing.
Built on `@elgato/streamdeck`, following `plugins/screensaver-cycler`'s architecture (background ticker +
persistent global settings + PI-probe pattern), not the `profiles/_build` config-only pipeline.

## Market Demand

- Deterministic signal is a weak floor by design — `tracker`/`formula` are generic substring matches, same
  caveat every sibling sports-tracker doc in this roster carries (see Demand row).
- **Real-world demand context is the strongest found for any sport validated in this roster to date.** As
  of July 2026: F1's global fanbase is estimated at **831 million**, described as the fastest-growing major
  sports property year-over-year (outpacing the Premier League and NBA by that measure); the **US fanbase
  has reached 52 million, up 11% year-on-year**; F1 registered an **all-time single-season US TV viewership
  record** in 2026, with live season race viewership up 21% versus the 2024 average; and Apple, in its
  first season as F1's exclusive US broadcaster after a reported ~$150M rights deal, reports viewership
  running "way up" through its first three races. The Drive to Survive effect (a cited **142% viewership
  increase since 2018**) continues to skew growth toward the 16-29 Gen Z demographic — a plausible match for
  the Stream Deck buyer demographic generally.
- **2026 season context gives a concrete launch hook:** 24 Grands Prix (Madrid replacing Barcelona on the
  calendar, Imola dropped), a brand-new **11th team, Cadillac** (General Motors-backed, the first new F1
  entrant in a decade, launched with a Super Bowl ad), and an all-new hybrid power-unit/aero regulation set
  — all genuine, above-baseline attention spikes for the sport in exactly this window.
- No free alternative *inside the Stream Deck plugin ecosystem* does this specific job (schedule/results/
  standings/next-session) today — see Competitor Analysis. Corsair's free "Formula One Next Race" widget
  (1136 downloads, different device ecosystem) is the closest functional analog found anywhere and is the
  single most-downloaded sport widget across this roster's entire research history, a genuinely strong
  proxy signal that this exact product shape (not live timing, just "when's the next race + basic status")
  draws real installs from streaming-hardware owners.

## Competitor Analysis

- **MVF1 (F1-Tools), Elgato Marketplace — the competitor named in this task's brief, deep-dived and
  corrected:** live-fetched via GitHub (`f1-tools/MVF1-Streamdeck`) and the Marketplace listing page. MVF1
  is **not** a schedule/results/standings tool. It is a **controller for the third-party MultiViewer for F1
  desktop application** — its actions swap driver camera feeds, full-screen a specific feed, mute/adjust
  volume per feed, and force-sync playback across feeds. It requires the separate MultiViewer app **and** an
  F1TV subscription to be useful at all (MultiViewer's own live-timing features specifically require F1TV
  Access). Confirmed **1675 downloads** (the strongest F1-branded Stream Deck traction found in this
  research), but **version 1.1, last updated February 16, 2024** — over two years stale as of this
  research, 19 GitHub stars, 2 forks, support contact is a `.edu` address (`f1-tools-contact@umich.edu`,
  reading as a student-run project) — maintenance-status flag, not confirmed abandoned. No official
  F1/FOM affiliation disclaimer was found on its live Marketplace listing. **Net: zero functional overlap**
  with the product this doc validates (video-app remote control vs. a standalone data glance tool that
  needs no companion app or subscription), but real *namespace* overlap — it is the thing a buyer searching
  "F1" on this marketplace finds today, which is the basis for the Competition-gap correction above, and
  its no-subscription-required, no-companion-app framing is this product's clearest differentiator if it is
  ever built ("check the schedule and standings without opening MultiViewer or paying for F1TV").
- **iConCity "F1 2024" / "F1 25" Profiles ($10 each) and "F1 25 for Galleon" ($10, 3 downloads):** static
  `.streamDeckProfile` game-shortcut products for the *F1* video game franchise (launch game, bind common
  in-game actions), not live race data — a different product category entirely (`type: profile` vs.
  `type: plugin` in this repo's own registry schema), but occupying the same "F1" keyword space and proving
  a $10 price point already clears under that keyword on this marketplace. "F1 25 for Galleon" additionally
  confirms the Corsair Galleon 100 Stream Deck already accepts ordinary profile builds from this repo's
  existing `profiles/_build` pipeline, unlike the Xeneon Edge (which needs Corsair's separate iCUE Widget
  toolchain) — relevant only if a future `type: profile` F1 product is ever considered alongside this
  plugin.
- **Corsair "Formula One Next Race" (iCUE Xeneon Edge widget), free, 1136 downloads:** a live countdown to
  the next F1 race weekend on Corsair's dashboard-LCD device. Different device ecosystem entirely (not
  Stream Deck), but the single strongest demand proxy found anywhere in this roster's sports-tracker
  research — direct evidence that "next race" style F1 status, on hardware someone already has open at
  their desk, draws real installs.
- **General web search for other F1 Stream Deck tools** turned up `sohanmanju/F1StreamDeck` on GitHub, an
  "F1 MFD integration for Elgato Stream Deck" — appears to be a small hobby/sideload project (not
  Marketplace-listed, not independently verified for scope or maintenance status in this pass) integrating
  with an F1 game's multi-function display, not live schedule/results/standings either. Treat as a minor,
  unconfirmed data point, not a real competitor.
- **Net:** no Marketplace-listed Stream Deck plugin does this product's actual job (schedule/results/
  standings/next-session) today. The gap is real, but the "F1" keyword space on this exact marketplace is
  already occupied by a well-downloaded (if functionally unrelated) free plugin and multiple paid
  game-profile SKUs — see the Competition-gap correction in the Score table for how that's reflected
  numerically.

## API Recommendation

- **Primary: Jolpica (`api.jolpi.ca/ergast/f1`)** — the community-maintained successor to the Ergast Motor
  Racing Developer API, which fully shut down at the end of the 2024 season. Jolpica maintains
  Ergast-compatible endpoints (`/{season}/driverstandings/`, `/{season}/constructorstandings/`, `/races/`,
  results, qualifying, schedule) plus its own newer surface, covering F1 data from 1950 to the present
  including the live 2025-2026 seasons. Free, no authentication required. Published rate limits: **4
  requests/second burst, 500 requests/hour sustained** for unauthenticated access — an actual number to
  code a backoff policy against, unlike the unofficial/undocumented endpoints every sibling sport-tracker
  doc in this roster had to self-throttle blind against.
  **Live-vs-historical caveat, addressed head-on per this task's explicit ask:** Jolpica, like Ergast before
  it, has **never been a live-timing API**. It is a record of races, results, and standings, populated
  after a session concludes — schedule and countdown data (which don't change during a session) are fine to
  poll anytime, but "who's leading right now" is simply not a question this API answers. This is the reason
  this doc's framing correction (top of file) moves the product from "live tracker" to
  "schedule/results/standings/next-session tracker." Any listing copy claiming live lap-by-lap timing would
  both misrepresent the product and needlessly invite comparison to F1TV's actual subscription-gated live
  product (see Risk).
- **Official live-timing situation, researched directly:** F1's public Live Timing feed (millisecond lap
  times, sector splits, pit entries/exits, tyre compounds, race control messages) is real but is delivered
  through F1TV (Access tier globally, Pro in select markets) — it intentionally withholds precise
  positional telemetry and some high-frequency control signals from public output, and full raw telemetry
  is legally available only to licensed teams/broadcast partners or through a direct commercial license
  under NDA. Third-party fan tools that do offer live-timing views (MultiViewer, the app MVF1 controls) do
  so by requiring the user's own F1TV subscription and operate as explicitly **non-commercial, fan-made**
  applications — not a model this product could copy for a paid product without the same risk MultiViewer
  itself is implicitly accepting.
- **Live-adjacent fallback, not recommended without a licensing decision: OpenF1 (`openf1.org`)** —
  real-time-ish session data from 2023 onward (data is classified "live" from 30 minutes before a session
  starts to 30 minutes after it ends; free REST tier at 3 req/s / 30 req/min). Could technically support a
  "Qualifying is live now" status flag without full lap timing, but its own documentation explicitly states
  it is "intended for... non-commercial fan engagement" and that "commercial use cases require contacting
  the OpenF1 team." Gate any use of this behind the same owner risk sign-off as the primary data source —
  do not fold it into v1 silently.
- **Longer-term escape hatch, not v1 economics:** a licensed commercial motorsport data feed (same category
  as SportsDataIO/Sportradar in the NHL/MLB docs) would resolve the data-licensing risk cleanly but at a
  cost tier that doesn't work against a one-time ~$7 plugin, matching every sibling doc's conclusion on this
  point. Not researched to a specific F1 price point in this pass; flag as the option if this product is
  ever pursued seriously post-rebrand.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/`, not `free/better-hotkeys-mouse` (no OS-level hooks
needed — network polling + text rendering only):

- **Background polling — genuinely lighter than every sibling sports tracker:** one ticker in the plugin
  process, same shape as `scheduler.ts`'s `startScheduler()`/`tick()` (not per-action timers, which pause on
  page switch). Because there is no live in-session state to track, cadence can stay slow most of the year
  (e.g., every few hours) and only step up briefly around a race weekend (e.g., every 15-30 minutes
  Friday-Sunday) to pick up newly finalized session results — no 20-30s live-game polling loop like the
  NHL/MLB/soccer siblings need.
- **Config/favorites store:** `scheduler.ts`'s `getConfig()`/`patchConfig()` pair over
  `streamDeck.settings.getGlobalSettings()`/`setGlobalSettings()`, storing one favorite driver and
  (optionally) one favorite constructor.
- **Favorites/settings UI:** unlike NHL's static 32-team list, F1's driver/constructor roster changes
  season-to-season (2026 adds an 11th team, Cadillac, and driver seats reshuffle most years — e.g. Bottas
  and Perez both returning from a year on the sidelines to drive for Cadillac in 2026). Recommend extending
  `plugins/screensaver-cycler/src/pi.ts`'s probe-and-reply pattern (`{probe:"drivers", season:"current"}` ->
  reply with the live roster fetched from Jolpica) rather than hardcoding a driver list that goes stale
  every driver-market shuffle — a genuine, cheap reuse of an existing protocol, not new design.
- **No dynamic per-key image compositing needed for v1** — the single biggest build-fit win over every
  sibling sports tracker. Next-race countdown, last-result line, and standings rows are all plain
  `setTitle`-able text; no runtime image renderer is required at all for an honest v1. A team-color-tinted
  background could be a future nice-to-have using small **pre-rendered, build-time** icon assets (the
  existing `profiles/_build/icons.py` / `_shared/marketing_engine.py` Pillow pipeline), not a new runtime
  subsystem.
- **Caching / offline fallback:** keep last-known-good response per endpoint in memory (or global settings
  for restart-persistence); on fetch failure, keep the last good state visible with a small staleness
  indicator, same pattern as every sibling doc's recommendation, especially important given Jolpica's
  no-SLA, volunteer-run status.
- **Error handling:** respect Jolpica's *published* 4 req/s burst / 500/hr sustained limits directly (a real
  advantage over the sibling sports' unofficial, undocumented endpoints — there's an actual number to code
  a backoff policy against instead of guessing).

## Feature List (v1)

- **Next Race** action: race name, circuit, date/time, live-updating countdown; press opens the official
  schedule page in a browser.
- **Last Result** action: favorited driver's finishing position and points from the most recently completed
  race (or qualifying/sprint session if that's the most recent completed session).
- **Driver Standings** action: top 5 plus the favorited driver's exact rank/points if they're outside the
  top 5.
- **Constructor Standings** action: same shape, for the favorited constructor.
- Favorites (one driver, optional one constructor) configured once in a shared settings surface across
  actions, using the season-aware probe pattern from Technical Notes.

## Premium Features (v2+ upsell surface, not v1)

- Separate Qualifying and Sprint result views (distinct from the full-race Last Result action).
- **Session-in-progress indicator** ("Qualifying is live now") — technically feasible via OpenF1, but
  **explicitly gated behind the same owner risk sign-off as the primary data source** (see API
  Recommendation); do not ship silently.
- Race-day reminder/alert (e.g., a notification as lights-out approaches).
- Multi-driver dashboard cycling several favorited drivers' standings.
- **Not promising for any version without a licensed feed:** live lap-by-lap timing, sector splits, or gap
  data — this is the exact product category F1TV/MultiViewer occupy under a subscription-gated,
  non-commercial framing this product should not attempt to replicate.

## UI Ideas

- Button layout: honor house rule 3 (never fill all 15 slots in marketing renders) — a realistic v1 layout
  is 1 Next Race key, 1 Last Result key (favorited driver), 1-2 standings keys, with the rest of the deck
  shown idle/faint, matching every other product in the roster.
- **Dashboard/LCD widget potential (v3, not v1):** Corsair's own "Formula One Next Race" widget on Xeneon
  Edge already proves this exact shape works on a small always-visible screen — worth a scoping pass on
  Stream Deck+/Neo once v1 (if ever built) proves demand, same note pattern used in the NHL/soccer docs.

## Marketplace Positioning

Lead with "next race, last result, standings — without leaving your deck" (benefit-focused, house rule 2).
**Do not claim "live" anything** in headline copy — the realistic data sources are results-after-the-fact,
and F1TV's actual live-timing product is subscription-gated; overclaiming here is both inaccurate and
invites unwanted comparison. Per the Risk section, this product's positioning is only safe to ship under a
non-"F1"-branded name with keyword-only use of "f1"/"formula 1," a prominent non-affiliation disclaimer, and
zero official liveries/logos/driver likenesses anywhere in the app or marketing kit — the same "name for
safety, tag for reach" pattern `soccer-tracker` used for FIFA's "World Cup" phrase, applied here to FOM's
documented enforcement against monetized "F1" branding specifically.

## Pricing Recommendation

No confirmed paid comp exists for a *live-data* F1 product (iConCity's $10 profiles are a different,
game-shortcut product category). If rebuilt under a safe name per the flip conditions: **$6.99**, matching
this roster's established "unproven sports-niche" tier used by every sibling sports tracker
(`nfl-tracker`, `nhl-tracker`, `soccer-tracker`), with room to test up to $7.99 post-launch given the
lighter, no-live-cadence maintenance burden relative to those siblings — but not priced there at launch
without sales evidence. **Under the literal "F1" name, as scoped for this validation: do not build**, the
same "don't, not charge less" conclusion `mlb-tracker`'s doc reached for its own dominant risk.

## Confidence Score

**Medium.** High confidence, directly sourced this pass: the live-vs-historical data distinction (Jolpica's
own docs and multiple independent sources agree it has never done live timing), the FOM
cease-and-desist pattern against monetized "F1" branding (multiple named creators, recent/ongoing as of
this research), MVF1's actual functional scope (confirmed via its own GitHub repo and Marketplace listing,
materially different from what this task's brief assumed), and the strong real-world F1 popularity/US
growth data. Lower confidence on: true F1-specific Marketplace demand (still a substring-matched floor, same
caveat as every sibling); and the precise likelihood FOM would pursue a small, non-affiliated data-only
plugin the same way it has pursued monetized content-creator branding — directionally the same risk
category and directly relevant, but not a perfectly matched precedent (data tool vs. personal brand).

## Build Recommendation

**Do not build under the literal "F1 Tracker" name and scope validated here.** This is a NO-GO at 54.9/100,
an extremely thin miss (0.1 point) with the most severe documented brand-enforcement risk found in this
roster's sports-tracker research to date. Sequence if this is ever revisited:
1. Decide, in writing (e.g. `docs/DECISIONS.md`), whether to (a) rebrand away from "F1" and pursue the
   LEAN-GO flip conditions above, (b) ship a free, non-"F1"-branded lead magnet first, or (c) broaden scope
   to a multi-series "Motorsport Tracker." Any of these is a materially different product than what this
   doc scored — re-validate under the new name/scope rather than assuming the score carries over.
2. If (a): execute the rename + disclaimer flip conditions, then re-run
   `tools/opportunity.py` under the new keyword pair for a fresh deterministic baseline, ideally near the
   2027 preseason window for a real demand signal.
3. Only proceed to `/rat-build` once the total clears 70 under the revised name/scope.

## Implementation Plan (if greenlit under a revised name)

1. Scaffold `plugins/<revised-slug>/` from the `screensaver-cycler` project layout (`@elgato/streamdeck` +
   Rollup + TypeScript), new UUID (not `com.packrat.f1-tracker` if the product is renamed).
2. Build the Jolpica API client (schedule, results, standings) with the caching/backoff layer from
   Technical Notes, respecting its published rate limits.
3. Background ticker (`scheduler.ts`-equivalent) with the season-aware, race-weekend-stepped cadence
   described above.
4. `Next Race`, `Last Result`, `Driver Standings`, `Constructor Standings` actions — all text-only, no
   image compositing needed for v1.
5. PI: season-aware driver/constructor probe (extends `pi.ts`'s probe-and-reply pattern) rather than a
   hardcoded list.
6. `streamdeck validate` / `streamdeck pack`, install-test, then QA gate.
7. Marketing kit via `gen_marketing.py` — zero official F1/team/driver logos or liveries anywhere in the
   kit, disclaimer language in the description, no "live" claims in headline copy.

## Roadmap

- **v2:** Qualifying/Sprint-specific result views, race-day reminder alerts, multi-driver dashboard.
- **v3:** session-in-progress status flag (gated behind a resolved data-licensing decision), Dashboard/LCD
  widget mode for Stream Deck+/Neo (Corsair's own Xeneon Edge widget already proves the shape), expansion
  to a multi-series "Motorsport Tracker" (IndyCar, WEC) to diversify trademark exposure and amortize the
  build cost across series, the same amortization logic `mlb-tracker`'s doc used to justify a second-sport
  build.

## Proposed registry.json entry

Not added to `registry.json` by this research — for the owner to add if they want the rejection on record,
same pattern as `mlb-tracker`:

```json
"f1-tracker": {
  "name": "F1 Tracker",
  "type": "plugin",
  "price_usd": 0,
  "status": "rejected",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.f1-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/f1-tracker",
    "package": "plugins/f1-tracker/marketing/com.packrat.f1-tracker.streamDeckPlugin",
    "marketing": "plugins/f1-tracker/marketing"
  },
  "keywords": ["f1 tracker", "formula 1 tracker", "f1 standings", "next f1 race", "f1 results"],
  "risk_flags": [
    "trademark:f1-brand-name-cd-precedent",
    "trademark:team-driver-livery-logos",
    "data-tos:jolpica-openf1-noncommercial-history",
    "positioning-risk:live-tracker-framing-mismatch"
  ],
  "notes": "NO-GO 54.9/100 (near-miss, LEAN-GO is 55; see plugins/f1-tracker/VALIDATION.md). Deterministic 43.9/75 (demand 18.9, competition_gap hand-corrected 19/25 from the tool's naive 25 -- MVF1 (F1-Tools, free MultiViewer-for-F1 Stream Deck controller, 1675 downloads, zero functional overlap but real namespace crowding) plus iConCity's $10 F1-game-profile SKUs already occupy the 'F1' keyword space, monetization 6). Build fit 9/15 -- the best of any sports tracker in this roster (nfl/nhl/soccer/mlb all scored 4-6) because the realistic data sources are results-after-the-fact, not live, so no runtime per-key image compositing is needed for v1. Risk 2/10, the worst of any sports tracker in this roster and well below the 4/10 sign-off floor: Formula One Management has documented, ongoing (2026) cease-and-desist enforcement against individual creators monetizing the literal word 'F1' in their branding -- a direct precedent for a paid plugin named 'F1 Tracker' -- plus the recommended API lineage (Ergast->Jolpica) has an explicit non-commercial ToS history and one full prior shutdown (Ergast, Dec 2024, unfunded volunteer infrastructure). Framing correction: this must ship as a schedule/results/standings/next-session tracker, never marketed as 'live' -- Jolpica has never provided lap-by-lap live timing; that is a separate, F1TV-subscription-gated product. Flip-to-LEAN-GO path: rebrand away from 'F1' in the name and headline copy (keep f1/formula-1 terms as keyword tags only) + explicit non-affiliation disclaimer and zero official liveries/logos (+5 combined risk), then a fresh demand read under the new name -- reaches ~60, still short of GO's 70. Better nearby idea: ship the reusable polling/PI scaffold as a free, non-F1-branded lead magnet first (mirrors better-hotkeys -> better-hotkeys-pro), or broaden to a multi-series 'Motorsport Tracker' (F1 + IndyCar + WEC) to avoid concentrating all brand risk on the single most litigious rights holder found in this roster's research to date."
}
```
