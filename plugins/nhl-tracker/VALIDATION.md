# Validation: NHL Tracker

Idea: Stream Deck **plugin** (`com.packrat.nhl-tracker`, not a `profiles/_build` profile) that shows
live NHL scores, standings, and next-game info on Stream Deck keys, with a favorite-team picker in the
Property Inspector. Closest in-repo precedent: `plugins/screensaver-cycler/` (background-poller +
persistent-config pattern, PI-probe protocol). No existing sports plugin in the roster.

Data freshness: deterministic run below is same-day (`data_age_days: 0`, no rescrape needed), but see the
Demand "why" line — the matched queries are generic, not NHL-specific.

## Score

| Component | Score | Why |
|---|---|---|
| Demand (0-30) | 18.9 | Best match is generic `tracker` (popularity 22, p63 of tracked queries) and `scores` (popularity 17) — the scrape's substring matcher cannot isolate "NHL" demand specifically, so this is a **weak floor, not a real NHL signal**. Category-level evidence is more useful: the marketplace already has live buyer behavior for sports-score utilities (see Competitor Analysis) proving *some* demand exists for this product shape; whether it clears for the NHL fanbase specifically (smaller than NFL/NBA/soccer in the US, but a real and online-engaged fanbase) is unproven until a live listing runs. |
| Competition gap (0-25) | 25.0 | 0 competing products matched by keyword scrape. **Caveat found by hand-verification (see Competitor Analysis):** no NHL-specific plugin is live on the Elgato Marketplace today, so the gap is real *right now*, but it is not structurally protected — a working NHL score engine already exists as public source and the same developer who ships a paid-adjacent MLB scores plugin on this Marketplace could publish an NHL sibling with comparatively little new work. Treat the 25 as "gap today," not "moat." |
| Monetization (0-20) | 6.0 | No comps found by the scrape to anchor a price against — tool defaults to "unproven niche, mid-low." Confirmed by hand: the one adjacent paid-marketplace comp (`Live MLB Scores`) does not expose its price to automated fetch (JS-rendered listing page), so there is no confirmed paid-sports-plugin price point to anchor to at all. This is a real ceiling on confidence, not just a tool limitation. |
| **Deterministic subtotal (0-75)** | **49.9** | From `tools/opportunity.py "nhl tracker" "nhl scores" --category Plugins` |
| Build fit (0-15) | 5 | This is a materially bigger build than any current Packrat plugin. Deduct 4: live external API polling (HTTP client, multi-endpoint normalization, retry/backoff, rate-limit handling) — no existing plugin talks to a network API at runtime; `screensaver-cycler` and `better-hotkeys-mouse` are both local-only. Deduct 3: dynamic per-key image rendering (score/team badge composited into the key image and re-rendered on state change) — no existing plugin does runtime image composition; both precedents ship static pre-rendered icon states only. Deduct 2: team badge assets must be built from scratch — Tabler/SimpleIcons has no sports-logo coverage, and official NHL logos are off the table anyway (house rule 4/5 + NHL trademark policy, see Risk) — so this needs a small in-house color+abbreviation badge renderer, not a static icon library, a new asset pipeline the roster hasn't needed before. Deduct 1: wider UI surface (favorites, standings view, next-game countdown, alerts) than a 3-action utility like `screensaver-cycler`. **Not deducted, i.e. genuinely reusable:** `@elgato/streamdeck` SDK + `SingletonAction` scaffold + Rollup build + vanilla-HTML/JS PI pattern (both precedents); the global-settings background-ticker pattern is a direct lift from `plugins/screensaver-cycler/src/scheduler.ts` (same shape: one plugin-process ticker, not per-action timers, so it survives page switches); the PI-probe messaging pattern in `plugins/screensaver-cycler/src/pi.ts` is reusable for team selection even though NHL's 32-team list is static (this is actually simpler than the case it was built for, a live filesystem scan); no OS-specific native hooks are needed at all (network + rendering only), so unlike `screensaver-cycler` this can plausibly ship Windows **and** Mac in v1 rather than deferring Mac. |
| Risk (0-10) | 4 | NHL.com Terms of Service: "you may access, use, and display the Services, but only for non-commercial, informational, personal use" and NHL logos/marks "may not be reproduced or used commercially without the prior written consent of NHL Enterprises, L.P." A **paid** plugin reselling access to NHL score data is a plausible target of the non-commercial clause in a way a free hobbyist tool is not — deduct 3. Team logos/marks are explicitly off-limits for a paid product per both NHL's own ToS and house rule 5 ("no third-party logos... trademark rejection vector") — deduct 2, permanent design constraint (ship color+abbreviation badges only, never the official crest). The public API (`api-web.nhle.com`) is unofficial/undocumented with a live precedent of full retirement — NHL fully deprecated the older `statsapi.web.nhl.com` in September 2023, forcing every integrator to migrate with no advance notice — deduct 1, recurring patch-churn risk, league-driven instead of anti-cheat-driven but the same shape. **Not deducted further:** raw scores/results are facts, not independently copyrightable, which is the standard legal basis nearly every sports-score product (ESPN, Bleacher Report, and the marketplace's own `Live MLB Scores` and `Keep the Score` listings) already operates on; no enforcement action against any small third-party NHL/MLB score tool turned up in this research; a clear non-affiliation disclaimer (the reference GitHub tool already carries one — see Competitor Analysis) is the market-standard mitigation. **Per the validation rubric, anything under 4 needs the owner's explicit sign-off regardless of total — this lands exactly at 4, so treat it as a sign-off item, not a pass.** |
| **Qualitative subtotal (0-25)** | **9** | |
| **TOTAL (0-100)** | **58.9** | |

