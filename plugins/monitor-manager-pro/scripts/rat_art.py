from __future__ import annotations
import argparse, os, hashlib
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT=Path(__file__).resolve().parents[3]
RAT=ROOT/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"
W,H=1920,960
BG=(7,10,14); PANEL=(16,20,26); BORDER=(43,50,61); WHITE=(247,249,251); MUTED=(169,179,192); ACCENT=(255,178,30); WARN=(255,196,77)

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

def fit_font(draw,text,max_width,max_size,min_size=12,bold=True):
    text=str(text or "")
    for size in range(max_size,min_size-1,-1):
        f=font(size,bold)
        box=draw.textbbox((0,0),text,font=f)
        if box[2]-box[0] <= max_width:
            return f
    return font(min_size,bold)

def header(im,title,sub):
    d=ImageDraw.Draw(im); d.text((110,85),"MONITOR MANAGER PRO",font=font(23),fill=(*ACCENT,255))
    d.text((110,130),title,font=fit_font(d,title,W-220,62,34),fill=(*WHITE,255))
    d.text((112,220),sub,font=fit_font(d,sub,W-225,25,18,False),fill=(*MUTED,255))

def footer(im):
    d=ImageDraw.Draw(im); d.line((0,824,W,824),fill=(*ACCENT,68),width=1)
    if RAT.is_file():
        rat=Image.open(RAT).convert("RGBA"); box=rat.getbbox()
        if box: rat=rat.crop(box)
        s=min(48/rat.width,48/rat.height); rat=rat.resize((int(rat.width*s),int(rat.height*s)),Image.Resampling.LANCZOS)
        im.alpha_composite(rat,((W-rat.width)//2,860))

def card(d,b): d.rounded_rectangle(b,radius=26,fill=(*PANEL,245),outline=(*BORDER,255),width=2)

def key(im,x,y,label,sub="",accent=ACCENT,size=142):
    d=ImageDraw.Draw(im); card(d,(x,y,x+size,y+size))
    inner=size-28
    label_font=fit_font(d,label,inner,19,12,True)
    d.text((x+size/2,y+58),label,font=label_font,fill=(*WHITE,255),anchor="mm")
    if sub:
        sub_font=fit_font(d,sub,inner,13,10,False)
        d.text((x+size/2,y+94),sub,font=sub_font,fill=(*accent,255),anchor="mm")

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
    d.text((110,438),"Your whole monitor setup. One press.",font=font(28,False),fill=(*MUTED,255))
    labels=[("165 HZ","REFRESH",ACCENT),("DP","INPUT",ACCENT),("HDMI","INPUT",ACCENT),("65%","BRIGHTNESS",ACCENT),("HDR","WINDOWS",ACCENT),
            ("60 HZ","REFRESH",ACCENT),("120 HZ","REFRESH",ACCENT),("144 HZ","REFRESH",ACCENT),("240 HZ","REFRESH",ACCENT),("BRIGHT -","-5%",ACCENT),
            ("PC MODE","PROFILE",ACCENT),("CONSOLE","PROFILE",ACCENT),("EXTEND","DISPLAY",ACCENT),("PRIMARY","DISPLAY",ACCENT),("POWER","DDC/CI",WARN)]
    deck(im,labels); footer(im); save(im,path)

def controls(path):
    im=bg(); header(im,"Stop reaching behind your monitor.","Put the display controls you actually change on physical Stream Deck keys.")
    d=ImageDraw.Draw(im)
    items=[("SWITCH INPUTS","Jump between PC and console without touching the monitor buttons."),
           ("CHANGE DISPLAY MODE","Move between high-refresh gaming and everyday display modes in one press."),
           ("CONTROL BRIGHTNESS","Use exact levels or a dial instead of digging through the monitor menu."),
           ("RUN MULTIPLE DISPLAYS","Target the screen you mean and keep the whole workflow on Stream Deck.")]
    y=330
    for title,body in items:
        d.ellipse((135,y+7,151,y+23),fill=(*ACCENT,255)); d.text((175,y),title,font=font(27),fill=(*WHITE,255)); d.text((175,y+45),body,font=font(20,False),fill=(*MUTED,255)); y+=125
    footer(im); save(im,path)

def capabilities(path):
    im=bg(); header(im,"One press. Your setup comes back.","Save the supported monitor state you use for gaming, console, work or night.")
    d=ImageDraw.Draw(im)
    for i,(state,body,color) in enumerate([
        ("PC / GAMING","Restore your preferred input, mode, brightness and display choices.",ACCENT),
        ("CONSOLE","Switch the monitor toward the console setup without rebuilding it by hand.",ACCENT),
        ("WORK / NIGHT","Bring back the display state you actually use for a different part of the day.",ACCENT)]):
        y=340+i*145; card(d,(180,y,1740,y+110)); d.text((230,y+22),state,font=font(28),fill=(*color,255)); d.text((600,y+28),body,font=font(21,False),fill=(*MUTED,255))
    footer(im); save(im,path)

def profiles(path):
    im=bg(); header(im,"Stop opening Windows Display Settings.","Refresh rate, resolution, HDR, primary display and Extend / Duplicate live on your deck.")
    labels=[("MONITORS","STATUS",ACCENT),("DP","INPUT",ACCENT),("HDMI","INPUT",ACCENT),("HDR","WINDOWS",ACCENT),("PRIMARY","DISPLAY",ACCENT),
            ("PC MODE","PROFILE",ACCENT),("CONSOLE","PROFILE",ACCENT),("WORK LAPTOP","PROFILE",ACCENT),("NIGHT","PROFILE",ACCENT),("EXTEND","DISPLAY",ACCENT),
            ("165 HZ","DISPLAY",ACCENT),("1440P","RESOLUTION",ACCENT),("65%","BRIGHTNESS",ACCENT),("50%","CONTRAST",ACCENT),("50%","VOLUME",ACCENT)]
    deck(im,labels,x=500,y=305); footer(im); save(im,path)

def plus(path):
    im=bg(); header(im,"Turn the controls you tweak all day.","Brightness, contrast and monitor volume stay continuous on Stream Deck+.")
    d=ImageDraw.Draw(im); card(d,(250,330,1670,690))
    d.text((335,390),"BRIGHTNESS   •   CONTRAST   •   VOLUME",font=font(30),fill=(*WHITE,255)); d.line((340,510,1450,510),fill=(*WHITE,255),width=18); d.ellipse((1040,468,1124,552),fill=(*ACCENT,255))
    d.text((335,570),"Rotate for fine adjustment. Pressed keys still support exact presets.",font=font(23,False),fill=(*MUTED,255))
    footer(im); save(im,path)

def compatibility(path):
    im=bg(); header(im,"Windows first. Hardware honest.","Pro never assumes HDMI, DisplayPort, USB-C or a VCP code exists on every monitor.")
    d=ImageDraw.Draw(im)
    boxes=[("CAPABILITY GATE","SUPPORTED / NOT SUPPORTED / UNKNOWN\nNo arbitrary VCP writes"),
           ("MONITOR PROFILES","Transactional apply where practical\nCOMPLETE / PARTIAL / FAILED"),
           ("WINDOWS DISPLAY","Topology + modes + HDR\nNative Windows APIs first")]
    x=120
    for title,body in boxes:
        card(d,(x,350,x+520,650)); d.text((x+35,400),title,font=font(25),fill=(*WHITE,255))
        for j,line in enumerate(body.split("\n")): d.text((x+35,475+j*42),line,font=font(19,False),fill=(*MUTED,255))
        x+=600
    footer(im); save(im,path)

def validate_outputs(out):
    if not RAT.is_file():
        raise SystemExit("RAT ART FAIL: PackRat logo asset missing: "+str(RAT))
    expected={
        "01_search_icon.png":(512,512),
        "02_cover.png":(1920,960),
        "03_gallery_01.png":(1920,960),
        "04_gallery_02.png":(1920,960),
        "05_gallery_03.png":(1920,960),
        "06_gallery_04.png":(1920,960),
    }
    digests={}
    for name,size in expected.items():
        file=out/name
        if not file.is_file():
            raise SystemExit("RAT ART FAIL: missing output "+name)
        with Image.open(file) as image:
            if image.size!=size:
                raise SystemExit(f"RAT ART FAIL: {name} is {image.size}, expected {size}")
        digest=hashlib.sha256(file.read_bytes()).hexdigest()
        if digest in digests:
            raise SystemExit(f"RAT ART FAIL: {name} is byte-identical to {digests[digest]}")
        digests[digest]=name

def main():
    p=argparse.ArgumentParser(); p.add_argument("--out",required=True); args=p.parse_args(); out=Path(args.out).resolve(); out.mkdir(parents=True,exist_ok=True)
    if not RAT.is_file(): raise SystemExit("RAT ART FAIL: PackRat logo asset missing: "+str(RAT))
    search_icon(out/"01_search_icon.png"); hero(out/"02_cover.png"); controls(out/"03_gallery_01.png"); capabilities(out/"04_gallery_02.png"); profiles(out/"05_gallery_03.png"); plus(out/"06_gallery_04.png")
    validate_outputs(out)
    print("RAT ART PASS:",out)

if __name__=="__main__": main()
