# Better Hotkeys & Mouse Pro

A Stream Deck plugin for Windows and macOS that holds keys down. This is the Pro edition:
every action in one plugin, including mouse movement and drag, radial wheel select,
auto-repeat, scroll, mic controls, and Stream Deck + dial support. Standalone, so it does
not depend on any other plugin being installed.

---

## Why this exists

Stream Deck's stock **Hotkey** action always sends the key-down and the key-up together.
It taps. It cannot hold.

That sounds small until you hit it. I build Stream Deck profiles, and while making one for
a game I like I ended up writing this into its README:

> **`RUN!` and `Crouch` are taps, not holds.** Sprint and crouch are hold-to-act in game,
> so these send a single press. For sustained sprinting keep using `Shift` on your keyboard.

Telling people to go back to their keyboard, in the manual for a keyboard replacement. That
bugged me enough to build this.

The missing piece is a key-down **without** a key-up. Stock can't do it. Multi Action Switch
gives you two alternating states but doesn't hold. Key Logic fires on single/double/long
press but doesn't hold. Only a plugin can send the key-down on its own.

## Actions

### Hold Key
Holds one or more keys for exactly as long as you physically hold the Stream Deck key.
Press and hold → the key goes down and stays down. Let go → it releases.

Multiple keys work together, so `Shift`+`W` is real, sustained auto-run - not a tap.

Classic use: push-to-talk.

### Toggle Key
Press once, the key goes down and *stays* down while you do other things. Press again, it
releases. The button looks different when it's on.

This is the one that makes sprint work.

### Click Mouse
Left, right or middle click - wherever your cursor already is, or at a specific spot on
screen. **Stock Stream Deck can't send mouse buttons at all**, so this alone opens up a lot.

### Move Mouse
Move the cursor to a spot on screen, or nudge it by a pixel offset.

### Hold Mouse Button
Left, right or middle held down for as long as you hold the Stream Deck key. Rotate-lock,
drag-panning, hold-to-aim.

### Toggle Mouse Button
Press once to hold a mouse button down, press again to let go. Rotate-lock you don't have to
keep a finger on.

Held mouse buttons get the same crash protection as held keys - a stuck right-button is
worse than a stuck Shift, because you can't even dismiss the menu it opens.

### Radial Select
One deck key picks one slot from an in-game wheel menu. It opens the wheel (holds a key you
choose), flicks the cursor to an **angle and distance** you set on a dial, optionally clicks
to confirm, and optionally puts the cursor back.

Set the direction by dragging on the dial instead of typing degrees. Wheels are forgiving:
they only need a rough direction, so one deck key per slot is more reliable than it sounds,
and it works for any wheel: weapons, emotes, builds, poses.

If a wheel doesn't register, raise the **step delay** so the game has time to open it before
the cursor moves.

### Auto-Repeat
Repeat a key or a click at a rate you set, while toggled on. Clickers, fishing, farming.
Optionally stops itself after a number of seconds. Press once to start, again to stop.

### Mouse Drag
Press at one point, travel to another, release - sliders, paint strokes, drag-and-drop. The
travel happens in small steps because many apps only register a drag if they see motion
between the press and the release. A slower drag is more reliable in fussy apps.

### Scroll
Turn the mouse wheel up or down by however many notches you want. Some games bind weapon or
tool cycling to the wheel and stock Stream Deck can't reach it. Can also throw several notches
in a burst for menus that ignore one big jump.

### Dial (Stream Deck +)
For the dials. Turning it clockwise or counter-clockwise each send their own hotkey,
pressing it down sends a third, and tapping the touchscreen sends a fourth - any of them
optional. One general-purpose dial action instead of a different one per app, so jogging a
timeline, zooming, scrubbing or nudging a value are all just "what hotkey does that app use
for this."

**Turning can send the mouse scroll wheel instead of a hotkey.** Switch **Turning the dial**
to *Mouse scroll wheel* and the dial becomes a scroll wheel you can spin with one finger,
which is the only way to reach the many apps and games that bind to the wheel with no
keyboard equivalent. Tick **Invert direction** if you want clockwise to scroll down.

Set **Steps** to send more than one keystroke (or notch) per detent, and turn on **faster
spins send extra steps** so a quick flick covers more ground than a slow nudge - useful for
a dial that jogs one frame at a time but should be able to scrub fast too. Acceleration
applies to scrolling exactly the same way.

## Capturing a position

Click **Capture cursor position**, then move your mouse wherever you want it, then **press
that action's key on your Stream Deck**. It reads the cursor at that moment and fills in the
X/Y.

It works this way for a reason. A capture button that reads the cursor the instant you click
it can only ever capture one place: the button you just clicked. Your mouse has to be there
to click it. The Stream Deck key is the only thing you can press that doesn't move the
pointer, so the deck key does the reading.

While it's waiting, the key captures instead of doing its normal job - so setting up a
"click here" button won't fire a real click into whatever is underneath. It stops waiting
after 30 seconds.

## Setting a key

Click **Record**, press the keys you want, let go. That's it.

Press `Shift`+`W` and it records `Shift`+`W`. Press just `Shift` and it records `Shift`. It
takes whatever you were holding when you let go, so you never have to hunt through a
dropdown for "Left Shift".

Recording reads the *physical* key, not the letter on it, so it does the right thing on any
keyboard layout.

A few keys never reach the window - Windows grabs the `Win` key to open the Start menu
before anything else sees it. Those live under **Can't record a key?**.

## Install

Double-click `com.packrat.betterhotkeyspro.streamDeckPlugin`.

Requires **Stream Deck 7.1 or newer**, and either **Windows 10 or newer** or **macOS 11 or
newer**.

