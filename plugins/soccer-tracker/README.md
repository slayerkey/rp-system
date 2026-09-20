# Soccer Tracker

A Stream Deck plugin that keeps the match on your deck. Pick your team, and the key shows the live
score while the game is on, a countdown to the next one when it is not, and where the team sits in
the table.

Not affiliated with, endorsed by, or sponsored by any league or club or any team. Team names, abbreviations
and colors are used to identify the teams whose scores you chose to follow.

---

## Actions

### Team Score
One key, one team. Both abbreviations, both scores, and the game clock while it is running,
refreshing about every 45 seconds. When there is no game it counts down to the next one and shows
who it is against. A green frame flashes when your team scores or the game starts. Press to refresh,
or set the key to open the game page instead. Drop it on as many keys as you follow teams.

### Standings
Rank, record, points, and current run of form. Press the key to swap between the table table and
its competition.

### League Scoreboard
Every game playing today on one key, live ones first, then upcoming, then finals. Press for the next
game. Nothing to configure.

## When the connection drops

Scores come from a public feed that can go quiet without warning. When a refresh fails the key keeps
showing the last score it got, draws an amber bar along the bottom edge and prints how old the data
is, so a stale number never passes for a live one.

## What it never shows

Team colors and abbreviations only. No logos, crests, or wordmarks anywhere in the product.

---

## Development

Shared code lives in [`../_shared`](../_shared): the data client, the poller, the key renderer and
all three actions are common to every Packrat sport tracker. This plugin is the sport specific part:
the club table across nine competitions, the manifest, and three one-line subclasses.

```
npm install            # once
npm run build          # rollup -> com.packrat.soccer-tracker.sdPlugin/bin/plugin.js
npm test               # runs the shared test suite in ../_shared
npx streamdeck validate com.packrat.soccer-tracker.sdPlugin
python ../_shared/scripts/gen_teams.py soccer-tracker soccer any league or club
python scripts/gen-icons.py
```
