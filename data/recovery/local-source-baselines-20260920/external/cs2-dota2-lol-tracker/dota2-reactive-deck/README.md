# Dota 2 Reactive Deck

Stream Deck buttons that react in real time to **Dota 2** using the game's **Game State
Integration (GSI)** protocol. Runs entirely locally — no API key.

## Actions
| Action | What it shows |
| --- | --- |
| **Hero HP / Mana** | Big HP number (green → yellow → red) with the mana value and a blue mana bar. |
| **Gold Counter** | Live gold; flashes yellow when it jumps (kill or bounty), ignoring passive income. |
| **Roshan Timer** | Manual stopwatch — press when Roshan dies. Glows red at the respawn window, pulses at hard respawn. |
| **KDA** | Live colour-coded kills / deaths / assists. |

## Install
Double-click `distribution/dota2-reactive-deck.streamDeckPlugin`, or in a dev checkout:

```bash
npm install
npm run build
streamdeck link com.ratpack.dota2reactivedeck.sdPlugin
streamdeck restart com.ratpack.dota2reactivedeck
```

## Enable Game State Integration in Dota 2 (one-time)
1. Create the GSI folder if it doesn't exist, then copy the config into it:
   ```
   ...\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\
   ```
   Copy `com.ratpack.dota2reactivedeck.sdPlugin/gamestate_integration_ratpack_dota2.cfg` there.
2. The file points at `http://127.0.0.1:3000/`. If you change the **GSI Port** in the
   property inspector, edit the `uri` line to match.
3. Launch Dota 2 with the launch option `-gamestateintegration` (right-click Dota 2 in Steam →
   Properties → Launch Options). Buttons go live once you're in a match.

## Roshan Timer — how it works (important)
Dota's **player-side** GSI does **not** report Roshan's death, so the timer is a manual
stopwatch by design: **press the key the instant Roshan dies.** It counts up, glows red when
the respawn window opens (default 8 min), and pulses bright red at the hard respawn (11 min).
Press again to reset. Both windows are configurable in the property inspector.

## Test without the game (mock harness)
```bash
node scripts/mock-dota2.mjs        # feeds a scripted match to port 3000
node scripts/mock-dota2.mjs 3001   # custom port
```
Watch HP swing, the mana bar drain, a +260 bounty flash the gold, and KDA tick up. Press the
Roshan key yourself to exercise its states.
