from pathlib import Path
import argparse, io, json, shutil, uuid, zipfile
from PIL import Image, ImageDraw, ImageFont
import cairosvg

BG=(7,9,12,255)
FG=(246,248,250,255)
SOFT=(128,137,148,255)
ACCENT=(43,232,106,255)
RED=(242,86,86,255)

DISCORD_SVG='''<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>'''
SPOTIFY_SVG='''<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>'''


def font(size):
    for name in ('DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
        try: return ImageFont.truetype(name,size)
        except OSError: pass
    raise RuntimeError('DejaVuSans-Bold.ttf is required for deterministic key labels')


def fit_font(draw,text,max_width,max_size=19,min_size=11):
    for size in range(max_size,min_size-1,-1):
        f=font(size); b=draw.textbbox((0,0),text,font=f)
        if b[2]-b[0] <= max_width: return f
    return font(min_size)


def sc(v,k): return int(round(v*k))

def rr(d,box,k,r=4,fill=None,outline=None,w=3):
    d.rounded_rectangle(tuple(sc(v,k) for v in box),radius=max(1,sc(r,k)),fill=fill,outline=outline,width=max(1,sc(w,k)))

def line(d,pts,k,fill=FG,w=4):
    d.line(tuple(sc(v,k) for v in pts),fill=fill,width=max(1,sc(w,k)),joint='curve')


def brand_icon(svg,size):
    svg=svg.replace('<path ','<path fill="#F6F8FA" ')
    png=cairosvg.svg2png(bytestring=svg.encode(),output_width=size,output_height=size)
    return Image.open(io.BytesIO(png)).convert('RGBA')


def draw_symbol(im,kind,variant=''):
    size=im.size[0]; k=size/72.0; d=ImageDraw.Draw(im)
    if kind=='workspace':
        rr(d,(15,24,57,55),k,5,outline=FG,w=4); rr(d,(26,16,46,27),k,4,outline=FG,w=4); line(d,(18,34,54,34),k,fill=SOFT,w=3)
    elif kind=='web':
        d.ellipse((sc(15,k),sc(15,k),sc(57,k),sc(57,k)),outline=FG,width=max(1,sc(4,k))); line(d,(16,36,56,36),k,w=3); line(d,(36,16,36,56),k,w=3); d.arc((sc(24,k),sc(15,k),sc(48,k),sc(57,k)),90,270,fill=FG,width=max(1,sc(3,k))); d.arc((sc(24,k),sc(15,k),sc(48,k),sc(57,k)),-90,90,fill=FG,width=max(1,sc(3,k)))
    elif kind=='discord':
        icon=brand_icon(DISCORD_SVG,size); im.alpha_composite(icon)
    elif kind=='spotify':
        icon=brand_icon(SPOTIFY_SVG,size); im.alpha_composite(icon)
    elif kind=='app':
        rr(d,(15,16,57,56),k,6,outline=FG,w=4); rr(d,(22,23,50,30),k,3,fill=FG); rr(d,(22,36,43,43),k,3,fill=SOFT)
    elif kind=='window':
        rr(d,(13,15,59,56),k,5,outline=FG,w=4)
        if variant=='left': d.rectangle((sc(17,k),sc(19,k),sc(34,k),sc(52,k)),fill=FG)
        elif variant=='right': d.rectangle((sc(38,k),sc(19,k),sc(55,k),sc(52,k)),fill=FG)
        elif variant=='maximize': rr(d,(19,21,53,50),k,2,outline=FG,w=3)
        elif variant=='restore': rr(d,(21,23,51,50),k,2,outline=FG,w=3); rr(d,(27,18,56,45),k,2,outline=SOFT,w=3)
        elif variant=='center': rr(d,(25,24,47,47),k,2,fill=FG)
        elif variant in ('top-left','top-right','bottom-left','bottom-right'):
            bx={'top-left':(17,19,34,34),'top-right':(38,19,55,34),'bottom-left':(17,37,34,52),'bottom-right':(38,37,55,52)}[variant]; d.rectangle(tuple(sc(v,k) for v in bx),fill=FG)
        elif variant=='next-monitor':
            rr(d,(10,18,41,46),k,4,outline=SOFT,w=3); rr(d,(31,25,62,53),k,4,outline=FG,w=3); line(d,(42,39,55,39),k,w=3); line(d,(50,33,56,39,50,45),k,w=3)
        elif variant=='minimize': line(d,(22,47,50,47),k,w=5)
        elif variant=='topmost':
            d.polygon([(sc(36,k),sc(16,k)),(sc(50,k),sc(31,k)),(sc(43,k),sc(34,k)),(sc(43,k),sc(48,k)),(sc(36,k),sc(56,k)),(sc(29,k),sc(48,k)),(sc(29,k),sc(34,k)),(sc(22,k),sc(31,k))],fill=FG)
    elif kind=='clipboard':
        rr(d,(19,18,53,57),k,5,outline=FG,w=4); rr(d,(27,12,45,24),k,4,fill=BG,outline=FG,w=4)
        if variant and variant[-1:].isdigit():
            n=variant[-1]; f=font(sc(14,k)); b=d.textbbox((0,0),n,font=f); d.text((sc(50,k)-(b[2]-b[0])/2,sc(44,k)),n,font=f,fill=FG)
        elif variant=='clear': line(d,(25,31,47,52),k,fill=RED,w=4); line(d,(47,31,25,52),k,fill=RED,w=4)
    elif kind=='snippet':
        rr(d,(14,18,58,54),k,6,outline=FG,w=4); line(d,(22,29,50,29),k,fill=FG,w=3); line(d,(22,37,45,37),k,fill=SOFT,w=3); line(d,(22,45,39,45),k,fill=SOFT,w=3)
    elif kind=='capture':
        if variant=='full': rr(d,(15,17,57,55),k,4,outline=FG,w=4); rr(d,(24,26,48,46),k,3,fill=FG)
        elif variant=='window': rr(d,(15,18,57,54),k,5,outline=FG,w=4); rr(d,(24,27,48,46),k,2,outline=FG,w=3)
        elif variant=='folder': rr(d,(13,25,59,55),k,5,outline=FG,w=4); rr(d,(17,18,36,29),k,3,fill=FG)
        else:
            line(d,(28,17,18,17,18,27),k,w=4); line(d,(44,17,54,17,54,27),k,w=4); line(d,(28,55,18,55,18,45),k,w=4); line(d,(44,55,54,55,54,45),k,w=4); d.ellipse((sc(32,k),sc(32,k),sc(40,k),sc(40,k)),fill=FG)
    elif kind=='media':
        if variant in ('volume-down','volume-up','mute'):
            d.polygon([(sc(14,k),sc(31,k)),(sc(25,k),sc(31,k)),(sc(38,k),sc(21,k)),(sc(38,k),sc(51,k)),(sc(25,k),sc(41,k)),(sc(14,k),sc(41,k))],fill=FG)
            if variant=='mute': line(d,(46,28,59,44),k,w=4); line(d,(59,28,46,44),k,w=4)
            elif variant=='volume-down': line(d,(47,36,60,36),k,w=4)
            else: line(d,(47,36,60,36),k,w=4); line(d,(53,30,53,42),k,w=4)
        elif variant=='previous': d.polygon([(sc(47,k),sc(20,k)),(sc(25,k),sc(36,k)),(sc(47,k),sc(52,k))],fill=FG); line(d,(20,20,20,52),k,w=4)
        elif variant=='next': d.polygon([(sc(25,k),sc(20,k)),(sc(47,k),sc(36,k)),(sc(25,k),sc(52,k))],fill=FG); line(d,(52,20,52,52),k,w=4)
        else: d.polygon([(sc(26,k),sc(19,k)),(sc(55,k),sc(36,k)),(sc(26,k),sc(53,k))],fill=FG)
    elif kind=='system':
        if variant=='desktop': rr(d,(12,18,60,49),k,4,outline=FG,w=4); line(d,(28,56,44,56),k,w=4); line(d,(36,49,36,56),k,w=4)
        elif variant=='task': rr(d,(16,14,56,58),k,5,outline=FG,w=4); line(d,(24,27,48,27),k,w=3); line(d,(24,36,44,36),k,w=3); line(d,(24,45,39,45),k,w=3)
        elif variant=='settings':
            d.ellipse((sc(24,k),sc(24,k),sc(48,k),sc(48,k)),outline=FG,width=max(1,sc(4,k))); d.ellipse((sc(32,k),sc(32,k),sc(40,k),sc(40,k)),fill=FG)
            for a,b,c,e in [(34,12,38,22),(34,50,38,60),(12,34,22,38),(50,34,60,38)]: rr(d,(a,b,c,e),k,2,fill=FG)
        elif variant=='lock': rr(d,(20,31,52,57),k,4,outline=FG,w=4); d.arc((sc(25,k),sc(15,k),sc(47,k),sc(43,k)),180,360,fill=FG,width=max(1,sc(4,k)))
        elif variant=='explorer': rr(d,(12,25,60,55),k,5,outline=FG,w=4); rr(d,(16,18,35,29),k,3,fill=FG)
        else: rr(d,(18,18,54,54),k,6,outline=FG,w=4)
    elif kind=='nav':
        if variant=='home':
            d.polygon([(sc(12,k),sc(35,k)),(sc(36,k),sc(16,k)),(sc(60,k),sc(35,k))],fill=FG); rr(d,(20,33,52,57),k,3,fill=FG); rr(d,(32,41,40,57),k,1,fill=BG)
        elif variant=='utilities':
            for y,x in ((22,28),(36,45),(50,23)): line(d,(15,y,57,y),k,fill=FG,w=3); d.ellipse((sc(x-4,k),sc(y-4,k),sc(x+4,k),sc(y+4,k)),fill=FG)
        else:
            rr(d,(14,17,58,55),k,5,outline=FG,w=4); line(d,(36,18,36,54),k,w=3); line(d,(15,36,57,36),k,w=3)


def render_key(kind,label,variant='',size=144):
    im=Image.new('RGBA',(size,size),BG)
    icon_size=int(size*.53); icon=Image.new('RGBA',(icon_size,icon_size),(0,0,0,0)); draw_symbol(icon,kind,variant)
    x=(size-icon_size)//2; y=int(size*.08); im.alpha_composite(icon,(x,y))
    d=ImageDraw.Draw(im); f=fit_font(d,label,size-20,19,11); b=d.textbbox((0,0),label,font=f); tw=b[2]-b[0]; th=b[3]-b[1]
    tx=(size-tw)/2; ty=size-22-th/2
    d.text((tx,ty-b[1]),label,font=f,fill=FG)
    return im


def render_action_icon(kind,variant,size):
    ss=size*4; im=Image.new('RGBA',(ss,ss),(0,0,0,0)); draw_symbol(im,kind,variant); return im.resize((size,size),Image.Resampling.LANCZOS)


def status_key(label,ok=True,size=144):
    im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); c=ACCENT if ok else RED
    if ok:
        line(d,(43,68,61,86,100,47),size/144.0,fill=c,w=7)
    else:
        line(d,(49,51,95,97),size/144.0,fill=c,w=7); line(d,(95,51,49,97),size/144.0,fill=c,w=7)
    f=fit_font(d,label,size-20,18,10); b=d.textbbox((0,0),label,font=f); d.text(((size-(b[2]-b[0]))/2,size-28-b[1]),label,font=f,fill=FG)
    return im


