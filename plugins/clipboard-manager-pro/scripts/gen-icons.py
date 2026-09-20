"""Generate Clipboard Manager Pro icons from Tabler glyphs."""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "plugins", "_shared", "scripts"))

from gen_icons import generate  # noqa: E402

generate(
    slug="clipboard-manager-pro",
    uuid="com.packrat.clipboardpro",
    actions={"slot": "clipboard-text", "picker": "search"},
    plugin_glyph="clipboard-copy",
)
