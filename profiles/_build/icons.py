"""Tabler webfont -> 72x72 button PNGs (sourced MIT icon assets, no AI generation).

Glyphs render in the upper portion of the key so Stream Deck's bottom-aligned
title text has room. "-on" variants (for Better Hotkeys toggle states) get the
accent color plus an indicator dot so an engaged toggle is unmistakable.
"""
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).parent / "assets"
TTF = ASSETS / "tabler-icons.ttf"
CSS = ASSETS / "tabler-icons.css"

_map: dict[str, str] | None = None

def icon_map() -> dict[str, str]:
    global _map
    if _map is None:
        css = CSS.read_text(encoding="utf-8")
        _map = {name: chr(int(code, 16)) for name, code in re.findall(
            r'\.ti-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', css)}
    return _map

def _rainbow(size: int, span=None) -> Image.Image:
    """Horizontal red-to-violet hue sweep. span=(x0,x1) maps the full sweep
    across that x-range so a glyph narrower than the key still gets all hues."""
    import colorsys
    x0, x1 = span or (0, size)
    grad = Image.new("RGB", (size, 1))
    for x in range(size):
        t = min(1.0, max(0.0, (x - x0) / max(1, x1 - x0)))
        r, g, b = colorsys.hsv_to_rgb(t * 0.83, 0.85, 1.0)
        grad.putpixel((x, 0), (int(r * 255), int(g * 255), int(b * 255)))
    return grad.resize((size, size))

def render(name: str, size: int = 72, bg=(20, 20, 20), fg=(255, 255, 255),
           glyph_size: int = 34, cy_ratio: float = 0.40, dot=None,
           flip: bool = False, nav: bool = False) -> bytes:
    """One key PNG. dot=(r,g,b) draws a small top-right state dot.
    fg="rainbow" fills the glyph with a hue gradient; bg="rainbow" makes the
    whole key face a (darkened) rainbow. flip mirrors the glyph. nav=True marks
    a sub-page folder key: dim outline frame + chevron badge so navigation keys
    read differently from action keys."""
    ch = icon_map().get(name)
    if ch is None:
        raise KeyError(f"Tabler icon not found: {name}")
    if bg == "rainbow":
        img = Image.blend(_rainbow(size), Image.new("RGB", (size, size), (0, 0, 0)), 0.35)
    elif bg is None:
        # Transparent ground: what the Stream Deck app's action list wants, since it draws
        # these over its own dark panel and a filled square reads as a black box.
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    else:
        img = Image.new("RGB", (size, size), bg)
    font = ImageFont.truetype(str(TTF), glyph_size)
    glyph = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glyph).text((size / 2, size * cy_ratio), ch, font=font,
                               fill=255, anchor="mm")
    if flip:
        glyph = glyph.transpose(Image.FLIP_LEFT_RIGHT)
    if fg == "rainbow":
        bbox = glyph.getbbox() or (0, 0, size, size)
        fill = _rainbow(size, span=(bbox[0], bbox[2]))
    else:
        fill = Image.new("RGB", (size, size), fg)
    img.paste(fill, (0, 0), glyph)
    d = ImageDraw.Draw(img)
    if nav:
        frame = fg if isinstance(fg, tuple) else (255, 255, 255)
        dim = tuple(int(c * 0.55) for c in frame)
        d.rounded_rectangle([2, 2, size - 3, size - 3], radius=10, outline=dim, width=2)
        chev = icon_map().get("chevron-right")
        d.text((size - 11, 12), chev, font=ImageFont.truetype(str(TTF), 16),
               fill=frame, anchor="mm")
    if dot:
        r = 5
        d.ellipse([size - 2 * r - 6, 6, size - 6, 6 + 2 * r], fill=dot)
    import io
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def image_key(png_path, size: int = 72, bg=(20, 20, 20), box_ratio: float = 0.62,
              cy_ratio: float = 0.40, nav: bool = False, nav_color=(255, 255, 255)) -> bytes:
    """A key whose glyph is an external image (e.g. a real brand crest) instead
    of a Tabler glyph. Same geometry as render() so titles fit underneath."""
    img = Image.new("RGB", (size, size), bg)
    logo = Image.open(png_path).convert("RGBA")
    box = int(size * box_ratio)
    logo.thumbnail((box, box), Image.LANCZOS)
    img.paste(logo, ((size - logo.width) // 2, int(size * cy_ratio) - logo.height // 2), logo)
    if nav:
        d = ImageDraw.Draw(img)
        dim = tuple(int(c * 0.55) for c in nav_color)
        d.rounded_rectangle([2, 2, size - 3, size - 3], radius=10, outline=dim, width=2)
        d.text((size - 11, 12), icon_map().get("chevron-right"),
               font=ImageFont.truetype(str(TTF), 16), fill=nav_color, anchor="mm")
    import io
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def solid(bg=(20, 20, 20), size: int = 72) -> bytes:
    import io
    img = Image.new("RGB", (size, size), bg)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()

def build_set(spec: dict[str, dict], bg=(20, 20, 20)) -> dict[str, bytes]:
    """spec: {output_name: {"icon": tabler_name, "fg": (r,g,b), "on": bool}}
    Always includes black.png (the page background default)."""
    out = {"black": solid(bg)}
    for name, cfg in spec.items():
        out[name] = render(cfg["icon"], bg=cfg.get("bg", bg),
                           fg=cfg.get("fg", (255, 255, 255)),
                           dot=cfg.get("dot"), flip=cfg.get("flip", False),
                           nav=cfg.get("nav", False))
    return out
