# plugins/_shared

The common core for every Packrat sport tracker. Built once for NBA Tracker so the nine sports
after it are a data adapter plus a manifest, not another plugin from scratch.

Not a package and not published: consuming plugins import the TypeScript **source** by relative
path and bundle it into their own `bin/plugin.js`. Same idea as `../../_shared/marketing_engine.py`
on the profile side.

## What is in here

| File | What it does |
|---|---|
| `src/espn.ts` | ESPN client and parsers. A league is two path segments, so NFL is `createEspnClient({ sport: "football", league: "nfl" })`. Every call resolves to `null` on failure instead of throwing. Also holds `rankWithin`, used to build a division table ESPN does not publish. |
| `src/cache.ts` | Last known good store over Stream Deck's global settings. Survives a plugin restart, which is what makes the offline fallback work on a cold start. |
| `src/poller.ts` | The single background ticker, with the live / soon / idle cadence tiers and the staleness rule. Pure functions plus one `setInterval`; no SDK import, so the cadence rules are directly testable. |
| `src/badge.ts` | Key faces as SVG strings for `setImage()`. No canvas, no native binaries, identical on Windows and macOS. Team colour plus abbreviation only. |
| `src/view.ts` | What a key should say given cached data: next game, start-time lines, countdown, cache age, board order, conference or division placement. |
| `src/event.ts` | The other model: sports whose unit is an event with a field. Fight cards, race grids, championship tables. |
| `src/actions/` | The actions themselves, as base classes. Team sports get `team-score`, `standings` and `scoreboard`; event sports get `event` (next event, card) and `rankings`. A tracker subclasses them with nothing but its own action UUID. |
| `src/sport.ts` | The per-plugin config: league, team table, data model, and whether the table is flat (soccer) or has conferences and divisions. |
| `src/pi-protocol.ts` | The `{ probe: "teams" }` request the property inspector sends to get the team list out of the plugin bundle. |
| `test-fixtures/` | Recorded ESPN payloads per sport: teams, standings at `level=3`, a scoreboard in each of the three game states, a UFC card and a completed NASCAR race. `nba-scoreboard-in.json` is synthetic, derived from the final-score fixture, because ESPN has no live game to capture during the offseason. |

## Working on it

```
npm install
npm test          # offline, fixture driven
npm run typecheck
npm run probe     # hits the real ESPN endpoints and prints the parsed result
npm run probe football nfl
npx tsx scripts/render-samples.ts out   # writes one SVG per key face to eyeball the layout
```

`npm run probe` is the tool to reach for when a tracker starts behaving oddly. If the raw fetch
returns rows but the parsed output is empty, ESPN changed a field name and the parser needs the
fix, not the network.

## Adding the next sport

```
python plugins/_shared/scripts/new_tracker.py mlb-tracker "MLB Tracker" baseball mlb --glyph ball-baseball --league-name "MLB"
python plugins/_shared/scripts/gen_teams.py mlb-tracker baseball mlb
python plugins/mlb-tracker/scripts/gen-icons.py
cd plugins/mlb-tracker && npm install && npm run build && npx streamdeck validate com.packrat.mlb-tracker.sdPlugin
```

That covers any sport shaped like a game between two teams. For an event sport (a card, a race
weekend), skip `gen_teams` and set `model: "fights"` or `model: "race"` in the `configureSport` call,
then subclass `NextEventBase` / `EventCardBase` / `RankingsBase` instead. `plugins/ufc-tracker` and
`plugins/nascar-tracker` are the two worked examples. F1 belongs on the race model, not the team one.

Whatever the scaffolder does not do:

1. Check the UUID, the `.sdPlugin` folder and the manifest actions match the sport.
2. Keep both load-bearing bits of `rollup.config.mjs`: the typescript plugin's `include` must
   cover `../_shared/src`, and `nodeResolve`'s `dedupe` must list the Elgato packages. This
   directory has its own `node_modules` for its tests, so without the dedupe the bundle gets two
   copies of the SDK, and every settings call made from shared code hangs with no error at all.
3. Send every badge through `keyImage()` before `setImage()`. Stream Deck wants a base64 data
   URI; raw SVG markup is accepted by the call and then silently never renders, so the key sits
   there showing its manifest icon as if nothing is wrong. A plain-text data URI fails the same
   way, because every colour in a badge starts with `#` and a URI parser treats that as a fragment.
4. Point `createEspnClient` at the new sport and league, record fresh fixtures, and regenerate
   the team table.
5. The design constraint is the same for all of them: colours and abbreviations only, never
   logos, crests, liveries or photos, and a non-affiliation line in the listing and the settings
   panel.
