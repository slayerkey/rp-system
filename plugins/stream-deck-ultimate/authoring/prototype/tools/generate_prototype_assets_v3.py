from pathlib import Path
import argparse, json, uuid, zipfile, io
from PIL import Image, ImageDraw

BG=(10,12,15,255)
FG=(246,248,250,255)
SOFT=(142,151,161,255)
ACCENT=(43,232,106,255)


def sc(v,k): return int(round(v*k))

def line(d, pts, k, fill=FG, width=4):
    d.line(tuple(sc(v,k) for v in pts), fill=fill, width=max(1,sc(width,k)), joint='curve')

def rr(d, box, k, radius=4, fill=None, outline=None, width=3):
    d.rounded_rectangle(tuple(sc(v,k) for v in box), radius=max(1,sc(radius,k)), fill=fill, outline=outline, width=max(1,sc(width,k)))

def symbol(im, kind, variant=''):
    size=im.size[0]; k=size/72.0; d=ImageDraw.Draw(im)
    if kind=='workspace':
        rr(d,(14,18,33,34),k,3,outline=FG,width=4)
        rr(d,(39,18,58,34),k,3,outline=FG,width=4)
        rr(d,(14,40,58,55),k,3,outline=FG,width=4)
    elif kind=='app':
        rr(d,(15,17,54,55),k,6,outline=FG,width=4)
        d.ellipse((sc(22,k),sc(24,k),sc(28,k),sc(30,k)),fill=FG)
    elif kind=='browser':
        d.ellipse((sc(15,k),sc(15,k),sc(57,k),sc(57,k)),outline=FG,width=max(1,sc(4,k)))
        line(d,(36,16,36,56),k,width=3)
        line(d,(16,36,56,36),k,width=3)
        d.arc((sc(24,k),sc(15,k),sc(48,k),sc(57,k)),90,270,fill=FG,width=max(1,sc(3,k)))
        d.arc((sc(24,k),sc(15,k),sc(48,k),sc(57,k)),-90,90,fill=FG,width=max(1,sc(3,k)))
    elif kind=='chat':
        rr(d,(13,17,59,49),k,7,outline=FG,width=4)
        d.polygon([(sc(22,k),sc(48,k)),(sc(32,k),sc(48,k)),(sc(22,k),sc(57,k))],fill=FG)
        for x in (26,36,46): d.ellipse((sc(x-2,k),sc(31,k),sc(x+2,k),sc(35,k)),fill=FG)
    elif kind=='music':
        line(d,(31,18,31,48),k,width=5)
        line(d,(31,19,52,15,52,43),k,width=5)
        d.ellipse((sc(18,k),sc(43,k),sc(32,k),sc(56,k)),fill=FG)
        d.ellipse((sc(39,k),sc(38,k),sc(53,k),sc(51,k)),fill=FG)
    elif kind=='window':
        rr(d,(13,16,59,55),k,5,outline=FG,width=4)
        if variant=='left':
            d.rectangle((sc(17,k),sc(20,k),sc(34,k),sc(51,k)),fill=FG)
        elif variant=='right':
            d.rectangle((sc(38,k),sc(20,k),sc(55,k),sc(51,k)),fill=FG)
        elif variant=='maximize':
            d.rectangle((sc(18,k),sc(21,k),sc(54,k),sc(50,k)),outline=FG,width=max(1,sc(3,k)))
        elif variant=='monitor':
            rr(d,(11,18,43,47),k,4,outline=FG,width=3)
            rr(d,(30,25,61,54),k,4,outline=FG,width=3)
            line(d,(43,36,53,36),k,width=3)
            line(d,(49,31,54,36,49,41),k,width=3)
        else:
            line(d,(36,18,36,53),k,width=3)
    elif kind=='clipboard':
        rr(d,(19,18,53,56),k,5,outline=FG,width=4)
        rr(d,(27,12,45,24),k,4,fill=BG,outline=FG,width=4)
        if variant and variant[-1:].isdigit():
            n=variant[-1]
            rr(d,(44,43,61,60),k,5,fill=BG,outline=FG,width=3)
            if n=='1': line(d,(52,47,52,56),k,width=3)
            elif n=='2': line(d,(48,48,56,48,56,51,48,56,56,56),k,width=2)
            elif n=='3': line(d,(48,48,56,48,52,52,56,53,56,56,48,56),k,width=2)
            elif n=='4': line(d,(48,48,48,53,56,53,56,48,56,56),k,width=2)
    elif kind=='capture':
        line(d,(28,17,18,17,18,27),k,width=4)
        line(d,(44,17,54,17,54,27),k,width=4)
        line(d,(28,55,18,55,18,45),k,width=4)
        line(d,(44,55,54,55,54,45),k,width=4)
    elif kind=='media':
        if variant=='play':
            d.polygon([(sc(27,k),sc(20,k)),(sc(55,k),sc(36,k)),(sc(27,k),sc(52,k))],fill=FG)
        elif variant=='vol-down':
            d.polygon([(sc(16,k),sc(31,k)),(sc(27,k),sc(31,k)),(sc(40,k),sc(21,k)),(sc(40,k),sc(51,k)),(sc(27,k),sc(41,k)),(sc(16,k),sc(41,k))],fill=FG)
            line(d,(47,36,60,36),k,width=4)
        elif variant=='vol-up':
            d.polygon([(sc(16,k),sc(31,k)),(sc(27,k),sc(31,k)),(sc(40,k),sc(21,k)),(sc(40,k),sc(51,k)),(sc(27,k),sc(41,k)),(sc(16,k),sc(41,k))],fill=FG)
            line(d,(47,36,60,36),k,width=4); line(d,(53,30,53,42),k,width=4)
        else:
            d.polygon([(sc(14,k),sc(31,k)),(sc(25,k),sc(31,k)),(sc(38,k),sc(21,k)),(sc(38,k),sc(51,k)),(sc(25,k),sc(41,k)),(sc(14,k),sc(41,k))],fill=FG)
            line(d,(46,28,59,44),k,width=4); line(d,(59,28,46,44),k,width=4)


