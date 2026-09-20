# NBA Tracker

A Stream Deck plugin that keeps the score on your deck. Pick your team, and the key shows the
live score while the game is on, the next matchup when it is not, and where the team sits in
the standings.

Not affiliated with, endorsed by, or sponsored by the NBA or any team. Team names, abbreviations
and colors are used to identify the teams whose scores you chose to follow.

---

## Why this exists

Checking a score means alt-tabbing out of a game or a stream, which is the one thing you do not
want to do mid-match. The Elgato Marketplace had nothing that fetched NBA scores on its own:
searching "NBA" returned zero results when this was validated. So this does it.

## Actions

### Team Score

One key, one team. While the game is running the key shows both abbreviations, both scores, and
the quarter and clock, refreshing about every 45 seconds. When there is no game it shows who is
next, home or away, and the tip-off time in your own timezone. Press the key any time to make
it check again.

Drop the action on as many keys as you follow teams.

### Standings

Your team's seed, its record, and how many games back it is. Press the key to swap between the
conference table and its division. It refreshes in the background like the score key.

## When the connection drops

Scores come from a public feed that can go quiet without warning. When a refresh fails the key
keeps showing the last score it got and draws an amber bar along the bottom edge, so a stale
number never passes for a live one. Nothing blanks out and nothing errors on the deck.

## What it never shows

Team colors and abbreviations only. No logos, crests, or wordmarks anywhere in the product,
on keys or in the artwork.

---

## Development

Shared code lives in [`../_shared`](../_shared): the data client, the background poller, and the
key-face renderer are common to every Packrat sport tracker. This plugin is the sport-specific
part: the team table, the two actions, and the manifest.

```
npm install            # once
npm run build          # rollup -> com.packrat.nba-tracker.sdPlugin/bin/plugin.js
npm test               # runs the shared test suite in ../_shared
npm run watch          # rebuild and restart the plugin on change
npx streamdeck validate com.packrat.nba-tracker.sdPlugin
npx streamdeck pack com.packrat.nba-tracker.sdPlugin -o marketing -f
python scripts/gen-icons.py    # action and plugin icons, Tabler glyphs
python scripts/gen-teams.py    # regenerate src/teams.ts from the recorded fixtures
```

Two things in `rollup.config.mjs` are load bearing and easy to break when copying this plugin
for the next sport: the typescript plugin's `include` has to cover `../_shared/src`, and
`nodeResolve`'s `dedupe` has to list the Elgato packages. Without the dedupe, the bundle ends up
with two copies of the SDK and every settings call from shared code hangs with no error.
