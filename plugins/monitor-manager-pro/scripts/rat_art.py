from __future__ import annotations
import argparse, os, hashlib, json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

ROOT=Path(__file__).resolve().parents[3]
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/"tools"/"art"))
from marketplace_text import draw_fitted_text
from streamdeck_photo import compose_device, alpha_crop_device
RAT=ROOT/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"
SCENE=ROOT/"tools"/"art"/"scenes"/"warm-studio-v1"/"base.png"
PLUGIN_DIR=ROOT/"plugins"/"monitor-manager-pro"/"com.packrat.monitormanagerpro.sdPlugin"
MANIFEST_PATH=PLUGIN_DIR/"manifest.json"
W,H=1920,960
BG=(7,10,14); PANEL=(12,16,23); BORDER=(54,63,76); WHITE=(247,249,251); MUTED=(178,188,203); ACCENT=(255,178,30); WARM=(255,126,24); COOL=(39,158,255); WARN=(255,196,77); GREEN=(43,232,106)

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
    if not SCENE.is_file():
        raise SystemExit("RAT ART FAIL: warm studio scene missing: "+str(SCENE))
    base=Image.open(SCENE).convert("RGBA")
    if base.size!=(W,H):
        raise SystemExit(f"RAT ART FAIL: warm studio scene is {base.size}, expected {(W,H)}")
    # Preserve the approved room, but darken it slightly so product proof wins.
    veil=Image.new("RGBA",(W,H),(2,5,10,56))
    return Image.alpha_composite(base,veil)


def glass_panel(im,box,radius=30,fill=(8,12,19,206),border_alpha=225,glow_alpha=54,border_width=3):
    x1,y1,x2,y2=[int(v) for v in box]
    if x2<=x1 or y2<=y1:
        raise ValueError("invalid glass panel box")
    layer=Image.new("RGBA",(W,H),(0,0,0,0))
    ld=ImageDraw.Draw(layer)
    ld.rounded_rectangle((x1,y1,x2,y2),radius=radius,fill=fill)
    im.alpha_composite(layer)

    outer=Image.new("L",(W,H),0); od=ImageDraw.Draw(outer)
    od.rounded_rectangle((x1,y1,x2,y2),radius=radius,fill=255)
    inner=Image.new("L",(W,H),0); idr=ImageDraw.Draw(inner)
    inset=max(1,border_width)
    idr.rounded_rectangle((x1+inset,y1+inset,x2-inset,y2-inset),radius=max(1,radius-inset),fill=255)
    ring=ImageChops.subtract(outer,inner)

    gradient=Image.new("RGBA",(W,H),(0,0,0,0))
    gd=ImageDraw.Draw(gradient)
    width=max(1,x2-x1)
    for x in range(x1,x2+1):
        t=(x-x1)/width
        r=round(WARM[0]*(1-t)+COOL[0]*t)
        g=round(WARM[1]*(1-t)+COOL[1]*t)
        b=round(WARM[2]*(1-t)+COOL[2]*t)
        gd.line((x,y1,x,y2),fill=(r,g,b,border_alpha),width=1)
    gradient.putalpha(ImageChops.multiply(gradient.getchannel("A"),ring))

    glow_mask=ring.filter(ImageFilter.GaussianBlur(14))
    glow=gradient.copy()
    glow.putalpha(glow_mask.point(lambda p: round(p*glow_alpha/255)))
    im.alpha_composite(glow)
    im.alpha_composite(gradient)




def fit_font(draw,text,max_width,max_size,min_size=12,bold=True):
    text=str(text or "")
    for size in range(max_size,min_size-1,-1):
        f=font(size,bold)
        box=draw.textbbox((0,0),text,font=f)
        if box[2]-box[0] <= max_width:
            return f
    return font(min_size,bold)