## Verdict: **LEAN-GO** (55-69 band)

58.9 is short of the 70 GO bar, driven by a genuinely bigger build than anything in the current roster and
a real (if not disqualifying) data-licensing risk, on top of a demand number that's a floor, not a
confirmed signal. It is not a NO-GO: the competitive gap is real today, the reusable plugin scaffolding is
substantial, and the risk is bounded and precedented, not novel.

**Exact conditions that would flip this to GO:**
1. **Descope v1 to text-only score updates** (`setTitle`/`setState` on the native key title, no image
   compositing) and defer the badge-rendering system to v2. This removes the single largest build-fit
   deduction. Build fit 5 -> 9 (+4).
2. **Owner explicit sign-off on the NHL ToS/data-licensing risk**, documented (e.g. in `docs/DECISIONS.md`),
   plus shipping with a clear non-affiliation disclaimer and zero official logos/marks anywhere, including
   marketing images. This doesn't remove the risk, it converts it from an open question into an accepted
   one, which is what the rubric asks for at a sub-4 score. Risk 4 -> 7 (+3).
3. Even taking both of the above (+7 qualitative), the total reaches **~66** — still short of 70. The
   remaining gap has to come from Demand: re-run `tools/opportunity.py "nhl tracker" "nhl scores"
   --category Plugins` after the 2026-27 season kicks off (**Sept 29, 2026**, confirmed schedule — see
   Market Demand) once real NHL-specific search/query traffic exists in the scrape, rather than today's
   generic `tracker`/`scores` substring matches. If the refreshed scrape shows a materially tighter
   NHL-specific match, Demand can move independently of anything above.

If none of the three land, this stays LEAN-GO and should not proceed to `/rat-build` as-is.

## Overview

A Stream Deck plugin for NHL fans who want live scores, standings, and next-game info without
alt-tabbing to a browser or second screen while streaming, working, or gaming. Favorite-team picker in
the Property Inspector; each key can be bound to a team, to standings, or to a next-game view. Built on
`@elgato/streamdeck`, following the `screensaver-cycler` architecture (background ticker in the plugin
process + persistent global settings), not the `profiles/_build` config-only pipeline — this product does
not exist without new plugin code.

