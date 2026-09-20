# Fortnite

Comms, capture and match info on one screen, plus one-tap presses of Fortnite's own default
Battle Royale keybinds.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Two are included:
   Stream Deck MK.2 (Windows) and Stream Deck XL (Windows).
2. Required plugins: **Better Hotkeys & Mouse** by Packrat, for the Push to Talk key.
   Every other key uses Stream Deck's built-in Hotkey and Website actions.
3. One-time binds, in each app's settings:
   - Discord: Toggle Mute `Ctrl+Shift+M`, Toggle Deafen `Ctrl+Shift+D`
   - OBS (Settings > Hotkeys): Save Replay `Ctrl+Alt+C`, Marker `Ctrl+Alt+M`,
     Start/Stop Recording `Ctrl+Alt+R`, Start/Stop Streaming `Ctrl+Alt+B`
   - Fortnite: nothing. The game keys match the default Battle Royale keybinds.
4. Page map:
   - **Fortnite** (home) - mic, deafen, push to talk, clip, marker, record, stream,
     map, inventory, emote, chat, squad comms, and links to the other two pages.
   - **Game** - weapon slots 1 to 5, pickaxe, reload, pick up, trap, upgrade.
   - **Links** - stats, item shop, patch notes, map and POIs.

Fortnite must be the focused window when you press a game key.

### Game page defaults

| Button | Sends |
|---|---|
| Slot 1 to Slot 5 | 1, 2, 3, 4, 5 |
| Pickaxe | F |
| Reload | R |
| Pick Up | E |
| Trap | Y |
| Upgrade | H |

Home page game keys: Map `M`, Bag `Tab`, Emote `B`, Chat `Enter`, Squad Comms `F4`,
Push to Talk `T` (held for as long as you hold the key down).

### What this profile does not do

**Building and editing are not on the deck, on purpose.** Wall, Floor, Stairs, Roof and
Building Edit are the fastest inputs in the game and they live under your left hand on
`Z X C V G` already. Reaching for a deck key is slower than the key you are holding, so a
build button would make you worse, not faster. Every key here is also a single press of a
single key, with no sequences and no automation, which is the only thing that is safe with
Easy Anti-Cheat.

**Scope is Battle Royale defaults.** Creative and Zero Build players should check their
bindings before relying on the deck. If you have rebound a key, rebind that one key in the
Stream Deck app to match.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

$7.99. One marketplace comp, and it is a UEFN *creator* tool rather than a Battle Royale
*player* profile, so the niche has thin proof of paid conversion. Priced under Valorant's
$8.99 for that reason. Median comp $6.00 x 56 downloads, median comp untouched 771 days.
See `VALIDATION.md` (82.3/100 GO).

## Decisions

**Cut: all building and editing keys (Z/X/C/V wall/floor/stairs/roof, G edit, R rotate).**
The feasibility rule in `/rat-build` STEP 0 #4. These are the highest-APM inputs in
Fortnite and a Stream Deck press is physically slower than the keyboard key already under
the player's hand. Shipping them would sell a button that degrades play. Documented in the
buyer-facing section above rather than quietly omitted.

**Better Hotkeys used for Push to Talk only.** Exactly the Valorant precedent: a held comms
key, never a movement toggle. Palworld's auto-sprint style `bh_toggle_key` is deliberately
not used here because Fortnite runs Easy Anti-Cheat and a held movement key in a
competitive shooter is a risk the free plugin does not need to carry.

**Windows only for v1.** Fortnite has a Mac client but PC is the dominant competitive
population, same call as the published Valorant profile (VALIDATION.md).

**No third-party art on keys.** Tabler glyphs only, per `game-ip:epic`. Epic's Fan Content
Policy permits nominative use but not use of marks to promote a product, so no Epic or
Fortnite logos appear on any key or in the profile.

**Seasonal maintenance.** `patch-churn:seasonal-meta` is a live risk flag: Fortnite reworks
its control scheme across chapters. Re-verify the Game page keybinds within 7 days of each
chapter launch (SOP iron rule on game profiles).

**XL layout.** 26 content keys, so all three pages fold flat onto one XL screen with no
folders. The MK.2 keeps the three-page split.
