from pathlib import Path
from PIL import Image, ImageDraw
import json
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
    fg=WHITE
    w=max(1,size//14)
    d.ellipse((size*.18,size*.38,size*.42,size*.62),outline=fg,width=w)
    d.arc((size*.28,size*.24,size*.74,size*.76),-55,55,fill=fg,width=w)
    d.arc((size*.30,size*.12,size*.90,size*.88),-55,55,fill=fg,width=w)
    return im

def action_glyph(kind,size,transparent=False):
    bg=(0,0,0,0) if transparent else KEY_BG
    im=Image.new("RGBA",(size,size),bg)
    d=ImageDraw.Draw(im)
    w=max(1,size//15)
    if not transparent:
        rail=max(2,size//28)
        d.rounded_rectangle((0,0,rail,size-1),radius=max(1,rail//2),fill=ACCENT)
    if kind=="device":
        d.ellipse((size*.39,size*.20,size*.61,size*.42),outline=WHITE,width=w)
        d.arc((size*.27,size*.24,size*.73,size*.68),205,335,fill=WHITE,width=w)
        d.arc((size*.18,size*.14,size*.82,size*.78),205,335,fill=WHITE,width=w)
    elif kind=="dashboard":
        for x,y in ((.20,.20),(.53,.20),(.20,.53),(.53,.53)):
            d.rounded_rectangle((size*x,size*y,size*(x+.25),size*(y+.20)),radius=max(1,size//24),outline=WHITE,width=w)
    elif kind=="cycle":
        d.arc((size*.20,size*.18,size*.78,size*.72),200,350,fill=WHITE,width=w)
        d.arc((size*.22,size*.28,size*.80,size*.82),20,170,fill=WHITE,width=w)
        d.polygon([(size*.72,size*.20),(size*.86,size*.23),(size*.76,size*.34)],fill=ACCENT if not transparent else WHITE)
        d.polygon([(size*.28,size*.80),(size*.14,size*.77),(size*.24,size*.66)],fill=ACCENT if not transparent else WHITE)
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

print("Rendered canonical PackRat Stream Deck visuals, staged Property Inspector assets, and catalog-driven Pro upsell config.")
