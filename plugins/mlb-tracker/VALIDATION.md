# VALIDATION: MLB Tracker

Slug: `mlb-tracker` | Type: `plugin` | UUID: `com.packrat.mlb-tracker` | Researched: 2026-07-28

> **STATUS UPDATE 2026-07-29:** Owner reviewed the NO-GO verdict below and gave explicit blanket sign-off
> on the risk pattern driving it (unofficial/commercial-restricted API + trademark exposure) across the
> whole sports-tracker slate — see `docs/DECISIONS.md`. `registry.json` now carries this product as
> **`status: "validated"`**, **cleared to build**. The verdict/score below is kept as-written for the
> research record; treat "NO-GO" in this file as historical, superseded by the sign-off. The one caution
> that ISN'T resolved by risk tolerance: a free, actively-maintained direct competitor ("Live MLB Scores")
> already exists on this exact marketplace — differentiate on favorites UI / multi-team support / postseason
> mode rather than expecting a novel-access pitch to work.

## Score table

| Dimension | Score | Why |
|---|---|---|
| Demand | 18.9 / 30 | Deterministic tool result. Best matched query "tracker" (popularity 22, p63 of tracked queries); "scores" popularity 17. Loose substring match, not "mlb"-specific — treat as a weak floor, not a real MLB demand signal. |
| Competition gap | 24.4 / 25 | Deterministic tool result based on `competitor_count: 1`. **Overstated** — see Competitor Analysis: real count is at least 3 (ThatSportsGamer's two Elgato plugins + Corsair's Xeneon Edge widget), the tool just missed "MiLB" and the Corsair listing because of its keyword/category matching. Left as-is per rule (deterministic half comes from the tool, not hand-adjusted), but every downstream judgment in this doc treats the niche as more contested than 24.4/25 implies. |
| Monetization | 2 / 20 | Deterministic tool result. Niche is 100% free products today — the only known comp (ThatSportsGamer) is free, and so is Corsair's. This is the load-bearing number for the pricing section below. |
| **Deterministic subtotal** | **45.3 / 75** | Straight from `tools/opportunity.py`. |
| Build fit | 6 / 15 | `plugins/screensaver-cycler` supplies real, directly-reusable scaffolding (SingletonAction skeleton, `@elgato/streamdeck` global-settings store, a background ticker in `scheduler.ts`, and the PI-probe pattern in `pi.ts` for populating a dynamic list). But three genuinely new subsystems have no precedent in either reference plugin: (1) a remote HTTP polling client against a live third-party sports API with caching/backoff, (2) **runtime dynamic key-image generation** (composite team colors/abbreviation/score onto a button icon on every tick — the marketing pipeline's Pillow rendering is build-time only, nothing in this repo renders images at runtime), and (3) a multi-select "pick your favorite team(s)" PI UI (the screensaver PI dropdown is single-select). Deducted 9 points for these three items. |
| Risk | 3 / 10 | Two stacked risk vectors, one severe. (a) MLB trademark/logo use is a standard, mitigable game/league-IP risk comparable to existing registry flags (`game-ip:riot`, `app-ip:blackmagic`) — solvable by never putting an official team logo on a key. (b) **The core data pipeline itself is the problem**: both realistic free data sources for this product (ESPN's hidden API and MLB's own Stats API, which is governed by the same MLBAM copyright notice as gdx.mlb.com) explicitly prohibit commercial use without prior written authorization. That is not a cosmetic trademark caution like the other flagged IP products in this registry — it is a direct textual conflict between "sell this as a paid plugin" and the terms governing the only data that makes the plugin work. Per the `/rat-validate` rule, anything under 4 here needs the user's explicit sign-off regardless of total. **This does.** |
| **TOTAL** | **54.3 / 100** | |

## Verdict: NO-GO (54.3/100, threshold is <55)

This is a near-miss, not a clear rejection — 0.7 points off LEAN-GO. Recorded as `status: "rejected"` per SOP so it isn't re-litigated from scratch, but the gap is small and specific enough to list exactly what would flip it:

**Conditions that flip this to LEAN-GO or better:**
1. **Swap the data source for a commercially-licensed feed** (e.g. SportsDataIO, api-sports.io, or a direct MLBAM commercial license) instead of ESPN's hidden API or the free MLB Stats API. This directly resolves the dominant Risk deduction (3/10 → roughly 7/10, since only the trademark/logo caution remains) and pushes the total to ~58/100 on Risk alone. It also justifies a real price, since "individual non-commercial use" data can't legally support a paid product but licensed data can.
2. **Reuse a built MLB Tracker's icon-rendering and polling code for a second sport** (NFL/NBA/NHL) to amortize the Build fit deduction — the first sport pays the full novelty cost, the second inherits a working runtime-icon-render + poll-and-cache pipeline and would likely score Build fit 11-12/15.
3. Either of these alone gets close to 58-60 (LEAN-GO). Both together, plus the demand caveat resolving with real MLB-specific query data from a future market refresh, could clear 70 (GO).

**A better nearby idea, if a sports plugin is wanted now:** ship this as a **free lead-magnet plugin** (like `better-hotkeys` and `discord-essentials`) rather than a paid one. That sidesteps the ToS "non-commercial" language almost entirely (still a gray area, but far closer to what the free ThatSportsGamer plugin is already doing in practice, unchallenged), builds the reusable live-data + dynamic-icon pipeline the roadmap needs anyway, and cross-sells the paid roster the same way Discord Essentials does — with the option to add a genuinely paid "Sports Tracker Pro" (licensed data, multi-league, multi-team) once the pipeline exists and a commercial data license is in hand.

## Recommended listing name

**MLB Tracker** (11 chars, well under the 30-char cap, exact-search-term style). Not recommended to actually list until the risk items above are resolved.

## Price, with comp table

| Product | Publisher | Platform | Price | Downloads |
|---|---|---|---|---|
| Live MLB Scores | ThatSportsGamer | Elgato Marketplace (Stream Deck plugin) | Free | 141 |
| Live MiLB Scores | ThatSportsGamer | Elgato Marketplace (Stream Deck plugin) | Free | 19 |
| Baseball Scores | Corsair | Elgato Marketplace (Xeneon Edge widget) | Free | 599 |

Every comp in this niche is free. Monetization scored 2/20 for exactly this reason, and pricing should follow the evidence, not the roster's usual $7.99-$17.99 band:

- **If shipped as-is (unlicensed data, paid):** do not recommend building this. The honest price given zero paid comps and a live free incumbent with 4x the downloads of anything else in the category would have to be low, and it still wouldn't resolve the ToS problem.
- **If a licensed data feed is secured:** a modest premium becomes defensible on features a free plugin can't safely ship (see Premium Features below) — **$4.99-$6.99**, well under the profile-tier pricing, reflecting a live-data plugin category with no paid precedent to anchor against.
- **If shipped free as a lead magnet:** **$0**, monetized indirectly the way `better-hotkeys` and `discord-essentials` are.

## Device SKU plan

Plugin-type product, not a profile — no std/xl/win/mac `.streamDeckProfile` variants to build. Matches the `variants: {}` / `required_variants: []` pattern already used by `better-hotkeys` and `screensaver-cycler`: one package, user places actions on whatever device/page they own. `@elgato/streamdeck` is cross-platform (unlike `screensaver-cycler`, which is Windows-only because it shell out to `reg.exe`), so **both Windows and Mac should be supported from v1** — nothing in the API-polling/icon-rendering design is OS-specific.

## Top 5 keywords

`mlb tracker`, `mlb scores`, `baseball scores`, `live scores`, `mlb standings`

## Risk flags

`data-tos:mlb-espn-commercial-use` (severe — see Risk row above), `trademark:mlb-team-logos` (mitigable — colors/abbreviations only, no official crests), `platform-risk:unofficial-api` (ESPN/MLB Stats endpoints are undocumented and can change or rate-limit without notice), `seasonality:mlb-offseason` (usage likely near-zero roughly November-February)

---

## Overview

MLB Tracker would be a Stream Deck plugin showing live MLB scores, standings, and next-game info for a user's favorite team(s), with dynamic per-key icons updating as games progress. It would be the factory's first sports plugin and its first plugin requiring a persistent live external-API poller plus runtime-generated icon art — a materially different build category from every profile shipped so far and from the two existing plugins.

## Market demand

The deterministic tool's 18.9/30 demand score is built on generic "tracker"/"scores" query matches, not MLB-specific search volume — the brief is explicit that this should be treated as a weak floor. There is no strong first-party signal in `streamdeck-market-data` that "MLB" specifically is a high-volume marketplace search term. What is a real, non-substring-matched signal: a free MLB scores plugin exists and has accumulated 141 downloads, plus a spinoff MiLB variant at 19, plus Corsair independently built and shipped a free "Baseball Scores" widget for a completely different device (Xeneon Edge LCD) that has 599 downloads. Three independent teams (a solo dev, and Corsair's first-party widget program) built free MLB-scores tools for Elgato-adjacent hardware. That is real evidence of demand for the *category* — it just hasn't been evidence of demand for a *paid* version of it, because nobody has tried to charge for it yet.

