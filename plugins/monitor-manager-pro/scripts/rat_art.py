from __future__ import annotations
import argparse, os, hashlib, json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/"tools"/"art"))
from marketplace_text import draw_fitted_text
RAT=ROOT/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"
W,H=1920,960
BG=(7,10,14); PANEL=(16,20,26); BORDER=(43,50,61); WHITE=(247,249,251); MUTED=(169,179,192); ACCENT=(255,178,30); WARN=(255,196,77); GREEN=(43,232,106)

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
    base=Image.new("RGBA",(W,H),(*BG,255))
    glow=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(glow)
    d.ellipse((-280,130,650,1120),fill=(*ACCENT,24))
    d.ellipse((1360,-260,2200,600),fill=(55,121,205,22))
    d.ellipse((540,180,1500,1080),fill=(*ACCENT,9))
    base=Image.alpha_composite(base,glow.filter(ImageFilter.GaussianBlur(140)))
    d=ImageDraw.Draw(base)
    d.rounded_rectangle((1180,95,1810,430),radius=30,fill=(10,14,19,120),outline=(58,65,75,90),width=2)
    d.rectangle((1470,430,1515,510),fill=(25,29,35,100))
    d.rounded_rectangle((1340,505,1645,525),radius=8,fill=(28,32,38,100))
    d.rectangle((0,785,W,824),fill=(62,37,18,110))
    for x in range(0,W,115):
        d.line((x,790,x+80,823),fill=(135,78,29,34),width=1)
        d.line((x+32,785,x+120,818),fill=(*ACCENT,18),width=1)
    return base


def fit_font(draw,text,max_width,max_size,min_size=12,bold=True):
    text=str(text or "")
    for size in range(max_size,min_size-1,-1):
        f=font(size,bold)
        box=draw.textbbox((0,0),text,font=f)
        if box[2]-box[0] <= max_width:
            return f
    return font(min_size,bold)

def header(im,title,sub):
    d=ImageDraw.Draw(im)
    d.text((105,70),"MONITOR MANAGER PRO",font=font(22),fill=(*ACCENT,255))
    d.text((105,112),title,font=fit_font(d,title,1710,60,38),fill=(*WHITE,255))
    draw_fitted_text(
        d,(107,196,W-105,266),sub,font,
        fill=(*MUTED,255),max_size=27,min_size=19,bold=False,max_lines=2,spacing=5
    )


def footer(im):
    d=ImageDraw.Draw(im); d.line((0,824,W,824),fill=(*ACCENT,68),width=1)
    if RAT.is_file():
        rat=Image.open(RAT).convert("RGBA"); box=rat.getbbox()
        if box: rat=rat.crop(box)
        s=min(48/rat.width,48/rat.height); rat=rat.resize((int(rat.width*s),int(rat.height*s)),Image.Resampling.LANCZOS)
        im.alpha_composite(rat,((W-rat.width)//2,860))

def card(d,b): d.rounded_rectangle(b,radius=26,fill=(*PANEL,245),outline=(*BORDER,255),width=2)


def runtime_key(im,x,y,kind,lines,size=150,tone="brand"):
    """Representative key face mirroring src/key-visuals.ts geometry and runtime labels."""
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x,y,x+size,y+size),radius=int(size*.16),fill=(5,7,10,255),outline=(50,57,68,255),width=max(2,int(size*.018)))
    accent={"brand":ACCENT,"success":GREEN,"neutral":(105,116,129)}.get(tone,ACCENT)
    d.rounded_rectangle((x+int(size*.14),y+int(size*.07),x+int(size*.86),y+int(size*.09)),radius=2,fill=(*accent,255))
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
    fs=int(size*(0.15 if max_len<=5 else 0.12))
    f=font(max(14,fs),True)
    if len(clean)==1:
        d.text((x+size/2,y+size*.76),clean[0],font=f,fill=(*WHITE,255),anchor="mm")
    else:
        d.text((x+size/2,y+size*.70),clean[0],font=f,fill=(*WHITE,255),anchor="mm")
        d.text((x+size/2,y+size*.84),clean[1],font=f,fill=(*WHITE,255),anchor="mm")

def arrow(d,x1,y,x2):
    d.line((x1,y,x2,y),fill=(*ACCENT,255),width=10)
    d.polygon([(x2,y),(x2-30,y-23),(x2-30,y+23)],fill=(*ACCENT,255))

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
    im=bg()
    header(im,"Stop reaching behind your monitor.","Input, brightness and display mode move from tiny monitor menus to physical Stream Deck controls.")
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((110,300,900,720),radius=35,fill=(10,14,19,235),outline=(58,66,78,255),width=3)
    d.rounded_rectangle((170,345,840,640),radius=22,fill=(3,5,8,255),outline=(35,42,52,255),width=2)
    d.text((505,455),"MONITOR OSD",font=font(33),fill=(*MUTED,255),anchor="mm")
    for i in range(5):
        x=355+i*58
        d.ellipse((x,650,x+18,668),fill=(74,80,88,255))
    d.text((505,690),"tiny buttons  •  hidden menus",font=font(20,False),fill=(*MUTED,255),anchor="mm")
    arrow(d,930,520,1045)
    keys=[("input",["DP"]),("brightness",["65%"]),("topology",["EXTEND"]),("refresh-rate",["165HZ"])]
    coords=[(1100,320),(1290,320),(1100,510),(1290,510)]
    for (kind,lines),(x,y) in zip(keys,coords):
        runtime_key(im,x,y,kind,lines,165)
    d.text((1490,382),"ON YOUR",font=font(28),fill=(*ACCENT,255))
    d.text((1490,425),"STREAM DECK",font=font(39),fill=(*WHITE,255))
    draw_fitted_text(d,(1490,492,1795,600),"Input, brightness, display mode and refresh rate stay where your hand already is.",font,fill=(*MUTED,255),max_size=23,min_size=18,bold=False,max_lines=4,spacing=6)
    footer(im); save(im,path)


