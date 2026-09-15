#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 960
BG = (8, 10, 14)
PANEL = (19, 23, 30)
PANEL2 = (13, 17, 23)
WHITE = (246, 248, 252)
MUTED = (165, 176, 190)
ORANGE = (255, 178, 30)
BLUE = (65, 164, 255)
LINE = (55, 66, 79)

def font(size: int, bold: bool = False):
    candidates = []
    if os.name == "nt":
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        ]
    candidates += [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()

def text(draw, xy, value, size, fill=WHITE, anchor="mm", bold=False):
    draw.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)

def bg():
    image = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(image)
    d.ellipse((-250, -220, 720, 620), fill=(20, 35, 54))
    d.ellipse((1350, 380, 2250, 1250), fill=(52, 31, 12))
    d.rectangle((0, 0, W, H), fill=(8, 10, 14))
    # restrained ambient accent bands
    d.rounded_rectangle((80, 74, W-80, 886), 46, fill=PANEL2, outline=LINE, width=3)
    d.line((150, 826, W-150, 826), fill=ORANGE, width=2)
    return image

def speaker(draw, cx, cy, scale=1.0, color=WHITE, accent=ORANGE):
    s = scale
    draw.polygon([
        (cx-int(72*s), cy-int(34*s)),
        (cx-int(30*s), cy-int(34*s)),
        (cx+int(18*s), cy-int(72*s)),
        (cx+int(18*s), cy+int(72*s)),
        (cx-int(30*s), cy+int(34*s)),
        (cx-int(72*s), cy+int(34*s))
    ], outline=color, fill=None)
    draw.line((cx+int(38*s), cy-int(38*s), cx+int(58*s), cy), fill=accent, width=max(3,int(8*s)))
    draw.line((cx+int(58*s), cy, cx+int(38*s), cy+int(38*s)), fill=accent, width=max(3,int(8*s)))
    draw.arc((cx+int(28*s),cy-int(74*s),cx+int(112*s),cy+int(74*s)), -55, 55, fill=accent, width=max(3,int(7*s)))

def mic(draw, cx, cy, scale=1.0, color=WHITE, accent=BLUE):
    s=scale
    draw.rounded_rectangle((cx-int(28*s),cy-int(78*s),cx+int(28*s),cy+int(12*s)), radius=int(24*s), outline=color, width=max(3,int(7*s)))
    draw.arc((cx-int(58*s),cy-int(26*s),cx+int(58*s),cy+int(78*s)), 0, 180, fill=accent, width=max(3,int(7*s)))
    draw.line((cx,cy+int(58*s),cx,cy+int(98*s)), fill=accent, width=max(3,int(7*s)))
    draw.line((cx-int(34*s),cy+int(98*s),cx+int(34*s),cy+int(98*s)), fill=accent, width=max(3,int(7*s)))

