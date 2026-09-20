# coding: utf-8
#!/usr/bin/env python3
"""
Elgato requires the in-app category + action icons to be monochrome white on a
transparent background:
https://docs.elgato.com/guidelines/stream-deck/plugins#icons

gen-icons.mjs draws the branded (coloured) gauge used for the Marketplace icon and
the key preview. This overwrites just the two in-app icon sets with a white render
of the provider's real logo, so each plugin stays distinguishable in the sidebar.

Run: python scripts/gen-white-icons.py [provider ...]
"""
import io, os, re, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

import resvg_py
from PIL import Image

PROVIDERS = {
    "gemini":     ("com.ratpack.gemini-usage.sdPlugin",     "gemini-logo.svg"),
    "copilot":    ("com.ratpack.copilot-usage.sdPlugin",    "copilot-logo.svg"),
    "grok":       ("com.ratpack.grok-usage.sdPlugin",       "grok-logo.svg"),
    "perplexity": ("com.ratpack.perplexity-usage.sdPlugin", "perplexity-logo.svg"),
}

# (relative path, px) — Elgato's required sizes for the in-app icons.
TARGETS = [
    ("imgs/plugin/category-icon.png", 28),
    ("imgs/plugin/category-icon@2x.png", 56),
    ("imgs/actions/usage/icon.png", 20),
    ("imgs/actions/usage/icon@2x.png", 40),
]

def white_logo(svg_path, size):
    """Render an SVG to a white-on-transparent PNG of `size`, with a small margin."""
    raw = open(svg_path, encoding="utf-8").read()
    ss = max(size * 8, 256)  # render big, downsample for clean edges at 20px
    png = resvg_py.svg_to_bytes(
        svg_string=raw, width=ss, height=ss,
        style_sheet="* { fill: #ffffff; stroke: none; }",
    )
    logo = Image.open(io.BytesIO(bytes(png))).convert("RGBA")
    # Trim to the glyph, then re-pad so every logo optically fills the same box.
    bbox = logo.getbbox()
    if bbox:
        logo = logo.crop(bbox)
    inner = max(1, int(size * 0.86))
    scale = min(inner / logo.width, inner / logo.height)
    logo = logo.resize((max(1, int(logo.width * scale)), max(1, int(logo.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(logo, dest=((size - logo.width) // 2, (size - logo.height) // 2))
    # Force pure white; keep the rendered alpha as the shape.
    alpha = out.split()[3]
    white = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    white.putalpha(alpha)
    return white

def build(provider):
    plugin_dir, logo_name = PROVIDERS[provider]
    svg_path = os.path.join(ROOT_DIR, "assets", logo_name)
    if not os.path.exists(svg_path):
        print(f"  ! {provider}: missing {logo_name}")
        return
    for rel, size in TARGETS:
        path = os.path.join(ROOT_DIR, plugin_dir, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        white_logo(svg_path, size).save(path)
    # Drop the white SVG alongside as the scalable variant. Force every painted fill to
    # white (sources vary: #8E75B2, #000000, currentColor); leave fill="none" alone so a
    # root element that paints nothing keeps doing so.
    svg_out = os.path.join(ROOT_DIR, plugin_dir, "imgs", "plugin", "category-icon.svg")
    raw = open(svg_path, encoding="utf-8").read()
    white_svg = re.sub(r'fill="(?!none")[^"]*"', 'fill="#FFFFFF"', raw)
    open(svg_out, "w", encoding="utf-8").write(white_svg)
    print(f"  > {provider}: 4 white icons + category-icon.svg")

def main():
    ids = sys.argv[1:] or list(PROVIDERS)
    print("Writing white in-app icons (Elgato guideline: #FFFFFF on transparent)")
    for p in ids:
        if p not in PROVIDERS:
            print(f"  ! unknown provider {p}")
            continue
        build(p)
    print("Done.")

if __name__ == "__main__":
    main()
