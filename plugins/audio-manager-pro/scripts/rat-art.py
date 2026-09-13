#!/usr/bin/env python3
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFont

W,H=1920,960
BG=(8,12,18); PANEL=(17,23,31); KEY=(21,29,38); WHITE=(246,248,251); MUTED=(151,163,178); ACC=(86,242,165); WARN=(255,204,102); RED=(255,107,118)

def font(size,bold=False):
    names=["arialbd.ttf" if bold else "arial.ttf","segoeuib.ttf" if bold else "segoeui.ttf","DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"]
    for name in names:
        try:return ImageFont.truetype(name,size)
        except OSError:pass
    return ImageFont.load_default()

def bg():
    im=Image.new("RGB",(W,H),BG);d=ImageDraw.Draw(im)
    for x in range(0,W,96): d.line((x,0,x,H),fill=(11,17,24),width=1)
    for y in range(0,H,96): d.line((0,y,W,y),fill=(11,17,24),width=1)
    return im

def title(im,head,sub):
    d=ImageDraw.Draw(im); d.text((100,80),head,font=font(62,True),fill=WHITE)
    d.text((104,160),sub,font=font(25),fill=MUTED)

def footer(im):
    d=ImageDraw.Draw(im); d.text((100,900),"PACKRAT  ·  AUDIO MANAGER PRO",font=font(18,True),fill=(99,115,129))
    d.text((1810,900),"$9.99",font=font(18,True),fill=(99,115,129),anchor="ra")

def key(d,x,y,label,out_name,in_name,accent=ACC):
    d.rounded_rectangle((x,y,x+290,y+350),34,fill=KEY,outline=accent,width=5)
    d.text((x+145,y+48),label,font=font(25,True),fill=WHITE,anchor="mm")
    d.rounded_rectangle((x+34,y+92,x+256,y+162),16,fill=PANEL)
    d.text((x+54,y+115),"OUT",font=font(14,True),fill=accent)
    d.text((x+110,y+115),out_name,font=font(17,True),fill=WHITE)
    d.rounded_rectangle((x+34,y+181,x+256,y+251),16,fill=PANEL)
    d.text((x+54,y+204),"IN",font=font(14,True),fill=accent)
    d.text((x+110,y+204),in_name,font=font(17,True),fill=WHITE)
    d.line((x+66,y+291,x+224,y+291),fill=accent,width=8)
    d.ellipse((x+135,y+278,x+161,y+304),fill=accent)

def save_cover(out):
    im=bg(); title(im,"Switch your entire audio setup with one key.","Each Audio Profile changes input + output together, including Windows Communications roles.")
    d=ImageDraw.Draw(im)
    specs=[("HEADSET","Headset","Headset Mic"),("SPEAKERS","Speakers","Desk Mic"),("MEETING","Headset","Shure Mic"),("STREAMING","Monitor","Broadcast Mic"),("VR","VR Headset","VR Mic")]
    xs=[75,430,785,1140,1495]
    for x,s in zip(xs,specs): key(d,x,300,*s)
    d.text((960,755),"DEFAULT OUTPUT  +  COMMUNICATIONS OUTPUT  +  DEFAULT INPUT  +  COMMUNICATIONS INPUT",font=font(21,True),fill=ACC,anchor="mm")
    footer(im); im.save(out/"02_cover.png")

def gallery_roles(out):
    im=bg(); title(im,"One press. Four Windows audio roles.","Apps do not all follow the same Windows device role. Audio Profiles can own them separately.")
    d=ImageDraw.Draw(im)
    roles=[("DEFAULT OUTPUT","Speakers"),("COMM OUTPUT","Headset"),("DEFAULT INPUT","Shure MV7"),("COMM INPUT","Headset Mic")]
    for i,(a,b) in enumerate(roles):
        x=150+i*430
        d.rounded_rectangle((x,300,x+350,610),28,fill=PANEL,outline=(49,63,76),width=2)
        d.text((x+175,375),a,font=font(18,True),fill=ACC,anchor="mm")
        d.text((x+175,475),b,font=font(27,True),fill=WHITE,anchor="mm")
        d.text((x+175,540),"saved per profile",font=font(16),fill=MUTED,anchor="mm")
    d.rounded_rectangle((630,690,1290,790),24,fill=(22,48,40),outline=ACC,width=3)
    d.text((960,740),"APPLY PROFILE  →  SUCCESS",font=font(28,True),fill=WHITE,anchor="mm")
    footer(im); im.save(out/"03_gallery_01.png")

