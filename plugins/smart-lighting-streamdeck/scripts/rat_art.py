from __future__ import annotations
import argparse, os, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"tools"/"art"))
from streamdeck_marketplace_campaign import campaign_header,campaign_footer,glass_panel,load_scene,resolve_campaign_config,thin_arrow,bounded_key_grid
from marketplace_text import draw_fitted_text
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
# Retain the product-local alias for regression tests; geometry comes from the
# canonical reusable Marketplace campaign primitive.
layout_faces=bounded_key_grid
def place_faces(im,out,region,ns,cols,size,gap_x,gap_y=0):
 geometry=layout_faces(region,ns,cols,size,gap_x,gap_y)
 for n,x,y,key_size in geometry:
  f=face(out,n).resize((key_size,key_size),Image.Resampling.LANCZOS)
  im.alpha_composite(f,(x,y))
 return geometry
def caption_box(center,top,width=210):
 return (int(center-width/2),top,int(center+width/2),top+46)
def caption(im,txt,center,top,width=210,color=WHITE):
 box=caption_box(center,top,width)
 draw_fitted_text(ImageDraw.Draw(im),box,txt,font,fill=color,max_size=30,min_size=22,bold=True,max_lines=1,align="center")
def label(im,txt,x,y,size=35,color=WHITE):
 ImageDraw.Draw(im).text((x,y),txt,font=font(size),fill=color)
def panel(im,b):glass_panel(im,b,radius=28,fill=(8,12,18,210),border_alpha=180,glow_alpha=22,border_width=2)
def search_icon(out):
 approved=Image.open(ROOT/"plugins"/SLUG/"com.packrat.smart-lighting-streamdeck.sdPlugin/imgs/plugin/icon.png").convert("RGBA")
 im=ImageOps.contain(approved,(512,512),Image.Resampling.LANCZOS);canvas=Image.new("RGBA",(512,512),(8,10,14,255));canvas.alpha_composite(im,((512-im.width)//2,(512-im.height)//2))
 canvas.save(out/"01_search_icon.png",optimize=True)
def slides(out):
 # Product-local 02 is an intermediate. Rat Ship replaces it with the
 # photographed MK.2 hero using the exact runtime faces from this same run.
 im=background("ONE DECK. BOTH LIGHTING BRANDS.","Real controls from one unified Stream Deck plugin")
 place_faces(im,out,(245,285,1655,761),list(range(1,16)),5,132,30,18)
 save(im,out/"02_cover.png")

 # 1. Why: show the two-app workflow becoming one deck. Both rows now fit.
 im=background("STOP SWITCHING LIGHTING APPS","Hue and Govee controls on one Stream Deck")
 left_panel=(150,310,862,740);right_panel=(982,310,1770,740)
 panel(im,left_panel);panel(im,right_panel)
 label(im,"Separate lighting apps",209,362,33)
 label(im,"Hue app",247,457,31,MUTED)
 label(im,"Govee app",247,548,31,MUTED)
 thin_arrow(ImageDraw.Draw(im),884,538,957,width=8)
 label(im,"One mixed-brand deck",1030,356,33)
 place_faces(im,out,(1032,403,1716,716),[1,7,3,4,5,10],3,142,25,20)
 save(im,out/"03_gallery_01.png")

 # 2. Strongest repeated workflow: exactly four centered keys and captions.
 im=background("ONE PRESS. BOTH LIGHTING BRANDS.","Power your favorite Hue and Govee lights together")
 panel(im,(205,327,1715,741))
 positions=place_faces(im,out,(286,407,1634,625),[1,7,5,10],4,200,110)
 for (_,x,_,size),txt,color in zip(positions,["HUE","GOVEE","ALL ON","ALL OFF"],[WHITE,WHITE,ORANGE,WHITE]):
  caption(im,txt,x+size//2,643,245,color)
 save(im,out/"04_gallery_02.png")

 # 3. The shipping plugin's exact live key visuals, not marketing substitutes.
 im=background("POWER. BRIGHTNESS. COLOR. SCENES.","Controls adapt to supported Hue and Govee devices")
 panel(im,(175,317,1745,742))
 positions=place_faces(im,out,(231,395,1689,623),[2,3,8,9,6],5,204,45)
 for (_,x,_,size),txt in zip(positions,["LIVE POWER","BRIGHTNESS","WARMTH","RGB","HUE SCENES"]):
  caption(im,txt,x+size//2,654,235)
 save(im,out/"05_gallery_03.png")

 # 4. Model support: inset keys + bounded footer inside the right glass card.
 im=background("SET IT UP ONCE. CONTROL IT DAILY.","Shared Windows companion • Hue + supported Govee LAN lights")
 left_panel=(185,318,950,741);right_panel=(1000,318,1755,741)
 panel(im,left_panel);panel(im,right_panel)
 label(im,"Included profiles",245,371,35)
 for i,txt in enumerate(["STANDARD / MK.2","STREAM DECK XL","STREAM DECK +","STREAM DECK NEO"]):
  label(im,txt,267,450+i*67,30)
 label(im,"Purpose-built controls",1056,371,34)
 place_faces(im,out,(1037,437,1718,619),[11,12,13,14],4,143,28)
 caption(im,"PLUS DIALS + NEO STATUS",1377,657,605,MUTED)
 save(im,out/"06_gallery_04.png")
if __name__=="__main__":
 parser=argparse.ArgumentParser();parser.add_argument("--out",required=True);args=parser.parse_args()
 out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 if len(list((out/"rat-art-keys").glob("*.png")))!=15:raise SystemExit("Exactly 15 exact runtime key faces required")
 search_icon(out);slides(out)
 print("PackRat canonical gallery primitives + 15 exact shipping key visuals PASS")
