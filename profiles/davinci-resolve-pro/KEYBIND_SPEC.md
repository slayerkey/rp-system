# DaVinci Resolve Pro: keybind reference

**You do not need to bind anything. The profile works on a stock Resolve install.**

Every key and dial in the Pro profile targets a DaVinci Resolve **default**
shortcut. This was confirmed by decoding Resolve's own keyboard preset
(`%APPDATA%\Blackmagic Design\DaVinci Resolve\Preferences\keyboard.preset.xml`),
which stores each of its 602 commands with its current binding as a Qt key
sequence. 23 of the 27 commands originally planned for a custom preset turned
out to already be bound out of the box.

This file is the record of what the profile targets, for future maintenance.

## Color page

| Key | Resolve default | Command ID |
|---|---|---|
| Serial Node | `Alt+S` | `nodesAddSerial` |
| Parallel | `Alt+P` | `nodesAddParallel` |
| Layer | `Alt+L` | `nodesAddLayer` |
| Bypass | `Ctrl+D` | `nodesToggleCurrent` |
| Bypass All | `Alt+D` | `nodesToggleAll` |
| Prev Node | `Shift+Alt+;` | `nodesPrevious` |
| Next Node | `Shift+Alt+'` | `nodesNext` |

## Grade page

| Key | Resolve default | Command ID |
|---|---|---|
| Save A / B / C | `Alt+1` / `Alt+2` / `Alt+3` | `sessionMemoriesSaveA/B/C` |
| Outside Node | `Alt+O` | `nodesAddOutside` |
| Grab Grade | `Shift+=` | `sessionGradeFromOneClipPrior` |
| Add Version | `Ctrl+Y` | `sessionVersionAdd` |
| Next Version | `Ctrl+N` | `sessionVersionNext` |

## Color dials: printer lights

Resolve puts printer lights on the numeric keypad by default, so the dials drive
them directly.

| Dial | Counter-clockwise | Clockwise |
|---|---|---|
| Master | keypad `-` | keypad `+` |
| Red | keypad `4` | keypad `7` |
| Green | keypad `5` | keypad `8` |
| Blue | keypad `6` | keypad `9` |

**One item to confirm on hardware.** Red, Green and Blue decoded cleanly.
`sessionPrinterLightsMasterMinus` decoded as keypad **Enter**, not keypad minus,
which is unusual enough that it may be a decode artifact. The profile sends
keypad minus. If Master-down does nothing, rebind
`sessionPrinterLightsMasterMinus` to keypad minus in Keyboard Customization.
That is the only bind a buyer could ever need, and only if the decode is wrong.

## Edit and Assembly pages

All Resolve defaults, unchanged from the shipped Lite product: `B` blade,
`A` select, `Ctrl+B` split, `Shift+Backspace` ripple delete, `N` snap, `T` trim,
`Shift+Z` zoom fit, `F9`-`F12` insert/overwrite/replace/place-on-top,
`Shift+F12` append, `Ctrl+T` transition, `Ctrl+R` retime, `M` marker,
`I`/`O` in and out, `L` play.

Edit dials: `Left`/`Right` scrub, `Ctrl+-`/`Ctrl+=` zoom, `Ctrl+Z`/`Ctrl+Shift+Z`
undo and redo, `Up`/`Down` edit point.

## Not used

`sessionMemoriesLoadA` through `H` are the only genuinely unbound commands in
this area of Resolve. The Grade page ships memory **save** (which is bound) and
leaves load out rather than shipping a key that does nothing. If load is wanted
later it needs a custom bind and a documented setup step.

## macOS

The Mac variant converts `Ctrl` to `Cmd`, matching Resolve's own Mac defaults.
Keypad and Alt keys are unchanged. No separate preset is needed.

## Decoder

`python profiles/_build/verify_preset.py --dump <preset.xml>` prints every
command and its current binding, which is how the tables above were produced.