def header(im,title,sub):
    # One strong campaign header: translucent glass with warm-left / cool-right edge.
    glass_panel(im,(195,74,1725,258),radius=34,fill=(5,9,16,196),border_alpha=205,glow_alpha=40,border_width=2)
    d=ImageDraw.Draw(im)
    draw_fitted_text(
        d,(245,108,1675,174),title,font,
        fill=(*WHITE,255),max_size=56,min_size=40,bold=True,max_lines=1,align="center"
    )
    if str(sub or "").strip():
        draw_fitted_text(
            d,(275,190,1645,228),sub,font,
            fill=(*MUTED,255),max_size=27,min_size=21,bold=False,max_lines=1,align="center"
        )




def footer(im):
    if RAT.is_file():
        rat=Image.open(RAT).convert("RGBA"); box=rat.getbbox()
        if box: rat=rat.crop(box)
        s=min(48/rat.width,48/rat.height)
        rat=rat.resize((max(1,int(rat.width*s)),max(1,int(rat.height*s))),Image.Resampling.LANCZOS)
        im.alpha_composite(rat,((W-rat.width)//2,875))




def card(d,b): d.rounded_rectangle(b,radius=26,fill=(*PANEL,235),outline=(*BORDER,220),width=2)


def runtime_key(im,x,y,kind,lines,size=150,tone="brand"):
    """Representative key face mirroring src/key-visuals.ts geometry and runtime labels."""
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x,y,x+size,y+size),radius=int(size*.16),fill=(5,7,10,255),outline=(50,57,68,255),width=max(2,int(size*.018)))
    k=size/72.0
    def P(px,py): return (x+px*k,y+py*k)
    sw=max(3,int(9*size/144))

    if kind=="brightness":
        cx,cy=P(36,23); rr=8*k
        d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=(*WHITE,255),width=sw)
        for a,b,c1,e in [(36,7,36,12),(36,34,36,39),(20,23,25,23),(47,23,52,23),(25,12,29,16),(43,30,47,34),(47,12,43,16),(29,30,25,34)]:
            d.line((P(a,b),P(c1,e)),fill=(*WHITE,255),width=sw)
    elif kind=="contrast":
        cx,cy=P(36,23); rr=15*k
        d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),outline=(*WHITE,255),width=sw)
        d.pieslice((cx-rr,cy-rr,cx+rr,cy+rr),-90,90,fill=(*WHITE,255))
        d.line((cx,cy-rr,cx,cy+rr),fill=(*WHITE,255),width=sw)
    elif kind=="volume":
        poly=[P(18,20),P(26,20),P(37,11),P(37,36),P(26,28),P(18,28)]
        d.line(poly+[poly[0]],fill=(*WHITE,255),width=sw,joint="curve")
        d.arc((P(38,14)[0],P(38,14)[1],P(53,34)[0],P(53,34)[1]),-55,55,fill=(*WHITE,255),width=sw)
    elif kind=="power":
        d.line((P(36,8),P(36,23)),fill=(*WHITE,255),width=sw)
        d.arc((P(20,10)[0],P(20,10)[1],P(52,42)[0],P(52,42)[1]),-55,235,fill=(*WHITE,255),width=sw)
    elif kind=="input":
        d.rounded_rectangle((P(14,10)[0],P(14,10)[1],P(58,38)[0],P(58,38)[1]),radius=int(4*k),outline=(*WHITE,255),width=sw)
        d.line((P(9,24),P(34,24)),fill=(*WHITE,255),width=sw)
        d.line((P(27,17),P(34,24),P(27,31)),fill=(*WHITE,255),width=sw)
    elif kind=="refresh-rate":
        d.arc((P(17,7)[0],P(17,7)[1],P(55,45)[0],P(55,45)[1]),205,340,fill=(*WHITE,255),width=sw)
        d.arc((P(17,7)[0],P(17,7)[1],P(55,45)[0],P(55,45)[1]),25,160,fill=(*WHITE,255),width=sw)
        d.line((P(52,17),P(52,8)),fill=(*WHITE,255),width=sw); d.line((P(52,17),P(43,17)),fill=(*WHITE,255),width=sw)
        d.line((P(20,35),P(20,44)),fill=(*WHITE,255),width=sw); d.line((P(20,35),P(29,35)),fill=(*WHITE,255),width=sw)
        d.line((P(36,15),P(36,23),P(42,27)),fill=(*WHITE,255),width=sw)
    elif kind=="resolution":
        for seg in [((13,18),(13,8),(23,8)),((49,8),(59,8),(59,18)),((13,29),(13,39),(23,39)),((49,39),(59,39),(59,29))]:
            d.line([P(*q) for q in seg],fill=(*WHITE,255),width=sw)
        d.rounded_rectangle((P(25,15)[0],P(25,15)[1],P(47,33)[0],P(47,33)[1]),radius=int(2*k),outline=(*WHITE,255),width=sw)
    elif kind=="hdr":
        d.rounded_rectangle((P(12,8)[0],P(12,8)[1],P(60,38)[0],P(60,38)[1]),radius=int(5*k),outline=(*WHITE,255),width=sw)
        d.text(P(36,23),"HDR",font=fit_font(d,"HDR",34*k,18,12),fill=(*WHITE,255),anchor="mm")
    elif kind=="topology":
        d.rounded_rectangle((P(9,8)[0],P(9,8)[1],P(43,32)[0],P(43,32)[1]),radius=int(3*k),outline=(*WHITE,255),width=sw)
        d.rounded_rectangle((P(29,15)[0],P(29,15)[1],P(63,39)[0],P(63,39)[1]),radius=int(3*k),outline=(*WHITE,255),width=sw)
    elif kind=="primary":
        d.rounded_rectangle((P(13,8)[0],P(13,8)[1],P(59,37)[0],P(59,37)[1]),radius=int(4*k),outline=(*WHITE,255),width=sw)
        cx,cy=P(36,23); r1=8*k; r2=3.5*k; pts=[]
        for i in range(10):
            a=-math.pi/2+i*math.pi/5; r=r1 if i%2==0 else r2
            pts.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
        d.polygon(pts,outline=(*WHITE,255))
    elif kind=="orientation":
        d.rounded_rectangle((P(26,7)[0],P(26,7)[1],P(46,38)[0],P(46,38)[1]),radius=int(3*k),outline=(*WHITE,255),width=sw)
        d.arc((P(12,5)[0],P(8,5)[1],P(34,28)[0],P(34,28)[1]),170,290,fill=(*WHITE,255),width=sw)
        d.arc((P(38,18)[0],P(44,18)[1],P(62,43)[0],P(62,43)[1]),-20,100,fill=(*WHITE,255),width=sw)
    elif kind=="save-profile":
        d.rounded_rectangle((P(17,7)[0],P(17,7)[1],P(55,38)[0],P(55,38)[1]),radius=int(4*k),outline=(*WHITE,255),width=sw)
        d.line((P(26,7),P(26,18),P(46,18),P(46,7)),fill=(*WHITE,255),width=sw)
        d.line((P(36,21),P(36,32)),fill=(*WHITE,255),width=sw)
        d.line((P(31,27),P(36,32),P(41,27)),fill=(*WHITE,255),width=sw)
    elif kind=="apply-profile":
        d.rounded_rectangle((P(16,9)[0],P(16,9)[1],P(56,40)[0],P(56,40)[1]),radius=int(4*k),outline=(*WHITE,255),width=sw)
        d.line((P(26,16),P(40,16)),fill=(*WHITE,255),width=sw); d.line((P(26,24),P(36,24)),fill=(*WHITE,255),width=sw)
        d.line((P(43,22),P(51,28),P(43,34)),fill=(*WHITE,255),width=sw)
    elif kind=="status":
        d.arc((P(15,12)[0],P(15,12)[1],P(57,54)[0],P(57,54)[1]),180,360,fill=(*WHITE,255),width=sw)
        d.line((P(36,34),P(46,22)),fill=(*WHITE,255),width=sw)
        rr=3*k; cx,cy=P(36,34); d.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill=(*WHITE,255))
        d.line((P(20,38),P(52,38)),fill=(*WHITE,255),width=sw)

    clean=[str(value).strip().upper() for value in lines if str(value).strip()][:2] or ["?"]
    max_len=max(len(value) for value in clean)
    fs=int(size*(0.167 if max_len<=5 else 0.139 if max_len<=8 else 0.118))
    f=font(max(14,fs),True)
    if len(clean)==1:
        d.text((x+size/2,y+size*.84),clean[0],font=f,fill=(*WHITE,255),anchor="mm")
    else:
        d.text((x+size/2,y+size*.71),clean[0],font=f,fill=(*WHITE,255),anchor="mm")
        d.text((x+size/2,y+size*.88),clean[1],font=f,fill=(*WHITE,255),anchor="mm")