def save_png(im,path):
    path.parent.mkdir(parents=True,exist_ok=True); im.save(path)


def generate_icons(plugin):
    action_defaults={
        'smart-app':('app','APP',''), 'workspace':('workspace','WORK',''), 'window':('window','WINDOW','left'),
        'clipboard':('clipboard','CLIP','clip1'), 'snippet':('snippet','SNIP',''), 'capture':('capture','SHOT','region'),
        'media':('media','MEDIA','play'), 'system':('system','SYSTEM','desktop'), 'navigation':('nav','MORE','windows')
    }
    for name,(kind,label,variant) in action_defaults.items():
        out=plugin/'imgs'/'actions'/name; out.mkdir(parents=True,exist_ok=True)
        for size,sfx in ((20,''),(40,'@2x')): save_png(render_action_icon(kind,variant,size),out/f'icon{sfx}.png')
        for size,sfx in ((72,''),(144,'@2x')): save_png(render_key(kind,label,variant,size),out/f'key{sfx}.png')

    key_specs={
        'work':('workspace','WORK',''), 'web':('web','WEB',''), 'discord':('discord','DISCORD',''), 'spotify':('spotify','SPOTIFY',''),
        'shot':('capture','SHOT','region'), 'shot-full':('capture','FULL','full'), 'shot-window':('capture','WINDOW','window'), 'shots-folder':('capture','SHOTS','folder'),
        'left':('window','LEFT','left'), 'right':('window','RIGHT','right'), 'max':('window','MAX','maximize'), 'restore':('window','RESTORE','restore'),
        'center':('window','CENTER','center'), 'top-left':('window','TOP L','top-left'), 'top-right':('window','TOP R','top-right'),
        'bottom-left':('window','BOT L','bottom-left'), 'bottom-right':('window','BOT R','bottom-right'), 'screen':('window','SCREEN','next-monitor'),
        'minimize':('window','MIN','minimize'), 'topmost':('window','PIN','topmost'),
        'clip1':('clipboard','CLIP 1','clip1'), 'clip2':('clipboard','CLIP 2','clip2'), 'clip3':('clipboard','CLIP 3','clip3'), 'clip4':('clipboard','CLIP 4','clip4'), 'clip-clear':('clipboard','CLEAR','clear'),
        'snippet':('snippet','SNIP',''),
        'mute':('media','MUTE','mute'), 'vol-down':('media','VOL -','volume-down'), 'vol-up':('media','VOL +','volume-up'), 'play':('media','PLAY','play'), 'previous':('media','PREV','previous'), 'next':('media','NEXT','next'),
        'desktop':('system','DESKTOP','desktop'), 'task':('system','TASKS','task'), 'settings':('system','SETTINGS','settings'), 'lock':('system','LOCK','lock'), 'explorer':('system','FILES','explorer'),
        'home':('nav','HOME','home'), 'windows':('nav','WINDOWS','windows'), 'utilities':('nav','TOOLS','utilities')
    }
    keys=plugin/'imgs'/'keys'; keys.mkdir(parents=True,exist_ok=True)
    for name,(kind,label,variant) in key_specs.items(): save_png(render_key(kind,label,variant,144),keys/f'{name}.png')

    status=plugin/'imgs'/'status'; status.mkdir(parents=True,exist_ok=True)
    for name,label,ok in [('opened','OPEN',True),('focused','FOCUS',True),('ready','READY',True),('pasted','PASTED',True),('cleared','CLEARED',True),('done','DONE',True),('empty','EMPTY',False),('failed','FAILED',False),('partial','PARTIAL',False)]:
        save_png(status_key(label,ok),status/f'{name}.png')

    pdir=plugin/'imgs'/'plugin'; pdir.mkdir(parents=True,exist_ok=True)
    for size,sfx in ((256,''),(512,'@2x')):
        im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); f=font(int(size*.48)); text='P'; b=d.textbbox((0,0),text,font=f); d.text(((size-(b[2]-b[0]))/2,size*.48-(b[1]+b[3])/2),text,font=f,fill=FG); dot=size*.11; d.rounded_rectangle((size*.72,size*.16,size*.72+dot,size*.16+dot),radius=dot*.25,fill=ACCENT); save_png(im,pdir/f'marketplace{sfx}.png')
    for size,sfx in ((28,''),(56,'@2x')):
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); f=font(int(size*.68)); b=d.textbbox((0,0),'P',font=f); d.text(((size-(b[2]-b[0]))/2,(size-(b[3]-b[1]))/2-b[1]),'P',font=f,fill=FG); dot=max(3,int(size*.18)); d.rounded_rectangle((size-dot-1,1,size-1,dot+1),radius=max(1,dot//4),fill=ACCENT); save_png(im,pdir/f'category{sfx}.png')


def base32_num(n):
    alphabet='0123456789abcdefghijklmnopqrstuv'
    if n==0: return '0'
    out=''
    while n: out=alphabet[n%32]+out; n//=32
    return out

def profile_folder_id(page_uuid):
    h=page_uuid.replace('-','')+'000'; groups=[h[i:i+5] for i in range(0,len(h)-4,5)]
    return (''.join(base32_num(int(g,16)).rjust(4,'0') for g in groups)[:26].upper().replace('V','W').replace('U','V')+'Z')


def action(slug,settings,image,display):
    return {'ActionID':str(uuid.uuid4()),'LinkedTitle':False,'Name':display,'UUID':f'com.packrat.stream-deck-ultimate-bundle.{slug}','Settings':settings,'State':0,'States':[{'Title':'','Image':'state0.png','ShowTitle':False,'TitleAlignment':'bottom','TitleColor':'#FFFFFF','FontFamily':'Arial','FontSize':10,'FontStyle':'Bold','FontUnderline':False}], '_image':image}


def profile_specs():
    home={
      '0,0':action('workspace',{'apps':'@browser\n@discord\n@spotify','arrange':True,'layout':'work'},'work','Workspace'),
      '1,0':action('smart-app',{'role':'browser','behavior':'focus'},'web','Web'),
      '2,0':action('smart-app',{'role':'discord','behavior':'focus'},'discord','Discord'),
      '3,0':action('smart-app',{'role':'spotify','behavior':'focus'},'spotify','Spotify'),
      '4,0':action('capture',{'mode':'region'},'shot','Capture'),
      '0,1':action('window',{'mode':'left'},'left','Window Left'), '1,1':action('window',{'mode':'right'},'right','Window Right'),
      '2,1':action('window',{'mode':'maximize'},'max','Maximize'), '3,1':action('window',{'mode':'next-monitor'},'screen','Next Screen'),
      '4,1':action('media',{'mode':'mute'},'mute','Mute'),
      '0,2':action('clipboard',{'mode':'slot','slot':1},'clip1','Clipboard'), '1,2':action('media',{'mode':'play-pause'},'play','Play Pause'),
      '2,2':action('navigation',{'profile':'profiles/Stream Deck Ultimate - Windows'},'windows','Windows'),
      '3,2':action('media',{'mode':'volume-down'},'vol-down','Volume Down'), '4,2':action('media',{'mode':'volume-up'},'vol-up','Volume Up')
    }
    windows={
      '0,0':action('window',{'mode':'left'},'left','Left'), '1,0':action('window',{'mode':'right'},'right','Right'), '2,0':action('window',{'mode':'maximize'},'max','Max'), '3,0':action('window',{'mode':'restore'},'restore','Restore'), '4,0':action('navigation',{'profile':'profiles/Stream Deck Ultimate - Home'},'home','Home'),
      '0,1':action('window',{'mode':'top-left'},'top-left','Top Left'), '1,1':action('window',{'mode':'top-right'},'top-right','Top Right'), '2,1':action('window',{'mode':'center'},'center','Center'), '3,1':action('window',{'mode':'bottom-left'},'bottom-left','Bottom Left'), '4,1':action('window',{'mode':'bottom-right'},'bottom-right','Bottom Right'),
      '0,2':action('window',{'mode':'minimize'},'minimize','Minimize'), '1,2':action('window',{'mode':'topmost'},'topmost','Always On Top'), '2,2':action('window',{'mode':'next-monitor'},'screen','Next Screen'), '3,2':action('workspace',{'apps':'@browser\n@discord\n@spotify','arrange':True,'layout':'work'},'work','Workspace'), '4,2':action('navigation',{'profile':'profiles/Stream Deck Ultimate - Utilities'},'utilities','Utilities')
    }
    utilities={
      '0,0':action('capture',{'mode':'region'},'shot','Region'), '1,0':action('capture',{'mode':'full'},'shot-full','Full Screen'), '2,0':action('capture',{'mode':'window'},'shot-window','Active Window'), '3,0':action('capture',{'mode':'folder'},'shots-folder','Screenshots'), '4,0':action('navigation',{'profile':'profiles/Stream Deck Ultimate - Home'},'home','Home'),
      '0,1':action('clipboard',{'mode':'slot','slot':1},'clip1','Clip 1'), '1,1':action('clipboard',{'mode':'slot','slot':2},'clip2','Clip 2'), '2,1':action('clipboard',{'mode':'slot','slot':3},'clip3','Clip 3'), '3,1':action('clipboard',{'mode':'slot','slot':4},'clip4','Clip 4'), '4,1':action('clipboard',{'mode':'clear'},'clip-clear','Clear Clipboard History'),
      '0,2':action('snippet',{'text':'','restoreClipboard':True},'snippet','Snippet'), '1,2':action('media',{'mode':'previous'},'previous','Previous'), '2,2':action('media',{'mode':'play-pause'},'play','Play Pause'), '3,2':action('media',{'mode':'next'},'next','Next'), '4,2':action('system',{'mode':'desktop'},'desktop','Show Desktop')
    }
    return [('Stream Deck Ultimate - Home',home),('Stream Deck Ultimate - Windows',windows),('Stream Deck Ultimate - Utilities',utilities)]


def build_profile(plugin,name,spec):
    root_id=str(uuid.uuid4()).upper(); page_id=str(uuid.uuid4()); folder_id=profile_folder_id(page_id); root=f'{root_id}.sdProfile'
    actions={}; images={}
    for coord,item in spec.items():
        item=dict(item); image=item.pop('_image'); actions[coord]=item; images[coord]=Image.open(plugin/'imgs'/'keys'/f'{image}.png').convert('RGBA')
    top={'Name':name,'Pages':{'Current':page_id,'Pages':[page_id]},'Version':'2.0'}; page={'Controllers':[{'Actions':actions,'Type':'Keypad'}]}
    target=plugin/'profiles'/f'{name}.streamDeckProfile'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr(f'{root}/manifest.json',json.dumps(top,separators=(',',':'))); z.writestr(f'{root}/Profiles/{folder_id}/manifest.json',json.dumps(page,separators=(',',':')))
        for coord,im in images.items():
            b=io.BytesIO(); im.save(b,'PNG'); z.writestr(f'{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png',b.getvalue())
    validate_profile(target,page_id,folder_id)
    return target


def validate_profile(target,page_id,folder_id):
    with zipfile.ZipFile(target) as z:
        names=z.namelist(); roots={n.split('/')[0] for n in names if '/' in n}; assert len(roots)==1; root=next(iter(roots)); top=json.loads(z.read(f'{root}/manifest.json'))
        assert top['Version']=='2.0' and 'Device' not in top and top['Pages']['Current']==page_id
        page_path=f'{root}/Profiles/{folder_id}/manifest.json'; assert page_path in names; page=json.loads(z.read(page_path)); actions=page['Controllers'][0]['Actions']; assert len(actions)==15
        for coord,a in actions.items():
            assert a['UUID'].startswith('com.packrat.stream-deck-ultimate-bundle.'); assert a['States'][0]['Image']=='state0.png'; assert a['States'][0]['ShowTitle'] is False
            image=f'{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png'; assert image in names
            with z.open(image) as f: assert Image.open(f).size==(144,144)


def preview(plugin,name,spec,out):
    canvas=Image.new('RGBA',(5*156,3*156+38),(24,26,30,255)); d=ImageDraw.Draw(canvas); f=font(22); d.text((12,8),name,font=f,fill=FG)
    for coord,item in spec.items():
        x,y=map(int,coord.split(',')); key=Image.open(plugin/'imgs'/'keys'/f"{item['_image']}.png").convert('RGBA'); canvas.alpha_composite(key,(x*156+6,y*156+38))
    out.parent.mkdir(parents=True,exist_ok=True); canvas.save(out)


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); plugin=ns.plugin.resolve(); generate_icons(plugin)
    profiles=plugin/'profiles'; shutil.rmtree(profiles,ignore_errors=True); profiles.mkdir(parents=True,exist_ok=True)
    prev=plugin.parent/'previews'; shutil.rmtree(prev,ignore_errors=True); prev.mkdir(parents=True,exist_ok=True)
    for name,spec in profile_specs(): build_profile(plugin,name,spec); preview(plugin,name,spec,prev/(name.lower().replace(' ','-')+'.png'))
    print('generated 3 profiles, deterministic key art, status art, and previews')

if __name__=='__main__': main()
