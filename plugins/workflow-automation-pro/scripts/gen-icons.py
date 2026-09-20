"""Generate the plugin's action + plugin icons from Tabler glyphs (reuses the factory
renderer in profiles/_build/icons.py). Packrat house style: white glyphs, accent green for
the store icon.

Run from anywhere:  python plugins/workflow-automation-pro/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="workflow-automation-pro",
    uuid="com.packrat.workflowpro",
    actions={"run": "player-play"},
    plugin_glyph="route",
)
