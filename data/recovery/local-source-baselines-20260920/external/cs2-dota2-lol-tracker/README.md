# Ratpack Stream Deck Plugins

Five independent, Marketplace-ready Elgato Stream Deck plugins, each its own product with its
own theme, built on the Stream Deck SDK v2 (TypeScript / Node 24). Publisher UUID prefix
`com.ratpack.*`.

| Plugin | What it does | Data source | Suggested price |
| --- | --- | --- | --- |
| [CS2 Reactive Deck](cs2-reactive-deck/) | HP, ammo, kills, round phase | Counter-Strike 2 GSI (local) | $4.99 |
| [Dota 2 Reactive Deck](dota2-reactive-deck/) | Hero HP/mana, gold, Roshan timer, KDA | Dota 2 GSI (local) | $4.99 |
| [LoL Live Companion](lol-live-companion/) | Gold, health, item-afford alert, KDA | Riot Live Client Data API (local) | $3.99 |
| [NASA Space Tracker](nasa-space-tracker/) | ISS overhead, launch countdown, APOD | Public NASA / space APIs | $4.99 |
| [Event Countdown](event-countdown/) | Per-key countdowns to any date | None (local date math) | $2.99 |

## Repository layout
```
cs2-reactive-deck/ … event-countdown/   # one folder per plugin (src, *.sdPlugin, scripts, docs)
distribution/                            # 5 packaged *.streamDeckPlugin files (ready to publish)
thumbnails/<plugin>/                     # marketing art per plugin: banners + preview.gif + preview.mp4
tools/                                   # shared dev tooling (icon + marketing generators)
```

Each plugin folder contains its compiled `com.ratpack.*.sdPlugin/`, TypeScript `src/`, a
`docs/marketplace-listing.md`, a `scripts/` folder with a **mock harness** and the
**marketing generator**, and its own README with game-specific setup.

## Install a plugin
Double-click the matching file in [`distribution/`](distribution/) — Stream Deck installs it.
Or, from a plugin folder during development:
```bash
npm install
npm run build
streamdeck link com.ratpack.<name>.sdPlugin
streamdeck restart com.ratpack.<name>
```

## Try them without the games (mock harnesses)
Every plugin ships a harness so you can see the buttons react without launching anything:
```bash
node cs2-reactive-deck/scripts/mock-cs2.mjs          # scripted CS2 round
node dota2-reactive-deck/scripts/mock-dota2.mjs      # scripted Dota match
node lol-live-companion/scripts/mock-lol.mjs         # fake League Live Client on :2999
node nasa-space-tracker/scripts/mock-nasa.mjs        # checks live APIs + prints ISS coords
node event-countdown/scripts/mock-countdown.mjs      # prints dates for each countdown state
```

## How the buttons are drawn
All dynamic key images are **SVG strings** handed to `setImage` (no native canvas dependency).
Because `setImage` can't animate GIFs, every flash / pulse / glow is rendered by toggling
between SVG frames on a timer (the shared `Pulse` helper), and updates stay within the SDK's
~10/sec budget. NASA's APOD is the one exception — it cover-crops the daily photo to a raster
with **jimp** (pure JS, so it still bundles cleanly).

## Per-game / per-service setup (summary — see each plugin's README)
- **CS2 / Dota 2:** drop the included `gamestate_integration_*.cfg` into the game's cfg folder.
  Dota also needs the `-gamestateintegration` launch option. The **Roshan timer is
  press-to-start** (player GSI can't see Roshan's death).
- **LoL:** nothing to configure — it reads the client's local API during a game. No key.
- **NASA:** set your home lat/lon for the ISS action; optionally add a free `api.nasa.gov`
  key for APOD (works on `DEMO_KEY` otherwise).
- **Event Countdown:** set a name, date/time, and detail level per key. No internet.

## Regenerating assets (dev)
```bash
python tools/gen_icons.py                    # all plugin icons (action/category/marketplace)
python <plugin>/scripts/gen-marketing.py     # that plugin's banners + gif + mp4 -> thumbnails/
```

## Publishing to the Elgato Marketplace
Each `distribution/*.streamDeckPlugin` is the artifact to upload via the Elgato Maker portal.
Use the matching `thumbnails/<plugin>/` images (1920×960 banners) and `preview.mp4`
(1920×1080, H.264) as the listing media, and `docs/marketplace-listing.md` for the copy.

## Status
All five plugins build, pass `streamdeck validate`, and are packaged in `distribution/`.
Live in-game behaviour (CS2/Dota/LoL reacting to real matches) is best confirmed with the
mock harnesses here, then with the actual games on your own machine.
