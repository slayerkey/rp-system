# coding: utf-8
#!/usr/bin/env python3
"""
Ratpack - Marketing Generator for Codex, ChatGPT, and Cursor Usage plugins
Run: python scripts/gen-marketing-providers.py
Output: scripts/output/marketing/codex/  chatgpt/  cursor/
"""
import os, sys, subprocess, math

def ensure_deps():
    need = []
    for mod, pkg in [("PIL","Pillow>=10.3.0"),("numpy","numpy")]:
        try: __import__(mod)
        except: need.append(pkg)
    if need:
        subprocess.check_call([sys.executable,"-m","pip","install",*need])
ensure_deps()

from PIL import Image, ImageDraw, ImageFont, ImageFilter

GREEN  = ( 48,226,123)
YELLOW = (255,214, 10)
RED    = (255, 59, 48)
BG     = (  8, 10, 16)
FILL_BG= ( 10, 10, 12)
KEY_SZ = 144

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
ICON_PATH  = os.path.join(ROOT_DIR, "icon.png")

# Provider state — updated per run
BRAND       = (16,163,127)
OUT_DIR     = ""
PLUGIN_NAME = ""

# ── Colors ──────────────────────────────────────────────────────────────────
def lerp_color(c1, c2, t):
    return tuple(max(0,min(255,int(c1[i]+(c2[i]-c1[i])*t))) for i in range(3))

def usage_color(used):
    u=max(0.0,min(100.0,used))
    if u>=85: return RED
    if u>=50: return lerp_color(YELLOW,RED,(u-50)/35)
    return lerp_color(GREEN,YELLOW,u/50)

def usage_label(used):
    u=max(0.0,min(100.0,used))
    if u>=85: return "Critical"
    if u>=75: return "Warning"
    if u>=50: return "Moderate"
    return "Safe"

# ── Font ─────────────────────────────────────────────────────────────────────
_FP=None
def get_fp():
    global _FP
    if _FP is not None: return _FP
    for p in [r"C:\Windows\Fonts\Montserrat-SemiBold.ttf",
              r"C:\Windows\Fonts\Inter-SemiBold.ttf",
              r"C:\Windows\Fonts\segoeuib.ttf",
              r"C:\Windows\Fonts\arialbd.ttf"]:
        if os.path.exists(p): _FP=p; return p
    return None

def fnt(size):
    fp=get_fp()
    try: return ImageFont.truetype(fp,size) if fp else ImageFont.load_default()
    except: return ImageFont.load_default()

_DI=Image.new("L",(1,1)); _DD=ImageDraw.Draw(_DI)
def txt_size(text,f):
    bb=_DD.textbbox((0,0),text,font=f); return bb[2]-bb[0],bb[3]-bb[1]

def fit_fnt(text,max_w,max_sz,min_sz=14):
    for sz in range(max_sz,min_sz-1,-2):
        f=fnt(sz)
        if txt_size(text,f)[0]<=max_w: return f
    return fnt(min_sz)

def draw_c(img,text,y,f,color,shadow=False):
    d=ImageDraw.Draw(img); w,_=txt_size(text,f); x=(img.width-w)//2
    if shadow: d.text((x+1,y+2),text,font=f,fill=(0,0,0,110))
    d.text((x,y),text,font=f,fill=(*color[:3],255))

# ── Key renderers ─────────────────────────────────────────────────────────────
def key_bg(bg=None):
    c=bg or (11,11,14)
    img=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0))
    ImageDraw.Draw(img).rounded_rectangle([(0,0),(KEY_SZ-1,KEY_SZ-1)],radius=10,fill=(*c,255))
    return img

def render_ring(used,label,reset,show_label=True,pct_max_sz=34):
    color=usage_color(used); img=key_bg()
    cx,cy,r,sw=72,57,48,11; bbox=[(cx-r,cy-r),(cx+r,cy+r)]
    track=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0))
    ImageDraw.Draw(track).arc(bbox,0,360,fill=(255,255,255,28),width=sw)
    img.alpha_composite(track)
    if used>0.5:
        arc=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0))
        ImageDraw.Draw(arc).arc(bbox,-90,-90+360*min(used/100,1),fill=(*color,255),width=sw)
        img.alpha_composite(arc)
    pct="%d%%" % int(round(used)); draw_c(img,pct,40,fit_fnt(pct,78,pct_max_sz,14),color)
    if show_label: draw_c(img,label,114,fnt(13),(200,200,200))
    if reset: draw_c(img,reset,129 if show_label else 116,fit_fnt(reset,88,14,10),(255,255,255))
    return img

def render_full(used,label,reset):
    color=usage_color(used); img=key_bg(FILL_BG)
    fill_h=max(1,int(KEY_SZ*used/100)); y0=KEY_SZ-fill_h
    ov=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0)); od=ImageDraw.Draw(ov)
    for yy in range(y0,KEY_SZ):
        t=(yy-y0)/max(fill_h-1,1); od.line([(0,yy),(KEY_SZ,yy)],fill=(*color,int(55+110*t)))
    img.alpha_composite(ov)
    if fill_h>2: ImageDraw.Draw(img).line([(0,y0),(KEY_SZ,y0)],fill=(*color,200),width=3)
    pct="%d%%" % int(round(used)); draw_c(img,pct,58,fit_fnt(pct,112,52,18),color,shadow=True)
    if reset: draw_c(img,reset,118,fnt(12),(255,255,255),shadow=True)
    return img

def render_bignumber(used,label,reset):
    color=usage_color(used); img=key_bg()
    draw_c(img,label,16,fnt(12),(180,180,180))
    pct="%d%%" % int(round(used)); draw_c(img,pct,48,fit_fnt(pct,122,58,18),color)
    bx,bar_y,bh=14,118,8; bw=KEY_SZ-2*bx; fw=int(bw*min(used/100,1))
    d=ImageDraw.Draw(img)
    d.rounded_rectangle([(bx,bar_y),(bx+bw,bar_y+bh)],radius=4,fill=(255,255,255,22))
    if fw>0: d.rounded_rectangle([(bx,bar_y),(bx+fw,bar_y+bh)],radius=4,fill=(*color,255))
    if reset: draw_c(img,reset,131,fnt(10),(160,160,160))
    return img

def render_bigtime(reset,label):
    img=key_bg()
    draw_c(img,label.upper(),16,fnt(10),(160,160,160))
    draw_c(img,"RESETS IN",31,fnt(9),(120,120,120))
    draw_c(img,reset,82,fit_fnt(reset,112,44,16),(255,255,255))
    ImageDraw.Draw(img).rounded_rectangle([(14,122),(130,125)],radius=1,fill=(255,255,255,22))
    return img

