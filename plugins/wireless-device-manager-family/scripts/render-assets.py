from pathlib import Path
from PIL import Image, ImageDraw
import shutil

ROOT=Path(__file__).resolve().parents[1]
PLUGINS=[ROOT/"com.packrat.wireless-device-manager.sdPlugin",ROOT/"com.packrat.wireless-device-manager-pro.sdPlugin"]

def bluetooth_mark(size, transparent=False):
    bg=(0,0,0,0) if transparent else (22,24,29,255)
    im=Image.new("RGBA",(size,size),bg)
    d=ImageDraw.Draw(im)
    fg=(255,255,255,255) if transparent else (235,235,235,255)
    w=max(1,size//14)
    cx=size/2
    d.line([(cx,size*.16),(cx,size*.84)],fill=fg,width=w)
    d.line([(cx,size*.16),(size*.74,size*.36),(cx,size*.50),(size*.74,size*.66),(cx,size*.84)],fill=fg,width=w,joint="curve")
    d.line([(size*.26,size*.31),(cx,size*.50),(size*.26,size*.70)],fill=fg,width=w,joint="curve")
    return im

def device_key(size):
    im=Image.new("RGBA",(size,size),(22,24,29,255))
    d=ImageDraw.Draw(im)
    w=max(2,size//18)
    d.ellipse((size*.20,size*.20,size*.80,size*.80),outline=(235,235,235,255),width=w)
    d.arc((size*.32,size*.32,size*.68,size*.68),200,340,fill=(235,235,235,255),width=w)
    return im

for plugin in PLUGINS:
    p=plugin/"imgs/plugin"
    p.mkdir(parents=True,exist_ok=True)

    # Preferences / Marketplace plugin icon: 256 + 512 @2x.
    bluetooth_mark(256).save(p/"marketplace.png")
    bluetooth_mark(512).save(p/"marketplace@2x.png")

    # Action-list category icon: 28 + 56 @2x, monochrome white on transparent.
    bluetooth_mark(28, transparent=True).save(p/"category.png")
    bluetooth_mark(56, transparent=True).save(p/"category@2x.png")

    p=plugin/"imgs/actions/device"
    p.mkdir(parents=True,exist_ok=True)

    # Action-list icon: 20 + 40 @2x, monochrome white on transparent.
    bluetooth_mark(20, transparent=True).save(p/"icon.png")
    bluetooth_mark(40, transparent=True).save(p/"icon@2x.png")

    # Key state image: 72 + 144 @2x.
    device_key(72).save(p/"key.png")
    device_key(144).save(p/"key@2x.png")

    ui=plugin/"ui"
    ui.mkdir(parents=True,exist_ok=True)
    for filename in ["inspector.html","inspector.css","inspector.js"]:
        shutil.copy2(ROOT/"ui"/filename,ui/filename)

print("Rendered Elgato-compliant plugin, category, action-list and key assets; staged Property Inspector.")
