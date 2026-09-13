from pathlib import Path
from PIL import Image, ImageDraw
import shutil

ROOT=Path(__file__).resolve().parents[1]
PLUGINS=[ROOT/"com.packrat.wireless-device-manager.sdPlugin",ROOT/"com.packrat.wireless-device-manager-pro.sdPlugin"]
for plugin in PLUGINS:
    for size,name in [(256,"marketplace.png"),(512,"marketplace@2x.png")]:
        p=plugin/"imgs/plugin"; p.mkdir(parents=True,exist_ok=True)
        im=Image.new("RGBA",(size,size),(22,24,29,255)); d=ImageDraw.Draw(im)
        w=size/18
        cx=cy=size/2
        # Bluetooth-inspired deterministic line mark, intentionally generic rather than vendor branding.
        d.line([(cx, size*.18),(cx,size*.82)],fill=(235,235,235,255),width=int(w))
        d.line([(cx,size*.18),(size*.72,size*.38),(cx,size*.52),(size*.72,size*.68),(cx,size*.82)],fill=(235,235,235,255),width=int(w),joint="curve")
        d.line([(size*.3,size*.32),(cx,size*.52),(size*.3,size*.7)],fill=(235,235,235,255),width=int(w),joint="curve")
        im.save(p/name)
    p=plugin/"imgs/actions/device"; p.mkdir(parents=True,exist_ok=True)
    for size,name in [(72,"icon.png"),(144,"key.png")]:
        im=Image.new("RGBA",(size,size),(22,24,29,255)); d=ImageDraw.Draw(im)
        d.ellipse((size*.22,size*.22,size*.78,size*.78),outline=(235,235,235,255),width=max(2,size//16))
        d.arc((size*.33,size*.33,size*.67,size*.67),200,340,fill=(235,235,235,255),width=max(2,size//18))
        im.save(p/name)
    ui=plugin/"ui"; ui.mkdir(parents=True,exist_ok=True)
    for filename in ["inspector.html","inspector.css","inspector.js"]:
        shutil.copy2(ROOT/"ui"/filename,ui/filename)
print("Rendered deterministic plugin assets and staged Property Inspector.")
