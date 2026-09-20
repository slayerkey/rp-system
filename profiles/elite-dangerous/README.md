# Elite Dangerous

Landing gear, scoop, hardpoints, the four panels and your power pips, all on one surface
instead of scattered across the keyboard.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Two are included:
   Stream Deck MK.2 (Windows) and Stream Deck XL (Windows).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey action.
3. One-time binds: none. Every key matches Elite's default keyboard bindings.
4. Page map:
   - **Elite** (home) - landing gear, cargo scoop, hardpoints, lights, silent running,
     frame shift drive, hyperspace, flight assist, boost, heat sink, galaxy map.
   - **Panels & Pips** - the four UI panels and the power distributor.
   - **Target** - target ahead, next ship, highest threat, next subsystem.

Elite must be the focused window when you press a key.

### Elite

| Button | Sends |
|---|---|
| Landing Gear | L |
| Cargo Scoop | Home |
| Hardpoints | U |
| Lights | Insert |
| Silent Run | Delete |
| Frame Shift | J |
| Hyperspace | ' (apostrophe) |
| Flight Assist | Z |
| Boost | Tab |
| Heat Sink | V |
| Galaxy Map | M |

### Panels & Pips

| Button | Sends |
|---|---|
| Nav | 1 |
| Comms | 2 |
| Role | 3 |
| Systems | 4 |
| Pip SYS | Left Arrow |
| Pip ENG | Up Arrow |
| Pip WEP | Right Arrow |
| Balance | Down Arrow |

The pip keys follow the distributor on your HUD: systems on the left, engines up, weapons on
the right, down to balance. Tap a pip key repeatedly the same way you would tap the arrow key.

### Target

Target Ahead `T`, Next Ship `G`, Highest Threat `H`, Next Subsystem `Y`.

### If you fly a custom bind set

Elite players remap heavily, especially with a HOTAS. This profile ships the game's keyboard
defaults. If a key does not match yours, check Options > Controls in game and rebind that one
key in the Stream Deck app. Everything here is a plain single key press.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

**$7.99, repriced down from $13.99 on 2026-08-01.**

A pre-art verification pass found a competitor `VALIDATION.md` never saw, because the
validation counted only Elgato Marketplace listings: **`mhwlng/streamdeck-elite` on GitHub
is free and strictly more capable than this profile.** It reads live game state and
auto-switches profiles on events (hardpoint deploy, SRV entry), and ships 14 state toggles,
power distributor control, FSS, firegroup selection and limpet buttons, plus pre-configured
MK.2, XL and Stream Deck + profiles covering all default binds.

Marketplace comps: 100% paid, median $15.00 x 62 downloads. See `VALIDATION.md`
(75.2/100, LEAN-GO).

## Positioning

**Lead on zero setup.** The free alternative is a developer tool: install a plugin, point it
at the game's journal files, keep it updated against game patches. This is a profile you
double-click once and it works, with nothing running in the background and nothing reading
your game files.

That is the whole pitch, and it is honest. Do not claim live state, telemetry, or
context-switching, because the free option does all three and this does none of them.
Priced accordingly.

Note this repositioning does **not** resolve the separate `demand-trend:declining-playerbase`
flag, which is still unverified.

## Decisions

**Owner risk sign-off obtained 2026-07-31** (`docs/DECISIONS.md`). Frontier's Media Usage
Rules explicitly require advance permission for commercial use of their content, the most
explicit ask-first policy in the batch. Risk scored 3/10, under the rules threshold of 4, so
this could not be built without an explicit yes. It was given. iConCity operates three Elite
listings unimpeded, which is precedent rather than permission. Constraints still apply: no
Frontier or Elite logos, Tabler glyphs only, nominative name use.

**Live demand caution, unresolved.** `demand-trend:declining-playerbase` is real: average
concurrent players are down roughly 70% from the March 2025 peak, and the deterministic
demand score cannot see it because it measures marketplace search popularity, not the live
player base. VALIDATION.md named "player-count decline stabilizes" as a flip-to-GO condition
and that has not been verified. This shipped on the owner's sign-off, not because the
condition was met. Worth re-checking before spending marketing effort here.

**Keybind sourcing.** Two independent sources agree on the core set (kevblog and the
Cheatography sheet): `L` gear, `Home` scoop, `Insert` lights, `U` hardpoints, `Delete` silent
running, `Z` flight assist, `Tab` boost, `J` FSD, `T`/`G`/`H`/`Y` targeting, `V` heat sink,
`M` galaxy map, `'` hyperspace. An early search hit listing "T2/T4/T6" was a joystick button
map, not keyboard, and was discarded. UI panels 1 to 4 and arrow-key pips confirmed separately.

**`INSERT` added to `common.py`.** Ship Lights is the only bind in the roster that needs it.
Added to the `VK` map (45) and `_QT_SPECIAL` (16777222). Deliberately **not** added to the
`MAC` map, because Mac keyboards have no Insert key: `mac_variant()` will now raise a clear
KeyError rather than silently emit a wrong keycode if a future Mac profile tries to use it.
This product is Windows only so the path is never taken. Verified purely additive: rebuilding
the existing profiles produced no manifest or action changes.

**Cut: SRV and on-foot Odyssey controls.** The full Elite control set spans ship, SRV and
on-foot layers. v1 ships the ship layer, which is the largest shared surface and what the
VALIDATION.md scoping call asked for.

**Cut: chaff, shield cell, night vision.** Could not be confirmed to a default key from two
independent sources, so they were left out rather than guessed at.

**XL layout.** 23 content keys, so all three pages fold flat onto one XL screen with no
folders. The MK.2 keeps the three-page split.
