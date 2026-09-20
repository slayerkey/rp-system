# coding: utf-8
#!/usr/bin/env python3
"""
Fix action list icons and category icons for both plugins to be
white (#FFFFFF) on a transparent background, per Elgato guidelines.
Run from anywhere: py ratpack-livestats/scripts/fix-icons.py
"""
import os, sys, subprocess

def ensure_deps():
    try: import PIL
    except:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow>=10.3.0"])

ensure_deps()
from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT       = os.path.dirname(SCRIPT_DIR)          # ratpack-livestats
PROJECTS   = os.path.dirname(ROOT)                # Claude Projects

# ── Helpers ───────────────────────────────────────────────────────────────────

def blank(sz):
    return Image.new("RGBA", (sz, sz), (0, 0, 0, 0))

def save_png(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    rel = os.path.relpath(path, PROJECTS)
    print("  PNG  %s" % rel)

def write_svg(content, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    rel = os.path.relpath(path, PROJECTS)
    print("  SVG  %s" % rel)

# ── Kick K-logo ───────────────────────────────────────────────────────────────
# Path data native coords: 24 x 24 grid
KICK_PTS = [
    (1.333,0),(9.333,0),(9.333,5.333),(12,5.333),(12,2.667),
    (14.667,2.667),(14.667,0),(22.667,0),(22.667,8),(20,8),
    (20,10.667),(17.333,10.667),(17.333,13.333),(20,13.333),
    (20,16),(22.667,16),(22.667,24),(14.667,24),(14.667,21.333),
    (12,21.333),(12,18.667),(9.333,18.667),(9.333,24),(1.333,24),
]

def kick_icon_png(sz):
    pad = max(1, sz // 10)
    s   = (sz - 2 * pad) / 24.0
    img = blank(sz)
    pts = [(int(x * s + pad), int(y * s + pad)) for x, y in KICK_PTS]
    ImageDraw.Draw(img).polygon(pts, fill=(255, 255, 255, 255))
    return img

KICK_SVG = """\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="#FFFFFF" d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z"/>
</svg>"""

# ── Sparkline (livestats) ─────────────────────────────────────────────────────
# Coordinates native to a 20 x 20 grid
SPARK_LINE = [(1.6,16.0),(5.9,11.7),(7.8,13.0),(12.1,8.8),(13.7,9.4),(17.2,4.9)]
SPARK_ARR  = [(18.4,3.4),(16.3,4.2),(18.0,5.6)]

def sparkline_icon_png(sz):
    pad = max(1, sz // 12)
    s   = (sz - 2 * pad) / 20.0
    img = blank(sz)
    d   = ImageDraw.Draw(img)
    w   = max(1, round(sz * 1.5 / 20))
    pts = [(x * s + pad, y * s + pad) for x, y in SPARK_LINE]
    d.line(pts, fill=(255,255,255,255), width=w, joint="curve")
    arr = [(int(x * s + pad), int(y * s + pad)) for x, y in SPARK_ARR]
    d.polygon(arr, fill=(255,255,255,255))
    return img

def sparkline_svg(w, h):
    # Scale the 20x20 sparkline coordinates into the target viewBox
    sx = w / 20.0; sy = h / 20.0
    def p(x, y): return "%.1f,%.1f" % (x * sx, y * sy)
    pts = " ".join(p(x, y) for x, y in SPARK_LINE)
    arr_pts = " ".join("%.1f,%.1f" % (x * sx, y * sy) for x, y in SPARK_ARR)
    sw = max(1.5, w * 1.5 / 20)
    ax0,ay0 = SPARK_ARR[0]; ax1,ay1 = SPARK_ARR[1]; ax2,ay2 = SPARK_ARR[2]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">\n'
        '<polyline points="%s" fill="none" stroke="#FFFFFF" stroke-width="%.1f"'
        ' stroke-linecap="round" stroke-linejoin="round"/>\n'
        '<path d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z" fill="#FFFFFF"/>\n'
        '</svg>'
    ) % (
        w, h, w, h,
        pts, sw,
        ax0*sx, ay0*sy, ax1*sx, ay1*sy, ax2*sx, ay2*sy,
    )

# ── Fix ratpack-kick ──────────────────────────────────────────────────────────

def fix_kick():
    plug = os.path.join(PROJECTS, "ratpack-kick", "com.ratpack.kick.sdPlugin")

    save_png(kick_icon_png(20), os.path.join(plug, "imgs", "actions", "stats", "icon.png"))
    save_png(kick_icon_png(40), os.path.join(plug, "imgs", "actions", "stats", "icon@2x.png"))
    save_png(kick_icon_png(28), os.path.join(plug, "imgs", "plugin", "category-icon.png"))
    save_png(kick_icon_png(56), os.path.join(plug, "imgs", "plugin", "category-icon@2x.png"))

    write_svg(KICK_SVG, os.path.join(plug, "imgs", "actions", "stats", "icon.svg"))
    write_svg(KICK_SVG, os.path.join(plug, "imgs", "plugin", "category-icon.svg"))

# ── Fix ratpack-livestats ─────────────────────────────────────────────────────

def fix_livestats():
    plug = os.path.join(PROJECTS, "ratpack-livestats", "com.ratpack.livestats.sdPlugin")

    save_png(sparkline_icon_png(20), os.path.join(plug, "imgs", "actions", "stats", "icon.png"))
    save_png(sparkline_icon_png(40), os.path.join(plug, "imgs", "actions", "stats", "icon@2x.png"))
    save_png(sparkline_icon_png(28), os.path.join(plug, "imgs", "plugin", "category-icon.png"))
    save_png(sparkline_icon_png(56), os.path.join(plug, "imgs", "plugin", "category-icon@2x.png"))

    write_svg(sparkline_svg(20, 20),  os.path.join(plug, "imgs", "actions", "stats", "icon.svg"))
    write_svg(sparkline_svg(40, 40),  os.path.join(plug, "imgs", "actions", "stats", "icon@2x.svg"))
    write_svg(sparkline_svg(28, 28),  os.path.join(plug, "imgs", "plugin", "category-icon.svg"))
    write_svg(sparkline_svg(56, 56),  os.path.join(plug, "imgs", "plugin", "category-icon@2x.svg"))

# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n=== ratpack-kick ===")
    fix_kick()
    print("\n=== ratpack-livestats ===")
    fix_livestats()
    print("\nDone. Both plugins need a rebuild + repack before uploading.")
