"""Action and plugin icons for Soccer Tracker, via the shared generator.

Run from anywhere:  python plugins/soccer-tracker/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="soccer-tracker",
    uuid="com.packrat.soccer-tracker",
    actions={"score": "ball-football", "standings": "list-numbers", "scoreboard": "layout-grid"},
    plugin_glyph="ball-football",
)
