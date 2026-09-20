"""Action and plugin icons for NASCAR Tracker, via the shared generator.

Run from anywhere:  python plugins/nascar-tracker/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="nascar-tracker",
    uuid="com.packrat.nascar-tracker",
    actions={"event": "steering-wheel", "card": "flag", "standings": "list-numbers"},
    plugin_glyph="steering-wheel",
)
