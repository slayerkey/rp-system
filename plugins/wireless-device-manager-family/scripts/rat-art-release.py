#!/usr/bin/env python3
from __future__ import annotations
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO=Path(__file__).resolve().parents[3]
W,H=1920,960
BG=(7,9,13); PANEL=(15,18,24); KEY=(24,29,37); WHITE=(246,248,251); MUTED=(163,173,188)
ACCENT=(91,203,255); GOOD=(84,221,139); WARN=(255,196,91); BORDER=(55,65,80)
RAT=REPO/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"

def font(size,bold=False):
    candidates=[
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    ]
    for p in candidates:
        if p.exists(): return ImageFont.truetype(str(p),size)
    raise SystemExit("Wireless Device Manager Rat Art requires a deterministic UI font")

def bg():
    im=Image.new("RGBA",(W,H),(*BG,255)); glow=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(glow)
    d.ellipse((700,-300,1900,900),fill=(*ACCENT,24)); d.ellipse((-300,450,800,1300),fill=(*GOOD,16))
    return Image.alpha_composite(im,glow.filter(ImageFilter.GaussianBlur(170)))

def title(im,h,s=""):
    d=ImageDraw.Draw(im); d.text((95,70),h,font=font(58,True),fill=WHITE)
    if s: d.text((98,145),s,font=font(23),fill=MUTED)