def capabilities(path):
    im=bg()
    header(im,"One press. Your setup comes back.","Saved Monitor Profiles restore the supported state you use for gaming, console, work or night.")
    d=ImageDraw.Draw(im)
    runtime_key(im,160,350,"apply-profile",["APPLY","GAMING"],220)
    d.text((270,610),"PRESS ONCE",font=font(26),fill=(*ACCENT,255),anchor="mm")
    arrow(d,410,460,620)
    states=[("input",["DP"],"INPUT"),("refresh-rate",["165HZ"],"REFRESH"),("hdr",["HDR","ON"],"HDR"),("brightness",["65%"],"BRIGHTNESS")]
    for i,(kind,lines,label) in enumerate(states):
        x=680+i*270
        runtime_key(im,x,345,kind,lines,185,"success" if kind=="hdr" else "brand")
        d.text((x+92,565),label,font=font(19),fill=(*MUTED,255),anchor="mm")
    for i,name in enumerate(["GAMING","CONSOLE","NIGHT"]):
        x=680+i*360
        d.rounded_rectangle((x,640,x+320,725),radius=18,fill=(*PANEL,245),outline=(*BORDER,255),width=2)
        d.text((x+160,683),name,font=font(24),fill=(*ACCENT,255),anchor="mm")
    footer(im); save(im,path)


def profiles(path):
    im=bg()
    header(im,"Stop opening Windows Display Settings.","Real semantic key faces, real values and the states you actually see on your deck.")
    d=ImageDraw.Draw(im)
    x0,y0=270,285; keysize=168; gap=17; pad=32
    width=pad*2+5*keysize+4*gap; height=pad*2+3*keysize+2*gap
    d.rounded_rectangle((x0,y0,x0+width,y0+height),radius=45,fill=(4,6,9,255),outline=(63,72,86,255),width=4)
    d.rounded_rectangle((x0+18,y0+18,x0+width-18,y0+height-18),radius=34,outline=(*ACCENT,60),width=2)
    specs=[
      ("brightness",["65%"],"brand"),("contrast",["50%"],"brand"),("volume",["50%"],"brand"),("power",["ON"],"success"),("input",["DP"],"brand"),
      ("refresh-rate",["165HZ"],"brand"),("resolution",["1440P"],"brand"),("hdr",["HDR","ON"],"success"),("topology",["EXTEND"],"brand"),("primary",["PRIMARY"],"brand"),
      ("orientation",["LAND"],"brand"),("save-profile",["SAVE","GAMING"],"brand"),("apply-profile",["APPLY","GAMING"],"brand"),("status",["165HZ","1440P"],"brand"),(None,[],"brand")
    ]
    for i,(kind,lines,tone) in enumerate(specs):
        x=x0+pad+(i%5)*(keysize+gap); y=y0+pad+(i//5)*(keysize+gap)
        if kind:
            runtime_key(im,x,y,kind,lines,keysize,tone)
        else:
            d.rounded_rectangle((x,y,x+keysize,y+keysize),radius=26,fill=(5,7,10,255),outline=(50,57,68,255),width=3)
    d.text((1435,360),"REAL",font=font(27),fill=(*ACCENT,255))
    d.text((1435,405),"KEY STATES",font=font(40),fill=(*WHITE,255))
    for i,label in enumerate(["INPUTS","HDR","PROFILES","LIVE STATUS"]):
        y=480+i*68
        d.rounded_rectangle((1435,y,1765,y+50),radius=14,fill=(*PANEL,235),outline=(*BORDER,255),width=2)
        d.text((1460,y+25),label,font=font(20),fill=(*WHITE,255),anchor="lm")
    footer(im); save(im,path)


def plus(path):
    im=bg()
    header(im,"Turn the controls you tweak all day.","Stream Deck+ gives brightness, contrast and monitor volume native continuous dial feedback.")
    d=ImageDraw.Draw(im)
    runtime_key(im,160,360,"brightness",["65%"],190)
    runtime_key(im,380,360,"contrast",["50%"],190)
    runtime_key(im,600,360,"volume",["50%"],190)
    d.text((475,590),"KEY PRESETS",font=font(24),fill=(*MUTED,255),anchor="mm")
    dial_strip(im,920,305,800,"BRIGHTNESS",65)
    dial_strip(im,920,455,800,"CONTRAST",50)
    dial_strip(im,920,605,800,"VOLUME",50)
    d.text((160,680),"Rotate to adjust.",font=font(31),fill=(*WHITE,255))
    d.text((160,726),"Press a key for an exact preset.",font=font(22,False),fill=(*MUTED,255))
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
    write_key_fixtures(out)
    validate_outputs(out)
    print("RAT ART PASS:",out)

if __name__=="__main__": main()
