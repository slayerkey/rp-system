# DaVinci Resolve Lite + Pro: SHIPPED 2026-08-11

Both submitted to Elgato through `/rat-ship` with auto-publish ON, so approval puts
them straight on the marketplace. Review takes 4-10 business days.

| Product | Price | Status |
|---|---|---|
| DaVinci Resolve Lite | Free | Submitted, pending review |
| DaVinci Resolve Pro | 29.99 | Submitted, pending review |

Both went out with: 6 device variants in one zip, Type "Creative Tools, Video", OS
macOS + Windows, devices Stream Deck MK + XL + Plus, "Supports Stream Deck + dials"
YES, "Includes icons" YES, version 1.0.0. Lite carried 6 gallery items, Pro 8, each
verified one at a time in kit order.

**Name and price are locked now.** Changing either takes an email to
maker@elgato.com. Gallery order is frozen.

## What the original handoff listed as blockers

All three were resolved before submission.

1. **Dist zip held 1 of 6 variants.** `make_dist_zip` in
   `profiles/_build/gen_marketing.py` globbed and kept whichever
   `.streamDeckProfile` sorted first. It now packs every variant named in the
   registry. Repo-wide, so the other profiles pick it up on their next `/rat-art`.
   Note the file actually uploaded was always the SHIP_KIT zip from
   `tools/ship/make_kit.py`, which had all six the whole time.
2. **"Packrat Marketplace.url" in the download.** Owner said keep it, and add a
   buyer-facing README. Both zips now carry `INSTALL.md` plus the marketplace
   shortcut. `INSTALL.md`, never `README.md`: a product folder's README is the
   internal build log and carries pricing rationale and competitor numbers.
3. **Pro hero clipped the Plus.** Fixed in `render_device_lineup` in
   `../_shared/marketing_engine.py`: only the gap following a deck with dials opens
   up, so the MK.2/XL fan overlap is unchanged at 0.17.

## Tooling bugs found and fixed during the run

Worth knowing, because they would have hit the next profile too.

- `registry.json` had no `marketplace_category` or `marketplace_devices` for either
  product, and `OS_BY_VARIANT` in `maker_console.mjs` only mapped `vsd_*`/`win`/`mac`,
  so every `std_*`, `xl_*` and `plus_*` variant silently became `undefined`. Device
  and OS went unset, Continue stayed disabled, and the run died on a 6s click
  timeout that looked like a selector fault. OS is now derived from the `_mac`
  suffix, and a preflight refuses to create a draft at all if either registry key is
  missing.
- The pre-submit version gate read "first text input on the page" and picked up
  "Stream Deck 7.1.0 or later" off the Compatibility summary, aborting a correct
  submission one click from the end. It now uses the same selector chain that
  filled the field.
- The price field is now read back after filling. It only exists on the create
  wizard's details slide and cannot be changed after submit.
- "Supports Stream Deck + dials" and "Includes icons" were never being ticked.
  Both are set now, and both are non-fatal if the console changes.

Each crashed run leaves 7 to 9 Chromium processes alive holding
`.playwright-profile`, which breaks the next run with a misleading error. Kill any
`ms-playwright` chrome processes before re-running.

## Next

`/rat-pulse` starts tracking once they publish. If either is rejected, the reviewer
feedback goes in `profiles/<slug>/REVIEWS.md` with the date, and the same day a
check goes into `tools/qa/checks_*.py` that would have caught it.

The old "Davinci Resolve Edit Profile" at 17.99 stays up per owner decision. It is
not in this Maker Console org, which matches the registry note that it went live
through a channel the registry did not track at the time.

## Context worth keeping

Everything runs on Resolve's **default** keymap, verified against the owner's own
install with `profiles/_build/verify_preset.py --check`. There is no keyboard preset
for a buyer to import, which is the main differentiator against SideshowFX, whose
listing requires their shortcut file.

Printer lights work because Resolve already binds them to the numeric keypad. The
Plus drives them from dials; MK.2 and XL put the same commands on keys. The Color
page needs Printer Lights pressed once before any of it responds, which is why that
key is a two-state switch showing a lit bulb when active. `INSTALL.md` tells the
buyer this up front.