def render_countdown(used,reset,label):
    color=usage_color(used); img=key_bg(FILL_BG)
    fill_h=max(1,int(KEY_SZ*used/100)); y0=KEY_SZ-fill_h
    ov=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0)); od=ImageDraw.Draw(ov)
    for yy in range(y0,KEY_SZ):
        t=(yy-y0)/max(fill_h-1,1); od.line([(0,yy),(KEY_SZ,yy)],fill=(*color,int(35+80*t)))
    img.alpha_composite(ov)
    if fill_h>2: ImageDraw.Draw(img).line([(0,y0),(KEY_SZ,y0)],fill=(*color,160),width=2)
    draw_c(img,label.upper(),16,fnt(10),(200,200,200),shadow=True)
    draw_c(img,"TIME LEFT",29,fnt(9),(160,160,160),shadow=True)
    draw_c(img,reset,80,fit_fnt(reset,112,42,16),(255,255,255),shadow=True)
    return img

def render_status(used,label):
    color=usage_color(used); word=usage_label(used); img=key_bg(); d=ImageDraw.Draw(img)
    d.rectangle([(0,0),(KEY_SZ,10)],fill=(*color,255))
    draw_c(img,label.upper(),26,fnt(12),(160,160,160))
    draw_c(img,word,62,fnt(30),color)
    draw_c(img,"%d%%" % int(round(used)),98,fnt(20),(200,200,200))
    bx,by,bh=14,120,7; bw=KEY_SZ-2*bx; fw=int(bw*min(used/100,1))
    d.rounded_rectangle([(bx,by),(bx+bw,by+bh)],radius=3,fill=(255,255,255,22))
    if fw>0: d.rounded_rectangle([(bx,by),(bx+fw,by+bh)],radius=3,fill=(*color,255))
    return img

SERIES=[18,28,35,42,51,45,38,58,72,68,55,65,78,72]
def render_sparkline(used,label,series=None):
    if series is None: series=SERIES
    color=usage_color(used); img=key_bg(); d=ImageDraw.Draw(img)
    draw_c(img,label,14,fnt(11),(160,160,160))
    pct="%d%%" % int(round(used)); pw,_=txt_size(pct,fnt(12))
    d.text((KEY_SZ-14-pw,10),pct,font=fnt(12),fill=(*color,255))
    ox,oy2,cw,ch=10,28,124,76; mx=max(series+[1])
    pts=[(int(ox+i/max(len(series)-1,1)*cw),int(oy2+ch*(1-v/mx))) for i,v in enumerate(series)]
    for i in range(len(pts)-1): d.line([pts[i],pts[i+1]],fill=(*color,200),width=2)
    if pts: lx2,ly2=pts[-1]; d.ellipse([(lx2-4,ly2-4),(lx2+4,ly2+4)],fill=(*color,255))
    draw_c(img,"30d history",128,fnt(9),(120,120,120))
    return img

