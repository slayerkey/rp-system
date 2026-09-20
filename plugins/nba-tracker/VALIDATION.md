# NBA Tracker — Opportunity Validation

> **BUILD NOTE 2026-07-29:** built and packed as v1.0.0.0, `status: "built"` in `registry.json`.
> The Build-fit flip-to-GO condition below (item 1, "extract a reusable dynamic key-image renderer
> as shared infra") is **done**: the ESPN client, background poller, SVG badge renderer and view
> helpers now live in `plugins/_shared/`, with recorded fixtures and tests, ready for the other
> nine trackers. Two corrections to the research below, both found while building:
> the dynamic key renderer needs **no** canvas/native dependency because Stream Deck's
> `setImage()` accepts an SVG string, which is also why v1 ships Windows **and** macOS; and the
> only standings endpoint worth calling is `level=3`, since it is the one response that carries
> division grouping alongside the conference seed. Everything else in this file stands as written.

Slug: `nba-tracker` | Type: `plugin` | UUID: `com.packrat.nba-tracker` | Date: 2026-07-28

---

## Score Table

| Dimension | Score | Why |
|---|---|---|
| Demand | 18.9 / 30 | Deterministic tool matched only generic "tracker"/"scores" queries (popularity 22/17, ~p63) — not NBA-specific signal. Real-world corroboration is decent but indirect: Corsair ships a free "Basketball Scores" widget on its Xeneon Edge device (iCUE Widgets, 435 downloads), and ThatSportsGamer's "Live MLB Scores" Stream Deck plugin exists and is actively maintained (v1.0.21, updated the day this was written), proving streamers do want auto-updating live sports scores on a physical device. No NBA-specific query data exists to confirm NBA scale, hence no upward adjustment to the deterministic number. |
| Competition gap | 25 / 25 | Confirmed live: searching "NBA" on marketplace.elgato.com returns zero results. The only near-comps are ThatSportsGamer's "Live MLB Scores" (different sport, same plugin category) and "Live Score Plugin" by Live Score GmbH (a manual broadcast-scoreboard *controller*, not an auto-fetching score display — different use case). Corsair's "Basketball Scores" is confirmed via live fetch to be an **iCUE/Xeneon widget**, not a Stream Deck plugin — different platform entirely, so it does not close this gap. |
| Monetization | 6 / 20 | Deterministic default for an unproven niche with zero direct comps to price against. |
| Build fit | 8 / 15 | `plugins/screensaver-cycler/src/scheduler.ts` gives a directly reusable background-poller + global-config-store pattern (swap "screensaver rotation" for "score refresh"). `src/pi.ts` gives a directly reusable PI-probe protocol for a dynamic picker (though NBA's 30-team list is static, so the probe pattern is a nice-to-have here, not a hard requirement like it was for screensaver enumeration). SDK/build scaffold (`@elgato/streamdeck`, Rollup, vanilla-JS PI) carries over wholesale. **Deducted for:** live third-party API integration (net new — neither existing plugin talks to an external HTTP API), per-key dynamic image rendering showing live scores/team colors (net new — screensaver-cycler only ever sets static preview images, never composites live text/data onto a key face), and caching/staleness/offline-fallback logic (net new). These three items are the bulk of the actual engineering effort. |
| Risk | 6 / 10 | No game-anti-cheat exposure (read-only data display, zero game input) — a meaningful plus versus the profile products in this registry. Two real deductions: (1) sole viable free data source is an **unofficial, ToS-less** ESPN endpoint that could change or rate-limit without notice (platform-dependency risk); (2) NBA is a litigious trademark holder for logos specifically, which forces a real design constraint (no team logos on keys — see Risk section below). Both are manageable with documented mitigations, neither is a game-IP-anti-cheat-style hard blocker, so this clears the "under 4 needs sign-off" bar without needing it. |
| **Total** | **63.9 / 100** | **Verdict: LEAN-GO** |

### LEAN-GO — exact conditions to flip to GO (need +6.1 pts)

Either of these closes the gap:

1. **Build fit 8 → 11+ (+3):** Before building, extract a small reusable "dynamic key-image renderer" (canvas/PNG compositing helper for text+color-swatch key faces) as shared infra (e.g. a new `plugins/_shared/` module, mirroring how `_shared/marketing_engine.py` is shared across the profile side). That converts this plugin's single biggest new-work item into reusable scaffold for any future data-display plugin, which is exactly the kind of leverage this factory optimizes for.
2. **Risk 6 → 9+ (+3):** Do a deeper, citation-backed dive specifically on ESPN's hidden API's enforcement history (not just "no ToS exists" — actual precedent of it being cracked down on for small non-commercial-scale consumers) and on nominative-fair-use precedent for *paid* apps displaying team names/scores without logos (the research below found general legal guidance and one free-widget precedent, but no paid-app-specific case law). If that comes back clean, risk should score higher than the conservative 6 given here.

Either alone would clear 70. Both together would put this solidly in GO territory. Given this is a paid product with a live external dependency and a real (if manageable) IP-adjacent constraint, recommend doing at least #2 before committing build time, per CLAUDE.md's "surface tradeoffs, don't hide confusion" guidance — the risk score here is a judgment call, not a hard number.

---

## Recommended Listing Name

**NBA Tracker** (11 chars, well under the 30-char cap, exact-search-term style matching how buyers will actually search).

## Pricing Recommendation

| Comp | Type | Price | Notes |
|---|---|---|---|
| Live MLB Scores (ThatSportsGamer) | Stream Deck plugin | Not published on scraped page (price renders client-side / behind purchase flow) | Closest direct comp: same category (live auto-fetching sports score plugin), same publisher scale (indie), actively maintained. |
| Live Score Plugin (Live Score GmbH) | Stream Deck plugin | Not published | Different use case (manual scoreboard control for broadcasters), weak price anchor. |
| Basketball Scores (Corsair) | iCUE/Xeneon widget | Free | Different platform; confirms demand, not price. Bundled with Corsair hardware, not a standalone sale — not a usable price anchor. |
| Screensaver Scheduler (Packrat, this factory) | Stream Deck plugin | $7.99 | Best internal comp: same architecture class (background poller + persistent config + settings UI), same publisher, known-working price point in this exact marketplace slot. |

**Recommendation: $6.99.** Slightly under the internal Screensaver Scheduler anchor ($7.99) because (a) monetization scored low (6/20) in an unproven niche with zero direct price comps, and (b) the unofficial-API dependency is a real reliability question a buyer may reasonably price-discount for until the product has a review history. Revisit toward $7.99-8.99 after the first 90 days if reviews/refund rate hold up and API reliability proves out.

## Device SKU Plan

Plugins in this factory ship as one package that works on any Stream Deck device/size (std, mini, XL, Plus) — no separate device SKUs the way profiles need (`registry.json`'s `variants` field is empty `{}` for both existing plugins). The only real axis is **OS**:

- **Windows: yes.** No blockers.
- **macOS: yes, recommended from day one.** Unlike `screensaver-cycler` (Windows-only because it shells out to `reg.exe` to change the active `.scr` screensaver — a genuinely Windows-only native mechanism), NBA Tracker is pure network polling (HTTP fetch to ESPN's API) plus canvas-based key rendering. Nothing in this plugin's core mechanism is OS-specific, so there is no technical reason to defer Mac the way screensaver-cycler did. Build and ship cross-platform in v1.

## Top 5 Keywords

1. `nba tracker`
2. `nba scores`
3. `nba live scores`
4. `basketball scores`
5. `nba stream deck`

## Risk Flags

- `sports-ip:nba` — team names/scores displayed without official NBA license; logos excluded by design (see Risk section).
- `platform-risk:unofficial-espn-api` — sole free data source has no published ToS, no SLA, no rate-limit guarantee; can change or vanish without notice.

---

## Overview

NBA Tracker is a Stream Deck plugin that surfaces live NBA scores, standings, and next-game info directly on physical keys, with a Property-Inspector settings UI to pick favorite team(s). It is the sports-data equivalent of what Screensaver Scheduler already proved works in this factory: a background-polling plugin with a persistent config store, sold as a standalone paid utility rather than bundled into a profile.

## Market Demand

Direct NBA-on-Stream-Deck query data does not exist in the scraped dataset (`tools/opportunity.py` matched only generic "tracker"/"scores" terms). Corroborating signal comes from adjacent, verified-live products:

- Corsair's free **Basketball Scores** iCUE widget (Xeneon Edge, 435 downloads, actively updated as recently as May 2026) — proves buyers in this exact hardware-peripheral ecosystem want glanceable live NBA scores on a secondary display, even when it's a free bundled feature rather than something they sought out and paid for.
- ThatSportsGamer's **Live MLB Scores** Stream Deck plugin — proves the *category* (auto-fetching live sports scores, delivered as a paid-adjacent Stream Deck plugin, actively maintained with releases as recent as July 28, 2026) has enough demand to justify ongoing indie development effort on this exact platform.
- NBA fan engagement context: this validation lands mid-2026 NBA offseason (free agency opened July 6, 2026; Summer League runs July 9-19 in Las Vegas), following a headline trade (Giannis Antetokounmpo to Miami). Offseason is lower urgency for a live-score tracker than in-season, but the trade news and Summer League both keep the fanbase engaged going into the fall — a launch timed for the regular-season start (typically mid-October) would hit peak relevant demand.

Net: real but indirect and unquantified demand. This is why the deterministic Demand score (18.9/30) was left as-is rather than adjusted upward — the corroboration is directional, not a query-volume number.

## Competitor Analysis

Live-checked the Elgato Marketplace directly (not just the stale scrape):

- **Search for "NBA" on marketplace.elgato.com returns zero results.** Confirmed gap.
- **Live MLB Scores** (ThatSportsGamer) — closest true analog: automatic live score display, plugin architecture, actively maintained (updated same week as this research). No NBA sibling product found from this publisher despite an obvious opportunity for them too, which is itself a signal nobody has claimed this yet.
- **Live Score Plugin** (Live Score GmbH) — different job entirely: lets a streamer manually operate/broadcast their own scoreboard (for a game they're commentating), not auto-fetch professional league scores. Not a real competitor for this use case.
- **Basketball Scores** (Corsair) — confirmed via live fetch to be an **iCUE Widget for the Xeneon Edge display**, filed under Corsair's own marketplace taxonomy (`iCUE > Widgets`), not a Stream Deck plugin. Different SDK, different device, different marketplace. It proves the demand pattern exists but does not compete for the same purchase.
- No open-source or GitHub Stream Deck NBA plugin found either (the one general "streamdeck-livescores" GitHub project found is sport-agnostic and DIY/self-hosted, not a packaged product).

Conclusion: the Elgato Marketplace has a confirmed, real, live-verified gap for NBA specifically. The nearest playbook to copy is ThatSportsGamer's MLB plugin's positioning, not any direct NBA competitor.

## API Recommendation

**Use ESPN's undocumented public API as the primary data source, with `balldontlie.io` evaluated as a v2 supplemental/fallback for stats-heavy features.**

| Option | Verdict | Why |
|---|---|---|
| **ESPN hidden API** (`site.api.espn.com/apis/site/v2/sports/basketball/nba/...`) | **Primary, v1** | Free, no auth/key required, returns the same clean JSON ESPN's own site/app use. Confirmed endpoints: `/scoreboard` (today's games + live status), `/teams` (roster of 30 teams + colors/abbreviations), `/teams/{id}` and `/teams/{id}/schedule` (next-game lookup), and standings at the differently-rooted `/apis/v2/sports/basketball/nba/standings`. Community consensus (multiple 2025-2026 dev writeups, an actively-maintained open-source doc project) is that these endpoints have been stable "for years" despite zero official backing, and no evidence of ESPN sending cease-and-desists or hard-blocking small consumers was found in this research — the known failure mode is silent breakage/format changes, not legal action. **No official ToS exists at all**, which is the real risk (see Risk section), not reliability in practice. |
| `balldontlie.io` | **Supplemental only, later version** | Free tier is capped at 5 requests/minute and, critically, **stats endpoints require a paid tier** ($9.99/mo+) — teams/players/games are free, live box-score stats are not. Too rate-limited and feature-gated to be the primary live-polling source for a $6.99 one-time-purchase plugin (recurring API cost would eat the margin). Worth revisiting for a v2 "career stats" feature if a paid API tier is justified. |
| NBA Stats API (stats.nba.com) | **Rejected** | Aggressive bot/scraper detection (custom headers, frequent blocking), far less developer-friendly than ESPN's endpoints for a small polling plugin; the extra fragility isn't worth it for what's a data source, not a differentiator. |
| SportsDataIO | **Rejected for v1** | Paid, subscription-based — turns a one-time-purchase plugin into a plugin with ongoing operating cost per install, which doesn't fit this factory's pricing model (compare: none of the existing profiles/plugins carry a recurring backend cost). Reconsider only if ESPN's endpoint proves unreliable in practice post-launch. |

**Mitigation for the "no ToS" risk:** cache aggressively (see Technical Notes), fail soft to last-known-good data with a visible "stale" indicator rather than erroring, and structure the API-calling code behind a thin adapter so swapping to balldontlie or another source later is a contained change, not a rewrite.

## Technical Notes

Architecture directly extends the pattern in `plugins/screensaver-cycler/src/scheduler.ts` and `src/pi.ts`:

- **Background polling:** one global `setInterval` ticker in the plugin process (not per-action timers — `scheduler.ts`'s comment block explains exactly why: a per-key timer pauses when the user switches Stream Deck pages, which would silently stop score updates on Stream Deck's own multi-page UI). Recommended cadence: 30-60s during live games (games update roughly every possession, but sub-30s polling of an unofficial API risks the "excessive requests may be blocked" warning ESPN's own community docs flag), 5-10 min when no favorite team has a game in progress, and near-zero (once per app launch) in the off-season. This tiered cadence is a straightforward extension of `scheduler.ts`'s existing `cy.intervalMin` pattern.
- **Config store:** favorite team(s), refresh cadence, and last-known-good cached score data all live in `streamDeck.settings` (global settings), exactly like `GlobalConfig` in `scheduler.ts`. This also gives free persistence across plugin restarts for the offline fallback below.
- **Team picker UI:** ESPN's `/teams` endpoint returns a static list of 30 teams that barely ever changes — this can ship as a hardcoded JSON list in the plugin bundle (simpler than screensaver-cycler's filesystem-enumeration problem, which had no choice but to probe live). The PI-probe protocol from `src/pi.ts` (`{ probe: "list" } -> { screensavers: [...] }`) is still the right shape to reuse if the list is ever fetched live instead of bundled, or for a "your favorite team's next 5 games" sub-picker.
- **Dynamic key images (the new part):** each key showing a live score needs a rendered PNG (team abbreviation, colors, score, game clock/status) pushed via `action.setImage()`. Neither existing plugin does this today — `screensaver-cycler` only ever sets static bundled preview images. This needs a small canvas-compositing helper (Node `canvas` package or SVG-to-PNG) that draws team-color background + text, not logos (see Risk).
- **Caching / offline fallback:** persist last successful API response per tracked team in settings; on fetch failure, keep showing the last-known score with a small "stale"/timestamp indicator rather than blanking the key or throwing an error state. This is the standard mitigation for depending on an unofficial, ToS-less API.
- **Error handling:** wrap every fetch in try/catch mirroring `scheduler.ts`'s `applySafe()` pattern (log via `streamDeck.logger`, never let a failed poll crash the ticker or the whole plugin).

## Feature List (v1)

- Live scoreboard: today's score for one or more favorite teams, auto-refreshing.
- Next-game info: date/time/opponent when the favorite team has no game today.
- Standings glance: conference/division rank for the favorite team.
- Favorite-team picker in the Property Inspector (static bundled team list, no live probe needed for v1).
- Offline/stale-data fallback with a visible "last updated" indicator.

## Premium Features (paid-tier justification, realistically buildable from ESPN's free endpoints)

- Multi-team tracking (favorite + rivals) on separate keys.
- Live game alerts (score-change or game-start push, polled via the background ticker — no push infra needed, just a state-diff check each tick).
- Next-game countdown key.
- Full standings key (division/conference table view, paged).
- **Not promised:** player-level stats/box scores (would require `balldontlie`'s paid tier or NBA Stats API's fragile scraping — defer to a v2 evaluation, don't oversell in v1 listing copy).

## UI Ideas

- Button layout: one key = one team's live score (abbreviation + colored background + score + period/clock), following the house rule of never lighting all 15 slots — ship as a partly-lit favorites row with idle-glow empty keys around it, consistent with existing marketing conventions.
- Next-game key: countdown or opponent/date when no game is live.
- Standings key: cycles through favorite team's division on repeated taps.
- Later potential: Stream Deck+ / Neo dial or dashboard-LCD-widget treatment for a scrolling live ticker, once the core plugin is proven — not v1 scope, just a roadmap note since the newer Stream Deck hardware line supports richer dashboard widgets than a static key grid.

## Marketplace Positioning

"See live NBA scores without alt-tabbing" — same benefit-first framing this factory already uses ("NO MORE ALT-TABBING" house rule), applied to sports instead of comms/OBS. Position against the *absence* of a direct competitor rather than against a rival product, since none exists on this marketplace today; reference the proven MLB-plugin category to reassure buyers this pattern already works elsewhere on their exact device.

## Confidence Score

**Medium.** High confidence on the competitive gap (live-verified, not just scraped) and on the technical path (ESPN's endpoints are well-documented by the community and directly compatible with Node/TypeScript fetch). Lower confidence on true NBA-specific demand size (no query data, only adjacent-product corroboration) and on long-run API stability (no ToS is a real unknown, not just a formality).

## Build Recommendation

**Build, but only after resolving the two flip conditions above** — specifically, do the deeper ESPN-enforcement-history and paid-app-nominative-fair-use research before writing code, since Risk is the more load-bearing of the two open questions (Build fit's deduction is just "this will take real engineering time," which is a planning fact, not a blocker; Risk's deduction is "there's a real unknown about the data source and the trademark boundary," which is worth nailing down before committing to a paid listing).

## Implementation Plan

1. Confirm ESPN endpoint risk/stability with the deeper dive noted in the flip conditions → verify: written risk note added to this file or a follow-up doc, sign-off if it stays under score 8.
2. Scaffold plugin from `plugins/screensaver-cycler` structure (Rollup + `@elgato/streamdeck` + vanilla-JS PI), rename to `com.packrat.nba-tracker` → verify: `streamdeck validate` passes on an empty scaffold.
3. Build ESPN API adapter module (scoreboard/teams/standings/schedule) with caching + stale-fallback → verify: unit test hitting live endpoint returns today's games; simulate a fetch failure and confirm last-known-good is served.
4. Build dynamic key-image renderer (team color + abbreviation + score, no logos) → verify: rendered PNG visually matches team colors for a sample of 5 teams.
5. Build favorite-team PI settings UI (static team list dropdown) → verify: selecting a team persists to global settings and the key updates on next poll.
6. Wire background ticker with tiered cadence (live/idle/offseason) → verify: manually confirm interval changes based on whether a tracked team has a live game.
7. Run through `python tools/qa/qa_gate.py nba-tracker` before any submission, per house rules.

## Roadmap

- **v2:** live game start/score-change alerts, standings key, next-game countdown key (all listed as v1 premium features above — genuinely v1-buildable, listed here only if v1 ships as a smaller MVP first).
- **v3:** evaluate a paid stats API tier (`balldontlie` All-Star tier or similar) for box-score/player-stat features if v1-v2 sales justify the recurring cost; evaluate Stream Deck dashboard-LCD-widget format for a richer live-ticker view as that hardware surface matures.

---

## Proposed registry.json Entry

```json
"nba-tracker": {
  "name": "NBA Tracker",
  "type": "plugin",
  "price_usd": 6.99,
  "status": "validated",
  "version": "0.1.0.0",
  "marketplace_slug": null,
  "uuid": "com.packrat.nba-tracker",
  "variants": {},
  "required_variants": [],
  "paths": {
    "dir": "plugins/nba-tracker",
    "package": "plugins/nba-tracker/marketing/com.packrat.nba-tracker.streamDeckPlugin",
    "marketing": "plugins/nba-tracker/marketing"
  },
  "keywords": ["nba tracker", "nba scores", "nba live scores", "basketball scores", "nba stream deck"],
  "risk_flags": ["sports-ip:nba", "platform-risk:unofficial-espn-api"],
  "notes": "LEAN-GO 63.9/100 (see profiles/nba-tracker/VALIDATION.md). Live-verified marketplace gap: zero NBA results on marketplace.elgato.com as of 2026-07-28; nearest comps are ThatSportsGamer's Live MLB Scores plugin (same category, different sport) and Corsair's free Basketball Scores iCUE widget (proves demand, different platform/device, not a real competitor). Cross-platform Win+Mac from v1 (pure network polling, no native OS hooks, unlike screensaver-cycler). Data source: ESPN's unofficial site.api.espn.com endpoints, no ToS/SLA -- requires caching + stale-data fallback. Design constraint: team colors/abbreviations only, no official team logos on keys (NBA trademark risk). Flip-to-GO conditions: extract a reusable dynamic-key-image-renderer as shared infra (+3 build fit), or deepen the ESPN-enforcement-history / paid-app-fair-use research (+3 risk) -- do the risk research before writing code."
}
```
