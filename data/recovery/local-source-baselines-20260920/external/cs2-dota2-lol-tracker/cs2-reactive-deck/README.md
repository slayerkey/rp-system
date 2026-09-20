# CS2 Reactive Deck

Stream Deck buttons that react in real time to **Counter-Strike 2** using the game's
**Game State Integration (GSI)** protocol. No external service, no API key — CS2 pushes
state straight to a local listener inside the plugin.

## Actions
| Action | What it shows |
| --- | --- |
| **Health Monitor** | Current HP. Green > 80, yellow 50–80, red < 50, flashing red below 20. |
| **Ammo Counter** | Active weapon clip / reserve with a fill bar. Pulses orange when the clip is empty. |
| **Kill Feed** | Flashes bright green on every kill, tallies kills this round. Press to reset. |
| **Round Phase** | Freezetime = blue, live = green, bomb planted = pulsing orange, round over = grey. |

All colours and thresholds are configurable in each action's property inspector.

## Install (from the packaged plugin)
Double-click `distribution/cs2-reactive-deck.streamDeckPlugin`, or in a dev checkout:

```bash
npm install
npm run build
streamdeck link com.ratpack.cs2reactivedeck.sdPlugin
streamdeck restart com.ratpack.cs2reactivedeck
```

## Enable Game State Integration in CS2 (one-time)
1. Copy `com.ratpack.cs2reactivedeck.sdPlugin/gamestate_integration_ratpack_cs2.cfg` into your CS2 cfg folder:
   ```
   ...\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\
   ```
   (Right-click CS2 in Steam → Manage → Browse local files to find it.)
2. The file points at `http://127.0.0.1:3000`. If you change the **GSI Port** in the
   property inspector, edit the `uri` line to match.
3. Restart CS2 (or start a match). Buttons go live as soon as you're in-game.

## Test without the game (mock harness)
```bash
node scripts/mock-cs2.mjs        # feeds a scripted round to port 3000
node scripts/mock-cs2.mjs 3001   # custom port
```
Watch HP fall, the clip empty and pulse, kills flash, and the phase cycle into a bomb plant.

## Notes
- GSI reports the **local player** (you, or whoever you're spectating). It does not expose
  enemy data — by design, this is anti-cheat-safe and uses only Valve's official integration.
- `setImage` can't animate GIFs, so flashes/pulses are rendered by toggling SVG frames on a timer.
