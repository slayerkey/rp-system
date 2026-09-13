from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "com.packrat.monitormanagerlite.sdPlugin"
OUT = PLUGIN / "imgs" / "plugin"
OUT.mkdir(parents=True, exist_ok=True)

def icon(size: int) -> Image.Image:
    im = Image.new("RGBA", (size, size), (8, 11, 15, 255))
    d = ImageDraw.Draw(im)
    pad = int(size * 0.12)
    radius = int(size * 0.12)
    d.rounded_rectangle((pad, pad, size-pad, int(size*0.68)), radius=radius,
                        fill=(17, 22, 29, 255), outline=(255, 255, 255, 255),
                        width=max(2, size//64))
    stand_y = int(size*0.76)
    cx = size//2
    d.line((cx, int(size*0.68), cx, stand_y), fill=(255,255,255,255), width=max(3,size//36))
    d.line((int(size*0.34), stand_y, int(size*0.66), stand_y), fill=(255,255,255,255), width=max(3,size//36))
    bar_x1, bar_x2 = int(size*0.23), int(size*0.77)
    y = int(size*0.38)
    d.rounded_rectangle((bar_x1, y, bar_x2, y+max(6,size//25)), radius=max(3,size//50), fill=(255,255,255,255))
    knob = int(size*0.58)
    r = max(5,size//24)
    d.ellipse((knob-r, y-r//2, knob+r, y+max(6,size//25)+r//2), fill=(43,232,106,255))
    return im

icon(256).save(OUT / "marketplace.png", "PNG", optimize=True)
icon(512).save(OUT / "marketplace@2x.png", "PNG", optimize=True)
print("Monitor Manager Lite plugin assets built.")
