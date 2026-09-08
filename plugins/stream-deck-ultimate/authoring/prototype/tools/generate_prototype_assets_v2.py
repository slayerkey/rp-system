from pathlib import Path
import argparse, json, uuid, zipfile, io
from PIL import Image, ImageDraw, ImageFilter

BG_TOP=(18,20,24,255)
BG_BOTTOM=(8,10,13,255)
FG=(240,243,246,255)
MUTED=(122,132,143,255)
ACCENT=(43,232,106,255)
BORDER=(54,60,68,255)


def S(v,k): return int(round(v*k))


def rounded_mask(size,radius):
    m=Image.new('L',(size,size),0)
    ImageDraw.Draw(m).rounded_rectangle((0,0,size-1,size-1),radius=radius,fill=255)
    return m


def key_bg(size):
    im=Image.new('RGBA',(size,size))
    px=im.load()
    for y in range(size):
        t=y/max(1,size-1)
        c=tuple(int(BG_TOP[i]*(1-t)+BG_BOTTOM[i]*t) for i in range(4))
        for x in range(size): px[x,y]=c
    out=Image.new('RGBA',(size,size),(0,0,0,0))
    out.paste(im,(0,0),rounded_mask(size,max(8,size//10)))
    d=ImageDraw.Draw(out)
    d.rounded_rectangle((1,1,size-2,size-2),radius=max(8,size//10),outline=BORDER,width=max(1,size//48))
    d.rounded_rectangle((4,4,size-5,size-5),radius=max(7,size//11),outline=(24,28,33,255),width=max(1,size//72))
    return out


def draw_symbol(im,kind,variant=''):
    size=im.size[0]; k=size/72.0; d=ImageDraw.Draw(im)
    white=FG; accent=ACCENT; muted=MUTED
    def rr(box,r,fill=None,outline=None,width=1):
        d.rounded_rectangle(tuple(S(v,k) for v in box),radius=S(r,k),fill=fill,outline=outline,width=max(1,S(width,k)))
    def line(points,fill=white,width=4):
        d.line(tuple(S(v,k) for v in points),fill=fill,width=max(1,S(width,k)),joint='curve')

    if kind=='workspace':
        rr((14,17,37,54),5,fill=(226,231,236,255)); rr((42,17,58,32),4,fill=accent); rr((42,37,58,54),4,fill=(83,91,101,255)); rr((18,22,33,49),3,fill=(25,29,34,255))
    elif kind=='app':
        rr((12,18,48,52),6,fill=(224,229,234,255)); rr((16,22,44,48),4,fill=(25,29,34,255)); d.polygon([(S(42,k),S(30,k)),(S(60,k),S(36,k)),(S(42,k),S(42,k))],fill=accent); rr((18,26,34,30),2,fill=(93,104,115,255)); rr((18,34,30,38),2,fill=(93,104,115,255))
    elif kind=='window':
        rr((11,15,61,56),6,outline=white,width=4)
        if variant=='left': rr((15,19,34,52),3,fill=accent)
        elif variant=='right': rr((38,19,57,52),3,fill=accent)
        elif variant=='maximize': rr((16,20,56,51),3,fill=accent)
        elif variant=='monitor':
            rr((16,20,56,47),3,fill=(42,48,55,255)); line((23,57,49,57),fill=muted,width=3); line((36,47,36,57),fill=muted,width=3); d.polygon([(S(47,k),S(29,k)),(S(60,k),S(36,k)),(S(47,k),S(43,k))],fill=accent)
        else: line((36,17,36,54),width=3)
    elif kind=='clipboard':
        rr((18,16,54,57),6,fill=(224,229,234,255)); rr((26,11,46,24),5,fill=accent); rr((23,26,49,52),3,fill=(26,30,35,255))
        for yy in (32,38,44): rr((27,yy,45,yy+2),1,fill=(115,126,138,255))
        if variant and variant[-1:].isdigit():
            n=variant[-1]; rr((45,44,61,60),5,fill=(27,31,36,255),outline=accent,width=2)
            if n=='1': line((53,48,53,56),fill=accent,width=3)
            elif n=='2': line((49,49,56,49,56,52,49,56,56,56),fill=accent,width=2)
            elif n=='3': line((49,49,56,49,53,52,56,54,56,56,49,56),fill=accent,width=2)
            elif n=='4': line((49,49,49,53,56,53,56,49,56,56),fill=accent,width=2)
    elif kind=='capture':
        line((28,18,20,18,20,26),width=4); line((44,18,52,18,52,26),width=4); line((28,54,20,54,20,46),width=4); line((44,54,52,54,52,46),width=4); rr((30,30,42,42),4,fill=accent)
    elif kind=='media':
        d.polygon([(S(15,k),S(30,k)),(S(26,k),S(30,k)),(S(38,k),S(21,k)),(S(38,k),S(51,k)),(S(26,k),S(42,k)),(S(15,k),S(42,k))],fill=white)
        if variant=='play': d.polygon([(S(47,k),S(26,k)),(S(60,k),S(36,k)),(S(47,k),S(46,k))],fill=accent)
        else:
            d.arc((S(36,k),S(25,k),S(55,k),S(47,k)),-55,55,fill=accent,width=max(2,S(3,k))); d.arc((S(37,k),S(19,k),S(65,k),S(53,k)),-48,48,fill=accent,width=max(2,S(3,k)))
    elif kind=='browser':
        rr((12,16,60,55),7,outline=white,width=4); line((13,26,59,26),fill=muted,width=2); d.ellipse((S(18,k),S(18,k),S(24,k),S(24,k)),fill=accent); d.arc((S(27,k),S(31,k),S(47,k),S(49,k)),0,360,fill=accent,width=max(2,S(3,k))); line((37,31,37,49),fill=accent,width=2); line((28,40,46,40),fill=accent,width=2)
    elif kind=='chat':
        rr((12,16,60,49),8,fill=(224,229,234,255)); d.polygon([(S(23,k),S(48,k)),(S(31,k),S(48,k)),(S(22,k),S(58,k))],fill=(224,229,234,255))
        for x in (24,36,48): d.ellipse((S(x-3,k),S(30,k),S(x+3,k),S(36,k)),fill=accent if x==36 else (63,72,82,255))
    elif kind=='music':
        line((31,18,31,47),width=5); line((31,19,53,15,53,42),fill=accent,width=5); d.ellipse((S(18,k),S(42,k),S(32,k),S(55,k)),fill=white); d.ellipse((S(40,k),S(37,k),S(54,k),S(50,k)),fill=accent)


def render_key(kind,variant,size):
    ss=size*4; im=key_bg(ss); draw_symbol(im,kind,variant); return im.resize((size,size),Image.Resampling.LANCZOS)


def render_action_icon(kind,size):
    ss=size*4; im=Image.new('RGBA',(ss,ss),(0,0,0,0)); draw_symbol(im,kind); return im.resize((size,size),Image.Resampling.LANCZOS)


def icons(plugin):
    kinds={'smart-app':'app','workspace':'workspace','window':'window','clipboard':'clipboard','capture':'capture','media':'media'}
    for name,kind in kinds.items():
        out=plugin/'imgs'/'actions'/name; out.mkdir(parents=True,exist_ok=True)
        for size,sfx in ((20,''),(40,'@2x')): render_action_icon(kind,size).save(out/f'icon{sfx}.png')
        for size,sfx in ((72,''),(144,'@2x')): render_key(kind,'',size).save(out/f'key{sfx}.png')
    out=plugin/'imgs'/'plugin'; out.mkdir(parents=True,exist_ok=True)
    for size,sfx in ((256,''),(512,'@2x')):
        im=key_bg(size); d=ImageDraw.Draw(im); cell=size*.15; gap=size*.055; start=(size-(3*cell+2*gap))/2
        for r in range(3):
            for c in range(3):
                x=start+c*(cell+gap); y=start+r*(cell+gap); d.rounded_rectangle((x,y,x+cell,y+cell),radius=cell*.24,fill=ACCENT if (r,c)==(1,1) else (78,86,96,255))
        im.save(out/f'marketplace{sfx}.png')
    for size,sfx in ((28,''),(56,'@2x')):
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); cell=size*.19; gap=size*.06; start=(size-(3*cell+2*gap))/2
        for r in range(3):
            for c in range(3):
                x=start+c*(cell+gap); y=start+r*(cell+gap); d.rounded_rectangle((x,y,x+cell,y+cell),radius=max(1,int(cell*.22)),fill=ACCENT if (r,c)==(1,1) else (220,225,230,255))
        im.save(out/f'category{sfx}.png')


def base32_num(n):
    alphabet='0123456789abcdefghijklmnopqrstuv'
    if n==0: return '0'
    out=''
    while n:
        out=alphabet[n%32]+out; n//=32
    return out


def profile_folder_id(page_uuid):
    h=page_uuid.replace('-','')+'000'
    groups=[h[i:i+5] for i in range(0,len(h)-4,5)]
    return (''.join(base32_num(int(g,16)).rjust(4,'0') for g in groups)[:26].upper().replace('V','W').replace('U','V')+'Z')


def profile(plugin):
    name='Stream Deck Ultimate Bundle - Windows'; root_id=str(uuid.uuid4()).upper(); page_id=str(uuid.uuid4()); folder_id=profile_folder_id(page_id); root=f'{root_id}.sdProfile'
    def state(title): return {'Title':title,'Image':'CustomImages/state0.png','ShowTitle':True,'TitleAlignment':'bottom','TitleColor':'#FFFFFF','FontFamily':'Arial','FontSize':11,'FontStyle':'Bold','FontUnderline':False}
    specs={
      '0,0':('Workspace','workspace',{'label':'WORK','apps':'@browser\n@chat\n@music'},'WORK','workspace',''),
      '1,0':('Smart App','smart-app',{'role':'browser','label':'BROWSER','path':''},'BROWSER','browser',''),
      '2,0':('Smart App','smart-app',{'role':'chat','label':'CHAT','path':''},'CHAT','chat',''),
      '3,0':('Smart App','smart-app',{'role':'music','label':'MUSIC','path':''},'MUSIC','music',''),
      '4,0':('Capture','capture',{},'CAPTURE','capture',''),
      '0,1':('Window Control','window',{'mode':'left'},'LEFT','window','left'),
      '1,1':('Window Control','window',{'mode':'right'},'RIGHT','window','right'),
      '2,1':('Window Control','window',{'mode':'maximize'},'MAX','window','maximize'),
      '3,1':('Window Control','window',{'mode':'next-monitor'},'NEXT\nMONITOR','window','monitor'),
      '4,1':('Media Control','media',{'mode':'mute'},'MUTE','media',''),
      '0,2':('Clipboard Slot','clipboard',{'slot':1},'CLIP 1','clipboard','clip1'),
      '1,2':('Clipboard Slot','clipboard',{'slot':2},'CLIP 2','clipboard','clip2'),
      '2,2':('Clipboard Slot','clipboard',{'slot':3},'CLIP 3','clipboard','clip3'),
      '3,2':('Clipboard Slot','clipboard',{'slot':4},'CLIP 4','clipboard','clip4'),
      '4,2':('Media Control','media',{'mode':'play-pause'},'PLAY','media','play')}
    actions={}; custom={}
    for coord,(display,slug,settings,title,kind,variant) in specs.items():
        actions[coord]={'ActionID':str(uuid.uuid4()),'LinkedTitle':True,'Name':display,'UUID':f'com.packrat.stream-deck-ultimate-bundle.{slug}','Settings':settings,'State':0,'States':[state(title)]}
        custom[coord]=render_key(kind,variant,144)
    top={'Name':name,'Pages':{'Current':page_id,'Pages':[page_id]},'Version':'2.0'}
    page={'Controllers':[{'Actions':actions,'Type':'Keypad'}]}
    out=plugin/'profiles'; out.mkdir(parents=True,exist_ok=True); target=out/f'{name}.streamDeckProfile'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr(f'{root}/manifest.json',json.dumps(top,separators=(',',':')))
        z.writestr(f'{root}/Profiles/{folder_id}/manifest.json',json.dumps(page,separators=(',',':')))
        for coord,im in custom.items():
            b=io.BytesIO(); im.save(b,'PNG'); z.writestr(f'{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png',b.getvalue())
    validate_profile(target,page_id,folder_id)
    return target


def validate_profile(target,page_id,folder_id):
    with zipfile.ZipFile(target) as z:
        names=z.namelist(); roots={n.split('/')[0] for n in names if '/' in n}; assert len(roots)==1
        root=next(iter(roots)); top=json.loads(z.read(f'{root}/manifest.json'))
        assert top['Version']=='2.0' and 'Device' not in top and top['Pages']['Current']==page_id
        page_path=f'{root}/Profiles/{folder_id}/manifest.json'; assert page_path in names
        page=json.loads(z.read(page_path)); actions=page['Controllers'][0]['Actions']; assert len(actions)==15
        for coord,a in actions.items():
            assert a['UUID'].startswith('com.packrat.stream-deck-ultimate-bundle.')
            assert f'{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png' in names


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); plugin=ns.plugin.resolve(); icons(plugin); print(profile(plugin))

if __name__=='__main__': main()
