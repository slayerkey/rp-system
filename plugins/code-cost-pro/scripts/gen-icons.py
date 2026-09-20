"""Action and plugin icons from Tabler glyphs (reuses profiles/_build/icons.py via the shared
generator, same as every other Packrat plugin).

No Anthropic or OpenAI marks anywhere: generic glyphs only, so there is no third-party logo on
a key or on the store icon.

Run from anywhere:  python plugins/code-cost-pro/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="code-cost-pro",
    uuid="com.packrat.code-cost-pro",
    actions={
        "value": "scale",
        "cost": "coin",
        "breakdown": "chart-donut",
        "cache": "database",
        "trend": "chart-bar",
    },
    plugin_glyph="coin",
)
