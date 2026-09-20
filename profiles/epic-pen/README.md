# Epic Pen Profile

Free funnel tier for `epic-pen-pro`. Build log and internal notes.

## Setup

1. Import the `.streamDeckProfile` for your device (Stream Deck / MK.2, XL,
   Stream Deck +, Virtual Stream Deck). Windows only.
2. Required plugins: none. Stock Elgato Hotkey actions throughout.
3. One-time binds: none. Every key uses an Epic Pen factory default shortcut.
   `INSTALL.md` leads with the full table so a buyer who rebound theirs can check.
4. Page map: **Epic Pen** (13 keys) and **Colors** (8 keys). XL, Plus and VSD are
   single flat pages.

## QA waivers

None.

---
<!-- INTERNAL BELOW: never ships -->

## Where the hotkeys came from

Epic Pen publishes no default hotkey list anywhere: not the user guide, not the
FAQ, not the version history. The whole table was read out of a live install at
`%APPDATA%\Epic Pen\settings.json` (v3.12.172, licence null, free tier), where a
binding is `{"Item1": <win vkey>, "Item2": [<modifiers>], "Item3": <enabled>}`
with 131072=Ctrl, 65536=Shift, 262144=Alt.

Verified after build: a script re-read that file and cross-checked all 316
bindings across the 8 built variants. All matched, no duplicate ActionIDs.

## Decisions

- **No Redo key.** Epic Pen has no redo hotkey and no `RedoHotkey` setting. Adding
  one would be inventing a feature.
- **Colour keys are labelled by slot number, not colour name only.** The hotkeys
  select palette slots; a buyer who recoloured their palette gets their own
  colours. Faces are tinted to Epic Pen's factory palette and `INSTALL.md`
  documents it.
- **Full-face colour on the colour keys** rather than a tinted glyph, because
  slot 4 is black and would be invisible tinted onto a dark key.
- **`PRINTSCREEN` added to `common.py`** (`VK` 44, Qt 16777225) for the screenshot
  key. Deliberately not added to the `MAC` map so `mac_variant()` raises instead
  of emitting a wrong keycode.
- **Windows only.** Epic Pen has a Mac build with claimed parity since 2022, but
  its default modifier is unverified and `mac_variant()` would silently emit a
  wrong keycode on every button if Mac uses Ctrl rather than Cmd.
- **Only one dial on Stream Deck +.** Stroke size is the sole continuous control
  Epic Pen exposes. No next/previous colour, no tool cycle, and dial press does
  nothing with the stock hotkey action. Dials 2 to 4 are left empty rather than
  filled with a rotation that does nothing.

## Open

- The repo's MK.2 `DeviceModel` constant is `20GBA9901`; the build machine's MK.2
  reports `20GAA9902`. Catalogue-wide, not specific to this product, and untouched
  here. `install_test.py` copies straight into ProfilesV3 and rewrites the model,
  so it never exercises the import path. Settling this needs one real double-click
  import of a `.streamDeckProfile`.

## Pricing and comps

Free. See `VALIDATION.md`: the niche has zero comps and zero search volume, and
every paid Packrat profile currently sits at 0 to 1 downloads while the free
Discord profile has 121. This tier exists to be findable.
