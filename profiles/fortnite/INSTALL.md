# Fortnite

Comms, capture and match info on one screen, plus one-tap presses of Fortnite's own
default Battle Royale keybinds.

## Pick your file

Import the one file that matches your deck. The other can stay in the folder or be
deleted.

| Your Stream Deck | File |
|---|---|
| Stream Deck / MK.2 (15 keys) | `Fortnite.streamDeckProfile` |
| Stream Deck XL (32 keys) | `Fortnite (XL).streamDeckProfile` |

## Install

1. Double-click your `.streamDeckProfile` file. The Stream Deck app imports it and asks
   which device to put it on.
2. Install the **Better Hotkeys & Mouse** plugin by Packrat from the marketplace. The
   Push to Talk key uses it. Every other key uses Stream Deck's built-in actions.

If double-clicking does nothing, open the Stream Deck app, click the gear icon, choose
**Profiles**, then the **...** menu, then **Import**, and pick the file.

## Set up Discord and OBS (takes about two minutes)

**Read this part.** Fortnite has no mute or deafen key of its own, so those two keys on
your deck press Discord's hotkeys instead. The capture keys press OBS hotkeys the same
way. Until you set the binds below, those keys will look like they do nothing.

The Fortnite keys need none of this. They already match the game's defaults.

### Discord

Discord ships with these two shortcuts, so usually there is nothing to add:

| Key on your deck | Discord shortcut |
|---|---|
| Mute Mic | Ctrl+Shift+M |
| Deafen | Ctrl+Shift+D |

**If the keys do nothing while you are in a match, this is almost always the reason:**
Fortnite runs with administrator rights because of its anti-cheat, and Discord does not.
Windows will not let Discord hear a keypress while a higher-privilege window is in front.

Close Discord, right-click the Discord shortcut, choose **Run as administrator**, and try
again. To make it stick, right-click the shortcut, choose **Properties**, then
**Advanced**, then tick **Run as administrator**.

Two more things worth checking if it still misses:

- Use the Discord **desktop app**, not Discord in a browser tab. The browser version has
  no global shortcuts.
- Make sure nothing else has claimed Ctrl+Shift+M. The Nvidia overlay and OBS are the
  usual suspects.

To set the binds by hand, or to change them: Discord, **User Settings**, **Keybinds**,
**Add a Keybind**, then pick Toggle Mute or Toggle Deafen and press the combination.

### OBS

Open OBS, go to **Settings**, then **Hotkeys**, and set these four:

| Key on your deck | OBS action | Bind |
|---|---|---|
| Save Clip | Save Replay | Ctrl+Alt+C |
| Marker | (your chosen marker action) | Ctrl+Alt+M |
| Record | Start / Stop Recording | Ctrl+Alt+R |
| Stream | Start / Stop Streaming | Ctrl+Alt+B |

Save Clip needs the **Replay Buffer** switched on in OBS under Settings, Output.

## Page map

- **Fortnite** (home): mic, deafen, push to talk, clip, marker, record, stream, map,
  inventory, emote, chat, squad comms, and links to the other two pages.
- **Game**: weapon slots 1 to 5, pickaxe, reload, pick up, trap, upgrade.
- **Links**: stats, item shop, patch notes, map and POIs.

On Stream Deck XL everything sits on one page, with no folder to open.

Fortnite must be the focused window when you press a game key.

## Game keys

| Button | Sends |
|---|---|
| Slot 1 to Slot 5 | 1, 2, 3, 4, 5 |
| Pickaxe | F |
| Reload | R |
| Pick Up | E |
| Trap | Y |
| Upgrade | H |
| Map | M |
| Bag | Tab |
| Emote | B |
| Chat | Enter |
| Squad Comms | F4 |
| Push to Talk | T, held for as long as you hold the key |

These are Fortnite's default Battle Royale bindings. If you have rebound one in game,
change that single key in the Stream Deck app to match.

## What this profile does not do

**Building and editing are not on the deck, on purpose.** Wall, Floor, Stairs, Roof and
Building Edit are the fastest inputs in the game and they already live under your left
hand on `Z X C V G`. Reaching for a deck key is slower than the key you are holding, so a
build button would make you worse, not faster.

Every key here is a single press of a single key, with no sequences and no automation,
which is the only thing that is safe with Easy Anti-Cheat.

**Scope is Battle Royale defaults.** Creative and Zero Build players should check their
bindings before relying on the deck.

Windows only.

## Support

Questions, or a key that does not fire: reply through the marketplace listing.
More Stream Deck profiles from Packrat at marketplace.elgato.com/@packrat
