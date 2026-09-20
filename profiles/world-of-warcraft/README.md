# World of Warcraft

The panels you open a hundred times a session, plus your whole action bar, on the deck.
Hearth, mount and dungeon queue are one press away instead of a menu dive.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Four are included:
   Stream Deck MK.2 (Windows), MK.2 (Mac), Stream Deck XL (Windows), XL (Mac).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey and Website actions.
3. One-time binds: none in WoW itself. Every key here is already bound by the game.
   The one thing to do is decide **which action bar slots hold your utility items** (below).
4. Page map:
   - **Warcraft** (home) - character, spells, talents, achievements, map, bags, mounts,
     group finder, guild, social, chat, reply, hide UI.
   - **Action Bar** - your primary action bar, slots 1 through 12.
   - **Guide** - Wowhead, Raider.IO, Warcraft Logs, patch notes.

WoW must be the focused window when you press a game key.

### Set up your utility slots

Hearthstone, mounts and consumables are not bound to a key by the game. They are items you
drag onto an action bar. So the deck presses the **bar slot**, and you decide what sits there.

A setup that works well:

| Bar slot | Put here |
|---|---|
| Bar 10 | Hearthstone |
| Bar 11 | Your favourite mount |
| Bar 12 | Food or a healthstone |

Drag the item onto that slot once and the matching deck key runs it from then on.

### Home

| Button | Sends |
|---|---|
| Character | C |
| Spells | P |
| Talents | N |
| Achieve | Y |
| Map | M |
| Bags | B |
| Mounts | Shift+P |
| Group Finder | I |
| Guild | J |
| Ready Check | types /readycheck |
| Chat | Enter |
| Reply | R |
| Hide UI | Alt+Z |

### Ready Check

The Ready Check key types `/readycheck` into chat and sends it, so a raid leader can pull the
whole group's status without touching the keyboard. The leading slash opens the chat box for
you, exactly as if you typed it.

If your setup does something unusual with chat and the key does not land, use a macro
instead: make a macro containing the single line `/readycheck`, drag it to any action bar
slot, and press that Bar key. Same result, and it works no matter what chat is doing.

**Stream Deck XL owners:** the XL keeps the Social panel key as well, since the bigger grid
has room for both.

### Action Bar

Slots 1 to 12 send `1` to `9`, then `0`, `-` and `=`, which is WoW's default primary bar.

### What this profile is not

**It is not a rotation helper and it does not automate anything.** Every key is one action:
a panel key sends one key press, and Ready Check sends one chat command that any player can
type by hand. There are no combat sequences, no timers and nothing that plays for you. That
matters in WoW more than in most games: Blizzard's terms are strict about input automation,
and a profile that fired combat rotations for you would put your account at risk. This one
just saves you reaching for a panel key.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

- **2026-08-01, `copy.blocklist` "macro" x2 (Ready Check section).** Waived. The blocklist bans
  the word because of anti-cheat exposure in competitive shooters, where a macro means an input
  sequence. In WoW a macro is a first-class, Blizzard-supported game feature, and the fallback
  instruction here is to make a one-line `/readycheck` macro and drag it to an action bar. That
  is the correct domain term and the safest possible advice; rewording it to avoid the token
  would make the instruction worse. The profile itself still contains no input sequences.

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

$11.99, undercutting the $12.32 median paid comp. Strong monetization signal: 100% of comps
are paid, median comp 643 downloads, and iConCity's WoW profile has 1062 downloads at $12.65.
See `VALIDATION.md` (78.5/100).

## Decisions

**Owner risk sign-off obtained 2026-07-31** (`docs/DECISIONS.md`). Blizzard's Trademark Usage
Guidelines allow mark use for non-commercial purposes only, outside a listed set of exceptions
that a paid Stream Deck profile is not on. Risk scored exactly 4/10, the rules threshold, so
this needed an explicit yes before build. It was given, same pattern as the sports-tracker
sign-off. Design constraints that earned it still apply: no Blizzard or WoW logos anywhere,
Tabler glyphs only, nominative name use, and the strict no-automation position below.

**Scope: utility layer only, per VALIDATION.md.** WoW's spellbook is enormous and shipping
"everything" would blur into a rotation tool, which is exactly what Blizzard's anti-botting
enforcement targets. The home page is UI panels; the second page is the default action bar.
Nothing else.

**Utility items go through action bar slots, not dedicated keys.** Hearthstone, mounts and
consumables have no default binding because they are items, not abilities. Inventing a
"Hearthstone" key would mean faking functionality (`/rat-build` STEP 0 #4). The honest
version is to press the bar slot and document which slot to park them in, which is also
literally what "mapped to keys the player already bound" required.

**Keybind source.** Modern retail defaults, cross-checked across two sources. One widely
cited list (onlinegamecommands) mixes in Classic-era binds (`I` as Abilities, `K` as Skills,
`H` as Honor) and was not used where it conflicted. Retail values used: `C` `P` `N` `Y` `M`
`B` `Shift+P` `I` `J` `O` `Enter` `R` `Alt+Z`.

**Cut: combat and targeting keys.** Tab target, `F` assist and the F1 to F5 party targets were
considered and dropped. They are combat-adjacent, and given the anti-automation posture the
cleaner product position is a profile that never touches combat at all.

**Mac ships.** WoW is fully native on macOS, unlike most of this batch. No Ctrl binds are used,
so the Mac variants differ only by keycode re-encoding, not by a Ctrl to Cmd swap.

**XL layout.** 29 content keys, so all three pages fold flat onto one XL screen with no
folders. The MK.2 keeps the three-page split.
