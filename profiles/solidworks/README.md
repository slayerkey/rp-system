# SOLIDWORKS

The view cube, the selection filters and the shortcut bar on real keys. Every key is a
SOLIDWORKS default, so it works the moment you import it.

## Setup

1. Import: double-click the `.streamDeckProfile` for your device. Two are included:
   Stream Deck MK.2 (Windows) and Stream Deck XL (Windows).
2. Required plugins: none. Every key uses Stream Deck's built-in Hotkey action.
3. One-time binds: none. Every key matches a SOLIDWORKS default shortcut.
4. Page map:
   - **SOLIDWORKS** (home) - shortcut bar, command search, zoom, the five most-used
     view orientations, rebuild, save and undo.
   - **Views** - the full Ctrl+1 to Ctrl+8 view cube, the orientation bar and the tree.
   - **Select & Tools** - selection filters, sketch line, force regen, repeat, recent
     documents, component hide and show, and the display pane.

SOLIDWORKS must be the focused window when you press a key.

### SOLIDWORKS

| Button | Sends |
|---|---|
| Shortcut Bar | S |
| Search | W |
| Zoom Fit | F |
| Zoom In | Shift+Z |
| Zoom Out | Z |
| Isometric | Ctrl+7 |
| Normal To | Ctrl+8 |
| Front | Ctrl+1 |
| Top | Ctrl+5 |
| Right | Ctrl+4 |
| Rebuild | Ctrl+B |
| Save | Ctrl+S |
| Undo | Ctrl+Z |

### Views

Front `Ctrl+1`, Back `Ctrl+2`, Left `Ctrl+3`, Right `Ctrl+4`, Top `Ctrl+5`, Bottom `Ctrl+6`,
Isometric `Ctrl+7`, Normal To `Ctrl+8`, Orientation Bar `Spacebar`, Expand Tree `C`.

### Select & Tools

| Button | Sends |
|---|---|
| Faces | X |
| Edges | E |
| Verts | V |
| Filters | F6 |
| Filter Bar | F5 |
| Line | L |
| Force Regen | Ctrl+Q |
| Repeat | Enter |
| Recent | R |
| Hide Comp | Tab |
| Show Comp | Shift+Tab |
| Display Pane | F8 |

Hide and Show Component act on whatever your cursor is hovering, so keep the mouse on the
part and press the key.

### If you have customized your shortcuts

Plenty of SOLIDWORKS users do, and the productivity guides encourage it. This profile ships
the documented defaults. If a key does not match yours, check Tools > Customize > Keyboard
and rebind that one key in the Stream Deck app. Everything here is a plain single key press,
so it is a one field change.

## QA waivers

<!-- Warnings waived at /rat-qa, with date and reason. Empty is the goal. -->

---
<!-- INTERNAL BELOW: never ships -->

## Pricing and comps

$19.99, per `VALIDATION.md`. Deliberately under the Vectorworks anchor despite a richer
buyer, because there is **no comp anywhere** to price against. Priced to buy a conversion
signal, not to maximize per-unit.

## Decisions

**Built against the VALIDATION.md gate, on the owner's explicit call (2026-08-01).**
`VALIDATION.md` says 64/100 LEAN-GO, *"do not build yet"*, and gates the build on Vectorworks
publishing and converting first: zero competitors means no demand signal **and** no price
proof, and Vectorworks is the same shape with ~10x the volume and real comps. That gate is
**not met** - Vectorworks is built but unpublished. The owner chose to build anyway. Two
consequences worth carrying forward:

1. Neither flip-to-GO condition was satisfied. Condition 2 (a subject-matter pass on the
   shortcut set) is partially addressed below but not by an actual SOLIDWORKS user.
2. **Vectorworks was repriced $29.99 to $11.99 on 2026-08-01** after the SideshowFX
   command-count finding. So the conversion signal Vectorworks returns will be against
   $11.99, not the $34.99-median thesis the SOLIDWORKS scoring assumed. The read is still
   useful but it is not the experiment VALIDATION.md described.

**Shortcut sourcing.** Two independent sources: Innova Systems' default-shortcut reference
and the Ctrl+1-8 view cube confirmed separately. Dassault's own help page and the Javelin
PDF both return 403 to automated fetches, so they could not be used directly. Every key here
appears in at least one reseller reference and none conflict between sources.

**Layout leans on the least-customized commands.** VALIDATION.md's real caution is that this
audience remaps shortcuts more than most, so a defaults profile competes with the user's own
setup and with the `S` shortcut bar. The mitigation is to lead with the commands people
rarely rebind: the Ctrl+1-8 view cube, the F5/F6/X/E/V selection filters, and `S` itself.

**Cut: file and edit shortcuts beyond save and undo.** New, Open, Print, Cut, Copy, Paste are
standard Windows bindings that every user already has muscle memory for on the keyboard.
Spending deck keys on them would pad the count without adding value.

**Cut: arrow-key model rotation.** It is a held, repeated input, wrong shape for a single tap.

**Windows only.** SOLIDWORKS has no native macOS build, so 2 SKUs rather than 4.

**XL layout.** 35 content keys overflow the XL's 32, so home and Views fold onto one flat
page and Select & Tools stays a folder. The MK.2 keeps all three pages.
