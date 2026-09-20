"""Generate the plugin's action + plugin icons from Tabler glyphs (reuses the factory
renderer in profiles/_build/icons.py). Packrat house style: white glyphs, accent green for
the store icon.

The action-list icons render on a transparent ground, because the Stream Deck app draws them
over its own dark panel and a filled square reads as a black box next to Elgato's own icons.
Key faces keep the brand ground, since those sit on the physical key.

Generic sport glyphs only. No league or team marks anywhere in this product.

Run from anywhere:  python plugins/nba-tracker/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="nba-tracker",
    uuid="com.packrat.nba-tracker",
    actions={"score": "ball-basketball", "standings": "list-numbers", "scoreboard": "layout-grid"},
    plugin_glyph="ball-basketball",
)