def arrow(d,x1,y,x2):
    # Thin connector: readable, but not a cartoon callout competing with the keys.
    d.line((x1,y,x2-18,y),fill=(*ACCENT,238),width=6)
    d.line((x2-18,y-16,x2,y),fill=(*ACCENT,238),width=6)
    d.line((x2-18,y+16,x2,y),fill=(*ACCENT,238),width=6)



def dial_strip(im,x,y,w,title,value):
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x,y,x+w,y+128),radius=22,fill=(11,15,20,250),outline=(55,63,74,255),width=2)
    d.text((x+30,y+27),title,font=font(24),fill=(*WHITE,255))
    d.text((x+w-30,y+27),f"{value}%",font=font(24),fill=(*ACCENT,255),anchor="ra")
    barx1=x+30; barx2=x+w-30; bary=y+92
    d.rounded_rectangle((barx1,bary-7,barx2,bary+7),radius=7,fill=(66,72,82,255))
    progress=barx1+(barx2-barx1)*value/100
    d.rounded_rectangle((barx1,bary-7,progress,bary+7),radius=7,fill=(*ACCENT,255))
    d.ellipse((progress-18,bary-18,progress+18,bary+18),fill=(*ACCENT,255),outline=(*WHITE,180),width=2)



def exact_runtime_faces(out):
    # rat-art.ps1 exports these through the shipping TypeScript keyImage() function.
    # Never redraw Monitor Manager glyphs independently in marketing art.
    key_dir=out/"rat-art-keys"
    paths=sorted(key_dir.glob("*.png")) if key_dir.is_dir() else []
    if len(paths)!=15:
        raise SystemExit(f"RAT ART FAIL: expected 15 exact runtime key faces, got {len(paths)}")
    faces=[]
    for path in paths:
        face=Image.open(path).convert("RGBA")
        if face.size!=(288,288):
            raise SystemExit(f"RAT ART FAIL: exact runtime key {path.name} is {face.size}, expected 288x288")
        faces.append(face)
    return faces



