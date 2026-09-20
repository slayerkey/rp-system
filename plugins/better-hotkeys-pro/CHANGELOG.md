# Better Hotkeys & Mouse Pro changelog

<!-- Newest first. Every registry version bump gets an entry BEFORE /rat-qa runs.
The top entry is pasted into the marketplace release notes verbatim: buyer
language, no internal jargon, no em dashes. -->

## v1.2.1.0 - 2026-08-31

- Fixed on Apple Silicon Macs: scrolling with a dial or a Scroll key only ever went one
  way, no matter which way you turned it. Both directions now work. Intel Macs and
  Windows were never affected.
- Scroll can now go sideways as well as up and down. Pick Left or Right under Direction,
  handy for timelines and wide spreadsheets. The dial has the same choice under Axis.
- New "Scrolls" setting on both the Scroll key and the dial. Leave it on "Where my mouse is"
  for the normal behaviour, or switch it to "The window in front" to send the scroll to the
  app you are working in no matter where you left the mouse pointer. Windows only, and a few
  games read the mouse directly and only answer to the normal setting.
- Clearer wording in the settings panel about where a scroll actually lands. Windows sends
  the wheel to whatever the pointer is sitting on, which is the usual reason a scroll key
  looks like it is doing nothing.

## v1.1.0.0 - 2026-07-29

- Dial Control (was Encoder Hotkey) can now send the mouse scroll wheel, not just hotkeys.
  Pick "Mouse scroll wheel" under Turning the dial, and "Faster spins send extra steps"
  works with it: a slow turn nudges a line, a quick flick scrolls a long way.
- Optional invert, so clockwise can scroll down instead of up.
- Mute Mic, Push to Talk and Mic Volume now cover BOTH of the microphones Windows treats
  as default. Voice apps and everything else can each have their own default, so muting
  only one could leave a second app still listening.
- New "All microphones" option on the mic actions, for routed setups (Voicemeeter, virtual
  cables) where more than one input can still be live.
- Auto-Repeat now says "Keyboard key" instead of "A key", which read like the letter A.

## v1.0.0.0 - 2026-07-29

- Hold Key and Toggle Key: keep one or more keys down, held or latched.
- Full mouse control: click, move, hold, toggle, drag between two points and scroll.
- Radial Select: pick a slot from any in-game wheel menu, aimed on a draggable dial.
- Encoder Hotkey for Stream Deck +: turn, push and tap each send their own hotkey.
- Auto-Repeat: repeat a key or click at a rate you set, with an optional time limit.
- Mic controls: system-wide mute, push to talk and input level (Windows).