def gallery_state(out):
    im=bg(); title(im,"Save the state, not just the device.","Restore endpoint volume and mute together with routing when your profile needs it.")
    d=ImageDraw.Draw(im)
    items=[("OUTPUT","Headset","42%","UNMUTED"),("INPUT","Shure MV7","76%","UNMUTED")]
    for i,(kind,name,vol,mute) in enumerate(items):
        x=280+i*720
        d.rounded_rectangle((x,300,x+640,660),36,fill=PANEL,outline=ACC,width=3)
        d.text((x+55,370),kind,font=font(18,True),fill=ACC)
        d.text((x+55,430),name,font=font(32,True),fill=WHITE)
        d.text((x+55,530),vol,font=font(62,True),fill=WHITE)
        d.text((x+300,530),mute,font=font(20,True),fill=MUTED)
        d.text((x+55,608),"volume + mute restore are opt-in per role",font=font(17),fill=MUTED)
    footer(im); im.save(out/"04_gallery_02.png")

def gallery_resilience(out):
    im=bg(); title(im,"Audio devices change IDs. Your profiles should not guess.","PackRat saves endpoint + hardware metadata and makes missing devices explicit.")
    d=ImageDraw.Draw(im)
    stages=[("USB RECONNECT","endpoint ID changed",ACC),("SAFE MATCH","hardware identity found",ACC),("MISSING DEVICE","rebind required",WARN)]
    for i,(a,b,c) in enumerate(stages):
        x=160+i*560
        d.rounded_rectangle((x,320,x+480,610),30,fill=PANEL,outline=c,width=4)
        d.text((x+240,405),a,font=font(24,True),fill=c,anchor="mm")
        d.text((x+240,475),b,font=font(19),fill=WHITE,anchor="mm")
        if i<2:
            d.line((x+160,540,x+320,540),fill=c,width=7)
            d.ellipse((x+226,526,x+254,554),fill=c)
        else:
            d.text((x+240,545),"NO SILENT FALLBACK",font=font(17,True),fill=WARN,anchor="mm")
    d.text((960,720),"SUCCESS   ·   PARTIAL   ·   FAILED",font=font(34,True),fill=WHITE,anchor="mm")
    footer(im); im.save(out/"05_gallery_03.png")

def gallery_dial(out):
    im=bg(); title(im,"Stream Deck+ gets a profile-aware volume dial.","Rotate live output volume. Press to reapply the profile. Touch to toggle output mute.")
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((600,300,1320,690),44,fill=PANEL,outline=(49,63,76),width=3)
    d.text((960,385),"MEETING",font=font(34,True),fill=WHITE,anchor="mm")
    d.text((960,455),"Headset · 42%",font=font(25),fill=MUTED,anchor="mm")
    d.line((760,550,1160,550),fill=(55,68,82),width=18)
    d.line((760,550,930,550),fill=ACC,width=18)
    d.ellipse((910,530,950,570),fill=WHITE)
    d.text((960,625),"ROTATE  ·  PRESS  ·  TOUCH",font=font(18,True),fill=ACC,anchor="mm")
    footer(im); im.save(out/"06_gallery_04.png")

def search(out):
    im=Image.new("RGB",(288,288),BG);d=ImageDraw.Draw(im)
    d.rounded_rectangle((18,18,270,270),56,fill=KEY,outline=ACC,width=8)
    for y,cx in [(86,104),(144,178),(202,128)]:
        d.line((64,y,224,y),fill=WHITE,width=10);d.ellipse((cx-18,y-18,cx+18,y+18),fill=ACC)
    im.save(out/"01_search_icon.png")

def main():
    p=argparse.ArgumentParser();p.add_argument("--destination",required=True);a=p.parse_args();out=Path(a.destination);out.mkdir(parents=True,exist_ok=True)
    search(out);save_cover(out);gallery_roles(out);gallery_state(out);gallery_resilience(out);gallery_dial(out)
    for path in out.glob("*.png"):
        with Image.open(path) as im:
            expected=(288,288) if path.name=="01_search_icon.png" else (W,H)
            if im.size!=expected: raise SystemExit(f"{path.name}: {im.size} != {expected}")
    print(f"Audio Manager Pro Rat Art ready: {out}")

if __name__=="__main__": main()