def device_from_faces(faces,max_box=(1080,520)):
    result=compose_device(faces)
    if result.uncovered_pixels!=0 or len(result.holes)!=15:
        raise SystemExit("RAT ART FAIL: Stream Deck device compositor did not cover all 15 LCDs")
    device=alpha_crop_device(result.device)
    scale=min(max_box[0]/device.width,max_box[1]/device.height)
    return device.resize(
        (max(1,round(device.width*scale)),max(1,round(device.height*scale))),
        Image.Resampling.LANCZOS,
    )



def paste_face(im,face,x,y,size):
    rendered=face.resize((size,size),Image.Resampling.LANCZOS)
    im.alpha_composite(rendered,(x,y))


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

def controls(path,faces):
    im=bg()
    header(im,"Stop reaching behind your monitor.","Input, brightness and display mode—without the monitor OSD.")
    d=ImageDraw.Draw(im)

    glass_panel(im,(125,305,760,710),radius=34,fill=(8,12,18,214),border_alpha=150,glow_alpha=24,border_width=2)
    d.text((170,355),"THE OLD WAY",font=font(22),fill=(*MUTED,255))
    draw_fitted_text(d,(170,405,710,470),"Tiny monitor buttons.",font,fill=(*WHITE,255),max_size=36,min_size=28,bold=True,max_lines=1)
    draw_fitted_text(d,(170,485,710,550),"Hidden OSD menus.",font,fill=(*WHITE,255),max_size=36,min_size=28,bold=True,max_lines=1)
    draw_fitted_text(d,(170,565,710,630),"Input switching by feel.",font,fill=(*WHITE,255),max_size=36,min_size=28,bold=True,max_lines=1)
    arrow(d,805,510,930)

    glass_panel(im,(970,300,1800,710),radius=34,fill=(7,12,19,218),border_alpha=190,glow_alpha=32,border_width=2)
    d.text((1020,345),"ON YOUR STREAM DECK",font=font(26),fill=(*WHITE,255))
    proof=[faces[4],faces[0],faces[8],faces[5]]
    coords=[(995,392),(1195,392),(1395,392),(1595,392)]
    for face,(x,y) in zip(proof,coords):
        paste_face(im,face,x,y,185)
    labels=["INPUT","BRIGHTNESS","DISPLAY MODE","REFRESH RATE"]
    for (x,_),label in zip(coords,labels):
        d.text((x+92,610),label,font=font(17),fill=(*MUTED,255),anchor="mm")
    draw_fitted_text(d,(1020,642,1750,680),"The controls you actually change stay one press away.",font,fill=(*MUTED,255),max_size=25,min_size=20,max_lines=1)
    footer(im); save(im,path)