HEAT=[45,60,35,80,55,88,72]
def render_heatmap(cells=None,label="7D"):
    if cells is None: cells=HEAT
    img=key_bg(); d=ImageDraw.Draw(img)
    draw_c(img,label,18,fnt(12),(160,160,160))
    draw_c(img,"HISTORY",34,fnt(9),(100,100,100))
    days=["M","T","W","T","F","S","S"]; cw2,gap=14,4
    total_w=len(days)*(cw2+gap)-gap; ox=(KEY_SZ-total_w)//2
    for i,v in enumerate(cells):
        x=ox+i*(cw2+gap)
        col=(255,255,255,28) if v is None else (*usage_color(v),int(60+160*(v/100)))
        d.rounded_rectangle([(x,66),(x+cw2,66+cw2)],radius=3,fill=col)
        if i==len(cells)-1:
            dc=usage_color(v) if v else (255,255,255)
            d.rounded_rectangle([(x-2,64),(x+cw2+2,68+cw2)],radius=4,outline=(*dc,200),width=1)
        fw2b,_=txt_size(days[i],fnt(8)); d.text((x+(cw2-fw2b)//2,86),days[i],font=fnt(8),fill=(100,100,100,255))
    draw_c(img,"today",126,fnt(9),(100,100,100))
    return img

def render_dual(a_used,b_used,label_a="5H",label_b="WEEK"):
    img=key_bg(); d=ImageDraw.Draw(img)
    draw_c(img,"OVERVIEW",18,fnt(10),(140,140,140))
    def row(lbl,used,y):
        color=usage_color(used); bx=14; bw=KEY_SZ-2*bx; bh=16; fw=int(bw*min(used/100,1))
        lf=fnt(12); lw,_=txt_size(lbl,lf); pw,_=txt_size("%d%%" % int(used),lf)
        d.text((bx,y-16),lbl,font=lf,fill=(160,160,160,255))
        d.text((KEY_SZ-bx-pw,y-16),"%d%%" % int(used),font=lf,fill=(*color,255))
        d.rounded_rectangle([(bx,y),(bx+bw,y+bh)],radius=8,fill=(255,255,255,20))
        if fw>0: d.rounded_rectangle([(bx,y),(bx+fw,y+bh)],radius=8,fill=(*color,255))
    row(label_a,a_used,50); row(label_b,b_used,96)
    return img

# ── Deck builder ──────────────────────────────────────────────────────────────
def build_deck(keys,deck_w=800,deck_h=520):
    img=Image.new("RGBA",(deck_w,deck_h),(0,0,0,0)); d=ImageDraw.Draw(img)
    d.rounded_rectangle([(0,0),(deck_w,deck_h)],radius=28,fill=(16,18,24,255))
    f_logo=fnt(22); lbl="STREAM DECK"; lw2,lh2=txt_size(lbl,f_logo)
    cr=13; gp=12; lx2=(deck_w-(cr*2+gp+lw2))//2; ly2=10; cxb,cyb=lx2+cr,ly2+cr
    lc=(*BRAND,200)
    d.ellipse([(lx2,ly2),(lx2+cr*2,ly2+cr*2)],outline=lc,width=2)
    d.polygon([(cxb-5,cyb-6),(cxb-5,cyb+6),(cxb+7,cyb)],fill=lc)
    bb2=d.textbbox((0,0),lbl,font=f_logo)
    d.text((lx2+cr*2+gp-bb2[0],cyb-lh2//2-bb2[1]),lbl,fill=lc,font=f_logo)
    COLS2,ROWS2=5,3; logo_h,pad,bgap=46,32,10
    avail_w=deck_w-2*pad; avail_h=deck_h-logo_h-18
    btn=min((avail_w-(COLS2-1)*bgap)//COLS2,(avail_h-(ROWS2-1)*bgap)//ROWS2)
    gw2=COLS2*btn+(COLS2-1)*bgap; gh2=ROWS2*btn+(ROWS2-1)*bgap
    gx2=(deck_w-gw2)//2; gy2=logo_h+(avail_h-gh2)//2
    for row2 in range(ROWS2):
        for col2 in range(COLS2):
            idx2=row2*COLS2+col2; bx2=gx2+col2*(btn+bgap); by2=gy2+row2*(btn+bgap)
            d.rounded_rectangle([(bx2-1,by2+4),(bx2+btn+1,by2+btn+4)],radius=10,fill=(3,4,5,255))
            d.rounded_rectangle([(bx2,by2),(bx2+btn,by2+btn)],radius=9,fill=(9,10,13,255))
            d.rounded_rectangle([(bx2+3,by2+3),(bx2+btn-3,by2+int(btn*0.22))],radius=6,fill=(255,255,255,7))
            if idx2<len(keys):
                k=keys[idx2].resize((btn,btn),Image.LANCZOS)
                img.alpha_composite(k,dest=(bx2,by2))
    return img

def warp_deck(deck,tilt=70):
    import numpy as np
    w,h=deck.size; out_h=h+tilt
    src=[(0,0),(w,0),(w,h),(0,h)]; dst=[(0,0),(w,tilt),(w,h+tilt*3//4),(0,h-tilt//4)]
    A,b=[],[]
    for (sx,sy),(dx,dy) in zip(src,dst):
        A+=[[dx,dy,1,0,0,0,-dx*sx,-dy*sx],[0,0,0,dx,dy,1,-dx*sy,-dy*sy]]; b+=[sx,sy]
    try:
        c=np.linalg.solve(np.array(A,dtype=float),np.array(b,dtype=float)).tolist()
        return deck.transform((w,out_h),Image.PERSPECTIVE,c,Image.BICUBIC)
    except:
        r=Image.new("RGBA",(w,out_h),(0,0,0,0)); r.alpha_composite(deck,dest=(0,tilt//2)); return r

# ── Canvas helpers ────────────────────────────────────────────────────────────
def make_canvas(W=1920,H=960,accent=None):
    if accent is None: accent=BRAND
    canvas=Image.new("RGBA",(W,H),(*BG,255))
    ImageDraw.Draw(canvas).rectangle([(0,76),(W,H-170)],fill=(6,7,12,255))
    glow=Image.new("RGBA",(W,H),(0,0,0,0))
    ImageDraw.Draw(glow).ellipse([(W//2-200,50),(W+300,H-50)],fill=(*accent,40))
    glow=glow.filter(ImageFilter.GaussianBlur(180))
    canvas=Image.alpha_composite(canvas,glow)
    vign=Image.new("RGBA",(W,H),(0,0,0,0)); vd=ImageDraw.Draw(vign)
    for r2 in range(max(W,H)//2,0,-14):
        t=r2/(max(W,H)/2); a=int(80*t**2.5)
        if a>0: vd.ellipse([(W//2-r2,H//2-r2),(W//2+r2,H//2+r2)],fill=(0,0,0,a))
    canvas=Image.alpha_composite(canvas,vign)
    _top_bar(canvas,W,accent)
    return canvas

def _top_bar(canvas,W,accent):
    TOP_H=76; d=ImageDraw.Draw(canvas)
    d.rectangle([(0,0),(W,TOP_H)],fill=(*BG,255))
    _grad_line(canvas,TOP_H-2,0,W,(*accent,200))
    lx=14; icon_sz=int((TOP_H-6)*1.17)
    if os.path.exists(ICON_PATH):
        try:
            ico=Image.open(ICON_PATH).convert("RGBA").resize((icon_sz,icon_sz),Image.LANCZOS)
            canvas.alpha_composite(ico,dest=(lx,(TOP_H-icon_sz)//2)); lx+=icon_sz+12
        except: pass
    d=ImageDraw.Draw(canvas); f_brand=fnt(28); bb=d.textbbox((0,0),"Ratpack",font=f_brand)
    d.text((lx-bb[0],(TOP_H-(bb[3]-bb[1]))//2-bb[1]),"Ratpack",fill=(210,220,240,230),font=f_brand)
    d.text((W-170,(TOP_H-20)//2),"///",fill=(*accent,130),font=fnt(20))
    d.line([(W-110,TOP_H//2),(W-28,TOP_H//2)],fill=(*accent,80),width=1)

def _grad_line(canvas,y,x0,x1,color):
    r,g,b,a=color; w=x1-x0
    ln=Image.new("RGBA",(w,2),(0,0,0,0)); px=ln.load()
    for xi in range(w):
        t=xi/max(w-1,1); fade=(1-abs(t-0.5)*2)**0.5; al=int(a*fade)
        px[xi,0]=px[xi,1]=(r,g,b,al)
    canvas.alpha_composite(ln,dest=(x0,y-1))

def add_bottom_bar(canvas,W,H,features,accent=None):
    if accent is None: accent=BRAND
    BOT_H=170; BOT_Y=H-BOT_H; d=ImageDraw.Draw(canvas)
    d.rectangle([(0,BOT_Y),(W,H)],fill=(*BG,255))
    _grad_line(canvas,BOT_Y+4,0,W,(*accent,200))
    n=len(features); tile_w=W//n
    for i,feat in enumerate(features):
        ikind,la,lb=feat[0],feat[1],feat[2]
        tx=i*tile_w
        if i>0: d.line([(tx,BOT_Y+20),(tx,H-20)],fill=(255,255,255,18),width=1)
        isz=64; pad=20; gap_ab=14
        avail_w=tile_w-2*pad-isz-16
        f_sm=fit_fnt(la,avail_w,20,12); f_big=fit_fnt(lb,avail_w,38,16)
        la_bb=d.textbbox((0,0),la,font=f_sm); lb_bb=d.textbbox((0,0),lb,font=f_big)
        la_h=la_bb[3]-la_bb[1]; lb_h=lb_bb[3]-lb_bb[1]; total_h=la_h+gap_ab+lb_h
        gx=tx+pad; ty0=BOT_Y+20+(BOT_H-20-total_h)//2
        _btm_icon(d,ikind,gx,ty0+total_h//2-isz//2,isz,(*accent,210))
        tfx=gx+isz+16
        d.text((tfx-la_bb[0],ty0-la_bb[1]),la,fill=(*accent,200),font=f_sm)
        d.text((tfx-lb_bb[0],ty0+la_h+gap_ab-lb_bb[1]),lb,fill=(230,234,250,255),font=f_big)

def _btm_icon(d,kind,x,y,sz,col):
    if kind=="refresh":
        r2=sz//2-4; cx,cy=x+sz//2,y+sz//2
        d.arc([(cx-r2,cy-r2),(cx+r2,cy+r2)],-45,270,fill=col,width=3)
        d.polygon([(cx+r2-2,cy-8),(cx+r2+6,cy-2),(cx+r2-2,cy+4)],fill=col)
    elif kind=="palette":
        s=sz//4
        for ri2 in range(2):
            for ci2 in range(2):
                d.rounded_rectangle([(x+ci2*(s+4),y+ri2*(s+4)),(x+ci2*(s+4)+s,y+ri2*(s+4)+s)],radius=3,fill=col)
    elif kind=="layers":
        for i in range(3): d.rounded_rectangle([(x+i*5,y+i*5),(x+sz-i*5,y+sz-i*5)],radius=5,outline=col,width=2)
    elif kind=="shield":
        rr=sz//5; d.rounded_rectangle([(x+2,y+2),(x+sz-2,y+sz-2)],radius=rr,outline=col,width=2)
        d.line([(x+sz//5,y+sz*11//20),(x+sz*2//5,y+sz*7//10)],fill=col,width=3)
        d.line([(x+sz*2//5,y+sz*7//10),(x+sz*4//5,y+sz*3//10)],fill=col,width=3)
    elif kind=="clock":
        r2=sz//2-3; cx,cy=x+sz//2,y+sz//2
        d.ellipse([(cx-r2,cy-r2),(cx+r2,cy+r2)],outline=col,width=2)
        d.line([(cx,cy),(cx,cy-r2+6)],fill=col,width=3)
        d.line([(cx,cy),(cx+r2-8,cy+4)],fill=col,width=2)
    elif kind=="people":
        cx=x+sz//2; r2=sz//5
        d.ellipse([(cx-r2,y),(cx+r2,y+r2*2)],fill=col)
        d.arc([(x+4,y+r2*2),(x+sz-4,y+sz)],180,0,fill=col,width=3)
    elif kind=="star":
        cx,cy=x+sz//2,y+sz//2; r_out=sz//2-3; r_in=r_out//2
        pts=[]
        for i in range(10):
            a=math.radians(-90+i*36); r=r_out if i%2==0 else r_in
            pts.append((cx+r*math.cos(a),cy+r*math.sin(a)))
        d.polygon(pts,fill=col)

def add_gradient_title(canvas,text,x,y,max_w,accent=None,white=False):
    if accent is None: accent=BRAND
    d=ImageDraw.Draw(canvas)
    f=_fit_banner(text,d,max_w,180,48); bb=d.textbbox((0,0),text,font=f)
    pw,ph=bb[2]-bb[0],bb[3]-bb[1]
    top=((min(255,accent[0]+90),min(255,accent[1]+60),min(255,accent[2]+60)) if not white else (255,255,255))
    bot=(accent if not white else (215,220,240))
    gl=Image.new("RGBA",(pw,ph),(0,0,0,0)); gd=ImageDraw.Draw(gl)
    for yy in range(ph):
        t=(yy/max(ph-1,1))**1.6; c=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3))
        gd.line([(0,yy),(pw,yy)],fill=(*c,255))
    mask=Image.new("L",(pw,ph),0)
    ImageDraw.Draw(mask).text((-bb[0],-bb[1]),text,fill=255,font=f)
    gl.putalpha(mask)
    shd=Image.new("RGBA",(pw+8,ph+8),(0,0,0,0))
    ImageDraw.Draw(shd).text((-bb[0]+3,-bb[1]+4),text,fill=(0,0,0,90),font=f)
    shd=shd.filter(ImageFilter.GaussianBlur(4))
    canvas.alpha_composite(shd,dest=(x,y)); canvas.alpha_composite(gl,dest=(x,y))
    return ph

def _fit_banner(text,draw,max_w,max_sz=180,min_sz=48):
    for sz in range(max_sz,min_sz-1,-4):
        f=fnt(sz); bb=draw.textbbox((0,0),text,font=f)
        if bb[2]-bb[0]<=max_w: return f
    return fnt(min_sz)

def draw_banner_c(canvas,text,y,f,color,W=1920):
    d=ImageDraw.Draw(canvas); tw,_=txt_size(text,f)
    d.text(((W-tw)//2,y),text,font=f,fill=(*color[:3],255))

def place_keys(canvas,keys,cols,cell_w,cell_h,ox,oy,label_f=None,labels=None,label_colors=None,key_disp=None,sub_labels=None,sub_f=None):
    ksz=key_disp if key_disp else KEY_SZ
    for i,key in enumerate(keys):
        row,col=divmod(i,cols); x=ox+col*cell_w+(cell_w-ksz)//2; y=oy+row*cell_h+(cell_h-ksz)//2
        if key_disp and key.size!=(ksz,ksz): key=key.resize((ksz,ksz),Image.LANCZOS)
        canvas.alpha_composite(key,dest=(x,y))
        if label_f and labels and i<len(labels):
            lbl=labels[i]; lw,_=txt_size(lbl,label_f)
            lcolor=(160,160,180) if not label_colors else label_colors[i]
            ImageDraw.Draw(canvas).text((x+(ksz-lw)//2,y+ksz+12),lbl,font=label_f,fill=(*lcolor,255))
        if sub_f and sub_labels and i<len(sub_labels):
            sl=sub_labels[i]; sw3,_=txt_size(sl,sub_f)
            lh3=txt_size(labels[i],label_f)[1] if label_f and labels and i<len(labels) else 0
            ImageDraw.Draw(canvas).text((x+(ksz-sw3)//2,y+ksz+16+lh3),sl,font=sub_f,fill=(110,120,145,200))

def save(canvas, name):
    path = os.path.join(OUT_DIR, name)
    canvas.convert("RGB").save(path, quality=96)
    print("> " + name)

# ==============================================================================
# SHARED GENERATORS
# ==============================================================================

def gen_hero(badge, tagline, bullets, bottom_feats, deck_keys):
    W,H=1920,960; canvas=make_canvas(W,H,BRAND)
    TOP_H,BOT_H=76,170; MAIN_Y=TOP_H; MAIN_H=H-TOP_H-BOT_H
    FLAT_DW,FLAT_DH,TILT=920,598,70
    deck_x=W-FLAT_DW-28; deck_y=MAIN_Y+(MAIN_H-(FLAT_DH+TILT))//2
    flat=build_deck(deck_keys,FLAT_DW,FLAT_DH); warped=warp_deck(flat,TILT)
    shadow=Image.new("RGBA",(W,H),(0,0,0,0))
    ImageDraw.Draw(shadow).polygon([(deck_x+12,deck_y+18),(deck_x+FLAT_DW+12,deck_y+TILT+18),
        (deck_x+FLAT_DW+12,deck_y+FLAT_DH+TILT+18),(deck_x+12,deck_y+FLAT_DH+18)],fill=(0,0,0,160))
    shadow=shadow.filter(ImageFilter.GaussianBlur(22))
    canvas=Image.alpha_composite(canvas,shadow); canvas.alpha_composite(warped,dest=(deck_x,deck_y))
    text_x=70; text_max_w=deck_x-text_x-60; d=ImageDraw.Draw(canvas)
    f_badge=fnt(24); bb=d.textbbox((0,0),badge,font=f_badge)
    bw,bh=bb[2]-bb[0],bb[3]-bb[1]; bp=12; badge_y=MAIN_Y+44
    d.rounded_rectangle([(text_x,badge_y),(text_x+bw+bp*2,badge_y+bh+bp)],radius=7,
                        outline=(*BRAND,200),width=2,fill=(14,16,22,220))
    d.text((text_x+bp-bb[0],badge_y+bp//2-bb[1]),badge,fill=(210,218,240,255),font=f_badge)
    title_y=badge_y+bh+bp+24
    title_h=add_gradient_title(canvas,PLUGIN_NAME,text_x,title_y,text_max_w,BRAND)
    sub_y=title_y+title_h+20; d=ImageDraw.Draw(canvas)
    d.text((text_x,sub_y),tagline,fill=(155,165,200,200),font=fnt(26))
    by2=sub_y+52
    for bline in bullets:
        d.ellipse([(text_x,by2+8),(text_x+8,by2+16)],fill=(*BRAND,210))
        d.text((text_x+18,by2),bline,fill=(185,195,220,200),font=fnt(22)); by2+=38
    add_bottom_bar(canvas,W,H,bottom_feats,BRAND)
    save(canvas,"1-hero.png")

def gen_styles(sub, win):
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"8 Display Styles",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,sub,MAIN_Y+94,fnt(26),(120,130,160))
    keys8=[
        render_ring(42,win,"2h 14m"),       render_full(78,win,"1h 40m"),
        render_bignumber(42,win,"2h 14m"),   render_bigtime("2h 14m",win),
        render_countdown(78,"1h 40m",win),   render_sparkline(72,win),
        render_heatmap(),                    render_status(42,win),
    ]
    labels=["Ring","Full","Big Number","Big Time","Countdown","Sparkline","Heatmap","Status"]
    cell_w=252; cell_h=224; COLS2=4
    grid_w=COLS2*cell_w; oy=MAIN_Y+138+(H-TOP_H-BOT_H-138-2*cell_h)//2
    ox=(W-grid_w)//2
    place_keys(canvas,keys8,COLS2,cell_w,cell_h,ox,oy,fnt(20),labels,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("clock","LIVE","UPDATES"),("palette","OLED","THEMES"),
        ("layers","MULTI","ACCOUNT"),("shield","100%","LOCAL"),
    ],BRAND)
    save(canvas,"2-styles.png")

def gen_alerts(win):
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Smart Color Alerts",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Color shifts automatically as usage climbs - no settings to configure",MAIN_Y+94,fnt(26),(120,130,160))
    alert_vals=[28,58,80,95]; alert_resets=["3h","1h 40m","42m","12m"]
    ks=228
    alert_keys=[render_ring(v,win,r,show_label=False,pct_max_sz=32).resize((ks,ks),Image.LANCZOS)
                for v,r in zip(alert_vals,alert_resets)]
    state_names=["Safe","Moderate","Warning","Critical"]
    state_descs=["0-49%","50-74%","75-84%","85%+"]
    cell_w=368; oy=MAIN_Y+130+(H-TOP_H-BOT_H-130-298)//2; ox=(W-4*cell_w)//2
    for i,key in enumerate(alert_keys):
        x=ox+i*cell_w+(cell_w-ks)//2
        canvas.alpha_composite(key,dest=(x,oy))
    d=ImageDraw.Draw(canvas); f_name=fnt(22); f_desc=fnt(17)
    for i,val in enumerate(alert_vals):
        col=usage_color(val); x=ox+i*cell_w
        nw,_=txt_size(state_names[i],f_name); dw,_=txt_size(state_descs[i],f_desc)
        d.text((x+(cell_w-nw)//2,oy+ks+14),state_names[i],font=f_name,fill=(*col,255))
        d.text((x+(cell_w-dw)//2,oy+ks+42),state_descs[i],font=f_desc,fill=(140,145,165,220))
    add_bottom_bar(canvas,W,H,[
        ("refresh","LIVE","UPDATES"),("clock","RESET","TIMER"),
        ("palette","COLOR","SHIFTS"),("shield","100%","LOCAL"),
    ],BRAND)
    save(canvas,"3-alerts.png")

def gen_reset(win, reset_label="Rolling Window"):
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Know Your Reset. Down to the Minute.",MAIN_Y+22,fnt(48),(240,245,255))
    draw_banner_c(canvas,"Always visible - no mental math, no browser tabs",MAIN_Y+90,fnt(26),(120,130,160))
    rkeys=[
        render_bigtime("3h 22m",win), render_bigtime("1h 40m",win),
        render_bigtime("42m",win),    render_countdown(88,"8m",win),
    ]
    rlabels=["Plenty of time","Pace yourself","Wrap it up","Final stretch"]
    cell_w=316; cell_h=246; oy=MAIN_Y+135+(H-TOP_H-BOT_H-135-cell_h)//2; ox=(W-4*cell_w)//2
    place_keys(canvas,rkeys,4,cell_w,cell_h,ox,oy,fnt(22),rlabels,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("clock","RESET","TIMER"),("refresh","LIVE","SYNC"),
        ("layers","8","STYLES"),("shield","100%","LOCAL"),
    ],BRAND)
    save(canvas,"4-reset.png")

def gen_multi_account(label_a="Work",label_b="Personal",label_c="Client",label_d="Team",
                      win_a="5H",win_b="WEEK"):
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Work. Personal. Client.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Named accounts on every key - no mixing them up",MAIN_Y+94,fnt(26),(120,130,160))
    ks=230
    acct_keys=[
        render_ring(42,label_a,"2h 14m").resize((ks,ks),Image.LANCZOS),
        render_ring(78,label_b,"1h 40m").resize((ks,ks),Image.LANCZOS),
        render_ring(28,label_c,"3h 45m").resize((ks,ks),Image.LANCZOS),
        render_ring(95,label_d,"12m").resize((ks,ks),Image.LANCZOS),
    ]
    acct_labels=[label_a+" Account",label_b+" Account",label_c+" Account",label_d+" Account"]
    acct_colors=[usage_color(42),usage_color(78),usage_color(28),usage_color(95)]
    cell_w=370; cell_h=264; oy=MAIN_Y+128+(H-TOP_H-BOT_H-128-cell_h)//2; ox=(W-4*cell_w)//2
    place_keys(canvas,acct_keys,4,cell_w,cell_h,ox,oy,fnt(22),acct_labels,acct_colors,key_disp=ks)
    add_bottom_bar(canvas,W,H,[
        ("people","NAMED","ACCOUNTS"),("layers","PER-KEY","SELECTION"),
        ("palette","SHARED","SETTINGS"),("shield","100%","LOCAL"),
    ],BRAND)
    save(canvas,"7-multi-account.png")

def gen_video(win_a, win_b, targets, resets, phases_extra=None):
    W,H=1200,630; FPS_MS=60; TOP_H=80; frames=[]
    TARGETS=targets; VLABELS=[win_a,win_b,win_a]; VRESETS=resets
    ALL_PHASES=["Fill","Ring","Big Number","Countdown","Status"]
    CAROUSEL=[
        ("Ring","Circular gauge - arc fills as you use more",
         render_ring(targets[0],win_a,resets[0]),render_ring(targets[1],win_b,resets[1]),render_ring(targets[2],win_a,resets[2])),
        ("Big Number","Giant percentage - cleanest glance",
         render_bignumber(targets[0],win_a,resets[0]),render_bignumber(targets[1],win_b,resets[1]),render_bignumber(targets[2],win_a,resets[2])),
        ("Countdown","Time left, front and center",
         render_countdown(targets[0],resets[0],win_a),render_bigtime(resets[1],win_b),render_countdown(targets[2],resets[2],win_a)),
        ("Status","Word plus color - fastest read",
         render_status(targets[0],win_a),render_status(targets[1],win_b),render_status(targets[2],win_a)),
    ]

    def draw_frame(k1,k2,k3,phase_name,desc,key_sub=None):
        canvas=Image.new("RGBA",(W,H),(*BG,255))
        glow=Image.new("RGBA",(W,H),(0,0,0,0))
        ImageDraw.Draw(glow).ellipse([(-100,100),(W+100,H-50)],fill=(*BRAND,30))
        glow=glow.filter(ImageFilter.GaussianBlur(120))
        canvas=Image.alpha_composite(canvas,glow)
        d=ImageDraw.Draw(canvas); d.rectangle([(0,0),(W,TOP_H)],fill=(*BG,255))
        _grad_line(canvas,TOP_H-1,0,W,(*BRAND,180))
        lx=18; icon_sz=48
        if os.path.exists(ICON_PATH):
            try:
                ico=Image.open(ICON_PATH).convert("RGBA").resize((icon_sz,icon_sz),Image.LANCZOS)
                canvas.alpha_composite(ico,dest=(lx,(TOP_H-icon_sz)//2)); lx+=icon_sz+12
            except: pass
        d=ImageDraw.Draw(canvas); f_title=fnt(26); f_sub2=fnt(14)
        bb=d.textbbox((0,0),PLUGIN_NAME,font=f_title)
        ty=(TOP_H-(bb[3]-bb[1]))//2-bb[1]
        d.text((lx,ty),PLUGIN_NAME,font=f_title,fill=(210,220,240,220))
        d.text((lx,ty+(bb[3]-bb[1])+2),"by Ratpack",font=f_sub2,fill=(120,130,160,180))
        f_pn=fnt(20); pnw,_=txt_size(phase_name,f_pn)
        d.text((W-pnw-20,(TOP_H-20)//2),phase_name,font=f_pn,fill=(*BRAND,210))
        ksz=168; gap=32; total_kw=3*ksz+2*gap; kx=(W-total_kw)//2; ky=TOP_H+40
        for key in [k1,k2,k3]:
            canvas.alpha_composite(key.resize((ksz,ksz),Image.LANCZOS),dest=(kx,ky)); kx+=ksz+gap
        if key_sub:
            kx2=(W-total_kw)//2; f_sub3=fnt(15)
            for lbl in key_sub:
                lw3,_=txt_size(lbl,f_sub3)
                d.text((kx2+(ksz-lw3)//2,ky+ksz+12),lbl,font=f_sub3,fill=(110,120,150,200))
                kx2+=ksz+gap
        f_desc=fnt(21); dw,_=txt_size(desc,f_desc)
        d.text(((W-dw)//2,ky+ksz+(40 if key_sub else 18)),desc,font=f_desc,fill=(155,165,200,220))
        dot_y=H-32; dot_r=6; ndots=len(ALL_PHASES); total_dot=ndots*(dot_r*2+10)-10
        dx=(W-total_dot)//2
        for ph in ALL_PHASES:
            fc=(*BRAND,255) if ph==phase_name else (70,80,105,200)
            d.ellipse([(dx,dot_y-dot_r),(dx+dot_r*2,dot_y+dot_r)],fill=fc)
            dx+=dot_r*2+10
        hint="Short-press any key to cycle styles"; hw2,_=txt_size(hint,fnt(13))
        d.text(((W-hw2)//2,H-20),hint,font=fnt(13),fill=(70,80,105,180))
        return canvas.convert("RGB")

    print("  Rendering GIF...")
    FILL_F=24
    for fi in range(FILL_F):
        t=1-(1-fi/max(FILL_F-1,1))**2; tf=min(t*0.98+0.02,1.0)
        k1=render_ring(TARGETS[0]*tf,VLABELS[0],VRESETS[0] if tf>=0.99 else None)
        k2=render_full(TARGETS[1]*tf,VLABELS[1],VRESETS[1] if tf>=0.99 else None)
        k3=render_bignumber(TARGETS[2]*tf,VLABELS[2],VRESETS[2] if tf>=0.99 else None)
        frames.append(draw_frame(k1,k2,k3,"Fill","Three styles, filling to your live limits",
                                 ["Ring","Full","Big Number"]))
    k1f=render_ring(TARGETS[0],VLABELS[0],VRESETS[0])
    k2f=render_full(TARGETS[1],VLABELS[1],VRESETS[1])
    k3f=render_bignumber(TARGETS[2],VLABELS[2],VRESETS[2])
    for _ in range(8):
        frames.append(draw_frame(k1f,k2f,k3f,"Fill","Three styles, filling to your live limits",
                                 ["Ring","Full","Big Number"]))
    for sn,sd,ck1,ck2,ck3 in CAROUSEL:
        for _ in range(11): frames.append(draw_frame(ck1,ck2,ck3,sn,sd))

    gif_path=os.path.join(OUT_DIR,"preview.gif")
    frames[0].save(gif_path,save_all=True,append_images=frames[1:],duration=FPS_MS,loop=0,optimize=False)
    print("> preview.gif (%d frames)" % len(frames))
    mp4_path=os.path.join(OUT_DIR,"preview.mp4")
    try:
        subprocess.run([
            "ffmpeg","-i",gif_path,
            "-vf","scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
            "-c:v","libx264","-crf","18","-pix_fmt","yuv420p",
            "-movflags","+faststart","-y",mp4_path
        ],check=True,capture_output=True)
        size=os.path.getsize(mp4_path)/1024/1024
        print("> preview.mp4 (%.1f MB)" % size)
    except Exception as e:
        print("  ffmpeg not found or failed - GIF only. Error: %s" % e)

# ==============================================================================
# CODEX
# ==============================================================================

def run_codex():
    global BRAND, OUT_DIR, PLUGIN_NAME
    BRAND=(16,163,127); PLUGIN_NAME="Codex Usage"
    OUT_DIR=os.path.join(SCRIPT_DIR,"output","marketing","codex")
    os.makedirs(OUT_DIR,exist_ok=True)
    print("\n== Codex Usage ==")

    deck_keys=[
        render_ring(42,"5H","2h 14m"),    render_ring(78,"WEEK","1h 40m"),  render_ring(95,"5H","12m"),
        render_full(78,"WEEK","1h 40m"),   render_bignumber(35,"WEEK","3d"),
        render_status(42,"5H"),            render_countdown(82,"42m","5H"),  render_bigtime("2h 14m","5H"),
        render_sparkline(72,"WEEK"),       render_heatmap(),
        render_dual(42,78),                render_full(95,"5H","12m"),
        render_bignumber(78,"WEEK","1h 40m"),render_status(95,"5H"),          render_bigtime("42m","5H"),
    ]
    gen_hero("LIVE USAGE MONITOR",
             "Know if you can keep coding - at a glance.",
             ["8 display styles, 3 themes, per-key customization",
              "5-hour + weekly limits, updates every 30 sec",
              "Auto-loads your local Codex token. Nothing to paste."],
             [("refresh","LIVE","USAGE"),("palette","8","STYLES"),
              ("layers","MULTI","ACCOUNT"),("shield","100%","LOCAL")],
             deck_keys)
    gen_styles("Short-press to cycle  |  Long-press to switch type","5H")
    gen_alerts("5H")
    gen_reset("5H","Rolling Window")

    # Banner 5: Auto-load feature
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Zero Setup.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Already using Codex? The plugin finds your token automatically.",MAIN_Y+94,fnt(26),(120,130,160))
    setup_keys=[
        render_ring(0,"5H",None,show_label=False,pct_max_sz=28),
        render_ring(42,"5H","2h 14m"),
        render_bignumber(42,"5H","2h 14m"),
        render_dual(42,78),
    ]
    setup_labels=["No token yet","Auto-detected","Usage live","5H + Weekly"]
    setup_colors=[(100,100,120),(48,226,123),(48,226,123),(48,226,123)]
    cell_w=326; cell_h=246; oy=MAIN_Y+135+(H-TOP_H-BOT_H-135-cell_h)//2; ox=(W-4*cell_w)//2
    place_keys(canvas,setup_keys,4,cell_w,cell_h,ox,oy,fnt(22),setup_labels,setup_colors,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("star","AUTO","DETECT"),("shield","100%","LOCAL"),
        ("clock","30 SEC","REFRESH"),("layers","MULTI","ACCOUNT"),
    ],BRAND)
    save(canvas,"5-auto-setup.png")

    # Banner 6: Two windows
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Two Limits. One Glance.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"5-hour session and weekly total, always visible on your deck",MAIN_Y+94,fnt(26),(120,130,160))
    win_keys=[
        render_ring(72,"5H","1h 40m"),  render_ring(35,"WEEK","3d"),
        render_bignumber(72,"5H","1h 40m"), render_dual(72,35),
    ]
    win_labels=["5-Hour Session","Weekly Total","Big Number View","Overview"]
    place_keys(canvas,win_keys,4,cell_w,cell_h,ox,oy,fnt(22),win_labels,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("clock","5-HOUR","SESSION"),("refresh","WEEKLY","TOTAL"),
        ("layers","8","STYLES"),("shield","LIVE","SYNC"),
    ],BRAND)
    save(canvas,"6-two-windows.png")

    gen_multi_account(win_a="5H",win_b="WEEK")
    gen_video("5H","WEEK",[72,35,95],["1h 40m","3d","12m"])

# ==============================================================================
# CHATGPT
# ==============================================================================

def run_chatgpt():
    global BRAND, OUT_DIR, PLUGIN_NAME
    BRAND=(16,163,127); PLUGIN_NAME="ChatGPT Usage"
    OUT_DIR=os.path.join(SCRIPT_DIR,"output","marketing","chatgpt")
    os.makedirs(OUT_DIR,exist_ok=True)
    print("\n== ChatGPT Usage ==")

    deck_keys=[
        render_ring(42,"5H","2h 14m"),    render_ring(78,"WEEK","1h 40m"),  render_ring(95,"5H","12m"),
        render_full(78,"WEEK","1h 40m"),   render_bignumber(35,"WEEK","3d"),
        render_status(42,"5H"),            render_countdown(82,"42m","5H"),  render_bigtime("2h 14m","5H"),
        render_sparkline(72,"WEEK"),       render_heatmap(),
        render_dual(42,78),                render_full(95,"5H","12m"),
        render_bignumber(78,"WEEK","1h 40m"),render_status(95,"5H"),          render_bigtime("42m","5H"),
    ]
    gen_hero("LIVE USAGE MONITOR",
             "Know if you can keep going - at a glance.",
             ["8 display styles, 3 themes, per-key customization",
              "5-hour + weekly limits, updates every 30 sec",
              "Short-press style  |  Long-press type  |  Multi-account"],
             [("refresh","LIVE","USAGE"),("palette","8","STYLES"),
              ("layers","MULTI","ACCOUNT"),("shield","100%","LOCAL")],
             deck_keys)
    gen_styles("Short-press to cycle  |  Long-press to switch type","5H")
    gen_alerts("5H")
    gen_reset("5H","Rolling Window")

    # Banner 5: Paste setup
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"One Token. Paste Once.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Get your session token from chatgpt.com/api/auth/session - takes 30 seconds",MAIN_Y+94,fnt(26),(120,130,160))
    setup_keys=[
        render_ring(42,"5H","2h 14m"),
        render_ring(78,"WEEK","1h 40m"),
        render_status(42,"5H"),
        render_dual(42,78),
    ]
    setup_labels=["5-Hour Ring","Weekly Ring","Status View","Overview"]
    cell_w=326; cell_h=246; oy=MAIN_Y+135+(H-TOP_H-BOT_H-135-cell_h)//2; ox=(W-4*cell_w)//2
    place_keys(canvas,setup_keys,4,cell_w,cell_h,ox,oy,fnt(22),setup_labels,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("star","ONE","TOKEN"),("shield","100%","LOCAL"),
        ("clock","30 SEC","REFRESH"),("layers","MULTI","ACCOUNT"),
    ],BRAND)
    save(canvas,"5-setup.png")

    # Banner 6: Two windows
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Two Limits. One Glance.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"5-hour session and weekly total, always visible on your deck",MAIN_Y+94,fnt(26),(120,130,160))
    win_keys=[
        render_ring(72,"5H","1h 40m"),  render_ring(35,"WEEK","3d"),
        render_bignumber(72,"5H","1h 40m"), render_dual(72,35),
    ]
    win_labels=["5-Hour Session","Weekly Total","Big Number View","Overview"]
    place_keys(canvas,win_keys,4,cell_w,cell_h,ox,oy,fnt(22),win_labels,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("clock","5-HOUR","SESSION"),("refresh","WEEKLY","TOTAL"),
        ("layers","8","STYLES"),("shield","LIVE","SYNC"),
    ],BRAND)
    save(canvas,"6-two-windows.png")

    gen_multi_account(win_a="5H",win_b="WEEK")
    gen_video("5H","WEEK",[72,35,95],["1h 40m","3d","12m"])

# ==============================================================================
# CURSOR
# ==============================================================================

def run_cursor():
    global BRAND, OUT_DIR, PLUGIN_NAME
    BRAND=(107,138,255); PLUGIN_NAME="Cursor Usage"
    OUT_DIR=os.path.join(SCRIPT_DIR,"output","marketing","cursor")
    os.makedirs(OUT_DIR,exist_ok=True)
    print("\n== Cursor Usage ==")

    deck_keys=[
        render_ring(65,"MONTH","22d"),    render_ring(35,"MONTH","22d"),  render_ring(90,"MONTH","3d"),
        render_full(65,"MONTH","22d"),     render_bignumber(35,"MONTH","22d"),
        render_status(65,"MONTH"),         render_countdown(80,"3d","MONTH"), render_bigtime("22 days","MONTH"),
        render_sparkline(65,"MONTH"),      render_heatmap([40,55,45,62,70,65,80],"MTH"),
        render_ring(45,"MONTH","22d"),     render_full(90,"MONTH","3d"),
        render_bignumber(80,"MONTH","3d"), render_status(35,"MONTH"),    render_bigtime("3 days","MONTH"),
    ]
    gen_hero("MONTHLY REQUESTS MONITOR",
             "Know your request limit - before it stops you.",
             ["8 display styles, 3 themes, per-key customization",
              "Monthly premium requests, updates every 30 sec",
              "Short-press style  |  Long-press type  |  Multi-account"],
             [("refresh","LIVE","USAGE"),("palette","8","STYLES"),
              ("layers","MULTI","ACCOUNT"),("shield","100%","LOCAL")],
             deck_keys)
    gen_styles("Short-press to cycle  |  Long-press to switch type","MONTH")
    gen_alerts("MONTH")
    gen_reset("MONTH","Monthly Reset")

    # Banner 5: Monthly pace
    W,H=1920,960; TOP_H,BOT_H=76,170; MAIN_Y=TOP_H
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"Know Before You Hit the Wall.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Monthly requests tracked day by day - see your pace before Cursor throttles you",MAIN_Y+94,fnt(26),(120,130,160))
    pace_keys=[
        render_ring(28,"MONTH","22d",show_label=False,pct_max_sz=32).resize((228,228),Image.LANCZOS),
        render_ring(62,"MONTH","8d",show_label=False,pct_max_sz=32).resize((228,228),Image.LANCZOS),
        render_ring(85,"MONTH","3d",show_label=False,pct_max_sz=32).resize((228,228),Image.LANCZOS),
        render_ring(97,"MONTH","22h",show_label=False,pct_max_sz=32).resize((228,228),Image.LANCZOS),
    ]
    ks=228; state_names=["Plenty left","Pace yourself","Wrap it up","Almost out"]
    state_descs=["28% used","62% used","85% used","97% used"]
    cell_w=368; oy=MAIN_Y+130+(H-TOP_H-BOT_H-130-298)//2; ox=(W-4*cell_w)//2
    for i,key in enumerate(pace_keys):
        x=ox+i*cell_w+(cell_w-ks)//2
        canvas.alpha_composite(key,dest=(x,oy))
    d=ImageDraw.Draw(canvas); f_name=fnt(22); f_desc=fnt(17)
    vals=[28,62,85,97]
    for i,val in enumerate(vals):
        col=usage_color(val); x=ox+i*cell_w
        nw,_=txt_size(state_names[i],f_name); dw,_=txt_size(state_descs[i],f_desc)
        d.text((x+(cell_w-nw)//2,oy+ks+14),state_names[i],font=f_name,fill=(*col,255))
        d.text((x+(cell_w-dw)//2,oy+ks+42),state_descs[i],font=f_desc,fill=(140,145,165,220))
    add_bottom_bar(canvas,W,H,[
        ("clock","MONTHLY","PACE"),("refresh","LIVE","UPDATES"),
        ("palette","COLOR","SHIFTS"),("shield","100%","LOCAL"),
    ],BRAND)
    save(canvas,"5-monthly-pace.png")

    # Banner 6: Setup
    canvas=make_canvas(W,H,BRAND)
    draw_banner_c(canvas,"One Cookie. Paste Once.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Copy WorkosCursorSessionToken from cursor.com cookies - takes 30 seconds",MAIN_Y+94,fnt(26),(120,130,160))
    setup_keys=[
        render_ring(65,"MONTH","22d"),
        render_status(65,"MONTH"),
        render_bignumber(65,"MONTH","22d"),
        render_countdown(65,"22d","MONTH"),
    ]
    setup_labels=["Ring","Status","Big Number","Countdown"]
    cell_w2=326; cell_h2=246; oy2=MAIN_Y+135+(H-TOP_H-BOT_H-135-cell_h2)//2; ox2=(W-4*cell_w2)//2
    place_keys(canvas,setup_keys,4,cell_w2,cell_h2,ox2,oy2,fnt(22),setup_labels,key_disp=183)
    add_bottom_bar(canvas,W,H,[
        ("star","ONE","COOKIE"),("shield","100%","LOCAL"),
        ("clock","30 SEC","REFRESH"),("layers","MULTI","ACCOUNT"),
    ],BRAND)
    save(canvas,"6-setup.png")

    gen_multi_account("Work","Personal","Side Project","Client",win_a="MONTH",win_b="MONTH")
    gen_video("MONTH","MONTH",[65,35,90],["22d","22d","3d"])

# ==============================================================================
# MAIN
# ==============================================================================

if __name__=="__main__":
    print("\nFont: %s" % (get_fp() or "(system default)"))
    run_codex()
    run_chatgpt()
    run_cursor()
    print("\nDone. Output in scripts/output/marketing/{codex,chatgpt,cursor}/")
