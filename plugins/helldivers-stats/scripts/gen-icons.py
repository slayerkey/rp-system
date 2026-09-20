"""Generate Helldivers 2 Live Stats icons with the shared Tabler renderer."""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="helldivers-stats",
    uuid="com.packrat.helldivers-stats",
    actions={"major-order": "target", "closest-front": "world", "war-summary": "chart-pie"},
    plugin_glyph="world",
)

