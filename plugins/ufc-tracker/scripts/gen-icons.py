"""Action and plugin icons for UFC Tracker, via the shared generator.

Run from anywhere:  python plugins/ufc-tracker/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="ufc-tracker",
    uuid="com.packrat.ufc-tracker",
    actions={"event": "karate", "card": "list-numbers"},
    plugin_glyph="karate",
)
