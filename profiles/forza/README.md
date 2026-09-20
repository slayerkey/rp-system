# Forza

Camera, photo mode, telemetry, radio and map without taking a hand off the wheel.
Works with **Forza Horizon 6 and Forza Horizon 5**.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Two are included:
   Stream Deck MK.2 (Windows) and Stream Deck XL (Windows).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey and Website actions.
3. One-time binds: none. Every key matches the game's default keyboard controls.
4. Page map:
   - **Forza** (home) - photo, camera, map, telemetry, rewind, horn, radio, Anna,
     Forza LINK, convertible, leaderboard, activate.
   - **Links** - forza.net, tunes, car wiki, support.

The game must be the focused window when you press a key.

### Forza

| Button | Sends |
|---|---|
| Photo | P |
| Camera | Tab |
| Map | M |
| Telemetry | T |
| Rewind | R |
| Horn | H |
| Radio Back | - (minus) |
| Radio Next | = (equals) |
| Anna | C |
| Forza LINK | V |
| Convertible | G |
| Leaders | L |
| Activate | Enter |

### Why there are no driving keys

Accelerate, brake, steering, gears, clutch and handbrake are not on this profile and will
not be. They are held inputs, and your hands are already on the wheel or on WASD. A deck key
cannot help you drive. What it can do is take over everything around the driving, which is
exactly the part that currently costs you a hand mid race.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

$7.99, undercutting MambaTech's $9.99 and matching Respawn's $7.99. Monetization is soft:
only 50% of comps are paid, median paid comp $8.99 x 39 downloads. See `VALIDATION.md`
(79.5 numeric, downgraded to LEAN-GO).

## Decisions

**VALIDATION.md is out of date on the most important fact: Forza Horizon 6 shipped
2026-05-19** (PC, Xbox, Game Pass; set in Japan). The 2026-07-31 validation discusses
"Horizon" versus "Motorsport" and never mentions FH6. This matters twice over:

1. Building an FH5-only profile in August 2026 would target the previous game.
2. It explains the `competition:freshly-contested-2026-06` flag. All three "fresh" comps
   (Corsair 2026-05-22, MambaTech 2026-06-16, Respawn Icons 2026-06-29) landed in the weeks
   right after the FH6 launch. That is a launch-wave cluster, not a niche that spontaneously
   got crowded. The validation read the dates but not the cause.

**Decision: one profile covering Horizon 6 and Horizon 5, rather than picking one.** The two
games share an identical PC keyboard scheme for every key on this profile, verified against
control guides for both. That is a real differentiator, because the three competing listings
are single-game Horizon profiles. It also resolves the open Motorsport-versus-Horizon
question in VALIDATION.md without the audience cost of going to Motorsport, which is the far
smaller player base. Same reasoning as the Vectorworks "one profile across editions" call.

The listing name should stay **"Forza"** (the registry name) rather than
"Forza Horizon Profile" from VALIDATION.md, so the two-game coverage is not contradicted by
the title. Worth an owner check at `/rat-ship`.

**Cut: all driving inputs.** Accelerate, brake, steer, gear up/down, clutch, handbrake. Held
or twitch inputs with the player's hands committed elsewhere. Same feasibility rule applied
to Fortnite's building keys.

**Cut: look controls (arrow keys) and telemetry paging (PgUp/PgDn).** Look is held, and the
telemetry pager only does anything while the telemetry overlay is already open.

**No third-party art on keys.** Tabler glyphs only. Microsoft/Xbox rules are standard
nominative use, and individual car-manufacturer marks are only a concern if vehicles or
logos are depicted, which they are not.

**Competitive intensity still unresolved.** VALIDATION.md's flip-to-GO condition was to wait
and see whether the niche stops attracting entrants. It has not been re-checked since
2026-07-31. Given the FH6 launch-wave explanation this looks less alarming than the flag
implies, but re-run `/rat-pulse` before committing marketing spend.

**XL layout.** 17 content keys, so both pages fold flat onto one XL screen with no folder.
The MK.2 keeps the two-page split.
