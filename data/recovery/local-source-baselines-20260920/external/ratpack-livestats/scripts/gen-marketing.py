# coding: utf-8
#!/usr/bin/env python3
# Creator Stats - Marketing Image + Video Generator
# Run: py scripts/gen-marketing.py
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

# ── Brand ─────────────────────────────────────────────────────────────────────
BRAND   = (255,  80,  80)
GREEN   = ( 48, 226, 123)
YELLOW  = (255, 214,  10)
RED     = (255,  59,  48)
BG      = (  8,  10,  16)
KEY_SZ  = 144

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
OUT_DIR    = os.path.join(SCRIPT_DIR, "output", "marketing")
ICON_PATH  = os.path.join(ROOT_DIR, "icon.png")
_ACTS      = os.path.join(ROOT_DIR, "com.ratpack.livestats.sdPlugin", "imgs", "actions")
_MKT       = os.path.join(SCRIPT_DIR, "marketing-assets")

def _first(*paths):
    for p in paths:
        if os.path.exists(p): return p
    return paths[-1]

# Prefer the high-res 512px masters (sharp when shown large); fall back to plugin 144px keys.
YT_PNG = _first(os.path.join(_MKT, "youtube-logo.png"), os.path.join(_ACTS, "youtube", "key@2x.png"))
TW_PNG = _first(os.path.join(_MKT, "twitch-logo.png"),  os.path.join(_ACTS, "twitch",  "key@2x.png"))

def load_png(path, size):
    try: return Image.open(path).convert("RGBA").resize((size,size), Image.LANCZOS)
    except: return None

# ── Color ─────────────────────────────────────────────────────────────────────
def lerp_color(c1, c2, t):
    return tuple(max(0,min(255,int(c1[i]+(c2[i]-c1[i])*t))) for i in range(3))

def milestone_color(pct):
    u = max(0.0, min(100.0, pct))
    if u >= 85: return RED
    if u >= 50: return lerp_color(YELLOW, RED, (u-50)/35)
    return lerp_color(GREEN, YELLOW, u/50)

def fmt_num(n):
    if n >= 1_000_000: return "%.1fM" % (n/1_000_000)
    if n >= 1_000:     return "%.1fK" % (n/1_000)
    return str(int(n))

# ── Font ──────────────────────────────────────────────────────────────────────
_FP = None
def get_fp():
    global _FP
    if _FP: return _FP
    for p in [r"C:\Windows\Fonts\Montserrat-SemiBold.ttf",
              r"C:\Windows\Fonts\Inter-SemiBold.ttf",
              r"C:\Windows\Fonts\segoeuib.ttf",
              r"C:\Windows\Fonts\arialbd.ttf"]:
        if os.path.exists(p): _FP=p; return p
    return None

def fnt(size):
    fp = get_fp()
    try: return ImageFont.truetype(fp, size) if fp else ImageFont.load_default()
    except: return ImageFont.load_default()

_DI=Image.new("L",(1,1)); _DD=ImageDraw.Draw(_DI)
def txt_size(text, f):
    bb=_DD.textbbox((0,0),text,font=f); return bb[2]-bb[0],bb[3]-bb[1]

def fit_fnt(text, max_w, max_sz, min_sz=14):
    for sz in range(max_sz,min_sz-1,-2):
        f=fnt(sz)
        if txt_size(text,f)[0]<=max_w: return f
    return fnt(min_sz)

def draw_c(img, text, y, f, color, shadow=False):
    d=ImageDraw.Draw(img); w,_=txt_size(text,f); x=(img.width-w)//2
    if shadow: d.text((x+1,y+2),text,font=f,fill=(0,0,0,110))
    d.text((x,y),text,font=f,fill=(*color[:3],255))

# ── Key background ─────────────────────────────────────────────────────────────
def key_bg(bg=None):
    c=bg or (11,11,14)
    img=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0))
    ImageDraw.Draw(img).rounded_rectangle([(0,0),(KEY_SZ-1,KEY_SZ-1)],radius=10,fill=(*c,255))
    return img

# ── Emoji ─────────────────────────────────────────────────────────────────────
_EMOJI_FP = r"C:\Windows\Fonts\seguiemj.ttf"
def draw_emoji(img, cx, top_y, char, size):
    try:
        ef=ImageFont.truetype(_EMOJI_FP,size); d=ImageDraw.Draw(img)
        bb=d.textbbox((0,0),char,font=ef,embedded_color=True)
        w=bb[2]-bb[0]
        d.text((cx-w//2-bb[0],top_y-bb[1]),char,font=ef,embedded_color=True)
        return bb[3]-bb[1]
    except: return 0

# ── Flame fallback ─────────────────────────────────────────────────────────────
def draw_flame(draw, cx, cy, sz, color, inner=None):
    pts=[(cx,cy-sz*.50),(cx+sz*.14,cy-sz*.26),(cx+sz*.36,cy+sz*.06),
         (cx+sz*.32,cy+sz*.44),(cx,cy+sz*.52),(cx-sz*.32,cy+sz*.44),
         (cx-sz*.36,cy+sz*.06),(cx-sz*.14,cy-sz*.26)]
    draw.polygon([(int(x),int(y)) for x,y in pts],fill=color)
    if inner:
        ipts=[(cx,cy-sz*.10),(cx+sz*.12,cy+sz*.10),(cx+sz*.14,cy+sz*.34),
              (cx,cy+sz*.44),(cx-sz*.14,cy+sz*.34),(cx-sz*.12,cy+sz*.10)]
        draw.polygon([(int(x),int(y)) for x,y in ipts],fill=inner)

# ══════════════════════════════════════════════════════════════════════════════
# KEY RENDERERS  (all return 144×144 RGBA)
# ══════════════════════════════════════════════════════════════════════════════

def render_big_number(value_str, label, color):
    img=key_bg()
    draw_c(img,label,22,fnt(13),(160,160,160))
    draw_c(img,value_str,50,fit_fnt(value_str,122,52,18),color)
    return img

def render_ring_milestone(pct, center_label, sub_label, color, pct_max_sz=34):
    img=key_bg(); cx,cy,r,sw=72,57,48,11
    bbox=[(cx-r,cy-r),(cx+r,cy+r)]
    track=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0))
    ImageDraw.Draw(track).arc(bbox,0,360,fill=(255,255,255,28),width=sw)
    img.alpha_composite(track)
    if pct>0.5:
        arc=Image.new("RGBA",(KEY_SZ,KEY_SZ),(0,0,0,0))
        ImageDraw.Draw(arc).arc(bbox,-90,-90+360*min(pct/100,1),fill=(*color,255),width=sw)
        img.alpha_composite(arc)
    draw_c(img,center_label,40,fit_fnt(center_label,80,pct_max_sz,14),color)
    if sub_label: draw_c(img,sub_label,112,fnt(11),(180,180,200))
    return img