def capabilities(path,faces):
    im=bg()
    header(im,"One press. Your setup comes back.","Restore Gaming, Console or Night monitor setups instantly.")
    d=ImageDraw.Draw(im)
    glass_panel(im,(115,300,1805,720),radius=36,fill=(7,11,18,214),border_alpha=205,glow_alpha=34,border_width=2)

    paste_face(im,faces[12],150,372,230)
    d.text((265,625),"APPLY GAMING",font=font(22),fill=(*WHITE,255),anchor="mm")
    arrow(d,430,488,560)

    proof=[faces[4],faces[5],faces[7],faces[0]]
    labels=["INPUT","REFRESH","HDR","BRIGHTNESS"]
    proof_x=[600,835,1070,1305]
    for face,label,x in zip(proof,labels,proof_x):
        paste_face(im,face,x,352,205)
        d.text((x+102,585),label,font=font(19),fill=(*MUTED,255),anchor="mm")

    d.text((1080,618),"SAVED SETUPS",font=font(19),fill=(*MUTED,255),anchor="mm")
    for i,name in enumerate(["GAMING","CONSOLE","NIGHT"]):
        x=570+i*345
        d.rounded_rectangle((x,644,x+305,706),radius=18,fill=(13,18,25,235),outline=(84,95,112,235),width=2)
        d.text((x+152,675),name,font=font(21),fill=(*WHITE,255),anchor="mm")
    footer(im); save(im,path)





def profiles(path,faces):
    im=bg()
    header(im,"Stop opening Windows Display Settings.","This is what Monitor Manager Pro actually looks like on your deck.")
    d=ImageDraw.Draw(im)
    glass_panel(im,(110,300,1810,760),radius=36,fill=(7,11,18,210),border_alpha=205,glow_alpha=34,border_width=2)

    device=device_from_faces(faces,(1060,400))
    im.alpha_composite(device,(165,350))

    d.text((1325,370),"REAL PRODUCT PROOF",font=font(21),fill=(*MUTED,255))
    d.text((1325,415),"REAL KEYS.",font=font(40),fill=(*WHITE,255))
    d.text((1325,465),"REAL VALUES.",font=font(40),fill=(*WHITE,255))
    d.text((1325,515),"REAL STATES.",font=font(40),fill=(*WHITE,255))
    for i,label in enumerate(["INPUTS","HDR","PROFILES","LIVE STATUS"]):
        y=585+i*42
        d.text((1325,y),label,font=font(19),fill=(*MUTED,255))
    footer(im); save(im,path)





