# Satisfactory

Every build tool, every hotbar slot, and your reference sites, on the deck instead of buried
under your left hand.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Two are included:
   Stream Deck MK.2 (Windows) and Stream Deck XL (Windows).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey and Website actions.
3. One-time binds: none. Every game key matches Satisfactory's default keybinds.
4. Page map:
   - **Satisfactory** (home) - build menu, dismantle, build mode, lock hologram, customizer,
     inventory, map, scanner, codex, flashlight, photo mode, use.
   - **Hotbar** - slots 1 through 10.
   - **Guide** - wiki, calculator, recipe tools, patch notes.

Satisfactory must be the focused window when you press a game key.

### Home

| Button | Sends |
|---|---|
| Build | Q |
| Dismantle | F |
| Build Mode | R |
| Lock Holo | H |
| Customizer | X |
| Bag | Tab |
| Map | M |
| Scanner | V |
| Codex | O |
| Torch | B |
| Photo | P |
| Use | E |

### Hotbar

Slots 1 to 9 send `1` to `9`, and Slot 10 sends `0`. These are the number row keys, which is
what Satisfactory uses by default.

### If you have rebound your controls

Satisfactory players remap more than most. If a key here does not match yours, rebind that
one key in the Stream Deck app to whatever you use. Everything on this profile is a plain
single key press, so it is a one field change.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

$6.99, value-priced on purpose. This is the weakest monetization base of the 2026-07-31
batch: a free iConCity comp ("Satisfactory for Galleon") already has 795 downloads, so a
chunk of this demand is served at $0. Median paid comp $6.50 x 109 downloads, only 66% of
comps are paid. Premium pricing would underperform here. See `VALIDATION.md` (75.6/100 GO).

## Decisions

**Keybind source: the official wiki (`satisfactory.wiki.gg`), patch 1.1.0.6.** A second
source (magicgameworld) disagreed on Crouch, Map and the X key, listing C as resource
scanner, Z as map and X as a message box. That is the pre-1.0 Early Access scheme. The
official wiki is post-1.0 and authoritative: Crouch `C`, Scanner `V`, Map `M`,
Customizer `X`.

**Cut: movement and vehicle keys.** Sprint, jump, crouch and the vehicle controls (WASD,
handbrake) are held or twitch inputs. A deck key that sends one tap is the wrong shape for
them, and they already sit under the player's hand.

**Cut: nudge mode and hologram scroll.** Nudge is arrow keys held while `H` is down, and
rotate is the mouse wheel. Neither survives a single-tap key, so shipping them would be
faking functionality.

**Included: the full 10-slot hotbar.** This is the genuine deck win in a factory builder.
Swapping between belts, splitters, foundations and power poles is constant, low-tempo, and
the numbers are hard to hit blind.

**No third-party art on keys.** Tabler glyphs only. `game-ip:coffee-stain-policy-undocumented`
is live: no official Coffee Stain fan-content or commercial-use policy was found, so this
is built to the strictest reading (no logos, no game art, nominative name use only) rather
than relying on the studio's permissive reputation.

**XL layout.** 26 content keys, so all three pages fold flat onto one XL screen with no
folders. The MK.2 keeps the three-page split.