On macOS, the first key or click won't reach anything until you grant **Accessibility**
access: System Settings → Privacy & Security → Accessibility → enable Stream Deck. The
plugin logs a warning at startup if it isn't granted yet, and any action that tries to send
input before you grant it will show the little red "failed" flash on the key instead of
silently doing nothing.

## Honest notes

**Some games block this.** The plugin sends real synthetic input - `SendInput` on Windows,
`CGEventPost` on macOS - the same mechanism the OS uses for any keystroke that isn't from a
real keyboard. Anti-cheat systems can and do reject it:

- **Kernel-level anti-cheat (Vanguard, and similar) will almost certainly block it.** There
  is no user-mode fix for that. Not a bug, not something I can patch.
- EAC and BattlEye may or may not, depending on the game and its configuration.

I'd rather say this up front than take your money and argue about it later.

**If the game runs as administrator, Stream Deck has to as well.** Windows won't let a
normal program send input to an elevated window. It fails silently - the key just does
nothing. Run Stream Deck as administrator and it works.

**Mic actions (Mute Mic, Push to Talk, Mic Volume) are Windows only for now.** They talk to
Windows Core Audio directly; a macOS install just won't show them doing anything useful yet.
Everything else - Hold/Toggle Key, all the mouse actions, Radial Select, Auto-Repeat,
Dial - works on both.

**About stuck keys.** A key held down is a key that has to come back up. This releases
everything when you let go, navigate to another page or profile, change the button's
settings, put the machine to sleep, or stop the plugin.

The awkward case: neither OS releases a synthetic key if the program that sent it gets
killed outright. Nothing running on your machine can catch that moment. So every held key is
written to a small file first (`held.json` in your temp folder), and on next start the
plugin reads that file and releases anything left over. Stream Deck restarts crashed plugins
automatically, so in practice this repairs itself in seconds. If it somehow doesn't, tap the
key on your real keyboard.

## Advanced: "Send as" (Windows)

Under **Advanced** in each button's settings there's a **Send as** option. Leave it on
**Scan code** unless something is broken. This setting only exists on Windows; macOS has no
equivalent concept and ignores it.

Scan codes are what a physical keyboard actually puts on the wire. Most games read them
directly and ignore virtual key codes entirely, which is why that's the default. The
**Virtual key only** option exists for the rare non-game app that wants the opposite, and as
something to try if a key mysteriously does nothing.

## Building from source

```
npm install
npm run build       # bundle into com.packrat.betterhotkeyspro.sdPlugin
npm run test:t0     # FFI: struct layout, scan codes, does a key stay down (Windows)
npm run test:t5     # stuck-key journal and crash recovery (Windows)
npm run test:t6     # mouse: monitor geometry, absolute positioning, buttons (Windows)
npm run test:t7     # radial geometry and cursor move/return (Windows)
npm run test:t8     # Core Audio: mute, volume, device list (Windows)
```

These tests send real keystrokes and move the real cursor. They release what they press
and put the cursor back where they found it. All five are Windows-only verification scripts
that talk to the native layer directly - there's no macOS equivalent of them yet, since
there's no Mac in this build loop to run them on.

One artifact ships to both OSes, so `node_modules` needs koffi's native binary for all
three targets (`win32-x64`, `darwin-x64`, `darwin-arm64`) before `npm run build` will
package correctly. `npm install` only fetches the one matching the machine you're on.
On a Windows box, get the other two with:
```
npm install --force @koromix/koffi-darwin-x64@<koffi version> @koromix/koffi-darwin-arm64@<koffi version>
```
(version must match the `koffi` entry in `package.json`). The build fails loudly and names
the missing file if any of the three aren't there.

Then `streamdeck link com.packrat.betterhotkeyspro.sdPlugin` and
`streamdeck restart com.packrat.betterhotkeyspro`.

Icons come from the shared icon set, generated by the base plugin package's
`tools/gen_icons.py` (needs Pillow).

## What's inside

TypeScript on the official `@elgato/streamdeck` SDK. Native input goes through
[koffi](https://koffi.dev) (MIT) - no C++ addon of my own, and no heavyweight automation
library, on either OS. Windows calls `SendInput` in `user32.dll` directly; macOS calls
`CGEventPost` and friends in CoreGraphics. `src/input.ts` picks whichever one matches
`process.platform` at runtime and the actions never know the difference. The packaged
plugin is a few MB, mostly from carrying three platform binaries in one file.

On Windows, keys are sent as hardware scan codes with the extended-key (`E0`) prefix
applied from an explicit table, because `MapVirtualKeyEx` under-reports it - it returns a
bare `0x4D` for Right Arrow, which is byte-identical to Numpad 6. Get that wrong and arrow
keys type digits. macOS has no equivalent wrinkle: a `vk` is already a CoreGraphics keycode
and gets sent straight through.

## Licence

The code is mine. Two MIT dependencies ship with it, and MIT asks that their notices
travel along, so they do:

- **[koffi](https://koffi.dev)** - calls `SendInput` in `user32.dll`. Licence at
  `node_modules/koffi/LICENSE.txt` inside the plugin.
- **[Tabler Icons](https://tabler.io/icons)** - the small glyphs in the action list are
  rendered from Tabler's webfont. © 2020-2026 Paweł Kuna. Licence at `LICENSE-tabler.txt`
  inside the plugin.

The key images on the deck itself are drawn from scratch by `tools/gen_icons.py`.

More Stream Deck profiles, icon packs, plugins and screensavers:
**[marketplace.elgato.com/@packrat](https://marketplace.elgato.com/@packrat)**
