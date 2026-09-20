"""Generate the plugin's action + plugin icons from Tabler glyphs (reuses the factory
renderer in profiles/_build/icons.py). Packrat house style: white glyphs on the near-black
brand ground, accent green for the toggle "on" states and the store icon.

Run from anywhere:  python plugins/screensaver-cycler/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "profiles", "_build"))
sys.path.insert(0, os.path.join(ROOT, "brand"))

import icons  # noqa: E402
import tokens  # noqa: E402

BG = tokens.BG
WHITE = (255, 255, 255)
ACCENT = tokens.ACCENT
OUT = os.path.join(ROOT, "plugins", "screensaver-cycler",
                   "com.packrat.screensavercycler.sdPlugin", "imgs")

# One glyph per action. Next = skip-forward, Cycle = rotate, Schedule = clock.
ACTIONS = {"next": "player-track-next", "cycle": "rotate", "schedule": "clock"}
TOGGLES = {"cycle", "schedule"}  # these have an "on" state


def write(rel, data):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def key_pair(folder, glyph, on=False):
    fg = ACCENT if on else WHITE
    dot = ACCENT if on else None
    name = "key_on" if on else "key"
    # cy_ratio 0.40 keeps the glyph high so the bottom-aligned key title has room.
    write(f"actions/{folder}/{name}.png", icons.render(glyph, size=72, bg=BG, fg=fg, glyph_size=34, dot=dot))
    write(f"actions/{folder}/{name}@2x.png", icons.render(glyph, size=144, bg=BG, fg=fg, glyph_size=68, dot=dot))


def icon_pair(folder, glyph):
    # The action-list icon is tiny and has no title, so centre it and fill more of the box.
    write(f"actions/{folder}/icon.png", icons.render(glyph, size=20, bg=BG, fg=WHITE, glyph_size=15, cy_ratio=0.5))
    write(f"actions/{folder}/icon@2x.png", icons.render(glyph, size=40, bg=BG, fg=WHITE, glyph_size=30, cy_ratio=0.5))


for folder, glyph in ACTIONS.items():
    icon_pair(folder, glyph)
    key_pair(folder, glyph, on=False)
    if folder in TOGGLES:
        key_pair(folder, glyph, on=True)

# Plugin store icon + category icon: a monitor, accent green for the store, white for the list.
write("plugin/marketplace.png", icons.render("device-desktop", size=72, bg=BG, fg=ACCENT, glyph_size=40, cy_ratio=0.5))
write("plugin/marketplace@2x.png", icons.render("device-desktop", size=144, bg=BG, fg=ACCENT, glyph_size=80, cy_ratio=0.5))
write("plugin/category-icon.png", icons.render("device-desktop", size=28, bg=BG, fg=WHITE, glyph_size=18, cy_ratio=0.5))
write("plugin/category-icon@2x.png", icons.render("device-desktop", size=56, bg=BG, fg=WHITE, glyph_size=36, cy_ratio=0.5))

print("icons written to", OUT)
