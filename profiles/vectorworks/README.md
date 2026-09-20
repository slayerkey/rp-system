# Vectorworks

Every key on this profile sends a **Vectorworks 2026 default shortcut**. Import it and start
working. There is no keyboard customization to do first.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Four are included:
   Stream Deck MK.2 (Windows), MK.2 (Mac), Stream Deck XL (Windows), XL (Mac).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey action.
3. One-time binds: none. All keys match the Vectorworks default workspace.
4. Page map:
   - **Draw** (home) - the basic palette tools, undo/redo/save, and links to the other two pages.
   - **Modify** - object editing: move, duplicate, group, mirror, offset, trim, order, rotate.
   - **3D & Views** - modeling, navigation, standard views, and the render modes.

Vectorworks must be the focused window when you press a key.

### Draw

| Button | Sends |
|---|---|
| Select | X |
| Pan | H |
| Zoom | C |
| Line | 2 |
| Rect | 4 |
| Circle | 6 |
| Arc | 3 |
| Polyline | 5 |
| Polygon | 8 |
| Wall | 9 |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y |
| Save | Ctrl+S |

### Modify

| Button | Sends |
|---|---|
| Move | Ctrl+M |
| Duplicate | Ctrl+D |
| Group | Ctrl+G |
| Ungroup | Ctrl+U |
| Mirror | = |
| Offset | Shift+- |
| Fillet | 7 |
| Split | L |
| Trim | Ctrl+T |
| Bring Front | Ctrl+F |
| Send Back | Ctrl+B |
| Rotate Left | Ctrl+L |
| Rotate Right | Ctrl+Shift+R |
| Eyedropper | Shift+E |

### 3D & Views

| Button | Sends |
|---|---|
| Push Pull | Shift+R |
| Extrude | Ctrl+E |
| Add Solids | Ctrl+Alt+A |
| Sub Solids | Ctrl+Alt+S |
| Flyover | Shift+C |
| Walkthrough | Shift+U |
| Top / Plan | Ctrl+5 |
| Set 3D View | Ctrl+0 |
| Fit to Objects | Ctrl+6 |
| Wireframe | Ctrl+Shift+W |
| Shaded | Ctrl+Shift+G |
| Hidden Line | Ctrl+Shift+E |
| Render | Ctrl+Shift+F |
| Object Info | Ctrl+I |

On Mac every Ctrl above is Cmd, which is what the Mac profiles send.

### A note on workspaces

Vectorworks shortcuts are editable per workspace (Tools > Workspaces > Edit Current Workspace).
These keys match the shipped default workspace. If you have customized a shortcut, rebind that
one key in the Stream Deck app to whatever you use.

Number keys here are the **number row**, not the numeric keypad. Vectorworks tells the two apart,
and the keypad is reserved for its standard views.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

**$11.99, repriced down from $29.99 on 2026-08-01.**

A pre-art verification pass established what SideshowFX actually sells, and it is not a
comparable profile. It is an exhaustive command library:

| SideshowFX SKU | Commands (MK.2 / XL) |
|---|---|
| Fundamentals | 550 / 570 |
| Architect | 1152 / 1178 |
| Landmark | 1008 / 1020 |
| Spotlight | 1368 / 1400 |
| Design Suite | 1589 / 1621 |

Priced $24.49-$49.99. This profile ships **41 keys**. At $29.99 a buyer comparing feature
lists sees 41 against 1178, and "undercut the median" does not survive that comparison.
See `VALIDATION.md` (87.5/100 GO), whose competitor analysis counted SKUs but not
command depth.

## Positioning

**Lead on curation, not coverage.** The pitch is "the commands you actually use, not 1,200
you will never find." A one-screen set a working drafter can navigate is a real answer to
library bloat, and their median SKU has sat untouched for 689 days. But that argument only
works at a price that does not invite a feature-count fight, which is why this is $11.99
and not $29.99.

Art and copy should show the three pages in full and make the point that everything is
reachable in one or two presses. Do not claim breadth.

## Decisions

**One bundled profile, not per-edition SKUs.** SideshowFX fragments this niche into five
listings split by Vectorworks edition (Spotlight, Design Suite, Fundamentals, Landmark,
Architect). The command set on these three pages is the shared core that exists in every
edition, so one listing covers all of them.

**Cut: shortcuts that genuinely differ between Windows and Mac.** Vectorworks diverges on more
than the Ctrl/Cmd convention for a handful of binds: Clip (Shift+N vs Option+C), Connect/Combine
(`;` vs Option+L), Attribute Mapping (Shift+A vs Option+A), Window tool (Shift+D vs
Option+Shift+W), Analysis (Shift+apostrophe vs Shift+A), Layer Options Show/Snap/Modify
(Ctrl+Alt+8 vs Cmd+Option+9), Activate Object Info Palette (Ctrl+backquote vs Cmd+Option+C).
`mac_variant()` only applies the mechanical Ctrl to Cmd swap, so shipping those would put a
wrong key on the Mac profiles. They are excluded so one layout is correct on both platforms.

**Cut: the numeric-keypad standard views (0-9 Num).** Vectorworks distinguishes keypad digits
from number-row digits and the Elgato hotkey action sends the number row. Top/Plan and Set 3D
View are covered instead by their Ctrl+5 / Ctrl+0 menu commands, which are number-row.

**Cut: Spotlight-menu commands.** Entertainment-design shortcuts (Spotlight Numbering, Focus
Lighting Devices, Label Legend Manager) only exist in the Spotlight edition. Including them
would have forced the per-edition SKU split this product deliberately avoids.

**No More Profiles key.** `profiles/_build/validate.py` treats a marketplace link inside a
profile as a rejection vector, so no page carries one.

**XL layout.** 41 content keys overflow the XL's 32, so Draw and Modify fold onto one flat
page and 3D & Views stays a folder. The MK.2 keeps all three pages.
