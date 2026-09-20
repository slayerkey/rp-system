# Discord Essentials: Stream Deck MK.2 profile

**Price: FREE** (lead magnet; free Discord profiles have 69k+ downloads while paid ones don't
exist; every install carries the rainbow More Profiles button to the paid catalog)

**v2, built on the OFFICIAL Discord plugin.** Keys reflect your live Discord state (muted,
deafened, camera on, sharing) and there are zero keybinds to configure: authorize the plugin
once and everything works, even while a game has focus.

## Buttons

| Pos | Button | Action (com.elgato.discord.*) | Live state |
|---|---|---|---|
| 0,0 | Mute Mic | `.mute` | white mic → red mic-off when muted |
| 1,0 | Deafen | `.deafen` | white headphones → red when deafened |
| 2,0 | Push to Talk | `.pushto.talk` | hold to speak |
| 3,0 | Voice Mode | `.pushtotalktoggle` | shows Voice Activity vs PTT |
| 4,0 | Camera | `.videotoggle` | camera glyph + green dot when on |
| 0,1 | Screen Share | `.streamtoggle` | share glyph + green dot when live |
| 1,1 | Notifs | `.notifications` | recent notification alerts |
| 2,1 | Audio Device | `.setaudiodevice` | pick input/output in the key's settings |
| 3,1 | Quick Switch | Ctrl+K hotkey | Discord quick switcher |
| 4,1 | Open Discord | opens discord.com/app | |
| 4,2 | More Profiles | marketplace.elgato.com/@packrat | rainbow gradient icon |

## Setup
1. Install the free **official Discord plugin** when Stream Deck prompts on import.
2. Press any Discord key once → the property inspector shows **Request Access** → click it and
   approve in Discord. One time only.
3. Camera and Screen Share only work while you're in a voice channel (plugin behavior).
4. Audio Device: open the key once and choose which input/output it sets.

## What was checked and is NOT possible
- **Set a custom status**: Discord exposes no keybind and no plugin action for status, so it was cut.
- **Join a specific voice channel**: the plugin CAN do it (`.channel.voice`) but the button
  stores your personal server/channel IDs, so it can't ship pre-configured in a sellable
  profile. README mentions buyers can add it themselves from the plugin's action list.

## Research rationale
Camera and screen-share toggles were added to the official plugin in late 2024 (Elgato
announcement); they need the plugin's RPC connection, not hotkeys. The old hotkey approach
(Ctrl+Shift+M etc.) survives in the paid profiles' comms rows where OAuth-free operation
matters; this Discord-focused product gets the richer plugin treatment.

## Icons & licensing
Tabler Icons webfont (MIT); Discord mark via Simple Icons (referential use, listed as
unofficial). No AI-generated icons.