def pill(draw, box, label, accent):
    draw.rounded_rectangle(box, 18, fill=(11,14,19), outline=accent, width=3)
    x1,y1,x2,y2=box
    text(draw, ((x1+x2)//2,(y1+y2)//2), label, 23, accent, bold=True)

def save_icon(path: Path):
    image=Image.new("RGB",(288,288),(7,9,13))
    d=ImageDraw.Draw(image)
    d.rounded_rectangle((16,16,272,272),52,fill=(15,19,25),outline=(48,58,70),width=4)
    speaker(d,105,139,0.70)
    mic(d,190,139,0.70)
    d.line((138,139,156,139),fill=ORANGE,width=6)
    d.polygon([(156,139),(144,131),(144,147)],fill=ORANGE)
    d.rounded_rectangle((194,28,257,61),12,fill=(14,17,22),outline=ORANGE,width=2)
    text(d,(225,45),"LITE",18,ORANGE,bold=True)
    image.save(path,"PNG",optimize=True)

def header(image, title, subtitle):
    d=ImageDraw.Draw(image)
    text(d,(W//2,135),title,58,WHITE,bold=True)
    text(d,(W//2,198),subtitle,27,MUTED)

def gallery_one(path: Path):
    image=bg(); d=ImageDraw.Draw(image)
    header(image,"SWITCH THE DEVICE YOU NEED","One key for your Windows output or input")
    d.rounded_rectangle((250,300,810,710),40,fill=PANEL,outline=(73,84,98),width=3)
    d.rounded_rectangle((1110,300,1670,710),40,fill=PANEL,outline=(73,84,98),width=3)
    speaker(d,530,470,1.35)
    mic(d,1390,470,1.35)
    pill(d,(350,620,710,676),"DEFAULT OUTPUT",ORANGE)
    pill(d,(1210,620,1570,676),"DEFAULT INPUT",BLUE)
    text(d,(W//2,775),"Speakers, headphones, microphones, USB audio and more",27,MUTED)
    image.save(path,"PNG",optimize=True)

def gallery_two(path: Path):
    image=bg(); d=ImageDraw.Draw(image)
    header(image,"SEE THE TARGET. SEE WINDOWS.","Configured device and live Windows state stay separate")
    for x,label,accent in [(250,"SWITCH TO",ORANGE),(1030,"WINDOWS IS USING",BLUE)]:
        d.rounded_rectangle((x,330,x+640,665),38,fill=PANEL,outline=accent,width=3)
        text(d,(x+320,385),label,23,accent,bold=True)
        speaker(d,x+145,505,0.9)
        text(d,(x+380,485),"Headphones",39,WHITE,bold=True)
        text(d,(x+380,535),"USB Audio Device",24,MUTED)
    d.line((905,500,1010,500),fill=ORANGE,width=7)
    d.polygon([(1010,500),(988,486),(988,514)],fill=ORANGE)
    image.save(path,"PNG",optimize=True)

def deck(draw,x,y,w,h,label,accent):
    draw.rounded_rectangle((x,y,x+w,y+h),32,fill=(10,13,18),outline=(69,80,94),width=3)
    cols,rows=5,3
    pad=28
    gap=14
    kw=(w-2*pad-(cols-1)*gap)//cols
    kh=(h-2*pad-(rows-1)*gap)//rows
    for r in range(rows):
        for c in range(cols):
            bx=x+pad+c*(kw+gap); by=y+pad+r*(kh+gap)
            draw.rounded_rectangle((bx,by,bx+kw,by+kh),10,fill=(24,29,37),outline=accent if (r==0 and c<2) else (43,52,63),width=2)
    text(draw,(x+w//2,y+h+34),label,23,MUTED,bold=True)

def gallery_three(path: Path):
    image=bg(); d=ImageDraw.Draw(image)
    header(image,"STARTER LAYOUTS INCLUDED","Drop in the layout, then choose the devices for your keys")
    deck(d,190,320,480,300,"STANDARD / MK.2",ORANGE)
    deck(d,720,320,480,300,"XL",BLUE)
    deck(d,1250,320,480,300,"STREAM DECK + / NEO",ORANGE)
    text(d,(W//2,760),"Output and input keys are ready to configure",30,WHITE,bold=True)
    image.save(path,"PNG",optimize=True)

def gallery_four(path: Path):
    image=bg(); d=ImageDraw.Draw(image)
    header(image,"LITE FOR DEVICE SWITCHING","Move the whole setup at once with Audio Manager Pro")
    d.rounded_rectangle((230,310,820,700),42,fill=PANEL,outline=ORANGE,width=3)
    text(d,(525,375),"LITE",28,ORANGE,bold=True)
    text(d,(525,445),"One device",42,WHITE,bold=True)
    text(d,(525,500),"at a time",42,WHITE,bold=True)
    speaker(d,440,605,0.70); mic(d,610,605,0.70)
    d.rounded_rectangle((1100,310,1690,700),42,fill=(20,24,32),outline=BLUE,width=3)
    text(d,(1395,375),"PRO",28,BLUE,bold=True)
    text(d,(1395,445),"Complete audio",40,WHITE,bold=True)
    text(d,(1395,500),"profiles",40,WHITE,bold=True)
    text(d,(1395,585),"Output + input + Communications",23,MUTED)
    text(d,(1395,625),"Volume / mute restore + profile controls",21,MUTED)
    d.line((860,505,1060,505),fill=ORANGE,width=7)
    d.polygon([(1060,505),(1034,488),(1034,522)],fill=ORANGE)
    image.save(path,"PNG",optimize=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--destination",required=True,type=Path)
    args=parser.parse_args()
    out=args.destination
    out.mkdir(parents=True,exist_ok=True)
    save_icon(out/"01_search_icon.png")
    gallery_one(out/"02_cover.png")
    gallery_one(out/"03_gallery_01.png")
    gallery_two(out/"04_gallery_02.png")
    gallery_three(out/"05_gallery_03.png")
    gallery_four(out/"06_gallery_04.png")
    print(f"AUDIO MANAGER LITE RAT ART PASS -> {out}")

if __name__=="__main__":
    main()