def signature(im):
    if RAT.exists():
        rat=Image.open(RAT).convert("RGBA"); box=rat.getbbox()
        if box: rat=rat.crop(box)
        scale=min(42/rat.width,42/rat.height); rat=rat.resize((max(1,int(rat.width*scale)),max(1,int(rat.height*scale))),Image.Resampling.LANCZOS)
        im.alpha_composite(rat,((W-rat.width)//2,905-rat.height//2))

def key(d,x,y,name,state,battery=None,connected=False,low=False,size=180):
    d.rounded_rectangle((x,y,x+size,y+size),28,fill=KEY,outline=GOOD if connected else BORDER,width=4 if connected else 2)
    d.text((x+size/2,y+38),name,font=font(18,True),fill=WHITE,anchor="mm")
    d.text((x+size/2,y+90),state,font=font(18,True),fill=GOOD if connected else MUTED,anchor="mm")
    if battery is not None:
        col=WARN if low else ACCENT
        d.text((x+size/2,y+132),f"{battery}%",font=font(28,True),fill=col,anchor="mm")
        d.rounded_rectangle((x+34,y+156,x+size-34,y+165),5,fill=(45,52,64))
        fill=int((size-68)*max(0,min(100,battery))/100)
        d.rounded_rectangle((x+34,y+156,x+34+fill,y+165),5,fill=col)

def card(d,x,y,w,h,heading,body,accent=ACCENT):
    d.rounded_rectangle((x,y,x+w,y+h),28,fill=PANEL,outline=BORDER,width=2)
    d.text((x+32,y+34),heading,font=font(24,True),fill=accent)
    d.multiline_text((x+32,y+82),body,font=font(19),fill=MUTED,spacing=8)

def hero(out,edition):
    im=bg(); pro=edition=="pro"
    title(im,"Wireless devices, without the guessing.", "Bluetooth status and battery where Windows exposes them. Control only where it is actually supported.")
    d=ImageDraw.Draw(im)
    card(d,95,245,630,450,"PRO" if pro else "LITE",
         ("MULTIPLE DEVICES\nFAVORITES + GROUPS\nLOW-BATTERY ALERTS\nDEVICE DASHBOARD" if pro else
          "ONE SELECTED DEVICE\nSTATUS\nBATTERY WHEN AVAILABLE\nSUPPORTED CONTROL"),
         GOOD if pro else ACCENT)
    devices=[("HEADPHONES","CONNECTED",72,True,False),("KEYBOARD","CONNECTED",41,True,False),("MOUSE","SLEEP/OFF",None,False,False),("CONTROLLER","CONNECTED",18,True,True)]
    x0=860
    for i,s in enumerate(devices):
        key(d,x0+(i%2)*235,285+(i//2)*230,*s,size=195)
    d.text((1095,760),"EACH DEVICE ADVERTISES ITS OWN CAPABILITIES",font=font(19,True),fill=MUTED,anchor="mm")
    signature(im); im.convert("RGB").save(out/"02_cover.png",quality=95)

def capability(out):
    im=bg(); title(im,"Capability-gated by design","No universal battery promise. No fake CONNECT button.")
    d=ImageDraw.Draw(im)
    rows=[
      ("HEADPHONES","STATUS  CONNECT  DISCONNECT  BATTERY  CHARGING",[1,1,1,1,1]),
      ("KEYBOARD","STATUS  BATTERY",[1,0,0,1,0]),
      ("MOUSE","STATUS",[1,0,0,0,0]),
      ("CONTROLLER","STATUS  BATTERY",[1,0,0,1,0]),
    ]
    labels=["STATUS","CONNECT","DISCONNECT","BATTERY","CHARGING"]
    for r,(name,desc,caps) in enumerate(rows):
        y=255+r*140; d.text((120,y+38),name,font=font(27,True),fill=WHITE)
        for i,(lab,on) in enumerate(zip(labels,caps)):
            x=520+i*245
            d.rounded_rectangle((x,y,x+210,y+76),20,fill=KEY,outline=GOOD if on else BORDER,width=2)
            d.text((x+105,y+38),lab,font=font(15,True),fill=WHITE if on else (92,101,114),anchor="mm")
    signature(im); im.convert("RGB").save(out/"03_gallery_01.png",quality=95)

def dashboard(out,edition):
    im=bg(); pro=edition=="pro"
    title(im,"One glance at the devices that matter", "Pro adds the multi-device dashboard, groups and low-battery thresholds." if pro else "Lite keeps one device simple: status, battery, or supported control.")
    d=ImageDraw.Draw(im)
    if pro:
        card(d,100,260,480,420,"ALL DEVICES","3 / 4 CONNECTED\n1 LOW BATTERY\n\nGAMING  2 / 3\nWORK    2 / 2\nTRAVEL  1 / 2",GOOD)
        for i,s in enumerate([("HEADPHONES","CONNECTED",72,True,False),("KEYBOARD","CONNECTED",41,True,False),("MOUSE","SLEEP/OFF",None,False,False),("CONTROLLER","CONNECTED",18,True,True)]):
            key(d,710+(i%2)*260,260+(i//2)*235,*s,size=215)
    else:
        for i,s in enumerate([("MY DEVICE","CONNECTED",72,True,False),("BATTERY","AVAILABLE",72,True,False),("CONNECT","SUPPORTED",None,False,False)]):
            key(d,300+i*430,330,*s,size=250)
    signature(im); im.convert("RGB").save(out/"04_gallery_02.png",quality=95)

def groups(out):
    im=bg(); title(im,"Profiles organize. They do not wake everything.","GAMING, WORK and TRAVEL are status groups, not risky bulk-connect macros.")
    d=ImageDraw.Draw(im)
    for i,(name,body) in enumerate([
      ("GAMING","Controller\nHeadset\nGaming mouse"),
      ("WORK","Keyboard\nEarbuds"),
      ("TRAVEL","Portable mouse\nHeadphones")
    ]):
        card(d,150+i*570,285,480,365,name,body,GOOD if i==0 else ACCENT)
    d.text((960,735),"CYCLE DEVICE MOVES THROUGH FAVORITES WITHOUT AUTO-CONNECTING",font=font(20,True),fill=MUTED,anchor="mm")
    signature(im); im.convert("RGB").save(out/"05_gallery_03.png",quality=95)

def compatibility(out):
    im=bg(); title(im,"Ready-made key profiles","Standard, XL and Stream Deck+ are included. Plus uses keys only because a dial adds no legitimate control.")
    d=ImageDraw.Draw(im)
    for i,(name,cols,rows) in enumerate([("STREAM DECK",5,3),("STREAM DECK XL",8,4),("STREAM DECK +",4,2)]):
        x=130+i*590; y=320
        d.rounded_rectangle((x,y,x+500,y+330),30,fill=PANEL,outline=BORDER,width=2)
        d.text((x+250,y+52),name,font=font(24,True),fill=WHITE,anchor="mm")
        cell=42 if cols<=5 else 28; gap=10; gw=cols*cell+(cols-1)*gap
        gx=x+(500-gw)//2; gy=y+115
        for rr in range(rows):
            for cc in range(cols):
                xx=gx+cc*(cell+gap); yy=gy+rr*(cell+gap)
                d.rounded_rectangle((xx,yy,xx+cell,yy+cell),7,fill=KEY,outline=ACCENT if rr==0 and cc<min(cols,5) else BORDER,width=2)
        d.text((x+250,y+285),"KEY PROFILE INCLUDED",font=font(15,True),fill=MUTED,anchor="mm")
    signature(im); im.convert("RGB").save(out/"06_gallery_04.png",quality=95)

def search(out,edition):
    im=Image.new("RGBA",(288,288),(*BG,255)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((18,18,270,270),54,fill=KEY,outline=GOOD if edition=="pro" else ACCENT,width=8)
    cx=144
    d.arc((78,70,210,202),200,340,fill=ACCENT,width=12)
    d.arc((98,92,190,184),200,340,fill=ACCENT,width=10)
    d.ellipse((134,165,154,185),fill=WHITE)
    d.text((144,231),"PRO" if edition=="pro" else "LITE",font=font(24,True),fill=GOOD if edition=="pro" else WHITE,anchor="mm")
    im.convert("RGB").save(out/"01_search_icon.png",quality=95)

def main():
    p=argparse.ArgumentParser(); p.add_argument("--destination",required=True); p.add_argument("--edition",choices=["lite","pro"],required=True); a=p.parse_args()
    out=Path(a.destination); out.mkdir(parents=True,exist_ok=True)
    search(out,a.edition); hero(out,a.edition); capability(out); dashboard(out,a.edition); groups(out); compatibility(out)
    req=["01_search_icon.png","02_cover.png","03_gallery_01.png","04_gallery_02.png","05_gallery_03.png","06_gallery_04.png"]
    for name in req:
        q=out/name
        if not q.is_file(): raise SystemExit(f"Missing Rat Art output: {name}")
        with Image.open(q) as chk:
            expected=(288,288) if name=="01_search_icon.png" else (W,H)
            if chk.size!=expected: raise SystemExit(f"Wrong Rat Art size for {name}: {chk.size}")
    print(f"Wireless Device Manager {a.edition} Rat Art ready: {out}")

if __name__=="__main__": main()
