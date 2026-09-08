from pathlib import Path
import argparse, shutil, sys
from PIL import Image, ImageDraw
import generate_prototype_assets_v4 as v4
import generate_prototype_assets_v5 as v5

PLUGIN=v5.PLUGIN
BG=v5.BG; FG=v5.FG; ACCENT=v5.ACCENT

def save(im,p): p.parent.mkdir(parents=True,exist_ok=True); im.save(p)

def context_key(symbol,label,size=144):
    im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); k=size/144.0
    S=lambda v:int(round(v*k)); W=lambda v:max(1,S(v))
    def line(points,w=5,fill=FG): d.line(tuple(S(v) for v in points),fill=fill,width=W(w),joint='curve')
    def rr(box,r=7,fill=None,outline=FG,w=4): d.rounded_rectangle(tuple(S(v) for v in box),radius=S(r),fill=fill,outline=outline,width=W(w))
    # Icon lives above y=102; labels share the same controlled baseline as the rest of Ultimate.
    if symbol=='smart':
        for x,y in ((34,30),(72,30),(34,68),(72,68)): rr((x-11,y-11,x+11,y+11),5,outline=FG,w=4)
        d.ellipse((S(91),S(20),S(103),S(32)),fill=ACCENT)
    elif symbol=='back':
        line((88,25,49,54,88,83),7); line((50,54,105,54),7)
    elif symbol=='new-tab':
        rr((27,25,95,79),8,outline=FG,w=5); line((68,38,68,65),5,ACCENT); line((55,52,81,52),5,ACCENT)
    elif symbol=='refresh':
        d.arc((S(31),S(22),S(96),S(87)),35,320,fill=FG,width=W(6)); d.polygon([(S(88),S(20)),(S(105),S(31)),(S(87),S(38))],fill=ACCENT)
    elif symbol=='close':
        line((42,27,91,78),7); line((91,27,42,78),7)
    elif symbol=='command':
        rr((25,24,99,82),8,outline=FG,w=5); line((39,43,51,52,39,61),5,ACCENT); line((59,64,82,64),5)
    elif symbol=='terminal':
        rr((24,24,100,82),8,outline=FG,w=5); line((39,42,53,53,39,64),5,ACCENT); line((61,65,84,65),5)
    elif symbol=='save':
        rr((31,20,92,86),7,outline=FG,w=5); rr((44,25,78,45),2,outline=FG,w=4); rr((45,58,79,80),3,outline=ACCENT,w=4)
    elif symbol=='up':
        line((36,65,66,34,96,65),7); line((66,35,66,84),7)
    elif symbol=='address':
        rr((20,34,106,72),8,outline=FG,w=5); line((35,53,75,53),5,ACCENT); d.ellipse((S(86),S(47),S(98),S(59)),outline=FG,width=W(4))
    elif symbol=='new-window':
        rr((24,30,83,78),7,outline=FG,w=5); rr((43,20,102,68),7,outline=FG,w=4); line((73,31,73,52),4,ACCENT); line((63,42,83,42),4,ACCENT)
    elif symbol=='search':
        d.ellipse((S(31),S(23),S(78),S(70)),outline=FG,width=W(6)); line((72,65,96,87),7,ACCENT)
    elif symbol=='switch':
        line((27,39,88,39),6); line((76,28,91,39,76,50),5,ACCENT); line((98,68,37,68),6); line((49,57,34,68,49,79),5,ACCENT)
    elif symbol=='discord-mute':
        rr((52,20,75,58),11,outline=FG,w=5); d.arc((S(43),S(42),S(84),S(77)),0,180,fill=FG,width=W(5)); line((63,75,63,87),5); line((46,88,81,88),5); line((34,22,91,87),6,ACCENT)
    elif symbol=='deafen':
        d.arc((S(29),S(20),S(98),S(87)),180,360,fill=FG,width=W(6)); rr((27,52,43,80),5,fill=FG,outline=FG,w=1); rr((84,52,100,80),5,fill=FG,outline=FG,w=1); line((29,24,99,87),6,ACCENT)
    else:
        return v5.premium_key('smart' if symbol=='smart' else 'setup',label,size)
    dd=ImageDraw.Draw(im); f=v4.fit_font(dd,label,size-20,19,10); b=dd.textbbox((0,0),label,font=f); tw=b[2]-b[0]; th=b[3]-b[1]
    dd.text(((size-tw)/2,size-22-th/2),label,font=f,fill=FG)
    return im

def active_variant(plugin,base):
    for size,sfx in ((72,''),(144,'@2x')):
        src=plugin/'imgs'/'keys'/f'{base}{sfx}.png'
        if not src.exists(): continue
        im=Image.open(src).convert('RGBA'); d=ImageDraw.Draw(im); r=max(4,int(size*.07)); cx=size-r-5; cy=r+5
        d.ellipse((cx-r,cy-r,cx+r,cy+r),fill=ACCENT)
        save(im,plugin/'imgs'/'keys'/f'{base}-active{sfx}.png')