def plus(path,faces):
    im=bg()
    header(im,"Turn the controls you tweak all day.","Brightness, contrast and monitor volume on native Stream Deck+ dials.")
    d=ImageDraw.Draw(im)
    glass_panel(im,(120,305,1800,720),radius=36,fill=(7,11,18,214),border_alpha=205,glow_alpha=34,border_width=2)

    d.text((175,350),"KEY PRESETS",font=font(20),fill=(*MUTED,255))
    for face,x in zip([faces[0],faces[1],faces[2]],[170,390,610]):
        paste_face(im,face,x,410,175)

    d.text((955,350),"STREAM DECK+ DIALS",font=font(20),fill=(*MUTED,255))
    dial_strip(im,955,390,760,"BRIGHTNESS",65)
    dial_strip(im,955,530,760,"CONTRAST",50)
    # Volume is shown as the third repeated daily-use control without squeezing text.
    d.text((175,625),"Press for an exact preset.",font=font(25),fill=(*WHITE,255))
    d.text((955,685),"VOLUME  •  rotate for continuous adjustment",font=font(22),fill=(*WHITE,255))
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

def write_key_fixtures(out):
    keys = [
        {"action_uuid":"com.packrat.monitormanagerpro.brightness","lines":["65%"]},
        {"action_uuid":"com.packrat.monitormanagerpro.contrast","lines":["50%"]},
        {"action_uuid":"com.packrat.monitormanagerpro.volume","lines":["50%"]},
        {"action_uuid":"com.packrat.monitormanagerpro.power","lines":["ON"],"tone":"success"},
        {"action_uuid":"com.packrat.monitormanagerpro.input","lines":["DP"]},
        {"action_uuid":"com.packrat.monitormanagerpro.refresh-rate","lines":["165HZ"]},
        {"action_uuid":"com.packrat.monitormanagerpro.resolution","lines":["1440P"]},
        {"action_uuid":"com.packrat.monitormanagerpro.hdr","lines":["HDR","ON"],"tone":"success"},
        {"action_uuid":"com.packrat.monitormanagerpro.topology","lines":["EXTEND"]},
        {"action_uuid":"com.packrat.monitormanagerpro.primary","lines":["PRIMARY"]},
        {"action_uuid":"com.packrat.monitormanagerpro.orientation","lines":["LAND"]},
        {"action_uuid":"com.packrat.monitormanagerpro.save-profile","lines":["SAVE","GAMING"]},
        {"action_uuid":"com.packrat.monitormanagerpro.apply-profile","lines":["APPLY","GAMING"]},
        {"action_uuid":"com.packrat.monitormanagerpro.status","lines":["165HZ","1440P"]},
        None,
    ]
    (out/"rat-art-key-fixtures.json").write_text(
        json.dumps({"schema_version":1,"keys":keys},indent=2)+"\n",
        encoding="utf-8",
    )

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
    key_dir=out/"rat-art-keys"
    key_files=sorted(key_dir.glob("*.png")) if key_dir.is_dir() else []
    if len(key_files)!=15:
        raise SystemExit(f"RAT ART FAIL: expected 15 product-owned runtime key faces, got {len(key_files)}")
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
    write_key_fixtures(out)
    faces=exact_runtime_faces(out)
    search_icon(out/"01_search_icon.png"); hero(out/"02_cover.png"); controls(out/"03_gallery_01.png",faces); capabilities(out/"04_gallery_02.png",faces); profiles(out/"05_gallery_03.png",faces); plus(out/"06_gallery_04.png",faces)
    validate_outputs(out)
    print("RAT ART PASS:",out)

if __name__=="__main__": main()
