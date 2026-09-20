# Screensaver Scheduler

A Stream Deck plugin for Windows that puts your screensavers on a schedule: by time of
day, on a rotating timer, or one press at a time.

---

## Why this exists

Windows only lets you set **one** screensaver. Pick Bubbles and you get Bubbles, forever,
until you dig back into Settings and change it by hand. There is no rotation, no "different
one in the evening," no quick switch.

The marketplace had exactly one screensaver plugin, and all it does is trigger sleep or the
screensaver on a single button. Nothing schedules them, nothing cycles them. So this does.

## Actions

### Next Screensaver
One press switches Windows to the next screensaver in your list and shows it on screen right
then, so the button does something you can see instead of waiting out an idle timer. Press
again for the one after that.

Drop it on the deck with nothing configured and it flips through every screensaver Windows
has. Tick a shorter list in its settings to flip through just those.

### Auto Cycle
Press once to start rotating the screensaver through your list every few minutes, press
again to stop. The button looks different while it's running. The rotation keeps going in
the background, so whenever the machine next goes idle it's showing a different one than last
time.

### Scheduled
Set specific screensavers for specific times of day: a calm one for the morning, something
louder after hours, whatever you like. Press the key to arm the schedule, press again to
turn it off. When the clock hits one of your times, the active screensaver switches.

## Choosing your screensavers

Every action's settings list the screensavers Windows found. Tick the ones you want. Windows
11 ships only a handful (Bubbles, Mystify, Ribbons, Photos, 3D Text), so if you want more,
drop any `.scr` files into a folder, point the **folder** box at it, and they show up in the
list right alongside the built-in ones.

## Install

Double-click `com.packrat.screensavercycler.streamDeckPlugin`.

Requires **Stream Deck 6.9 or newer** and **Windows 10 or newer**.

## Honest notes

**Windows only.** Setting the active screensaver is a Windows thing (it writes the same
setting the Windows Settings screen does). macOS locks this down far more tightly and isn't
supported yet.

**Cycling and scheduling run while Stream Deck is running.** They live in the plugin, not on
the button, so they keep working no matter which Stream Deck page you're looking at. If you
quit Stream Deck, they pause until it's open again. Turning a button **off** (press it until
the icon goes dark) is how you stop it, not deleting the button.

**A change shows up the next time the machine goes idle.** Auto Cycle and Scheduled change
*which* screensaver Windows will use; they don't force it onto the screen mid-work (that
would interrupt you). The **Next** button is the one that shows a screensaver immediately,
because that's a button you pressed on purpose.

**Locked-down work machines may ignore it.** On a company laptop where IT enforces the
screensaver through group policy, Windows overrides this setting and the change won't stick.
Nothing a plugin can do about that; it's the machine's policy winning.

## Building from source

```
npm install
npm run build       # bundle into com.packrat.screensavercycler.sdPlugin
npm test            # pure-logic checks (name parsing, ring advance, folder scan)
```

Then `streamdeck link com.packrat.screensavercycler.sdPlugin` and
`streamdeck restart com.packrat.screensavercycler`.

Icons are generated: `python scripts/gen-icons.py` (needs Pillow; reuses the factory
renderer in `profiles/_build/icons.py`).

## What's inside

TypeScript on the official `@elgato/streamdeck` SDK. No native/FFI layer: setting the active
screensaver is a `reg.exe` write to `HKCU\Control Panel\Desktop\SCRNSAVE.EXE`, and the
instant preview just launches the `.scr` with the standard `/s` (full-screen) argument. The
background scheduler is one timer in the plugin process reading global settings, which is why
it doesn't care what's on the deck.

## Licence

The code is mine. The action-list glyphs are rendered from
**[Tabler Icons](https://tabler.io/icons)** (MIT, © 2020-2026 Paweł Kuna); notice at
`LICENSE-tabler.txt` inside the plugin. The key images are drawn by `scripts/gen-icons.py`.

More Stream Deck profiles, icon packs, plugins and screensavers:
**[marketplace.elgato.com/@packrat](https://marketplace.elgato.com/@packrat)**

---
<!-- INTERNAL BELOW: never ships -->

## Build fit vs VALIDATION.md

Validated 81/100 (GO). Build came in cleaner than the 8/15 build-fit score feared: the
registry + `.scr /s` approach removed the entire koffi/native apparatus the score budgeted
for, so there are no platform binaries to juggle. No new icons needed beyond three Tabler
glyphs.

## Decisions

- **No koffi / no FFI.** Screensaver control is `child_process` only (reg.exe + launching the
  .scr). Simpler and more robust than the FFI path the sibling plugin needs for input.
- **Global ticker, not per-action timers.** Stream Deck fires `willDisappear` on every page
  switch, so a per-action timer would silently pause scheduling whenever another page was
  showing. The scheduler lives in the plugin process and reads global settings instead.
- **Set-active vs show-now.** Cycle and Schedule change the *active* screensaver (applies on
  next idle, non-disruptive). Only the Next button launches a screensaver on screen, because
  that's an explicit press.
- **Windows-only v1.** macOS screensaver control is far more restricted on modern macOS; it's
  a separate research phase, tracked as `platform-risk:macos-permissions` in the registry.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->
