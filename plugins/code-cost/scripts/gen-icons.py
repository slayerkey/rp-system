"""Generate the action and plugin icons from Tabler glyphs (reuses the factory renderer in
profiles/_build/icons.py, same as every tracker).

No Anthropic or OpenAI marks anywhere in this product: the glyph is a generic coin/meter, so
there is no third-party logo on a key or on the store icon.

Run from anywhere:  python plugins/code-cost/scripts/gen-icons.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="code-cost",
    uuid="com.packrat.code-cost",
    actions={"cost": "coin"},
    plugin_glyph="coin",
)
