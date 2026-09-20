"""Fetches real, publicly served brand logos and normalizes them to white-on-transparent
silhouette PNGs (512px) for the marketing engine's _tinted_logo().

Sources: Simple Icons CDN (MIT-licensed SVG library of real brand marks), the official
Streamer University site wordmark, and Steam's public logo asset for Palworld.
"""
import io
import urllib.request
from pathlib import Path

from PIL import Image

OUT = Path(__file__).parent / "assets" / "logos"
OUT.mkdir(parents=True, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

FONT_TTF = OUT.parent / "SimpleIcons.ttf"
FONT_CSS = OUT.parent / "simple-icons.css"

def ensure_font():
    """simple-icons-font: the Simple Icons brand marks as a webfont (PIL-renderable,
    no Cairo needed) — same sourcing pattern as the Tabler icon pipeline."""
    if not FONT_TTF.exists():
        FONT_TTF.write_bytes(get("https://cdn.jsdelivr.net/npm/simple-icons-font@latest/font/SimpleIcons.ttf"))
    if not FONT_CSS.exists():
        FONT_CSS.write_bytes(get("https://cdn.jsdelivr.net/npm/simple-icons-font@latest/font/simple-icons.css"))

def glyph_map() -> dict:
    import re
    css = FONT_CSS.read_text(encoding="utf-8")
    return {name: chr(int(code, 16)) for name, code in re.findall(
        r'\.si-([a-z0-9-]+)::?before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"', css)}

def brand_glyph_png(slug: str, size: int = 512) -> Image.Image:
    from PIL import ImageDraw, ImageFont
    ch = glyph_map()[slug]
    im = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    ImageDraw.Draw(im).text((size / 2, size / 2), ch,
                            font=ImageFont.truetype(str(FONT_TTF), int(size * 0.9)),
                            fill=(255, 255, 255, 255), anchor="mm")
    return im

def png_to_white_silhouette(png_bytes: bytes) -> Image.Image:
    """Existing transparent PNG -> white silhouette via its own alpha."""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    out = Image.new("RGBA", im.size, (255, 255, 255, 0))
    out.putalpha(im.getchannel("A"))
    return out

def crop_pad(im: Image.Image, size: int = 512) -> Image.Image:
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    im.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas

SIMPLE = {  # name -> simpleicons slug (served as real brand SVGs, MIT-licensed library)
    "valorant": "valorant",
    "obsstudio": "obsstudio",
    "discord": "discord",
    "davinciresolve": "davinciresolve",
}
DIRECT_PNG = {
    "streameru": "https://streameruniversity.com/SU-wordmark.png",
    "palworld": "https://cdn.cloudflare.steamstatic.com/steam/apps/1623730/logo.png",
}

if __name__ == "__main__":
    ensure_font()
    for name, slug in SIMPLE.items():
        try:
            crop_pad(brand_glyph_png(slug)).save(OUT / f"{name}.png")
            print("ok  font:", name)
        except Exception as e:
            print("FAIL font:", name, e)
    for name, url in DIRECT_PNG.items():
        try:
            im = png_to_white_silhouette(get(url))
            crop_pad(im).save(OUT / f"{name}.png")
            print("ok  png:", name)
        except Exception as e:
            print("FAIL png:", name, url, e)