def render_key(kind,variant,size):
    ss=size*4
    im=Image.new('RGBA',(ss,ss),BG)
    symbol(im,kind,variant)
    return im.resize((size,size),Image.Resampling.LANCZOS)

def render_action_icon(kind,size):
    ss=size*4
    im=Image.new('RGBA',(ss,ss),(0,0,0,0))
    symbol(im,kind)
    return im.resize((size,size),Image.Resampling.LANCZOS)

def icons(plugin):
    kinds={'smart-app':'app','workspace':'workspace','window':'window','clipboard':'clipboard','capture':'capture','media':'media'}
    for name,kind in kinds.items():
        out=plugin/'imgs'/'actions'/name; out.mkdir(parents=True,exist_ok=True)
        for size,sfx in ((20,''),(40,'@2x')): render_action_icon(kind,size).save(out/f'icon{sfx}.png')
        for size,sfx in ((72,''),(144,'@2x')): render_key(kind,'',size).save(out/f'key{sfx}.png')
    out=plugin/'imgs'/'plugin'; out.mkdir(parents=True,exist_ok=True)
    for size,sfx in ((256,''),(512,'@2x')):
        im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im)
        cell=size*.14; gap=size*.055; start=(size-(3*cell+2*gap))/2
        for r in range(3):
            for c in range(3):
                x=start+c*(cell+gap); y=start+r*(cell+gap)
                d.rounded_rectangle((x,y,x+cell,y+cell),radius=cell*.22,fill=ACCENT if (r,c)==(1,1) else FG)
        im.save(out/f'marketplace{sfx}.png')
    for size,sfx in ((28,''),(56,'@2x')):
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im)
        cell=size*.18; gap=size*.06; start=(size-(3*cell+2*gap))/2
        for r in range(3):
            for c in range(3):
                x=start+c*(cell+gap); y=start+r*(cell+gap)
                d.rounded_rectangle((x,y,x+cell,y+cell),radius=max(1,int(cell*.22)),fill=ACCENT if (r,c)==(1,1) else FG)
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
    name='Stream Deck Ultimate Bundle - Windows'
    root_id=str(uuid.uuid4()).upper(); page_id=str(uuid.uuid4()); folder_id=profile_folder_id(page_id); root=f'{root_id}.sdProfile'
    def state(title):
        return {'Title':title,'Image':'state0.png','ShowTitle':True,'TitleAlignment':'bottom','TitleColor':'#FFFFFF','FontFamily':'Arial','FontSize':11,'FontStyle':'Bold','FontUnderline':False}
    specs={
      '0,0':('Workspace','workspace',{'label':'WORK','apps':'@browser\n@chat\n@music'},'WORK','workspace',''),
      '1,0':('Smart App','smart-app',{'role':'browser','label':'BROWSER','path':''},'BROWSER','browser',''),
      '2,0':('Smart App','smart-app',{'role':'chat','label':'DISCORD','path':''},'DISCORD','chat',''),
      '3,0':('Smart App','smart-app',{'role':'music','label':'SPOTIFY','path':''},'SPOTIFY','music',''),
      '4,0':('Capture','capture',{},'CAPTURE','capture',''),
      '0,1':('Window Control','window',{'mode':'left'},'LEFT','window','left'),
      '1,1':('Window Control','window',{'mode':'right'},'RIGHT','window','right'),
      '2,1':('Window Control','window',{'mode':'maximize'},'MAX','window','maximize'),
      '3,1':('Window Control','window',{'mode':'next-monitor'},'NEXT\nSCREEN','window','monitor'),
      '4,1':('Media Control','media',{'mode':'mute'},'MUTE','media','mute'),
      '0,2':('Clipboard Slot','clipboard',{'slot':1},'CLIP 1','clipboard','clip1'),
      '1,2':('Clipboard Slot','clipboard',{'slot':2},'CLIP 2','clipboard','clip2'),
      '2,2':('Media Control','media',{'mode':'volume-down'},'VOL −','media','vol-down'),
      '3,2':('Media Control','media',{'mode':'volume-up'},'VOL +','media','vol-up'),
      '4,2':('Media Control','media',{'mode':'play-pause'},'PLAY','media','play')}
    actions={}; custom={}
    for coord,(display,slug,settings,title,kind,variant) in specs.items():
        actions[coord]={
            'ActionID':str(uuid.uuid4()),'LinkedTitle':True,'Name':display,
            'UUID':f'com.packrat.stream-deck-ultimate-bundle.{slug}',
            'Settings':settings,'State':0,'States':[state(title)]
        }
        custom[coord]=render_key(kind,variant,144)
    top={'Name':name,'Pages':{'Current':page_id,'Pages':[page_id]},'Version':'2.0'}
    page={'Controllers':[{'Actions':actions,'Type':'Keypad'}]}
    out=plugin/'profiles'; out.mkdir(parents=True,exist_ok=True); target=out/f'{name}.streamDeckProfile'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr(f'{root}/manifest.json',json.dumps(top,separators=(',',':')))
        z.writestr(f'{root}/Profiles/{folder_id}/manifest.json',json.dumps(page,separators=(',',':')))
        for coord,im in custom.items():
            b=io.BytesIO(); im.save(b,'PNG')
            z.writestr(f'{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png',b.getvalue())
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
            assert a['States'][0]['Image']=='state0.png'
            image=f'{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png'
            assert image in names
            with z.open(image) as f:
                im=Image.open(f); assert im.size==(144,144)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); plugin=ns.plugin.resolve(); icons(plugin); print(profile(plugin))

if __name__=='__main__': main()
