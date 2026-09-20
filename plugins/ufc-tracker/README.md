# UFC Tracker

A Stream Deck plugin that keeps fight night on your deck. The next card, who is fighting, and how the night is going, without leaving what you are doing.

Not affiliated with, endorsed by, or sponsored by UFC, any promotion, or any fighter. Fighter names are used to identify the bouts on the card.

---

## Actions

### Next Event
The next card, its main event, and a countdown once it is close. While the card is running it shows
how far along the night is. Press to refresh, or set it to open the card's page.

### Fight Card
Every bout on the card, one at a time, main event first. Press for the next bout. Once a bout is
settled the key shows who won.

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
npx streamdeck validate com.packrat.ufc-tracker.sdPlugin
python scripts/gen-icons.py
```
