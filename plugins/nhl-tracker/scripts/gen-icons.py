"""Action and plugin icons for NHL Tracker, via the shared generator.

Run from anywhere:  python plugins/nhl-tracker/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="nhl-tracker",
    uuid="com.packrat.nhl-tracker",
    actions={"score": "trophy", "standings": "list-numbers", "scoreboard": "layout-grid"},
    plugin_glyph="trophy",
)
