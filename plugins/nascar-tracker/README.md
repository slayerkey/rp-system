# NASCAR Tracker

A Stream Deck plugin that keeps race day on your deck. The next race, the running order, and the championship table, without leaving what you are doing.

Not affiliated with, endorsed by, or sponsored by NASCAR, any team, or any driver. Driver names are used to identify the field.

---

## Actions

### Next Race
The next race and a countdown once it is close. On race day it shows the race status instead.

### Race Field
The running order, one driver at a time. Press for the next position. Before the green flag there is
no field yet, and the key says so rather than showing nothing.

### Driver Standings
The championship table, one driver at a time with points, leader first. Press to walk down the
order.

## When the connection drops

Data comes from a public feed that can go quiet without warning. When a refresh fails the key keeps
showing the last thing it got and draws an amber bar along the bottom edge, so nothing stale passes
for current.

## What it never shows

Names and text only. No photos, no promotion or team marks, no liveries.

---

## Development

Shared code lives in [`../_shared`](../_shared). This plugin is the sport specific part: the event
parser choice, the manifest, and the action subclasses. There is no team table, because this sport
has no teams.

```
npm install
npm run build
npm test
npx streamdeck validate com.packrat.nascar-tracker.sdPlugin
python scripts/gen-icons.py
```
