from pathlib import Path
from PIL import Image, ImageDraw
import json
import math
import re
import shutil

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[1]
PLUGINS=[ROOT/"com.packrat.wireless-device-manager.sdPlugin",ROOT/"com.packrat.wireless-device-manager-pro.sdPlugin"]
PACKRAT_LOGO=REPO/"tools/art/assets/ratpack-icon-transparent.png"
DIRECT_MARKETPLACE=re.compile(r"^https://marketplace\.elgato\.com/product/[a-z0-9][a-z0-9-]*-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/?$",re.I)
ACCENT=(255,178,30,255)
WHITE=(245,247,251,255)
KEY_BG=(5,7,10,255)

def verified_pro_url():
    catalog=json.loads((REPO/"products/lite-pro-map.json").read_text(encoding="utf-8"))
    pair=next((p for p in catalog.get("pairs",[]) if p.get("lite_id")=="wireless-device-manager"),None)
    if not pair:
        raise SystemExit("Wireless Device Manager Lite/Pro catalog relationship is missing")
    url=str(pair.get("pro_marketplace_url") or "").strip()
    if url and not DIRECT_MARKETPLACE.fullmatch(url):
        raise SystemExit(f"Wireless Device Manager Pro Marketplace URL is not a verified direct product URL: {url}")
    return url

PRO_MARKETPLACE_URL=verified_pro_url()

def wireless_device_mark(size, transparent=False):
    bg=(0,0,0,0) if transparent else (8,10,14,255)
    im=Image.new("RGBA",(size,size),bg)
    d=ImageDraw.Draw(im)
    w=max(1,size//14)
    d.rounded_rectangle((size*.20,size*.25,size*.80,size*.70),radius=max(2,size//10),outline=WHITE,width=w)
    d.line((size*.31,size*.56,size*.53,size*.56),fill=WHITE,width=w)
    r=max(2,size//18)
    cx,cy=size*.68,size*.40
    d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=ACCENT if not transparent else WHITE)
    return im

def star_points(cx,cy,outer,inner):
    points=[]
    for i in range(10):
        angle=-math.pi/2+i*math.pi/5
        radius=outer if i%2==0 else inner
        points.append((cx+math.cos(angle)*radius,cy+math.sin(angle)*radius))
    return points

def action_glyph(kind,size,transparent=False):
    bg=(0,0,0,0) if transparent else KEY_BG
    im=Image.new("RGBA",(size,size),bg)
    d=ImageDraw.Draw(im)
    w=max(1,size//16)
    fg=WHITE
    accent=WHITE if transparent else ACCENT
    if not transparent:
        rail=max(2,size//29)
        d.rounded_rectangle((size*.055,size*.083,size*.055+rail,size*.305),radius=max(1,rail//2),fill=ACCENT)
    if kind=="device":
        d.rounded_rectangle((size*.24,size*.19,size*.76,size*.55),radius=max(2,size//13),outline=fg,width=w)
        d.line((size*.33,size*.45,size*.52,size*.45),fill=fg,width=w)
        r=max(2,size//18)
        d.ellipse((size*.63-r,size*.31-r,size*.63+r,size*.31+r),fill=accent)
    elif kind=="dashboard":
        for y,index in ((.24,0),(.43,1),(.62,2)):
            r=max(2,size//22)
            if index==0:
                d.ellipse((size*.23-r,size*y-r,size*.23+r,size*y+r),fill=accent)
            else:
                d.ellipse((size*.23-r,size*y-r,size*.23+r,size*y+r),outline=fg,width=w)
            d.line((size*.35,size*y,size*.75,size*y),fill=fg,width=w)
    elif kind=="cycle":
        d.polygon(star_points(size*.31,size*.36,size*.14,size*.065),fill=accent)
        d.line((size*.48,size*.42,size*.78,size*.42),fill=fg,width=w)
        d.line((size*.68,size*.31,size*.79,size*.42,size*.68,size*.53),fill=fg,width=w)
    return im

for plugin in PLUGINS:
    p=plugin/"imgs/plugin"
    p.mkdir(parents=True,exist_ok=True)
    wireless_device_mark(256).save(p/"marketplace.png")
    wireless_device_mark(512).save(p/"marketplace@2x.png")
    wireless_device_mark(28,transparent=True).save(p/"category.png")
    wireless_device_mark(56,transparent=True).save(p/"category@2x.png")

    for kind in ("device","dashboard","cycle"):
        p=plugin/"imgs/actions"/kind
        p.mkdir(parents=True,exist_ok=True)
        action_glyph(kind,20,transparent=True).save(p/"icon.png")
        action_glyph(kind,40,transparent=True).save(p/"icon@2x.png")
        action_glyph(kind,72).save(p/"key.png")
        action_glyph(kind,144).save(p/"key@2x.png")

    ui=plugin/"ui"
    ui.mkdir(parents=True,exist_ok=True)
    for filename in ["inspector.html","inspector.css","inspector.js"]:
        shutil.copy2(ROOT/"ui"/filename,ui/filename)
    if not PACKRAT_LOGO.exists():
        raise SystemExit(f"Canonical PackRat logo missing: {PACKRAT_LOGO}")
    shutil.copy2(PACKRAT_LOGO,ui/"packrat-logo.png")

    pro_url=PRO_MARKETPLACE_URL if plugin.name=="com.packrat.wireless-device-manager.sdPlugin" else ""
    (ui/"upsell-config.js").write_text(
        "window.WIRELESS_PRO_MARKETPLACE_URL = "+json.dumps(pro_url)+";\n",
        encoding="utf-8"
    )

print("Rendered canonical semantic Wireless key art and staged Property Inspector assets.")