## Market Demand

- Deterministic signal is weak by design (see Demand row) — the scrape cannot isolate "NHL" from generic
  "tracker"/"scores" queries.
- Category-level demand for live-sports Stream Deck utilities is real and already monetized on this
  marketplace and adjacent hardware ecosystems: `Live MLB Scores` (paid-tier "Utilities" category
  listing, Elgato Marketplace, dev "ThatSportsGamer", v1.0.21 as of Jul 28 2026), `Live Score Plugin`
  (Live Score GmbH, general multi-sport), `Keep The Score` (Elgato Marketplace, scoreboard control for
  basketball/football/hockey/soccer/volleyball), and Corsair's free **"Hockey Scores"** iCUE Xeneon Edge
  widget (438 downloads per the seed data) — a different device ecosystem, but direct proof NHL-style live
  scores draw real install numbers in this exact buyer segment (streaming-hardware owners at their desk).
- NHL fan engagement context for the sell window: the 2026-27 season starts **Tuesday, Sept. 29, 2026**
  (confirmed via NHL.com/ESPN schedule releases) with an expanded **84-game season** (first time over 82
  games in three decades) plus high-visibility fixtures (Winter Classic, Heritage Classic, Global Series
  games in Finland and Germany, a five-team 3-on-3 All-Star Game Feb. 6). A longer season and more
  marquee dates is a mild demand tailwind for a "keep the score on my desk" utility, and gives a natural
  launch/marketing hook if this proceeds (ship ahead of Sept 29).
- No free alternative *inside the Stream Deck plugin ecosystem* was found that is Marketplace-listed and
  NHL-specific (see Competitor Analysis for the one GitHub-only free tool). Outside the ecosystem, generic
  NHL score apps/websites (NHL.com, ESPN, ESPN app) are the obvious free substitute buyers already use —
  the pitch has to be "stays on hardware I already have open," same framing the repo used for
  `screensaver-cycler`, not "novel access to scores."

## Competitor Analysis

