#!/usr/bin/env python3
"""Deterministic Neo-only Marketplace previews. Never draw fictional device hardware."""
from __future__ import annotations

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO = Path(__file__).resolve().parents[3]
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dist" / "marketplace-art"
W, H = 1920, 960
BG, PANEL = (7, 10, 16), (14, 19, 28)
WHITE, MUTED, GREEN = (245, 247, 250), (158, 169, 185), (43, 232, 106)
RAT = REPO / "tools" / "art" / "assets" / "ratpack-icon-transparent.png"


def font(size, bold=False):
    env = os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    candidates = [Path(env)] if env else []
    if os.name == "nt":
        candidates += [Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf")]
    else:
        candidates += [Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
                           "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    raise SystemExit("PackRat artwork requires its real brand font, no fallback")


def canvas():
    img = Image.new("RGBA", (W, H), BG + (255,))
    glow = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(glow)
    d.ellipse((230, 350, 1200, 1260), fill=GREEN + (18,))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(165)))


def brand(img):
    if not RAT.exists():
        raise SystemExit(f"PackRat logo missing: {RAT}")
    rat = Image.open(RAT).convert("RGBA")
    box = rat.getbbox()
    if box:
        rat = rat.crop(box)
    ratio = min(64/rat.width, 64/rat.height)
    rat = rat.resize((int(rat.width*ratio), int(rat.height*ratio)), Image.Resampling.LANCZOS)
    img.alpha_composite(rat, ((W-rat.width)//2, 39))


def text(draw, xy, value, size=32, bold=False, fill=WHITE, anchor=None):
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)


def header(img, title, subtitle):
    brand(img)
    d = ImageDraw.Draw(img)
    text(d, (W//2, 158), title, 67, True, WHITE, "mm")
    text(d, (W//2, 218), subtitle, 27, False, MUTED, "mm")


def strip(img, left, top, width, height, mode="overview", values=None):
    # Exact physical aspect ratio: 232x50, enlarged for readable Marketplace previews.
    assert abs(width/height - 232/50) < 0.04
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((left, top, left+width, top+height), radius=21, fill=PANEL, outline=(66,75,88), width=3)
    if mode == "overview":
        entries = values or [("CPU", "34%"), ("GPU", "61%"), ("RAM", "47%")]
        for idx, (label, value) in enumerate(entries):
            x = left + width*(idx + .5)/3
            text(d, (x, top+height*.31), label, 28, True, MUTED, "mm")
            text(d, (x, top+height*.67), value, 62, True, WHITE, "mm")
            if idx:
                boundary = left + width*idx/3
                d.line((boundary, top+37, boundary, top+height-37), fill=(42,50,60), width=2)
    else:
        label, value, companion = values or ("GPU LOAD", "61%", "GPU TEMP 63°C")
        text(d, (left+50, top+53), label, 30, True, MUTED)
        text(d, (left+50, top+108), value, 82, True, WHITE)
        text(d, (left+width-60, top+53), companion, 29, True, MUTED, "ra")
        graph = [23, 24, 29, 22, 36, 42, 33, 55, 46, 51, 61, 58]
        right_start = left+width*.60
        right_end = left+width-65
        lo, hi = min(graph), max(graph)
        coords = [(right_start + (right_end-right_start)*i/(len(graph)-1),
                   top+height*.83-(v-lo)/(hi-lo)*height*.32) for i,v in enumerate(graph)]
        d.line(coords, fill=GREEN, width=7, joint="curve")


def footer(img, label="232 × 50 INFOBAR PREVIEW · WINDOWS · STREAM DECK 7.6+"):
    d = ImageDraw.Draw(img)
    text(d, (W//2, 897), label, 22, True, MUTED, "mm")


def frame(name, title, subtitle, mode="overview", values=None, caption=None):
    img = canvas()
    header(img, title, subtitle)
    strip(img, 175, 346, 1570, 338, mode, values)
    if caption:
        text(ImageDraw.Draw(img), (W//2, 766), caption, 30, True, GREEN, "mm")
    footer(img)
    img.convert("RGB").save(OUT/name, optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frame("02_cover.png", "PERFORMANCE GRAPHER NEO",
          "PC performance at a glance. Keep all eight keys free.",
          caption="CPU  ·  GPU  ·  RAM  —  NO KEY REQUIRED")
    frame("03_gallery_01.png", "YOUR PC. ONE GLANCE.",
          "A dedicated system overview for Stream Deck Neo.",
          caption="Live local monitoring. Missing sensors never become fake zeroes.")
    frame("04_gallery_02.png", "ONE METRIC. REAL HISTORY.",
          "Show your selected reading with a compact optional 60-second trend.",
          "single", caption="GPU load shown with a supported temperature companion.")
    frame("05_gallery_03.png", "ROTATE THE METRICS YOU CARE ABOUT.",
          "Choose three readings and switch every 3, 5, or 10 seconds.",
          "overview", [("GPU", "61%"), ("CPU", "34%"), ("RAM", "47%")],
          "GPU → CPU → RAM · one Infobar, no extra key.")
    frame("06_gallery_04.png", "TUNED FOR NEO.",
          "Simple labels, readable values, optional trends, and selectable refresh.",
          "single", ("CPU LOAD", "34%", "CPU TEMP 58°C"),
          "Windows CPU/RAM baseline · compatible hardware sensors when available.")
    # Search icon is a cropped real product icon: no device mockup or AI imagery.
    icon_src = ROOT / "com.packrat.performance-grapher-neo.sdPlugin" / "imgs" / "plugin" / "icon.png"
    icon = Image.open(icon_src).convert("RGBA").resize((288,288), Image.Resampling.LANCZOS)
    icon.save(OUT/"01_search_icon.png", optimize=True)
    for file in ["01_search_icon.png", "02_cover.png", "03_gallery_01.png",
                 "04_gallery_02.png", "05_gallery_03.png", "06_gallery_04.png"]:
        assert (OUT/file).is_file()
    print("Rendered exact-ratio Neo-only cover, four galleries, and 288x288 icon.")

if __name__ == "__main__":
    main()
