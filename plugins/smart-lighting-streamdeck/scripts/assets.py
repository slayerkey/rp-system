from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[3]
PLUG=ROOT/"plugins"/"smart-lighting-streamdeck"/"com.packrat.smart-lighting-streamdeck.sdPlugin"
LOGO=ROOT/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"
if not LOGO.is_file():raise SystemExit("Approved PackRat source mark missing")
src=Image.open(LOGO).convert("RGBA")
out=PLUG/"imgs"/"plugin";out.mkdir(parents=True,exist_ok=True)
for size,name in ((256,"icon.png"),(512,"icon@2x.png")):
    im=Image.new("RGBA",(size,size),(8,10,14,255))
    img=src.copy();img.thumbnail((int(size*.83),int(size*.83)),Image.Resampling.LANCZOS)
    im.alpha_composite(img,((size-img.width)//2,(size-img.height)//2))
    im.save(out/name)
    if size==256: im.save(out/"packrat-logo.png")