## Competitor analysis

**Live MLB Scores (ThatSportsGamer)** — https://marketplace.elgato.com/product/live-mlb-scores-fbafac13-4e61-4452-b677-5e60fea52639
- Free, Utilities category, Mac + Windows, requires Stream Deck 6.9+, 79.5 KB.
- Actively maintained: version 1.0.21 as of July 28, 2026 (this validation's research date), up from 1.0.16 on July 20 — a new point release roughly weekly during the season, which suggests either active bug-fixing or a fast-iterating solo dev, either way a sign the incumbent is not neglected.
- Support via GitHub issues and a YouTube demo video exist, but the product page content available to this research did not surface a written feature list, screenshots, or user ratings/review text — the marketplace page's rendered detail (description, feature bullets, star rating, review comments) is client-side and did not come through in fetched form. **This is a gap**: before committing to a "premium alternative" positioning, someone should manually open the listing in a browser and record what it actually shows on keys (single team? all games? standings?), what its icon design looks like, and read any star ratings/reviews for concrete complaints. That manual check is a prerequisite for the Premium Features list below, not something this research could fully substitute for.
- 141 downloads is a meaningful adoption number for a single-purpose utility plugin in this marketplace and directly explains why the deterministic Competition gap score (24.4/25, "1 competing product") understates the real contest — this is a live, iterating, adopted incumbent, not a dead listing.

**Live MiLB Scores (ThatSportsGamer)** — same publisher, minor-league spinoff, 19 downloads. Could not independently re-confirm via marketplace search (the marketplace's search endpoint did not return results through automated fetch), but it's consistent with the publisher's pattern of narrow, single-league utility plugins, and 19 downloads for a minor-league niche is plausible. Its existence signals the incumbent is willing to fragment into narrow spinoffs rather than build one configurable multi-league tool — a possible opening for a better-unified product, but not a gap this validation can price confidently without seeing it directly.

**Baseball Scores (Corsair)** — https://marketplace.elgato.com/product/baseball-scores-f38a29a4-65f0-4b8f-bb2a-a49ea589724e, version 2.0.5, released May 1, 2026, free, part of Corsair's 20+ first-party widget library for the Xeneon Edge LCD. Its own copy (surfaced via search snippet) describes it as "a full-season MLB companion... follow live game scores, check divisional standings, and switch to a dedicated Championship view during the World Series." That feature set (scores + standings + a special postseason mode) is a good reference for what "table stakes" looks like in this category even outside Stream Deck proper, and confirms the World Series is treated as a distinct product moment worth its own UI state.

Net: this is the only sport in the batch with a confirmed, adopted, actively-maintained free direct competitor on Stream Deck itself, plus independent proof (Corsair) that a well-resourced hardware company judged MLB scores worth building for free as a bundled perk. Both facts cut against a straight paid clone and in favor of either (a) a free entry that's simply better, or (b) a paid tier that is different in kind (multi-team favorites, dynamic team-colored icons, next-game-with-countdown), not just prettier.

## API recommendation

**Recommend against both of the free options as the data source for a paid product, and recommend the MLB Stats API over ESPN's if a free/prototype build proceeds anyway.**

- **MLB Stats API (`statsapi.mlb.com/api/v1/...`)**: No API key or auth required, no published rate limit, documented (unofficially, via community projects like `pseudo-r/Public-MLB-API`) with a `/api/v1/` surface covering schedule, live game feed, standings, and team data — genuinely more complete and stable-shaped than ESPN's for this use case, and it's MLB's own system rather than a third party scraping MLB. **However**, usage is explicitly governed by the notice at `gdx.mlb.com/components/copyright.txt`: *"Only individual, non-commercial, non-bulk use of the Materials is permitted... any other application... requires the prior written consent of MLBAM."* A paid plugin polling this on behalf of every customer is commercial use by any reasonable reading.
- **ESPN's hidden API (`site.api.espn.com/apis/site/v2/sports/baseball/mlb/...`)**: Undocumented, unauthenticated, community-mapped (`pseudo-r/Public-ESPN-API`), covers scoreboard/schedule but standings only stub through this path. ESPN's terms of service prohibit using the API or its content for any commercial purpose without ESPN's prior written approval — same conflict as MLB's own API, without the compensating advantage of being the more complete/native source.
- **If a licensed path is pursued instead** (the condition that flips this validation), a commercial sports-data vendor such as SportsDataIO or api-sports.io should be evaluated — both explicitly sell redistribution rights, which is the missing piece here. That changes unit economics (a recurring data-feed cost against a one-time plugin sale) and should be priced into the recommendation above, not treated as free infrastructure the way the reference plugins' local OS calls are.

## Technical notes (plugin architecture)

Same shape as `plugins/screensaver-cycler`, not `free/better-hotkeys-mouse` (that one is a heavier native-OS-hook plugin, per `CLAUDE.md`'s project map, and has little to reuse here):

- **Background poller**: `plugins/screensaver-cycler/src/scheduler.ts` runs one `setInterval` ticker in the plugin process (not per-action timers, specifically so it survives page switches — see the file's own header comment). MLB Tracker needs exactly this shape, polling the chosen API every N seconds/minutes instead of checking a schedule table, with results cached in memory and pushed out to any visible key actions.
- **Config/settings store**: same file's `getConfig`/`patchConfig` pair over `streamDeck.settings.getGlobalSettings()` is directly reusable for storing the user's favorite-team list and any cached last-known scores.
- **Property Inspector probe protocol**: `plugins/screensaver-cycler/src/pi.ts` shows the pattern for a PI (a sandboxed browser window with no filesystem/network access of its own) asking the plugin process to enumerate a list — there, local `.scr` files; here, the MLB team list — and getting a reply via `streamDeck.ui.sendToPropertyInspector`. This is the mechanism for a "pick your favorite team(s)" dropdown, extended to multi-select (screensaver-cycler's version is single-select).
- **Genuinely new**: an HTTP client against a remote API (not filesystem/registry calls like both precedents), and — the biggest net-new piece — generating a key image at runtime (team abbreviation/colors/score composited onto a button bitmap on every refresh tick) via `setImage()`. Nothing in this repo currently renders images outside the build-time Pillow marketing pipeline (`_shared/marketing_engine.py`); a Node-side canvas/image library would be a new dependency for the plugin runtime itself.
- SDK/build stack matches both precedents: `@elgato/streamdeck` SDK, `SingletonAction` classes, vanilla HTML/JS Property Inspector (no framework), Rollup build, `streamdeck validate`/`streamdeck pack`. Same package.json-at-zip-root trap applies (house rule 6).

## Feature list (v1, if built)

- Live score display for a user-selected favorite team, refreshed on a background poll cadence
- Team logo/color key icon (colors + abbreviation, not official crest — see Risk)
- Basic game state on the key: pre-game (next game time), live (inning/score), final (result)
- Manual refresh action
- Property Inspector: single "my team" picker populated via the probe pattern above

## Premium features (what would make buyers pay when a free alternative exists)

Flagged as the hardest sell in this batch, honestly: the free incumbent already covers the baseline ("show live MLB scores on your Stream Deck"). A paid version has to be different in kind, not degree:

- **Multi-team favorites** (follow 3-5 teams across separate keys simultaneously) — the free MiLB spinoff pattern suggests ThatSportsGamer solves multi-league by shipping separate plugins per league rather than one configurable multi-team tool; a single plugin that tracks several teams at once is a real differentiator if true.
- **Dynamic team-colored icons** that actually change art per team (not just text) — contingent on solving the runtime icon-rendering build-fit gap above.
- **"Next game" countdown/schedule key** distinct from a live-score key.
- **Standings view** (division/wild-card position) as its own key, matching the feature Corsair judged worth building for its widget.
- **Postseason-aware mode** (the Corsair widget's "Championship view" during the World Series is a validated pattern worth copying: Oct 23-31, 2026 for this season).

None of this is verified against what the free competitor actually lacks — see the Competitor Analysis gap above about not being able to confirm ThatSportsGamer's exact feature set through automated fetch. **Before building, manually inspect the live listing** to confirm these are real gaps and not already-shipped features.

## UI ideas

- Key face: team abbreviation (2-3 letters) on a team-color background, score overlay when live, small "@"/"vs" + opponent abbreviation for pre-game.
- PI: multi-select team list (checkboxes, not a single dropdown), populated via the same probe-and-reply pattern as `pi.ts`, plus a refresh-interval setting.
- Optional dial/touch-strip support if targeting Stream Deck+ hardware, showing an expanded box score — not scoped for v1.

## Marketplace positioning

Not recommended for the "premium alternative, clearly better" framing this house's rules (no settling for feature parity) would normally require, until the data-license and feature-gap items above are actually resolved and verified. If those land, position on "follow every team you care about, not just one" (multi-team) plus "know exactly when your next game is" (countdown/schedule) as the two concrete, checkable differentiators from the free single-team incumbent.

## Pricing recommendation

See comp table above. Do not price this like a profile ($7.99+) — there is no paid precedent in the category and the direct incumbent is free with real adoption. If the licensing condition is met, $4.99-$6.99 is the ceiling this evidence supports. If it is not met, the honest recommendation is free-or-don't-build, not "charge less."

## Confidence score

**Medium-low.** High confidence on the two hard facts driving the verdict (both realistic data sources contractually restrict commercial use; a free, adopted, actively-maintained direct competitor exists). Lower confidence on the exact competitive feature gap, since the live marketplace listing's description/reviews/screenshots did not render through automated fetch and would need a manual look before any build decision.

## Build recommendation

**Do not build as a paid plugin under current conditions.** Do not build at all until at minimum: (1) the data-licensing question is resolved one way or the other (secure a commercial feed, or consciously accept the ToS risk in writing), and (2) someone manually reviews the ThatSportsGamer listing to confirm the premium feature gap is real. If those two things happen, this idea plausibly becomes LEAN-GO to GO — the underlying interest signal (three independent free tools built for this exact category) is genuine.

## Implementation plan (if greenlit later)

1. Resolve data source (licensed feed vs. accepted ToS risk) — blocking, do first.
2. Manually audit ThatSportsGamer's live listing and reviews to lock the real feature-gap list.
3. Scaffold from `plugins/screensaver-cycler` (manifest, package.json, Rollup config, SingletonAction skeleton).
4. Build background poller against the chosen API with caching/backoff (extend `scheduler.ts` pattern).
5. Build runtime key-icon renderer (new subsystem — spike this early, it's the biggest unknown).
6. Build multi-select team-picker PI (extend `pi.ts` probe pattern).
7. QA gate, install test, `streamdeck validate`/`pack`.

## Roadmap (if built)

- **v2**: standings key, postseason/World Series mode, next-game countdown key.
- **v3**: reuse the polling + runtime-icon pipeline for a second league (NFL/NBA/NHL) once proven, amortizing the Build fit cost flagged above across a small "Live Scores" sub-line rather than one-off sports plugins.

## Proposed registry.json entry

Not added to `registry.json` by this research (per instructions) — for the owner to add if they want the rejection on record:

```json
"mlb-tracker": {
  "name": "MLB Tracker",
  "type": "plugin",
  "price_usd": 0,
  "status": "rejected",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.mlb-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/mlb-tracker",
    "package": "plugins/mlb-tracker/marketing/com.packrat.mlb-tracker.streamDeckPlugin",
    "marketing": "plugins/mlb-tracker/marketing"
  },
  "keywords": ["mlb tracker", "mlb scores", "baseball scores", "live scores", "mlb standings"],
  "risk_flags": [
    "data-tos:mlb-espn-commercial-use",
    "trademark:mlb-team-logos",
    "platform-risk:unofficial-api",
    "seasonality:mlb-offseason"
  ],
  "notes": "NO-GO 54.3/100 (near-miss, LEAN-GO is 55). Deterministic 45.3/75 (demand 18.9, competition_gap 24.4 -- overstated, tool only found 1 of >=3 real competitors), Build fit 6/15, Risk 3/10 (below the 4/10 sign-off floor: ESPN and MLB Stats API terms both prohibit commercial use of the data this plugin would be built on). Free direct competitor 'Live MLB Scores' by ThatSportsGamer (141 downloads, actively maintained, v1.0.21 as of 2026-07-28) plus 'Live MiLB Scores' spinoff (19 downloads) and Corsair's free 'Baseball Scores' Xeneon Edge widget (599 downloads). Flip conditions: secure a commercially-licensed sports data feed (resolves the dominant risk deduction) and/or amortize build cost by reusing the pipeline across a second sport. See profiles/mlb-tracker/VALIDATION.md for full research."
}
```