def extra_context_icons(plugin):
    action=plugin/'imgs'/'actions'/'context'; action.mkdir(parents=True,exist_ok=True)
    for size,sfx in ((20,''),(40,'@2x')):
        # Tiny sidebar mark: four blocks, one active.
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); m=max(2,size//8); gap=max(2,size//10); cell=(size-2*m-gap)//2
        for i,(x,y) in enumerate(((m,m),(m+cell+gap,m),(m,m+cell+gap),(m+cell+gap,m+cell+gap))): d.rounded_rectangle((x,y,x+cell,y+cell),radius=max(1,size//12),outline=FG,width=max(1,size//12))
        d.ellipse((size-max(4,size//5)-1,1,size-1,max(4,size//5)+1),fill=ACCENT); save(im,action/f'icon{sfx}.png')
    for size,sfx in ((72,''),(144,'@2x')): save(context_key('smart','SMART',size),action/f'key{sfx}.png')
    specs={
      'smart':('smart','SMART'),'ctx-back':('back','BACK'),'ctx-new-tab':('new-tab','NEW TAB'),'ctx-refresh':('refresh','REFRESH'),'ctx-close':('close','CLOSE'),
      'ctx-command':('command','COMMAND'),'ctx-terminal':('terminal','TERMINAL'),'ctx-save':('save','SAVE'),'ctx-up':('up','UP'),'ctx-address':('address','ADDRESS'),
      'ctx-new-window':('new-window','NEW'),'ctx-search':('search','SEARCH'),'ctx-switch':('switch','SWITCH'),'ctx-discord-mute':('discord-mute','MUTE'),'ctx-deafen':('deafen','DEAFEN')
    }
    for name,(symbol,label) in specs.items():
        for size,sfx in ((72,''),(144,'@2x')): save(context_key(symbol,label,size),plugin/'imgs'/'keys'/f'{name}{sfx}.png')
    for base in ('web','discord','spotify'): active_variant(plugin,base)

def smart_profile():
    act=v5.act
    s={
      '0,0':act('context',{'slot':1,'context':'smart'},'web','Context 1'),
      '1,0':act('context',{'slot':2,'context':'smart'},'discord','Context 2'),
      '2,0':act('context',{'slot':3,'context':'smart'},'spotify','Context 3'),
      '3,0':act('context',{'slot':4,'context':'smart'},'shot','Context 4'),
      '4,0':act('navigation',{'profile':'profiles/Stream Deck Ultimate - Home'},'home','Home'),
      '0,1':act('routine',{'mode':'work'},'work','Work'),'1,1':act('routine',{'mode':'focus'},'focus','Focus'),'2,1':act('routine',{'mode':'meeting'},'meeting','Meeting'),'3,1':act('audio',{'mode':'mic-toggle'},'mic-live','Mic'),'4,1':act('audio',{'mode':'output-cycle'},'output','Output'),
      '0,2':act('clipboard',{'mode':'slot','slot':1},'clip1','Clipboard'),'1,2':act('media',{'mode':'play-pause'},'play','Play Pause'),'2,2':act('navigation',{'profile':'profiles/Stream Deck Ultimate - Windows'},'windows','Windows'),'3,2':act('navigation',{'profile':'profiles/Stream Deck Ultimate - Utilities'},'utilities','Utilities'),'4,2':act('setup',{},'setup','Setup')
    }
    return ('Stream Deck Ultimate - Smart',s,5,3,0)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); plugin=ns.plugin.resolve()
    v4.generate_icons(plugin); v5.extra_icons(plugin); extra_context_icons(plugin)
    profiles=plugin/'profiles'; shutil.rmtree(profiles,ignore_errors=True); profiles.mkdir(parents=True,exist_ok=True)
    prev=plugin.parent/'previews'; shutil.rmtree(prev,ignore_errors=True); prev.mkdir(parents=True,exist_ok=True)
    standard=v5.standard_specs()
    # Keep Home predictable: one explicit entry into Smart Context replaces only the redundant Home media shortcut.
    standard[0][1]['1,2']=v5.act('navigation',{'profile':'profiles/Stream Deck Ultimate - Smart'},'smart','Smart Context')
    specs=standard+[smart_profile(),v5.xl_spec(),v5.plus_spec(),v5.neo_spec()]
    for entry in specs:
        if len(entry)==5: name,spec,cols,rows,device=entry; encoders=None
        else: name,spec,cols,rows,device,encoders=entry
        v5.build_profile(plugin,name,spec,cols,rows,device,encoders); v5.preview(plugin,name,spec,cols,rows,prev/(name.lower().replace(' ','-').replace('&','and')+'.png'))
    print('generated 8 v0.7 profiles with optional Smart Context, active app states, premium art, dials, and previews')

if __name__=='__main__': main()
