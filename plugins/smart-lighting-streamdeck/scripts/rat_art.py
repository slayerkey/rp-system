from __future__ import annotations
import argparse, os, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"tools"/"art"))
from streamdeck_marketplace_campaign import campaign_header,campaign_footer,glass_panel,load_scene,resolve_campaign_config
SLUG="smart-lighting-streamdeck"
CONFIG=resolve_campaign_config(SLUG)
LOGO=ROOT/"tools/art/assets/ratpack-icon-transparent.png"
W,H=1920,960
WHITE=(245,247,251,255);MUTED=(178,188,203,255);ORANGE=(255,178,30,255)
def font(size,bold=True):
 choices=([os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")] if os.environ.get("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT") else [])
 if os.name=="nt":choices += [r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"]
 choices += ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
 for item in choices:
  if item and Path(item).is_file():return ImageFont.truetype(item,size)
 raise SystemExit("Canonical Rat Art font unavailable")
def canvas():return load_scene(CONFIG.gallery_scene,veil=(2,5,9,45))
def save(im,p):im.convert("RGB").save(p,"PNG",optimize=True)
def background(title,sub):
 im=canvas();campaign_header(im,title,sub,font);campaign_footer(im,logo_path=LOGO);return im
def face(out,n):
 p=out/"rat-art-keys"/f"{n:02}.png"
 if not p.is_file():raise SystemExit("Missing real runtime key: "+str(p))
 im=Image.open(p).convert("RGBA")
 if im.size!=(288,288):raise SystemExit("Wrong runtime key dimensions")
 return im
def keys(im,out,ns,x,y,size=174,gap=17,cols=4):
 for i,n in enumerate(ns):
  f=face(out,n).resize((size,size),Image.Resampling.LANCZOS)
  im.alpha_composite(f,(x+(i%cols)*(size+gap),y+(i//cols)*(size+gap)))
def label(im,txt,x,y,size=35,color=WHITE):
 ImageDraw.Draw(im).text((x,y),txt,font=font(size),fill=color)
def panel(im,b):glass_panel(im,b,radius=28,fill=(8,12,18,210),border_alpha=180,glow_alpha=22,border_width=2)
def search_icon(out):
 approved=Image.open(ROOT/"plugins"/SLUG/"com.packrat.smart-lighting-streamdeck.sdPlugin/imgs/plugin/icon.png").convert("RGBA")
 im=ImageOps.contain(approved,(512,512),Image.Resampling.LANCZOS);canvas=Image.new("RGBA",(512,512),(8,10,14,255));canvas.alpha_composite(im,((512-im.width)//2,(512-im.height)//2))
 canvas.save(out/"01_search_icon.png",optimize=True)
def slides(out):
 # Product-local 02 is an intermediate. Rat Ship overwrites with approved
 # photographed MK.2 compositor using exact rat-art-keys from this same run.
 im=background("ONE DECK. BOTH LIGHTING BRANDS.","Real controls, not an illustration of a separate second product")
 keys(im,out,list(range(1,16)),225,290,141,16,5);save(im,out/"02_cover.png")
 im=background("STOP SWITCHING LIGHTING APPS","Keep Hue and Govee on the same Stream Deck surface")
 panel(im,(154,306,865,737));label(im,"Separate lighting apps",206,358)
 label(im,"Hue controls",222,453,29,MUTED);label(im,"Govee controls",222,533,29,MUTED)
 panel(im,(970,306,1770,737));label(im,"One mixed-brand deck",1008,358)
 keys(im,out,[1,7,3,4,5,10],1010,420,190,31,3)
 save(im,out/"03_gallery_01.png")
 im=background("ONE-PRESS MIXED-BRAND FAVORITES","Power eligible favorite Hue and Govee lights together")
 panel(im,(205,330,1715,735))
 keys(im,out,[1,7,5,10],328,431,193,67,4)
 label(im,"HUE",392,674,28);label(im,"GOVEE",674,674,28);label(im,"ALL ON",968,674,28,ORANGE);label(im,"ALL OFF",1283,674,28,ORANGE)
 save(im,out/"04_gallery_02.png")
 im=background("POWER. BRIGHTNESS. COLOR. SCENES.","Capabilities come from the real Hue and Govee devices")
 panel(im,(175,317,1745,742));keys(im,out,[2,3,8,9,6],280,403,209,43,5)
 label(im,"Live power",280,668,25);label(im,"Bright preset",532,668,25);label(im,"Warmth",785,668,25);label(im,"RGB",1038,668,25);label(im,"Hue scene",1285,668,25)
 save(im,out/"05_gallery_03.png")
 im=background("SET IT UP ONCE. CONTROL IT DAILY.","Shared Windows companion • Local Hue + Govee LAN where supported")
 panel(im,(185,318,955,741));label(im,"Included profiles",247,373)
 label(im,"Standard / MK.2",259,451,31);label(im,"Stream Deck XL",259,519,31)
 label(im,"Stream Deck +",259,587,31);label(im,"Stream Deck Neo",259,655,31)
 panel(im,(1000,318,1755,741));label(im,"Purpose-built controls",1065,373)
 keys(im,out,[11,12,13,14],1050,458,167,25,4)
 label(im,"Plus dials + Neo status",1103,669,25,MUTED)
 save(im,out/"06_gallery_04.png")
if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("--out",required=True);args=parser.parse_args()
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 if len(list((out/"rat-art-keys").glob("*.png")))!=15:raise SystemExit("Exactly 15 exact runtime key faces required")
 search_icon(out);slides(out)
 print("PackRat canonical gallery primitives + 15 exact shipping key visuals PASS")
