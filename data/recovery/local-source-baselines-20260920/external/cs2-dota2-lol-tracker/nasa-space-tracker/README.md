# NASA Space Tracker

Bring space to your Stream Deck: know when the ISS is overhead, count down to the next rocket
launch, and see NASA's Astronomy Picture of the Day. All data comes from free public APIs.

## Actions
| Action | What it shows |
| --- | --- |
| **ISS Overhead** | ISS altitude and distance from your home; pulses white + "OVERHEAD" when it's within range. |
| **Next Launch** | Live T-minus countdown to the next orbital launch (mission + rocket). Press to cycle the next three. |
| **Picture of the Day** | NASA's APOD, cover-cropped onto the key, refreshed each morning. Press to open it full size. |

## Install
Double-click `distribution/nasa-space-tracker.streamDeckPlugin`, or in a dev checkout:

```bash
npm install
npm run build
streamdeck link com.ratpack.nasaspacetracker.sdPlugin
streamdeck restart com.ratpack.nasaspacetracker
```

## Setup
- **ISS Overhead:** open the property inspector and enter your **home latitude/longitude**
  (find them at latlong.net). Optionally tweak the overhead range (default 1000 km).
- **Picture of the Day:** works with the built-in `DEMO_KEY`, but it's heavily rate-limited.
  Grab a free key at [api.nasa.gov](https://api.nasa.gov) and paste it into the APOD inspector.
- **Next Launch:** nothing to configure.

## Data sources
- ISS position — `api.wheretheiss.at` (polled every 10s)
- Launches — Launch Library 2, `ll.thespacedevs.com` (fetched hourly; the anonymous tier is
  rate-limited, so the plugin caches and the countdown ticks locally)
- APOD — `api.nasa.gov/planetary/apod`

## Test / verify connectivity (harness)
```bash
node scripts/mock-nasa.mjs
```
This checks all three APIs and prints the ISS's **current coordinates** — paste those into the
ISS action's Home Lat/Lon to trigger the OVERHEAD pulse right away instead of waiting for a pass.

> APOD's `DEMO_KEY` sometimes returns 503/429 when busy. The button falls back to a title card
> and retries; a free key avoids this.
