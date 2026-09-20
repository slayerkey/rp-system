# Old School RuneScape

Every interface tab on its own key. No more hunting the tab row mid-fight.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Four are included:
   Stream Deck MK.2 (Windows), MK.2 (Mac), Stream Deck XL (Windows), XL (Mac).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey and Website actions.
3. One-time binds: none. Every key matches the game's default function key layout.
4. Page map:
   - **Old School** (home) - all thirteen interface tabs.
   - **Guide** - wiki, world map, GE prices, hiscores, quests, DPS calculator,
     Wise Old Man, TempleOSRS, world list, official news.

The game must be the focused window when you press a tab key.

### Old School

| Button | Sends | Opens |
|---|---|---|
| Bag | Esc | Inventory |
| Combat | F1 | Combat Options |
| Skills | F2 | Skills |
| Quests | F3 | Quests and Achievement Diary |
| Gear | F4 | Worn Equipment |
| Prayer | F5 | Prayers |
| Magic | F6 | Spellbook |
| Clan | F7 | Clan Chat |
| Friends | F8 | Friends List |
| Account | F9 | Account Management |
| Options | F10 | Settings |
| Emotes | F11 | Emotes |
| Music | F12 | Music |

### Guide

Every site an Old School player keeps open on a second monitor, one press away.

| Button | Opens |
|---|---|
| Wiki | oldschool.runescape.wiki |
| World Map | Explv's interactive map |
| GE Prices | prices.runescape.wiki |
| Hiscores | Official hiscores |
| Quests | Full quest list |
| DPS Calc | dps.osrs.wiki |
| Wise Old Man | XP and gains tracking |
| Temple OSRS | Collection log and records |
| Worlds | Official world list |
| News | Official game news |

### A note on F11 and F12

Windows and macOS both grab these keys for their own shortcuts on some machines (show
desktop, volume, mission control). If Emotes or Music does not respond, that is your OS
catching the key before the game sees it. Turn the shortcut off in your system keyboard
settings, or rebind those two tabs in game and in the Stream Deck app to match.

### If you use RuneLite with custom keybinds

Plenty of players remap these. If a key does not match yours, change it in
Settings > Controls > Keybinds in game, then rebind that one key in the Stream Deck app.
Everything here is a plain single key press.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

$6.99, matching the $6.00 comps. No basis to price above given the weak proven demand.
See `VALIDATION.md` (LEAN-GO).

**The comp list in VALIDATION.md is incomplete.** It counted two iConCity marketplace
listings. A pre-art verification pass on 2026-08-01 found two more, both off-marketplace,
which is why the validation missed them:

- **Rune Nav** (chektek, Gumroad) sells *exactly* this profile's original design: OSRS
  default hotkeys for menu navigation, in mini, neo and plus sizes.
- **Rune Deck** (Elgato Marketplace) is a plugin doing live 24-skill tracking and RuneLite
  plugin toggles via a companion client plugin.

## Positioning

**Tab navigation is not a differentiator. The reference layer is.** Rune Nav already owns
the tab-nav pitch and has no equivalent to the Guide page, so that is what leads.

The Guide page was expanded from 4 links to 10 on 2026-08-01 for exactly this reason.
Art and copy should headline "every site you keep on your second monitor, one press away"
(GE prices, DPS calc, Wise Old Man, TempleOSRS), with the thirteen interface tabs as the
supporting feature rather than the hook.

Do not claim live skill tracking or RuneLite integration. Rune Deck does that, this does not.

## Decisions

**Demand caution, unresolved.** `demand-signal:weak-substring-inflated` is the live risk
flag and it still stands. The deterministic demand score matched on the substring 'escape'
(popularity 25), which is not mostly OSRS traffic. The honest runescape-only signal is
popularity 19 across 5 hits, the thinnest of the whole 2026-07-31 batch. VALIDATION.md
named "confirm real search intent before committing full art/build budget" as the
flip-to-GO condition, and that check has **not** been done. The build was cheap (this is
the simplest profile in the batch, one keymap and four links), but the art budget decision
at `/rat-art` should account for this. Do not expect Valorant-tier volume.

**Best legal position in the roster.** Jagex's Fan Content Policy explicitly permits making
and selling fan works and names OSRS. Only restriction is the Jagex logo, which is not used.
Tabler glyphs and nominative text only, same as every other profile.

**Keybind source: the official wiki (`oldschool.runescape.wiki`, Shortcut keys).** The Fandom
mirror lists an older RS2-era naming (F7 Ignore, F9 Log out) that disagrees on F7 to F9. The
official wiki is authoritative: F7 Clan Chat, F8 Friends List, F9 Account Management.

**Cut: the in-game World Map (Ctrl+M).** `mac_variant()` mechanically converts Ctrl to Cmd,
and Cmd+M is Minimize Window on macOS, so the Mac profiles would have shipped a key that
minimizes the client. Same rule applied in the Vectorworks profile. The Guide page links to
Explv's map instead, which is correct on both platforms.

**Cut: dialogue keys (1-5, Space) and Tab reply.** These are contextual, only live inside a
dialogue or Make-X interface, and are faster on the keyboard the hand is already on.

**XL layout.** 17 content keys, so both pages fold flat onto one XL screen with no folder.
The MK.2 keeps the two-page split.
