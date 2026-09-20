# LoL Live Companion

Stream Deck buttons driven by the **League of Legends Live Client Data API** — the data feed
the game serves locally at `https://127.0.0.1:2999` during a match. **No API key, no login,
nothing leaves your PC.**

## Actions
| Action | What it shows |
| --- | --- |
| **Gold Tracker** | Live gold; flashes gold-yellow whenever it increases. |
| **Health Display** | Champion HP percentage, colour shifting green → yellow → red, with a bar. |
| **Item Afford Alert** | Set an item cost; shows progress and glows green when you can afford it. |
| **KDA Display** | Live colour-coded kills / deaths / assists and creep score. |

When you're not in a game, every button shows a calm "NOT IN GAME" idle state.

## Install
Double-click `distribution/lol-live-companion.streamDeckPlugin`, or in a dev checkout:

```bash
npm install
npm run build
streamdeck link com.ratpack.lollivecompanion.sdPlugin
streamdeck restart com.ratpack.lollivecompanion
```

## How it works
The plugin polls `https://127.0.0.1:2999/liveclientdata/allgamedata` every 2 seconds while a
game is running. The League client serves this over a **self-signed certificate**, so the
plugin disables TLS verification *for that localhost endpoint only*. There is **nothing to
configure** — start a game (including Practice Tool) and the buttons come alive.

For the Item Afford Alert, open its property inspector and enter the item's name and gold cost.

## Test without the game (mock harness)
```bash
node scripts/mock-lol.mjs   # serves a fake, evolving match on https://127.0.0.1:2999
```
Gold climbs (with kill-spikes), HP oscillates, and KDA grows so you can watch every button
react. Stop the script (Ctrl+C) to see the idle state. The mock uses a throwaway self-signed
cert — exactly the situation the plugin already handles.

> Note: close the mock before launching real League (both want port 2999).