- **Elgato Marketplace, live-searched:** no NHL-specific plugin or profile is currently listed. Adjacent
  listings: `Live MLB Scores` (baseball-only, same interaction pattern this product would use — per-team
  or per-game live score on a key), `Live Score Plugin` (general/multi-sport, dev "Live Score GmbH",
  compatible with Stream Deck 4.9+, last updated 2023 — stale relative to `Live MLB Scores`), `Keep The
  Score` (manual scorekeeping/control tool, not a live-fetch fan companion — different use case, not a
  direct competitor), and `Baseball Scores` (a **Dashboard/LCD widget**, not a keypad plugin — same
  developer/family as `Live MLB Scores`, "full-season MLB companion for your dashboard LCD... no setup
  required"). This confirms Elgato's own ecosystem already has a template for a small-screen live-sports
  widget (see UI Ideas / Dashboard-LCD note below).
- **Important hand-verified finding the scrape missed:** a free, open-source NHL scores plugin already
  exists — `ThatSportsGamer/live-nhl-scores-for-stream-deck` on GitHub. Same interaction model this
  product would use: per-team key, 30-second refresh, pre-game/live/final states, score-change flash in
  team colors, opens NHL Gamecenter on press, all 32 teams supported, uses the NHL public API with no key
  required, carries an explicit "not affiliated with, endorsed by, or sponsored by the National Hockey
  League" disclaimer. It is **not published on the Elgato Marketplace** — GitHub-release sideload only, so
  it doesn't show up in a Marketplace competitor scrape and doesn't compete for marketplace SEO or an
  impulse purchase, but it does mean the hard technical problem (live NHL data -> per-team Stream Deck key)
  is already solved and public, and the same author has a working, Marketplace-published sports-plugin
  business (`Live MLB Scores`). This is the basis for the Competition-gap "why" caveat above: **the gap is
  real today but not structurally defended** — that developer could publish an NHL sibling to the
  Marketplace with comparatively little new work whenever they choose to.
- No direct paid-comp price was recoverable (Marketplace product pages are JS-rendered; automated fetch
  could not extract a dollar figure for `Live MLB Scores`). Manually check the live listing before final
  price-lock if this proceeds.

## API Recommendation

- **Primary: `api-web.nhle.com`** (the current NHL public API family, e.g. `/v1/score/now`,
  `/v1/standings/now`, `/v1/club-schedule/{team}/week/now`). Unofficial and undocumented, but actively
  used by a large open-source ecosystem (`Zmalski/NHL-API-Reference`, `dword4/nhlapi`, multiple npm/PyPI
  clients, the `ThatSportsGamer` GitHub plugin above) and it is the *current* generation — NHL fully
  retired the older `statsapi.web.nhl.com` endpoint in **September 2023**, so `api-web.nhle.com` is not a
  fallback, it's the live surface. No API key/auth required; no published rate limit was found, so cadence
  should be self-throttled rather than assumed safe (the reference GitHub plugin polls every 30s per key —
  match or exceed that interval, don't undercut it).
- **Fallback/secondary: ESPN's hidden API** (`site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard`).
  Also unofficial/undocumented but independently stable ("reliable... structured JSON... stable for
  years" per research), no auth required, supports date-range scoreboard queries. Since both primary and
  fallback are unofficial with no SLA, this is a soft fallback (reduces single-point-of-failure risk during
  an NHL-side outage) not a guaranteed backstop — build the caching/last-known-good layer regardless (see
  Technical Notes).
- **Longer-term escape hatch, not for v1 economics:** licensed commercial feeds exist (SportsDataIO,
  Sportradar) with real SLAs and legitimate commercial-use terms. Realistic cost (likely $50-500+/mo tier)
  does not work against a one-time $6-8 plugin price — flag this as the option if NHL enforcement or
  reliability ever becomes a real problem post-launch, not a v1 requirement.

## Technical Notes

Architecture follows `plugins/screensaver-cycler/`, not `profiles/_build`:

- **Background polling:** one ticker in the plugin process (not per-action timers, which pause on page
  switch) — same pattern as `plugins/screensaver-cycler/src/scheduler.ts`'s `startScheduler()`/`tick()`.
  Poll cadence should step up during a tracked team's live game (e.g. 20-30s) and step down when nothing
  is live (e.g. every 5-10 min), mirroring the reference plugin's cadence.
- **Config/favorites store:** persistent global settings via `streamDeck.settings.getGlobalSettings()` /
  `setGlobalSettings()`, same shape as `scheduler.ts`'s `getConfig()`/`patchConfig()` — favorite team(s)
  live here, not per-action settings, so a "Standings" key can read the same favorites a "Team Score" key
  uses.
- **Caching / offline fallback:** keep last-known-good response per endpoint in memory (and optionally
  global settings for restart-persistence); on fetch failure, keep showing the last good state and surface
  a small staleness indicator (e.g., a dimmed title or "!" badge) once data is older than ~2x the expected
  poll interval, rather than blanking the key. This is the standard mitigation for an unofficial,
  no-SLA API (see API Recommendation).
- **Error handling:** exponential backoff on non-2xx/timeout, capped retry rate so a sustained outage
  doesn't hammer the endpoint (self-imposed, since no published rate limit exists to respect).
- **Favorites/settings UI:** unlike `screensaver-cycler`'s PI (`src/pi.ts`), which needs a live
  filesystem-probe protocol because installed screensavers vary per machine, NHL's 32-team list is fixed
  and can just be a static `<select>` in the PI HTML/JS — actually simpler than the precedent it borrows
  the pattern from. The probe-protocol pattern is still worth keeping in reserve for a "search standings by
  division/conference" filtered view if that ships.
- **Dynamic icons:** the real net-new piece (see Build fit). Composite a small badge (team abbreviation +
  team color block, no official crest) plus the live score/period/time onto the key image on each state
  change, using a lightweight in-process image library (Node canvas or equivalent) — nothing in either
  precedent plugin does this today.

## Feature List (v1)

- **Team Score** action: pick a team in the PI, key shows abbreviation + score + period/time; pre-game
  shows matchup + start time; final shows "Final"/"Final/OT"/"Final/SO"; press opens the game on
  NHL.com/Gamecenter in the browser.
- **Standings** action: cycles division/conference view on press (text-based, no per-team art needed).
- **Next Game** action: shows the next scheduled game for a favorited team with date/time.
- Favorites configured once in a settings/PI surface shared across actions.

## Premium Features (v2+ upsell surface, not v1)

- Live game alerts (goal/period-change notification — system notification and/or key flash) — the
  reference GitHub tool already proves score-change-flash is feasible; a system notification is new.
- Next-game countdown (live-updating "T-minus" title on a key).
- Multi-team dashboard view cycling favorites automatically.
- Injury alerts — **flag as uncertain**: not available from the NHL scoreboard/standings endpoints above;
  would need a separate news/injury data source, unresearched, do not promise this without a confirmed
  feed.

## UI Ideas

- Button layout: honor house rule 3 (never fill all 15 slots in marketing renders) — a realistic layout is
  3-5 favorite-team keys + 1 standings key + 1 next-game key, with the rest of the deck shown idle/faint in
  marketing art, same as every other product in the roster.
- **Dashboard/LCD widget potential (v3, not v1):** Elgato's own Marketplace already has this exact pattern
  for baseball — `Baseball Scores` is a "full-season MLB companion for your **dashboard LCD**" widget, and
  Corsair ships the same shape for hockey on iCUE Xeneon Edge. Stream Deck+ / Neo devices with a small
  screen are a natural v3 target for a rotating scoreboard that doesn't consume a key at all — worth a
  scoping pass once v1 proves demand, not a v1 commitment.

## Marketplace Positioning

Lead with "keep the score on your deck, not a second tab" (matches the repo's benefit-focused-copy house
rule — never "100% LOCAL" backend framing). Do not lead with "NHL data access" as if novel; free
alternatives (NHL.com, ESPN app, browser tabs) are the obvious substitute, and a free GitHub-only NHL
plugin already exists for anyone willing to sideload. The differentiator is packaging: Marketplace
discoverability/install-and-go, a favorites UI, and staying on hardware already open at the desk — the same
framing this repo used for `screensaver-cycler` ("not needing a separate background app").

## Pricing Recommendation

No confirmed paid-plugin comp price was recoverable (see Competitor Analysis) and the deterministic
monetization score (6/20) already reflects an unproven niche with no comps to anchor to. Recommend pricing
**below** this roster's standard multi-feature-utility tier ($7.99, used by `screensaver-cycler` and
`streamer-starter-pack`) rather than at it, given the weaker monetization confidence:

| Comp | Price | Notes |
|---|---|---|
| `screensaver-cycler` (this roster, multi-action plugin) | $7.99 | Standard utility-plugin tier, strong comp/demand backing |
| `Live MLB Scores` (Elgato Marketplace) | unconfirmed | JS-rendered page, price not machine-readable; verify manually |
| Corsair "Hockey Scores" (iCUE widget) | free | Different device/ecosystem, proves demand not price ceiling |

**Recommended launch price: $6.99**, one tier below the roster's default utility price, to reduce buyer
friction for an unproven niche, with room to raise toward $7.99-8.99 once downloads validate demand (the
same "raise after validation" pattern already used elsewhere in the roster, e.g. `davinci-resolve` as the
premium A/B target). Verify the actual `Live MLB Scores` price manually before final lock.

## Confidence Score

**Medium.** Research coverage is solid on API status, season timing, and the NHL ToS text (all
directly sourced). Two real gaps: (1) the one adjacent paid comp's price could not be confirmed
programmatically, so the pricing table above is judgment-anchored to the roster's own tiers, not a true
market comp; (2) true NHL-specific buyer demand (vs. sports-utility demand generally) rests on a
substring-matched deterministic floor plus category-level inference, not a direct signal.

## Build Recommendation

**Do not proceed to `/rat-build` yet.** This is a LEAN-GO, and the rubric's own rule applies here: Risk
scored exactly 4, which requires the owner's explicit sign-off regardless of total. Sequence:
1. Get explicit owner sign-off on the NHL ToS/data-licensing risk (document the decision).
2. Re-scope v1 to the text-only, no-image-compositing version to bank the build-fit flip condition.
3. Re-run the deterministic scorer close to the Sept 29, 2026 season start for a fresher demand read.
4. If total clears 70 after that, proceed to `/rat-build nhl-tracker`; if not, this stays parked as
   `validated` (not `rejected` — the gap and reusable scaffolding are both real) pending a stronger signal.

## Implementation Plan (if greenlit)

1. Scaffold `plugins/nhl-tracker/` from the `screensaver-cycler` project layout (`@elgato/streamdeck` +
   Rollup + TypeScript), UUID `com.packrat.nhl-tracker`.
2. Build the `api-web.nhle.com` client (scoreboard, standings, per-team schedule) with the caching/backoff
   layer from Technical Notes.
3. Background ticker (`scheduler.ts`-equivalent) driving live state into global settings.
4. `Team Score` action (v1 text-only titles first, per the flip-condition descope), `Standings`, `Next
   Game` actions.
5. PI: static team-select dropdown (no probe protocol needed for v1).
6. `streamdeck validate` / `streamdeck pack`, install-test, then QA gate.
7. Marketing kit via `gen_marketing.py` (already plugin-aware per `screensaver-cycler`'s registry notes) —
   zero official logos anywhere in the kit, disclaimer language in the description.

## Roadmap

- **v2:** dynamic per-key badge/score image compositing (the deferred build-fit item), live game alerts,
  next-game countdown.
- **v3:** Dashboard/LCD widget mode for Stream Deck+/Neo (see UI Ideas), multi-team auto-cycling dashboard,
  investigate a licensed data feed if NHL API reliability or enforcement posture changes.

## Proposed registry.json entry

Not applied — for the owner to add once sign-off/flip conditions are addressed.

```json
"nhl-tracker": {
  "name": "NHL Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.nhl-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/nhl-tracker",
    "package": "plugins/nhl-tracker/marketing/com.packrat.nhl-tracker.streamDeckPlugin",
    "marketing": "plugins/nhl-tracker/marketing"
  },
  "keywords": ["nhl tracker", "nhl scores", "hockey scores", "nhl live scores", "nhl standings"],
  "risk_flags": ["sports-ip:nhl", "api-dependency:unofficial-nhl-api"],
  "notes": "LEAN-GO at 58.9/100 (profiles/nhl-tracker/VALIDATION.md). New plugin architecture (no existing builder covers live API polling + dynamic per-key score rendering); reuses screensaver-cycler's background-ticker and PI patterns. Risk scored 4/10 (NHL ToS restricts commercial use of NHL Content and marks; unofficial API with a 2023 full-retirement precedent) -- needs owner sign-off before /rat-build per the validation rubric's sub-4 rule. Flip-to-GO path: descope v1 to text-only titles (no image compositing) + owner risk sign-off (+7 combined) + a post-season-start (Sept 29 2026) rescrape for a real NHL-specific demand read. Team badges must use color+abbreviation only, never official logos/crests (house rule 5 + NHL trademark policy)."
}
```

**Note on file location:** written to `profiles/nhl-tracker/VALIDATION.md` per instruction. The actual
plugin precedent (`screensaver-cycler`) keeps its `VALIDATION.md` inside `plugins/<slug>/` instead of
`profiles/<slug>/` — worth moving this file alongside that convention if/when `plugins/nhl-tracker/` gets
scaffolded.
