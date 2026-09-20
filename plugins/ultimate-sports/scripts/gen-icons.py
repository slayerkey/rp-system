"""Generate the plugin's action + plugin icons from Tabler glyphs (reuses the factory
renderer in profiles/_build/icons.py). Packrat house style: white glyphs, accent green for
the store icon.

The action-list icons render on a transparent ground, because the Stream Deck app draws them
over its own dark panel and a filled square reads as a black box next to Elgato's own icons.
Key faces keep the brand ground, since those sit on the physical key.

Generic sport glyphs only. No league or team marks anywhere in this product, which is the same
constraint that governs the key faces: colours and abbreviations, never a logo or a crest.

Run from anywhere:  python plugins/ultimate-sports/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="ultimate-sports",
    uuid="com.packrat.ultimatesports",
    actions={
        # The headline action gets the star: it is the one key that holds every sport at once.
        "myteams": "star",
        "score": "ball-football",
        "standings": "list-numbers",
        "scoreboard": "layout-grid",
        "event": "calendar-event",
        "card": "swords",
        "rankings": "trophy",
        "dial": "circle-dot",
    },
    plugin_glyph="ball-football",
)