SPARK_SERIES=[28,35,42,51,45,38,58,72,68,55,65,78,72,80]
def render_sparkline_creator(n_bars=7, label="+142 today"):
    img=key_bg(); d=ImageDraw.Draw(img)
    draw_c(img,"7-DAY TREND",12,fnt(10),(140,140,140))
    series=SPARK_SERIES[-7:]; ox,oy2,cw,ch=12,28,120,70
    mx=max(series+[1]); bar_w=cw//7-2; n=min(n_bars,7)
    for i in range(n):
        v=series[i]; bh=int(ch*v/mx); bx=ox+i*(bar_w+2); by=oy2+ch-bh
        col_a=lerp_color(GREEN,(80,210,140),i/6)
        d.rounded_rectangle([(bx,by),(bx+bar_w,oy2+ch)],radius=2,fill=(*col_a,200))
    draw_c(img,label,116,fnt(11),(140,140,140))
    return img

def render_delta(delta_str, label, color):
    img=key_bg()
    draw_c(img,delta_str,38,fit_fnt(delta_str,122,50,18),color)
    draw_c(img,label,96,fnt(11),(160,160,160))
    return img

def render_streak_key(days_n, label, flame_color):
    img=key_bg(); d=ImageDraw.Draw(img)
    got=draw_emoji(img,KEY_SZ//2,8,"🔥",52)
    if not got:
        inner=tuple(min(255,c+60) for c in flame_color[:3])
        draw_flame(d,KEY_SZ//2,46,32,flame_color,inner)
    draw_c(img,str(days_n),68,fit_fnt(str(days_n),104,34,14),(240,240,255))
    draw_c(img,label,108,fnt(11),(160,160,160))
    return img

def render_milestone_bar(pct, label, detail, color):
    img=key_bg(); d=ImageDraw.Draw(img)
    draw_c(img,label,22,fnt(12),(160,160,160))
    pct_str="%d%%" % int(pct)
    draw_c(img,pct_str,44,fit_fnt(pct_str,100,38,18),color)
    bx,bar_y,bh=14,92,10; bw=KEY_SZ-2*bx; fw=int(bw*min(pct/100,1))
    d.rounded_rectangle([(bx,bar_y),(bx+bw,bar_y+bh)],radius=5,fill=(255,255,255,22))
    if fw>0: d.rounded_rectangle([(bx,bar_y),(bx+fw,bar_y+bh)],radius=5,fill=(*color,255))
    draw_c(img,detail,114,fnt(10),(120,120,140))
    return img

# ══════════════════════════════════════════════════════════════════════════════
# ENGINE  (verbatim from reference)
# ══════════════════════════════════════════════════════════════════════════════

def build_deck(keys, deck_w=800, deck_h=520):
    img=Image.new("RGBA",(deck_w,deck_h),(0,0,0,0)); d=ImageDraw.Draw(img)
    d.rounded_rectangle([(0,0),(deck_w,deck_h)],radius=28,fill=(16,18,24,255))
    f_logo=fnt(22); label="STREAM DECK"; lw,lh=txt_size(label,f_logo)
    cr=13; gap=12; lx=(deck_w-(cr*2+gap+lw))//2; ly=10; cx2,cy2=lx+cr,ly+cr
    lc=(*BRAND,200)
    d.ellipse([(lx,ly),(lx+cr*2,ly+cr*2)],outline=lc,width=2)
    d.polygon([(cx2-5,cy2-6),(cx2-5,cy2+6),(cx2+7,cy2)],fill=lc)
    bb=d.textbbox((0,0),label,font=f_logo)
    d.text((lx+cr*2+gap-bb[0],cy2-lh//2-bb[1]),label,fill=lc,font=f_logo)
    COLS,ROWS=5,3; logo_h,pad,bgap=46,32,10
    avail_w=deck_w-2*pad; avail_h=deck_h-logo_h-18
    btn=min((avail_w-(COLS-1)*bgap)//COLS,(avail_h-(ROWS-1)*bgap)//ROWS)
    gw=COLS*btn+(COLS-1)*bgap; gh=ROWS*btn+(ROWS-1)*bgap
    gx=(deck_w-gw)//2; gy=logo_h+(avail_h-gh)//2
    for row in range(ROWS):
        for col in range(COLS):
            idx=row*COLS+col; bx=gx+col*(btn+bgap); by=gy+row*(btn+bgap)
            d.rounded_rectangle([(bx-1,by+4),(bx+btn+1,by+btn+4)],radius=10,fill=(3,4,5,255))
            d.rounded_rectangle([(bx,by),(bx+btn,by+btn)],radius=9,fill=(9,10,13,255))
            d.rounded_rectangle([(bx+3,by+3),(bx+btn-3,by+int(btn*0.22))],radius=6,fill=(255,255,255,7))
            if idx<len(keys):
                k=keys[idx].resize((btn,btn),Image.LANCZOS)
                img.alpha_composite(k,dest=(bx,by))
    return img

def warp_deck(deck, tilt=70):
    w,h=deck.size; out_h=h+tilt
    src=[(0,0),(w,0),(w,h),(0,h)]; dst=[(0,0),(w,tilt),(w,h+tilt*3//4),(0,h-tilt//4)]
    A,b=[],[]
    for (sx,sy),(dx,dy) in zip(src,dst):
        A+=[[dx,dy,1,0,0,0,-dx*sx,-dy*sx],[0,0,0,dx,dy,1,-dx*sy,-dy*sy]]; b+=[sx,sy]
    try:
        import numpy as np
        c=np.linalg.solve(np.array(A,dtype=float),np.array(b,dtype=float)).tolist()
        return deck.transform((w,out_h),Image.PERSPECTIVE,c,Image.BICUBIC)
    except:
        r=Image.new("RGBA",(w,out_h),(0,0,0,0)); r.alpha_composite(deck,dest=(0,tilt//2)); return r

def make_canvas(W=1920, H=960, accent=BRAND):
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

def _top_bar(canvas, W, accent=BRAND):
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

def _grad_line(canvas, y, x0, x1, color):
    r,g,b,a=color; w=x1-x0
    ln=Image.new("RGBA",(w,2),(0,0,0,0)); px=ln.load()
    for xi in range(w):
        t=xi/max(w-1,1); fade=(1-abs(t-0.5)*2)**0.5; al=int(a*fade)
        px[xi,0]=px[xi,1]=(r,g,b,al)
    canvas.alpha_composite(ln,dest=(x0,y-1))

def add_bottom_bar(canvas, W, H, features, accent=BRAND):
    BOT_H=170; BOT_Y=H-BOT_H; d=ImageDraw.Draw(canvas)
    d.rectangle([(0,BOT_Y),(W,H)],fill=(*BG,255))
    _grad_line(canvas,BOT_Y+4,0,W,(*accent,200))
    n=len(features); tile_w=W//n
    for i,feat in enumerate(features):
        ikind,la,lb=feat[0],feat[1],feat[2]; tx=i*tile_w
        if i>0: d.line([(tx,BOT_Y+20),(tx,H-20)],fill=(255,255,255,18),width=1)
        isz=64; pad=20; gap_ab=14
        avail_w=tile_w-2*pad-isz-16
        f_sm=fit_fnt(la,avail_w,20,12); f_big=fit_fnt(lb,avail_w,38,16)
        la_bb=d.textbbox((0,0),la,font=f_sm); lb_bb=d.textbbox((0,0),lb,font=f_big)
        la_h=la_bb[3]-la_bb[1]; total_h=la_h+gap_ab+(lb_bb[3]-lb_bb[1])
        gx=tx+pad; ty0=BOT_Y+20+(BOT_H-20-total_h)//2; icon_cy=ty0+total_h//2-isz//2
        _btm_icon(d,ikind,gx,icon_cy,isz,(*accent,210)); tfx=gx+isz+16
        d.text((tfx-la_bb[0],ty0-la_bb[1]),la,fill=(*accent,200),font=f_sm)
        d.text((tfx-lb_bb[0],ty0+la_h+gap_ab-lb_bb[1]),lb,fill=(230,234,250,255),font=f_big)

def _btm_icon(d, kind, x, y, sz, col):
    if kind=="refresh":
        r2=sz//2-4; cx,cy=x+sz//2,y+sz//2
        d.arc([(cx-r2,cy-r2),(cx+r2,cy+r2)],-45,270,fill=col,width=3)
        d.polygon([(cx+r2-2,cy-8),(cx+r2+6,cy-2),(cx+r2-2,cy+4)],fill=col)
    elif kind=="palette":
        s=sz//4
        for ri in range(2):
            for ci in range(2):
                d.rounded_rectangle([(x+ci*(s+4),y+ri*(s+4)),(x+ci*(s+4)+s,y+ri*(s+4)+s)],radius=3,fill=col)
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
        cx2,cy2=x+sz//2,y+sz//2; r_out=sz//2-3; r_in=r_out//2; pts=[]
        for i in range(10):
            a=math.radians(-90+i*36); r=r_out if i%2==0 else r_in
            pts.append((cx2+r*math.cos(a),cy2+r*math.sin(a)))
        d.polygon(pts,fill=col)
    elif kind=="heart":
        cx2,cy2=x+sz//2,y+sz//2+4; r=sz//4
        d.ellipse([(cx2-r*2,cy2-r),(cx2,cy2+r)],fill=col)
        d.ellipse([(cx2,cy2-r),(cx2+r*2,cy2+r)],fill=col)
        d.polygon([(cx2-r*2,cy2),(cx2+r*2,cy2),(cx2,cy2+r*2+4)],fill=col)

def add_gradient_title(canvas, text, x, y, max_w, accent=BRAND, white=False):
    d=ImageDraw.Draw(canvas); f=_fit_banner(text,d,max_w,180,48)
    bb=d.textbbox((0,0),text,font=f); pw,ph=bb[2]-bb[0],bb[3]-bb[1]
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

def _fit_banner(text, draw, max_w, max_sz=180, min_sz=48):
    for sz in range(max_sz,min_sz-1,-4):
        f=fnt(sz); bb=draw.textbbox((0,0),text,font=f)
        if bb[2]-bb[0]<=max_w: return f
    return fnt(min_sz)

def draw_banner_c(canvas, text, y, f, color, W=1920):
    d=ImageDraw.Draw(canvas); tw,_=txt_size(text,f)
    d.text(((W-tw)//2,y),text,font=f,fill=(*color[:3],255))

def place_keys(canvas, keys, cols, cell_w, cell_h, ox, oy,
               label_f=None, labels=None, label_colors=None,
               key_disp=None, sub_labels=None, sub_f=None):
    ksz=key_disp if key_disp else KEY_SZ
    for i,key in enumerate(keys):
        row,col=divmod(i,cols)
        x=ox+col*cell_w+(cell_w-ksz)//2; y=oy+row*cell_h+(cell_h-ksz)//2
        if key_disp and key.size!=(ksz,ksz): key=key.resize((ksz,ksz),Image.LANCZOS)
        canvas.alpha_composite(key,dest=(x,y))
        if label_f and labels and i<len(labels):
            lbl=labels[i]; lw,_=txt_size(lbl,label_f)
            lcolor=(160,160,180) if not label_colors else label_colors[i]
            ImageDraw.Draw(canvas).text((x+(ksz-lw)//2,y+ksz+14),lbl,font=label_f,fill=(*lcolor,255))
        if sub_f and sub_labels and i<len(sub_labels):
            sl=sub_labels[i]; sw2,_=txt_size(sl,sub_f)
            lh=txt_size(labels[i],label_f)[1] if label_f and labels and i<len(labels) else 0
            ImageDraw.Draw(canvas).text((x+(ksz-sw2)//2,y+ksz+18+lh),sl,font=sub_f,fill=(110,120,145,200))

# ══════════════════════════════════════════════════════════════════════════════
# LAYOUT CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════
W, H = 1920, 960
TOP_H, BOT_H = 76, 170
MAIN_Y  = TOP_H                   # 76
MAIN_BOT = H - BOT_H              # 790
MAIN_H  = MAIN_BOT - MAIN_Y       # 714
BAN_H   = 130                     # space consumed by banner + sub-banner
CT_TOP  = MAIN_Y + BAN_H          # 206  — top of key content zone
CT_H    = MAIN_BOT - CT_TOP       # 584  — height of key content zone

def content_oy(key_h, label_h=0):
    """Vertically center a block of height (key_h + label_h) in the content zone."""
    return CT_TOP + (CT_H - key_h - label_h) // 2

# ══════════════════════════════════════════════════════════════════════════════
# GENERATORS
# ══════════════════════════════════════════════════════════════════════════════

def gen_hero():
    canvas = make_canvas(W, H, BRAND)
    FLAT_DW, FLAT_DH, TILT = 940, 612, 72
    deck_x = W - FLAT_DW - 24
    deck_y = MAIN_Y + (MAIN_H - (FLAT_DH + TILT)) // 2

    # Build 15-key deck (all display styles + real platform PNGs)
    yt_key = load_png(YT_PNG, KEY_SZ)
    tw_key = load_png(TW_PNG, KEY_SZ)
    blank  = key_bg()
    keys = [
        yt_key  or render_big_number("YT","YOUTUBE",(255,0,0)),
        render_big_number("12.4K","SUBSCRIBERS",GREEN),
        render_sparkline_creator(7,"+142 today"),
        render_ring_milestone(74,"74%","TO 100K",milestone_color(74)),
        render_delta("+142","SUBS TODAY",GREEN),
        tw_key  or render_big_number("TW","TWITCH",(145,70,255)),
        render_big_number("8.2K","FOLLOWERS",(145,70,255)),
        render_big_number("341","LIVE VIEWERS",(48,200,160)),
        render_streak_key(7,"DAY STREAK",YELLOW),
        render_delta("+18","FOLLOWERS",(145,70,255)),
        render_milestone_bar(74,"TO 100K","9,247 / 10K",milestone_color(74)),
        render_ring_milestone(28,"28%","TO 1K",milestone_color(28)),
        render_delta("+847","VIEWS TODAY",GREEN),
        render_delta("-3","SUBS TODAY",RED),
        render_ring_milestone(99,"99%","TO 1M",RED),
    ]
    flat = build_deck(keys, FLAT_DW, FLAT_DH)
    warped = warp_deck(flat, TILT)
    shadow = Image.new("RGBA",(W,H),(0,0,0,0))
    ImageDraw.Draw(shadow).polygon([
        (deck_x+14,deck_y+20),(deck_x+FLAT_DW+14,deck_y+TILT+20),
        (deck_x+FLAT_DW+14,deck_y+FLAT_DH+TILT+20),(deck_x+14,deck_y+FLAT_DH+20)],
        fill=(0,0,0,170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(warped, dest=(deck_x, deck_y))

    # Left text column
    tx = 68; max_w = deck_x - tx - 50
    d = ImageDraw.Draw(canvas)
    f_badge = fnt(24); badge = "CREATOR ANALYTICS"
    bb = d.textbbox((0,0),badge,font=f_badge); bw,bh=bb[2]-bb[0],bb[3]-bb[1]; bp=12
    badge_y = MAIN_Y + 48
    d.rounded_rectangle([(tx,badge_y),(tx+bw+bp*2,badge_y+bh+bp)],radius=7,
                        outline=(*BRAND,200),width=2,fill=(14,16,22,220))
    d.text((tx+bp-bb[0],badge_y+bp//2-bb[1]),badge,fill=(210,218,240,255),font=f_badge)

    title_y = badge_y + bh + bp + 20
    title_h = add_gradient_title(canvas,"Creator Stats",tx,title_y,max_w,BRAND)

    sub_y = title_y + title_h + 18
    d = ImageDraw.Draw(canvas)
    d.text((tx,sub_y),"Your numbers, on your desk. Always.",fill=(155,165,200,200),font=fnt(26))

    bullets = [
        "Subscribers, views, and live viewers from both platforms",
        "Six display styles: rings, delta, streaks, and more",
        "Short-press to cycle style  ·  Long-press to switch stat",
    ]
    by2 = sub_y + 52
    for b in bullets:
        d.ellipse([(tx,by2+8),(tx+8,by2+16)],fill=(*BRAND,210))
        d.text((tx+18,by2),b,fill=(185,195,220,200),font=fnt(22)); by2+=38

    # Platform logos — actual PNGs, no labels, prominent
    logo_y = by2 + 22; logo_sz = 120; bx_p = tx
    for png in [YT_PNG, TW_PNG]:
        logo = load_png(png, logo_sz)
        if logo: canvas.alpha_composite(logo, dest=(bx_p, logo_y))
        bx_p += logo_sz + 18

    add_bottom_bar(canvas,W,H,[
        ("refresh","AUTO","REFRESH"),
        ("clock","ALWAYS","UP TO DATE"),
        ("star","YOUR STATS","AT A GLANCE"),
        ("people","BUILT FOR","CREATORS"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"1-hero.png"),quality=96)
    print("> 1-hero.png")


def gen_styles():
    canvas = make_canvas(W, H, BRAND)
    draw_banner_c(canvas,"6 Display Styles",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Short-press to cycle  ·  Long-press to switch stat",MAIN_Y+94,fnt(26),(120,130,160))

    KD = 220; CW = 300; COLS = 6
    grid_w = COLS * CW                       # 1800
    ox = (W - grid_w) // 2                  # 60
    oy = content_oy(KD, 40)                 # vertically centered

    keys6 = [
        render_big_number("12.4K","SUBSCRIBERS",GREEN),
        render_ring_milestone(74,"74%","TO 10K",BRAND),
        render_sparkline_creator(7,"+142 today"),
        render_delta("+142","SUBS TODAY",GREEN),
        render_streak_key(7,"DAY STREAK",YELLOW),
        render_milestone_bar(74,"TO 10K","9,247 / 10,000",GREEN),
    ]
    labels6 = ["Big Number","Ring","Sparkline","Delta","Streak","Milestone"]
    place_keys(canvas,keys6,COLS,CW,KD,ox,oy,fnt(20),labels6,key_disp=KD)

    add_bottom_bar(canvas,W,H,[
        ("star","SHORT PRESS","CYCLE STYLE"),
        ("layers","LONG PRESS","SWITCH STAT"),
        ("palette","BUILT FOR","OLED DECKS"),
        ("refresh","ALWAYS","UP TO DATE"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"2-styles.png"),quality=96)
    print("> 2-styles.png")


def gen_milestones():
    canvas = make_canvas(W, H, BRAND)
    draw_banner_c(canvas,"Never Miss a Milestone.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Set any goal. The ring fills as you climb.",MAIN_Y+94,fnt(26),(120,130,160))

    KS = 264; CW = 420; COLS = 4
    grid_w = COLS * CW                      # 1680
    ox = (W - grid_w) // 2                  # 120
    oy = content_oy(KS, 72)

    milestone_data = [
        (28,"28%","280 / 1K",  milestone_color(28)),
        (61,"61%","6.1K / 10K",milestone_color(61)),
        (84,"84%","84K / 100K",milestone_color(84)),
        (99,"99%","990K / 1M", RED),
    ]
    mkeys = [render_ring_milestone(p,cl,sl,c).resize((KS,KS),Image.LANCZOS) for p,cl,sl,c in milestone_data]
    state_names = ["Just Starting","Building","Almost There","So Close"]
    state_descs = ["0 – 1K subs","1K – 10K subs","10K – 100K subs","100K – 1M subs"]

    for i,key in enumerate(mkeys):
        x = ox + i*CW + (CW-KS)//2
        canvas.alpha_composite(key, dest=(x, oy))

    d = ImageDraw.Draw(canvas); f_name=fnt(22); f_desc=fnt(16)
    for i,(_,_,_,col) in enumerate(milestone_data):
        x = ox + i*CW
        nw,_ = txt_size(state_names[i],f_name); dw,_=txt_size(state_descs[i],f_desc)
        d.text((x+(CW-nw)//2, oy+KS+16), state_names[i], font=f_name, fill=(*col,255))
        d.text((x+(CW-dw)//2, oy+KS+44), state_descs[i], font=f_desc, fill=(140,145,165,220))

    add_bottom_bar(canvas,W,H,[
        ("star","SET","ANY GOAL"),
        ("refresh","FILLS","AS YOU GROW"),
        ("clock","ALWAYS","UP TO DATE"),
        ("heart","CELEBRATE","EVERY WIN"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"3-milestones.png"),quality=96)
    print("> 3-milestones.png")


def gen_delta():
    canvas = make_canvas(W, H, BRAND)
    draw_banner_c(canvas,"Know If Today Is a Good Day.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Daily change on every key. Green when up, red when down.",MAIN_Y+94,fnt(26),(120,130,160))

    KD = 240; CW = 420; COLS = 4
    grid_w = COLS * CW                      # 1680
    ox = (W - grid_w) // 2                  # 120
    oy = content_oy(KD, 44)

    dkeys = [
        render_delta("+847",  "SUBS TODAY",  GREEN),
        render_delta("+12.4K","VIEWS TODAY", GREEN),
        render_delta("-3",    "SUBS TODAY",  RED),
        render_delta("+0",    "NO CHANGE",   (130,130,140)),
    ]
    dlabels = ["Growing","Viral Day","Off Day","Flat Day"]
    place_keys(canvas,dkeys,COLS,CW,KD,ox,oy,fnt(22),dlabels,key_disp=KD)

    add_bottom_bar(canvas,W,H,[
        ("star","TODAY AT","A GLANCE"),
        ("refresh","AUTO","REFRESH"),
        ("clock","RESETS","AT MIDNIGHT"),
        ("people","KNOW YOUR","GROWTH"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"4-delta.png"),quality=96)
    print("> 4-delta.png")


def gen_streak():
    canvas = make_canvas(W, H, BRAND)
    draw_banner_c(canvas,"Keep the Streak Alive.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"Stay consistent. Break the streak and you'll know instantly.",MAIN_Y+94,fnt(26),(120,130,160))

    KD = 240; CW = 420; COLS = 4
    grid_w = COLS * CW
    ox = (W - grid_w) // 2
    oy = content_oy(KD, 44)

    streak_data = [
        (1,   "1 DAY",   (140,140,140), "Just Started"),
        (7,   "7 DAYS",  YELLOW,        "One Week"),
        (30,  "30 DAYS", BRAND,         "One Month"),
        (100, "100 DAYS",RED,           "Legend"),
    ]
    skeys  = [render_streak_key(dn,lbl,col) for dn,lbl,col,_ in streak_data]
    slbls  = [cat for _,_,_,cat in streak_data]
    scols  = [col for _,_,col,_ in streak_data]
    place_keys(canvas,skeys,COLS,CW,KD,ox,oy,fnt(22),slbls,scols,key_disp=KD)

    add_bottom_bar(canvas,W,H,[
        ("clock","DAILY UPLOAD","TRACKING"),
        ("refresh","DETECTED","AUTOMATICALLY"),
        ("star","DON'T BREAK","THE CHAIN"),
        ("heart","BUILD THE","HABIT"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"5-streak.png"),quality=96)
    print("> 5-streak.png")


def gen_platforms():
    canvas = make_canvas(W, H, BRAND)
    draw_banner_c(canvas,"YouTube + Twitch. Built In.",MAIN_Y+22,fnt(52),(240,245,255))
    draw_banner_c(canvas,"All your numbers from both platforms, in one place",MAIN_Y+94,fnt(26),(120,130,160))

    # Two halves: left=YouTube (cx=480), right=Twitch (cx=1440)
    LOGO_SZ = 280
    STAT_SZ = 190
    STAT_GAP = 16
    stat_row_w = STAT_SZ * 2 + STAT_GAP   # 396

    total_h = LOGO_SZ + 28 + STAT_SZ      # 498
    logo_y  = CT_TOP + (CT_H - total_h) // 2   # vertically centered
    stat_y  = logo_y + LOGO_SZ + 28

    for cx, png_path, stat_keys in [
        (480,  YT_PNG, [render_big_number("12.4K","SUBSCRIBERS",(255,0,0)),
                        render_ring_milestone(74,"74%","TO 100K",milestone_color(74))]),
        (1440, TW_PNG, [render_big_number("8.2K","FOLLOWERS",(145,70,255)),
                        render_big_number("341","LIVE VIEWERS",(48,200,160))]),
    ]:
        # Large actual platform PNG
        logo = load_png(png_path, LOGO_SZ)
        if logo: canvas.alpha_composite(logo, dest=(cx - LOGO_SZ//2, logo_y))

        # Two stat keys below, centered under the logo
        sx = cx - stat_row_w // 2
        for ki, sk in enumerate(stat_keys):
            k2 = sk.resize((STAT_SZ, STAT_SZ), Image.LANCZOS)
            canvas.alpha_composite(k2, dest=(sx + ki*(STAT_SZ+STAT_GAP), stat_y))

    # Center divider
    d = ImageDraw.Draw(canvas)
    d.line([(W//2, CT_TOP+20),(W//2, MAIN_BOT-20)],fill=(255,255,255,18),width=1)

    add_bottom_bar(canvas,W,H,[
        ("people","FOLLOWERS","& SUBSCRIBERS"),
        ("clock","LIVE","VIEWER COUNT"),
        ("refresh","AUTO","REFRESH"),
        ("star","QUICK","ONE-TIME SETUP"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"6-platforms.png"),quality=96)
    print("> 6-platforms.png")


def gen_dashboard():
    """Full creator deck — shows what a real setup looks like."""
    canvas = make_canvas(W, H, BRAND)
    draw_banner_c(canvas,"Your Complete Creator Dashboard.",MAIN_Y+22,fnt(48),(240,245,255))
    draw_banner_c(canvas,"Every stat you check daily, right on your desk",MAIN_Y+90,fnt(26),(120,130,160))

    FLAT_DW, FLAT_DH, TILT = 1100, 505, 56
    deck_x = (W - FLAT_DW) // 2
    deck_y = CT_TOP + (CT_H - (FLAT_DH + TILT)) // 2

    yt_key = load_png(YT_PNG, KEY_SZ)
    tw_key = load_png(TW_PNG, KEY_SZ)

    keys = [
        yt_key  or render_big_number("YT","YOUTUBE",(255,0,0)),
        render_big_number("12.4K","SUBSCRIBERS",GREEN),
        render_sparkline_creator(7,"+142 today"),
        render_ring_milestone(74,"74%","TO 100K",milestone_color(74)),
        render_delta("+142","SUBS TODAY",GREEN),

        tw_key  or render_big_number("TW","TWITCH",(145,70,255)),
        render_big_number("8.2K","FOLLOWERS",(145,70,255)),
        render_big_number("341","LIVE VIEWERS",(48,200,160)),
        render_streak_key(7,"DAY STREAK",YELLOW),
        render_delta("+18","FOLLOWERS",(145,70,255)),

        render_milestone_bar(74,"TO 100K","9,247 / 10K",milestone_color(74)),
        render_ring_milestone(28,"28%","TO 1K",milestone_color(28)),
        render_delta("+847","VIEWS TODAY",GREEN),
        render_delta("-3","SUBS TODAY",RED),
        render_ring_milestone(99,"99%","TO 1M",RED),
    ]
    flat   = build_deck(keys, FLAT_DW, FLAT_DH)
    warped = warp_deck(flat, TILT)
    shadow = Image.new("RGBA",(W,H),(0,0,0,0))
    ImageDraw.Draw(shadow).polygon([
        (deck_x+12,deck_y+16),(deck_x+FLAT_DW+12,deck_y+TILT+16),
        (deck_x+FLAT_DW+12,deck_y+FLAT_DH+TILT+16),(deck_x+12,deck_y+FLAT_DH+16)],
        fill=(0,0,0,160))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(warped, dest=(deck_x, deck_y))

    add_bottom_bar(canvas,W,H,[
        ("layers","ALL YOUR STATS","ON ONE DECK"),
        ("refresh","AUTO","REFRESH"),
        ("clock","ALWAYS","UP TO DATE"),
        ("people","BUILT FOR","CREATORS"),
    ],BRAND)
    canvas.convert("RGB").save(os.path.join(OUT_DIR,"7-dashboard.png"),quality=96)
    print("> 7-dashboard.png")


def gen_video():
    VW,VH=1200,630; FPS_MS=60; TOP_H=80; frames=[]
    ALL_PHASES=["Fill","Ring","Delta","Streak","Big Number"]
    CAROUSEL=[
        ("Ring","Milestone progress: the ring fills as you grow",
         render_ring_milestone(74,"74%","TO 10K",milestone_color(74)),
         render_ring_milestone(42,"42%","TO 1K", milestone_color(42)),
         render_ring_milestone(91,"91%","TO 100K",milestone_color(91))),
        ("Delta","Daily change: green up, red down",
         render_delta("+142","SUBS TODAY",GREEN),
         render_delta("+12.4K","VIEWS TODAY",GREEN),
         render_delta("-3","SUBS TODAY",RED)),
        ("Streak","Upload consistency: keep the streak alive",
         render_streak_key(7,"DAY STREAK",YELLOW),
         render_streak_key(30,"DAY STREAK",BRAND),
         render_streak_key(100,"DAY STREAK",RED)),
        ("Big Number","Giant stats, readable across the room",
         render_big_number("12.4K","SUBSCRIBERS",GREEN),
         render_big_number("8.2K","FOLLOWERS",(145,70,255)),
         render_big_number("341","LIVE VIEWERS",(48,200,160))),
    ]

    def draw_frame(k1,k2,k3,phase_name,desc,key_sub=None):
        c=Image.new("RGBA",(VW,VH),(*BG,255))
        glow=Image.new("RGBA",(VW,VH),(0,0,0,0))
        ImageDraw.Draw(glow).ellipse([(-100,100),(VW+100,VH-50)],fill=(*BRAND,30))
        glow=glow.filter(ImageFilter.GaussianBlur(120))
        c=Image.alpha_composite(c,glow)
        d=ImageDraw.Draw(c); d.rectangle([(0,0),(VW,TOP_H)],fill=(*BG,255))
        _grad_line(c,TOP_H-1,0,VW,(*BRAND,180))
        lx=18; icon_sz=48
        if os.path.exists(ICON_PATH):
            try:
                ico=Image.open(ICON_PATH).convert("RGBA").resize((icon_sz,icon_sz),Image.LANCZOS)
                c.alpha_composite(ico,dest=(lx,(TOP_H-icon_sz)//2)); lx+=icon_sz+12
            except: pass
        d=ImageDraw.Draw(c)
        f_t=fnt(26); f_s=fnt(14)
        bb=d.textbbox((0,0),"Creator Stats",font=f_t)
        ty=(TOP_H-(bb[3]-bb[1]))//2-bb[1]
        d.text((lx,ty),"Creator Stats",font=f_t,fill=(210,220,240,220))
        d.text((lx,ty+(bb[3]-bb[1])+2),"by Ratpack",font=f_s,fill=(120,130,160,180))
        f_pn=fnt(20); pnw,_=txt_size(phase_name,f_pn)
        d.text((VW-pnw-20,(TOP_H-20)//2),phase_name,font=f_pn,fill=(*BRAND,210))
        ksz=168; gap=32; total_kw=3*ksz+2*gap; kx=(VW-total_kw)//2; ky=TOP_H+40
        for key in [k1,k2,k3]:
            c.alpha_composite(key.resize((ksz,ksz),Image.LANCZOS),dest=(kx,ky)); kx+=ksz+gap
        if key_sub:
            kx2=(VW-total_kw)//2; f_s3=fnt(15)
            for lbl in key_sub:
                lw3,_=txt_size(lbl,f_s3)
                d.text((kx2+(ksz-lw3)//2,ky+ksz+12),lbl,font=f_s3,fill=(110,120,150,200))
                kx2+=ksz+gap
        f_desc=fnt(21); dw,_=txt_size(desc,f_desc)
        d.text(((VW-dw)//2,ky+ksz+(40 if key_sub else 18)),desc,font=f_desc,fill=(155,165,200,220))
        dot_y=VH-32; dot_r=6; total_dot=len(ALL_PHASES)*(dot_r*2+10)-10
        dx=(VW-total_dot)//2
        for ph in ALL_PHASES:
            fc=(*BRAND,255) if ph==phase_name else (70,80,105,200)
            d.ellipse([(dx,dot_y-dot_r),(dx+dot_r*2,dot_y+dot_r)],fill=fc); dx+=dot_r*2+10
        hint="Short-press any key to cycle styles"; hw2,_=txt_size(hint,fnt(13))
        d.text(((VW-hw2)//2,VH-20),hint,font=fnt(13),fill=(70,80,105,180))
        return c.convert("RGB")

    print("  Rendering GIF...")
    FILL_F=24
    for fi in range(FILL_F):
        t=1-(1-fi/max(FILL_F-1,1))**2; t=t*0.98+0.02; tf=min(t,1.0)
        k1=render_ring_milestone(74*tf,"%.0f%%" % (74*tf),"TO 10K",milestone_color(74*tf))
        k2=render_big_number(fmt_num(int(12400*tf)),"SUBSCRIBERS",GREEN)
        k3=render_sparkline_creator(max(1,int(7*tf)),"+142 today")
        frames.append(draw_frame(k1,k2,k3,"Fill","Live stats, always on your desk",["Milestone","Subscribers","Trend"]))
    k1f=render_ring_milestone(74,"74%","TO 10K",milestone_color(74))
    k2f=render_big_number("12.4K","SUBSCRIBERS",GREEN)
    k3f=render_sparkline_creator(7,"+142 today")
    for _ in range(8):
        frames.append(draw_frame(k1f,k2f,k3f,"Fill","Live stats, always on your desk",["Milestone","Subscribers","Trend"]))
    for sn,sd,ck1,ck2,ck3 in CAROUSEL:
        for _ in range(11): frames.append(draw_frame(ck1,ck2,ck3,sn,sd))

    gif_path=os.path.join(OUT_DIR,"preview.gif")
    frames[0].save(gif_path,save_all=True,append_images=frames[1:],duration=FPS_MS,loop=0,optimize=False)
    print("> preview.gif (%d frames, %.1fs)" % (len(frames),len(frames)*FPS_MS/1000))

    mp4_path=os.path.join(OUT_DIR,"preview.mp4")
    try:
        subprocess.run(["ffmpeg","-i",gif_path,
            "-vf","scale=1920:1008:flags=lanczos,pad=1920:1080:0:36:black",
            "-c:v","libx264","-crf","18","-pix_fmt","yuv420p",
            "-movflags","+faststart","-y",mp4_path],check=True)
        print("> preview.mp4")
    except Exception as e:
        print("  ffmpeg skipped: %s" % e)

def gen_marketplace_icon():
    """288x288 icon for the Elgato Marketplace listing."""
    SZ = 288; RADIUS = 48
    img = Image.new("RGBA", (SZ, SZ), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([(0,0),(SZ-1,SZ-1)], radius=RADIUS, fill=(10,10,14,255))

    # YouTube play triangle - top-left quadrant
    cx_yt, cy_yt = 80, 110
    r_yt = 44
    d.ellipse([(cx_yt-r_yt, cy_yt-r_yt),(cx_yt+r_yt, cy_yt+r_yt)], fill=(255,0,0,255))
    tri_pts = [(cx_yt-14, cy_yt-18),(cx_yt-14, cy_yt+18),(cx_yt+20, cy_yt)]
    d.polygon(tri_pts, fill=(255,255,255,255))

    # Twitch logo - top-right quadrant
    cx_tw, cy_tw = 208, 110
    r_tw = 36
    # Glitch mark: rounded rect with notch
    bx, by = cx_tw - r_tw, cy_tw - r_tw
    d.rounded_rectangle([(bx,by),(bx+r_tw*2,by+r_tw*2)], radius=8, fill=(145,70,255,255))
    # Two white bars (glitch eyes)
    bar_w, bar_h = 10, 20
    d.rectangle([(cx_tw-16, cy_tw-14),(cx_tw-16+bar_w, cy_tw-14+bar_h)], fill=(255,255,255,255))
    d.rectangle([(cx_tw+6,  cy_tw-14),(cx_tw+6+bar_w,  cy_tw-14+bar_h)], fill=(255,255,255,255))

    # Sparkline across the bottom area
    spark_y0 = 178; spark_x0 = 28; spark_x1 = SZ-28
    series = [0.30, 0.42, 0.36, 0.55, 0.48, 0.60, 0.52, 0.70, 0.65, 0.80, 0.74, 0.88]
    n = len(series); seg_w = (spark_x1 - spark_x0) / (n-1); spark_h = 52
    pts = [(int(spark_x0 + i*seg_w), int(spark_y0 + spark_h*(1-v))) for i,v in enumerate(series)]
    for i in range(len(pts)-1):
        t = i/(n-2)
        col = tuple(int(BRAND[c]*(1-t) + GREEN[c]*t) for c in range(3))
        d.line([pts[i], pts[i+1]], fill=(*col, 230), width=3)
    for px, py in pts:
        d.ellipse([(px-3,py-3),(px+3,py+3)], fill=(255,255,255,200))

    # "STATS" label at bottom
    f_lbl = fit_fnt("STATS", 200, 28, 18)
    lw, _ = txt_size("STATS", f_lbl)
    d.text(((SZ-lw)//2, 242), "STATS", font=f_lbl, fill=(*BRAND, 230))

    out = os.path.join(OUT_DIR, "icon-288x288.png")
    img.save(out)
    print("> icon-288x288.png")


def write_descriptions():
    txt = """\
Real-time YouTube and Twitch creator analytics on your Stream Deck. Subscriber count, live viewers, milestone progress, total views, and growth trends always at a glance.

Your numbers. On your desk. Always.

Creator Stats puts your most important YouTube and Twitch numbers on your Stream Deck keys. Enter your YouTube API key and channel ID, connect your Twitch account, and stats start loading immediately.

Subscribers, live viewers, follower count, total views, video count, upload streak, and milestone progress. Six display styles per key. Short press to cycle styles. Long press to switch metrics.

**Features**
- YouTube and Twitch stats in one plugin, no extra apps needed
- Six display styles: big number, milestone ring, sparkline trend, delta, streak, and multi-stat overview
- Milestone mode: progress ring to any target with a days-to-goal estimate
- Live mode: viewer count updates every 90 seconds while you stream, switches to followers when you go offline
- Upload streak: consecutive upload days tracked automatically from your YouTube activity
- Multi-stat overview: four key stats on one key, TW followers, YT subs, live viewers, and new follows today
- Short press cycles display style, long press cycles the metric shown

*Part of the Ratpack creator toolkit. Check out Kick Stats for Stream Deck for Kick.com channel analytics.*

creator stats stream deck youtube subscribers twitch followers live viewers milestone progress analytics
"""
    out = os.path.join(OUT_DIR, "description.txt")
    with open(out, "w", encoding="utf-8") as f:
        f.write(txt.strip())
    print("> description.txt")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__=="__main__":
    os.makedirs(OUT_DIR,exist_ok=True)
    print("\nFont:  %s" % (get_fp() or "system default"))
    print("Icon:  %s" % ("found" if os.path.exists(ICON_PATH) else "NOT FOUND"))
    print("YT:    %s" % ("found" if os.path.exists(YT_PNG) else "NOT FOUND — run npm run build first"))
    print("TW:    %s" % ("found" if os.path.exists(TW_PNG) else "NOT FOUND — run npm run build first"))
    print("Out:   %s\n" % OUT_DIR)
    gen_hero()
    gen_styles()
    gen_milestones()
    gen_delta()
    gen_streak()
    gen_platforms()
    gen_dashboard()
    gen_marketplace_icon()
    write_descriptions()
    gen_video()
    print("\nDone. %s" % OUT_DIR)
