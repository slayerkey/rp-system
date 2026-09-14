from __future__ import annotations
import argparse, os, hashlib, json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT=Path(__file__).resolve().parents[3]
sys.dont_write_bytecode=True
sys.path.insert(0,str(ROOT/"tools"/"art"))
from marketplace_text import draw_fitted_text
from render_streamdeck_ship_hero import fixture_faces
RAT=ROOT/"tools"/"art"/"assets"/"ratpack-icon-transparent.png"
PLUGIN_DIR=ROOT/"plugins"/"monitor-manager-pro"/"com.packrat.monitormanagerpro.sdPlugin"
MANIFEST_PATH=PLUGIN_DIR/"manifest.json"
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
    # Environmental continuity comes from light pools + the wood desk band.
    # Avoid monitor/card outlines here; they read like empty placeholder UI.
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
    if str(sub or "").strip():
        draw_fitted_text(
            d,(107,198,W-105,246),sub,font,
            fill=(*MUTED,255),max_size=31,min_size=25,bold=False,max_lines=1,spacing=4
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



def canonical_faces(out):
    fixture_path=out/"rat-art-key-fixtures.json"
    if not fixture_path.is_file():
        write_key_fixtures(out)
    manifest=json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    faces,_=fixture_faces(PLUGIN_DIR,manifest,fixture_path,out/"rat-art-svg-cache")
    if len(faces)!=15:
        raise SystemExit(f"RAT ART FAIL: expected 15 canonical key faces, got {len(faces)}")
    return faces

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
    d.rounded_rectangle((105,305,840,715),radius=35,fill=(10,14,19,235),outline=(58,66,78,255),width=3)
    d.rounded_rectangle((165,348,780,625),radius=22,fill=(3,5,8,255),outline=(35,42,52,255),width=2)
    d.text((472,460),"MONITOR OSD",font=font(33),fill=(*MUTED,255),anchor="mm")
    for i in range(5):
        x=325+i*58
        d.ellipse((x,650,x+18,668),fill=(74,80,88,255))
    d.text((472,690),"tiny buttons  •  hidden menus",font=font(20,False),fill=(*MUTED,255),anchor="mm")
    arrow(d,875,510,1015)

    # Exact canonical faces used by Rat Ship: input, brightness, topology, refresh.
    proof=[faces[4],faces[0],faces[8],faces[5]]
    coords=[(1060,315),(1250,315),(1060,505),(1250,505)]
    for face,(x,y) in zip(proof,coords):
        paste_face(im,face,x,y,165)

    d.text((1480,365),"ON YOUR",font=font(28),fill=(*ACCENT,255))
    d.text((1480,410),"STREAM DECK",font=font(39),fill=(*WHITE,255))
    d.text((1480,485),"INPUT • BRIGHTNESS",font=font(21),fill=(*MUTED,255))
    d.text((1480,525),"HZ • DISPLAY MODE",font=font(21),fill=(*MUTED,255))
    footer(im); save(im,path)



def capabilities(path,faces):
    im=bg()
    header(im,"One press. Your setup comes back.","Restore Gaming, Console or Night monitor setups instantly.")
    d=ImageDraw.Draw(im)
    paste_face(im,faces[12],150,340,220)
    d.text((260,600),"PRESS ONCE",font=font(26),fill=(*ACCENT,255),anchor="mm")
    arrow(d,405,450,610)

    # Resulting representative state: input, refresh, HDR, brightness.
    proof=[faces[4],faces[5],faces[7],faces[0]]
    labels=["INPUT","REFRESH","HDR","BRIGHTNESS"]
    for i,(face,label) in enumerate(zip(proof,labels)):
        x=670+i*270
        paste_face(im,face,x,335,185)
        d.text((x+92,555),label,font=font(19),fill=(*MUTED,255),anchor="mm")

    for i,name in enumerate(["GAMING","CONSOLE","NIGHT"]):
        x=670+i*360
        d.rounded_rectangle((x,635,x+320,720),radius=18,fill=(*PANEL,245),outline=(*BORDER,255),width=2)
        d.text((x+160,678),name,font=font(24),fill=(*ACCENT,255),anchor="mm")
    footer(im); save(im,path)



def profiles(path,faces):
    im=bg()
    header(im,"Stop opening Windows Display Settings.","Real keys. Real values. Real states.")
    d=ImageDraw.Draw(im)
    x0,y0=150,280; keysize=150; gap=10; pad=24
    width=pad*2+5*keysize+4*gap; height=pad*2+3*keysize+2*gap
    d.rounded_rectangle((x0,y0,x0+width,y0+height),radius=42,fill=(4,6,9,255),outline=(63,72,86,255),width=4)
    d.rounded_rectangle((x0+16,y0+16,x0+width-16,y0+height-16),radius=32,outline=(*ACCENT,60),width=2)
    for i,face in enumerate(faces):
        x=x0+pad+(i%5)*(keysize+gap)
        y=y0+pad+(i//5)*(keysize+gap)
        paste_face(im,face,x,y,keysize)

    d.text((1065,350),"REAL",font=font(30),fill=(*ACCENT,255))
    d.text((1065,400),"KEY STATES",font=font(46),fill=(*WHITE,255))
    for i,label in enumerate(["INPUTS","HDR","PROFILES","LIVE STATUS"]):
        y=490+i*64
        d.rounded_rectangle((1065,y,1515,y+48),radius=14,fill=(*PANEL,235),outline=(*BORDER,255),width=2)
        d.text((1095,y+24),label,font=font(21),fill=(*WHITE,255),anchor="lm")
    footer(im); save(im,path)



def plus(path,faces):
    im=bg()
    header(im,"Turn the controls you tweak all day.","Brightness, contrast and monitor volume on native Stream Deck+ dials.")
    d=ImageDraw.Draw(im)
    for face,x in zip([faces[0],faces[1],faces[2]],[120,345,570]):
        paste_face(im,face,x,345,200)
    d.text((445,585),"KEY PRESETS",font=font(25),fill=(*MUTED,255),anchor="mm")

    dial_strip(im,880,295,850,"BRIGHTNESS",65)
    dial_strip(im,880,440,850,"CONTRAST",50)
    dial_strip(im,880,585,850,"VOLUME",50)
    d.text((120,680),"Rotate to adjust.",font=font(34),fill=(*WHITE,255))
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
    write_key_fixtures(out)
    faces=canonical_faces(out)
    search_icon(out/"01_search_icon.png"); hero(out/"02_cover.png"); controls(out/"03_gallery_01.png",faces); capabilities(out/"04_gallery_02.png",faces); profiles(out/"05_gallery_03.png",faces); plus(out/"06_gallery_04.png",faces)
    validate_outputs(out)
    print("RAT ART PASS:",out)

if __name__=="__main__": main()
