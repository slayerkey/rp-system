from __future__ import annotations
import argparse, os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT=Path(__file__).resolve().parents[3]
RAT=ROOT/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"
W,H=1920,960
BG=(7,10,14); PANEL=(16,20,26); BORDER=(43,50,61); WHITE=(247,249,251); MUTED=(169,179,192); ACCENT=(43,232,106); WARN=(243,184,74)

def font(size,bold=True):
    candidates=[]
    env=os.getenv("RATPACK_ART_FONT_BOLD" if bold else "RATPACK_ART_FONT")
    if env:candidates.append(env)
    if os.name=="nt":candidates += [r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf"]
    candidates += ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for c in candidates:
        if c and Path(c).is_file(): return ImageFont.truetype(c,size)
    raise SystemExit("RAT ART FAIL: deterministic font missing")

def bg():
    base=Image.new("RGBA",(W,H),(*BG,255)); glow=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(glow)
    d.ellipse((760,80,1950,1120),fill=(*ACCENT,24)); d.ellipse((-400,-350,700,520),fill=(44,78,122,24))
    return Image.alpha_composite(base,glow.filter(ImageFilter.GaussianBlur(170)))

def header(im,title,sub):
    d=ImageDraw.Draw(im); d.text((110,85),"MONITOR MANAGER LITE",font=font(23),fill=(*ACCENT,255))
    d.text((110,130),title,font=font(62),fill=(*WHITE,255)); d.text((112,220),sub,font=font(25,False),fill=(*MUTED,255))

def footer(im):
    d=ImageDraw.Draw(im); d.line((0,824,W,824),fill=(*ACCENT,68),width=1)
    if RAT.is_file():
        rat=Image.open(RAT).convert("RGBA"); box=rat.getbbox()
        if box: rat=rat.crop(box)
        s=min(48/rat.width,48/rat.height); rat=rat.resize((int(rat.width*s),int(rat.height*s)),Image.Resampling.LANCZOS)
        im.alpha_composite(rat,((W-rat.width)//2,860))

def card(d,b): d.rounded_rectangle(b,radius=26,fill=(*PANEL,245),outline=(*BORDER,255),width=2)

def key(im,x,y,label,sub="",accent=ACCENT,size=142):
    d=ImageDraw.Draw(im); card(d,(x,y,x+size,y+size)); d.rounded_rectangle((x+16,y+14,x+58,y+18),radius=2,fill=(*accent,255))
    d.text((x+15,y+44),label,font=font(19),fill=(*WHITE,255))
    if sub:d.text((x+15,y+82),sub,font=font(13,False),fill=(*accent,255))

def deck(im,labels,x=785,y=320):
    d=ImageDraw.Draw(im); keysize=142; gap=17; pad=28; cols=5; rows=3
    width=pad*2+cols*keysize+(cols-1)*gap; height=pad*2+rows*keysize+(rows-1)*gap
    d.rounded_rectangle((x,y,x+width,y+height),radius=42,fill=(5,7,10,255),outline=(48,56,67,255),width=3)
    for i,(a,b,c) in enumerate(labels):
        col=i%cols; row=i//cols; key(im,x+pad+col*(keysize+gap),y+pad+row*(keysize+gap),a,b,c,keysize)

def save(im,path): path.parent.mkdir(parents=True,exist_ok=True); im.convert("RGB").save(path,"PNG",optimize=True)

def search_icon(path):
    im=Image.new("RGBA",(512,512),(8,11,15,255)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((60,82,452,340),radius=36,fill=(17,22,29),outline=WHITE,width=9)
    d.line((256,340,256,405),fill=WHITE,width=12); d.line((174,405,338,405),fill=WHITE,width=12)
    d.line((120,220,392,220),fill=WHITE,width=18); d.ellipse((290,192,346,248),fill=ACCENT)
    im.save(path,"PNG",optimize=True)

def hero(path):
    im=bg(); header(im,"CONTROL YOUR MONITORS","Windows display control from Stream Deck without pretending every monitor supports the same hardware features.")
    d=ImageDraw.Draw(im); d.text((110,380),"BRIGHTNESS. HZ. POWER.",font=font(34),fill=(*WHITE,255))
    d.text((110,438),"One useful monitor. Free.",font=font(28,False),fill=(*MUTED,255))
    labels=[("165 HZ","REFRESH",ACCENT),("65%","BRIGHTNESS",ACCENT),("POWER","DDC/CI",WARN),("STATUS","2560×1440",ACCENT),("BRIGHT +","+5%",ACCENT),
            ("60 HZ","REFRESH",ACCENT),("120 HZ","REFRESH",ACCENT),("144 HZ","REFRESH",ACCENT),("240 HZ","REFRESH",ACCENT),("BRIGHT -","-5%",ACCENT),
            ("SUPPORTED","CAPABILITY",ACCENT),("UNKNOWN","CAPABILITY",WARN),("MONITOR","SELECT",ACCENT),("CURRENT","DISPLAY",ACCENT),("WINDOWS","DISPLAY",ACCENT)]
    deck(im,labels); footer(im); save(im,path)

def controls(path):
    im=bg(); header(im,"Useful on day one.","Real Lite actions for one configured Windows display.")
    d=ImageDraw.Draw(im)
    items=[("MONITOR BRIGHTNESS","Set a value or use Brightness Up / Down. Stream Deck+ gets a real dial."),
           ("REFRESH RATE SWITCH","60 / 120 / 144 / 165 / 240 Hz only when Windows reports the requested mode."),
           ("MONITOR POWER","Uses DDC/CI power control only when the monitor advertises the feature."),
           ("CURRENT DISPLAY STATUS","See current Hz and resolution directly on the key.")]
    y=330
    for title,body in items:
        d.ellipse((135,y+7,151,y+23),fill=(*ACCENT,255)); d.text((175,y),title,font=font(27),fill=(*WHITE,255)); d.text((175,y+45),body,font=font(20,False),fill=(*MUTED,255)); y+=125
    footer(im); save(im,path)

def capabilities(path):
    im=bg(); header(im,"Capability aware by design.","DDC/CI is monitor-specific, so Lite reports what it knows instead of guessing.")
    d=ImageDraw.Draw(im)
    for i,(state,body,color) in enumerate([
        ("SUPPORTED","The monitor/API explicitly exposes this control.",ACCENT),
        ("NOT SUPPORTED","The capability data explicitly omits it.",(255,90,103)),
        ("UNKNOWN","Windows or the monitor cannot prove support safely.",WARN)]):
        y=340+i*145; card(d,(180,y,1740,y+110)); d.text((230,y+22),state,font=font(28),fill=(*color,255)); d.text((600,y+28),body,font=font(21,False),fill=(*MUTED,255))
    footer(im); save(im,path)

def profiles(path):
    im=bg(); header(im,"Starter profiles included.","Standard / MK, XL, Stream Deck+ and Virtual Stream Deck layouts use real plugin actions.")
    labels=[("MONITORS","STATUS",ACCENT),("65%","BRIGHTNESS",ACCENT),("POWER","DDC/CI",WARN),("60 HZ","DISPLAY",ACCENT),("120 HZ","DISPLAY",ACCENT),
            ("144 HZ","DISPLAY",ACCENT),("165 HZ","DISPLAY",ACCENT),("240 HZ","DISPLAY",ACCENT),("25%","BRIGHTNESS",ACCENT),("50%","BRIGHTNESS",ACCENT),
            ("65%","BRIGHTNESS",ACCENT),("80%","BRIGHTNESS",ACCENT),("BRIGHT -","5%",ACCENT),("BRIGHT +","5%",ACCENT),("STATUS","CURRENT",ACCENT)]
    deck(im,labels,x=500,y=305); footer(im); save(im,path)

def plus(path):
    im=bg(); header(im,"Turn a dial. Change brightness.","Stream Deck+ gets continuous control where a dial actually makes sense.")
    d=ImageDraw.Draw(im); card(d,(250,330,1670,690))
    d.text((335,390),"BRIGHTNESS",font=font(30),fill=(*WHITE,255)); d.line((340,510,1450,510),fill=(*WHITE,255),width=18); d.ellipse((1040,468,1124,552),fill=(*ACCENT,255))
    d.text((335,570),"Rotate for fine adjustment. Pressed keys still support exact presets.",font=font(23,False),fill=(*MUTED,255))
    footer(im); save(im,path)

def compatibility(path):
    im=bg(); header(im,"Windows first. Hardware honest.","External DDC/CI and laptop internal brightness use different Windows paths.")
    d=ImageDraw.Draw(im)
    boxes=[("EXTERNAL MONITOR","DDC/CI capability discovery\nBrightness + safe power when exposed"),
           ("LAPTOP PANEL","Windows internal brightness path\nNo fake DDC/CI requirement"),
           ("DISPLAY MODES","Windows mode enumeration\nUnsupported Hz requests are rejected")]
    x=120
    for title,body in boxes:
        card(d,(x,350,x+520,650)); d.text((x+35,400),title,font=font(25),fill=(*WHITE,255))
        for j,line in enumerate(body.split("\n")): d.text((x+35,475+j*42),line,font=font(19,False),fill=(*MUTED,255))
        x+=600
    footer(im); save(im,path)

def main():
    p=argparse.ArgumentParser(); p.add_argument("--out",required=True); args=p.parse_args(); out=Path(args.out).resolve(); out.mkdir(parents=True,exist_ok=True)
    search_icon(out/"01_search_icon.png"); hero(out/"02_cover.png"); controls(out/"03_gallery_01.png"); capabilities(out/"04_gallery_02.png"); profiles(out/"05_gallery_03.png"); plus(out/"06_gallery_04.png")
    print("RAT ART PASS:",out)

if __name__=="__main__": main()
