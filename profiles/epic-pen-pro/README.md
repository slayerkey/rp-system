# Epic Pen Pro Profile

Paid superset of `epic-pen`. Build log and internal notes.

## Setup

1. Import the `.streamDeckProfile` for your device (Stream Deck / MK.2, XL,
   Stream Deck +, Virtual Stream Deck). Windows only.
2. Required plugins: none. Stock Elgato Hotkey and Open actions.
3. One-time binds: none. Every key uses an Epic Pen factory default shortcut.
   Eight keys additionally need Epic Pen Pro in the app itself.
4. Page map: **Epic Pen** (14 keys), **Colors** (8), **Shapes** (8), **Boards**
   (8). XL, Plus and VSD are single flat pages.

## QA waivers

- `registry.risk hardware-unverified:pro-tools-untested` stays open at submission.
  Owner accepted it 2026-08-12 rather than start an Epic Pen Pro trial. The
  build compensates by shipping the three board and fade keys as plain
  hotkeys instead of two-state toggles, so no key face claims a state that
  was never observed.

---
<!-- INTERNAL BELOW: never ships -->

## Open risk: pro-tools-untested

Registry flag `hardware-unverified:pro-tools-untested`, owner-accepted 2026-08-12.
Line, Arrow, Rectangle, Ellipse, Text, Whiteboard, Blackboard and Fading Ink were
never confirmed firing: the build machine runs the unlicensed tier of Epic Pen,
with no trial used. Their bindings come from the same live `settings.json` as the eighteen
verified keys, so they are very likely right, but that is the actual confidence
level.

Consequence carried into the build: **Whiteboard, Blackboard and Fading Ink ship
as plain `hotkey_action`, not `hotkey_switch_action`.** Epic Pen calls them
toggles, but a two-state key face would assert on/off behaviour nobody verified.
Draw and Toolbar are two-state because they were tested. If a Pro licence is ever
activated, promoting those three is a clean v1.1.

## Decisions

Everything in `profiles/epic-pen/README.md` applies here too. Additionally:

- **The paywall is Epic Pen's own paywall.** Every key this tier adds is a tool
  Epic Pen gates behind Pro. The boundary never needs explaining.
- **$7.99, not $29.99.** `davinci-resolve-pro` earns its price from SideshowFX
  comps at 176 to 2021 downloads. This niche has no comps and no search volume.
- **House rule 8** applies to every word of this listing, and the blocklist
  matches on substrings, so the ordinary drawing term for un-guided strokes
  trips it too. That is why the page map says "the pen" instead.
- **The Launch key** points at `C:\Program Files (x86)\Epic Pen\epicpen.exe`, read
  off a real install. The binary is lowercase and Epic Pen is a 32-bit build, so
  it lands in Program Files (x86) even on 64-bit Windows.

## Pricing and comps

$7.99. Floor of the house $8 to $18 band. See `VALIDATION.md` for why nothing
supports a premium ask here.
