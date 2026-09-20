"""Shared icon generation for the sport trackers, on top of the factory renderer in
profiles/_build/icons.py (Tabler webfont, MIT, no AI generation).

Two grounds, deliberately:

- Action list icons and the category icon are drawn on a transparent ground. The Stream Deck
  app paints them over its own dark panel, so a filled square reads as a black box sitting next
  to Elgato's own icons.
- Key faces keep the brand ground, because those sit on a physical key and are what the user
  sees before any data arrives.

Generic sport glyphs only. No league, team or driver marks anywhere in these products.
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "profiles", "_build"))
sys.path.insert(0, os.path.join(ROOT, "brand"))

import icons  # noqa: E402
import tokens  # noqa: E402

WHITE = (255, 255, 255)


def generate(slug: str, uuid: str, actions: dict[str, str], plugin_glyph: str) -> None:
    out = os.path.join(ROOT, "plugins", slug, f"{uuid}.sdPlugin", "imgs")

    def write(rel, data):
        path = os.path.join(out, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)

    for folder, glyph in actions.items():
        # Action list: transparent, centred, filling more of the box since it carries no title.
        write(f"actions/{folder}/icon.png",
              icons.render(glyph, size=20, bg=None, fg=WHITE, glyph_size=15, cy_ratio=0.5))
        write(f"actions/{folder}/icon@2x.png",
              icons.render(glyph, size=40, bg=None, fg=WHITE, glyph_size=30, cy_ratio=0.5))
        # Key face: brand ground, glyph held high so a bottom aligned title has room.
        write(f"actions/{folder}/key.png",
              icons.render(glyph, size=72, bg=tokens.BG, fg=WHITE, glyph_size=34))
        write(f"actions/{folder}/key@2x.png",
              icons.render(glyph, size=144, bg=tokens.BG, fg=WHITE, glyph_size=68))

    write("plugin/marketplace.png",
          icons.render(plugin_glyph, size=72, bg=tokens.BG, fg=tokens.ACCENT, glyph_size=40, cy_ratio=0.5))
    write("plugin/marketplace@2x.png",
          icons.render(plugin_glyph, size=144, bg=tokens.BG, fg=tokens.ACCENT, glyph_size=80, cy_ratio=0.5))
    write("plugin/category-icon.png",
          icons.render(plugin_glyph, size=28, bg=None, fg=WHITE, glyph_size=18, cy_ratio=0.5))
    write("plugin/category-icon@2x.png",
          icons.render(plugin_glyph, size=56, bg=None, fg=WHITE, glyph_size=36, cy_ratio=0.5))

    print(f"icons written to {out}")
