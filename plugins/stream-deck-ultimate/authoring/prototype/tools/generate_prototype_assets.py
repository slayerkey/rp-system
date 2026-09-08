from pathlib import Path
import argparse, json, uuid, zipfile
from PIL import Image, ImageDraw

BG=(17,19,22,255); FG=(238,242,245,255); ACCENT=(43,232,106,255)

def symbol(d,s,b,c,w):
    x0,y0,x1,y1=b; W=x1-x0; H=y1-y0
    if s=='app':
        d.rounded_rectangle((x0+.15*W,y0+.18*H,x0+.70*W,y0+.75*H),radius=max(2,int(.07*W)),outline=c,width=w); d.line((x0+.54*W,y0+.47*H,x0+.88*W,y0+.47*H),fill=c,width=w); d.line((x0+.73*W,y0+.32*H,x0+.88*W,y0+.47*H,x0+.73*W,y0+.62*H),fill=c,width=w)
    elif s=='workspace':
        for a,b0,c0,e in [(.08,.18,.46,.48),(.54,.18,.92,.48),(.08,.56,.92,.84)]: d.rounded_rectangle((x0+a*W,y0+b0*H,x0+c0*W,y0+e*H),radius=max(2,int(.05*W)),outline=c,width=w)
    elif s=='window': d.rounded_rectangle((x0+.09*W,y0+.15*H,x0+.91*W,y0+.84*H),radius=max(2,int(.05*W)),outline=c,width=w); d.line((x0+.50*W,y0+.16*H,x0+.50*W,y0+.83*H),fill=c,width=w)
    elif s=='clipboard':
        d.rounded_rectangle((x0+.23*W,y0+.19*H,x0+.78*W,y0+.84*H),radius=max(2,int(.05*W)),outline=c,width=w); d.rounded_rectangle((x0+.36*W,y0+.10*H,x0+.64*W,y0+.29*H),radius=max(2,int(.04*W)),fill=BG,outline=c,width=w)
        for yy in (.43,.56,.69): d.line((x0+.34*W,y0+yy*H,x0+.68*W,y0+yy*H),fill=c,width=w)
    elif s=='capture':
        for pts in [(.15,.42,.15,.18,.39,.18),(.61,.18,.85,.18,.85,.42),(.15,.58,.15,.82,.39,.82),(.61,.82,.85,.82,.85,.58)]: d.line(tuple(v*(W if i%2==0 else H)+(x0 if i%2==0 else y0) for i,v in enumerate(pts)),fill=c,width=w)
        d.ellipse((x0+.43*W,y0+.43*H,x0+.57*W,y0+.57*H),fill=c)
    elif s=='media':
        d.polygon([(x0+.18*W,y0+.43*H),(x0+.34*W,y0+.43*H),(x0+.52*W,y0+.28*H),(x0+.52*W,y0+.72*H),(x0+.34*W,y0+.57*H),(x0+.18*W,y0+.57*H)],outline=c); d.arc((x0+.45*W,y0+.32*H,x0+.80*W,y0+.68*H),-55,55,fill=c,width=w); d.arc((x0+.42*W,y0+.21*H,x0+.92*W,y0+.79*H),-50,50,fill=c,width=w)

def icons(plugin):
    for name,s in [('smart-app','app'),('workspace','workspace'),('window','window'),('clipboard','clipboard'),('capture','capture'),('media','media')]:
        out=plugin/'imgs'/'actions'/name; out.mkdir(parents=True,exist_ok=True)
        for size,sfx in [(20,''),(40,'@2x')]:
            im=Image.new('RGBA',(size,size),(0,0,0,0)); symbol(ImageDraw.Draw(im),s,(1,1,size-1,size-1),(255,255,255,255),max(1,size//10)); im.save(out/f'icon{sfx}.png')
        for size,sfx in [(72,''),(144,'@2x')]:
            im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); d.rounded_rectangle((2,2,size-3,size-3),radius=max(6,size//12),outline=(47,52,58,255),width=max(1,size//48)); d.rectangle((size*.18,size*.12,size*.82,size*.145),fill=ACCENT); symbol(d,s,(size*.22,size*.23,size*.78,size*.79),FG,max(2,size//24)); im.save(out/f'key{sfx}.png')
    out=plugin/'imgs'/'plugin'; out.mkdir(parents=True,exist_ok=True)
    for size,sfx in [(256,''),(512,'@2x')]:
        im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); cell=size*.17; gap=size*.055; start=(size-(3*cell+2*gap))/2
        for r in range(3):
            for c in range(3):
                x=start+c*(cell+gap); y=start+r*(cell+gap); d.rounded_rectangle((x,y,x+cell,y+cell),radius=int(cell*.22),fill=ACCENT if (r,c)==(1,1) else (45,51,56,255))
        im.save(out/f'marketplace{sfx}.png')
    for size,sfx in [(28,''),(56,'@2x')]:
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); cell=size*.21; gap=size*.07; start=(size-(3*cell+2*gap))/2
        for r in range(3):
            for c in range(3):
                x=start+c*(cell+gap); y=start+r*(cell+gap); d.rounded_rectangle((x,y,x+cell,y+cell),radius=max(1,int(cell*.18)),outline=(255,255,255,255),width=max(1,size//28))
        im.save(out/f'category{sfx}.png')

def profile(plugin):
    name='Stream Deck Ultimate Bundle - Windows'; pid=str(uuid.uuid4()).upper(); pageid=str(uuid.uuid4()).upper(); root=f'{pid}.sdProfile'
    def st(t): return {'Title':t,'Image':'','ShowTitle':True,'TitleAlignment':'bottom','TitleColor':'#FFFFFF','FontFamily':'Arial','FontSize':11,'FontStyle':'Bold','FontUnderline':False}
    def a(n,slug,settings,t): return {'ActionID':str(uuid.uuid4()).upper(),'LinkedTitle':True,'Name':n,'UUID':f'com.packrat.stream-deck-ultimate-bundle.{slug}','Settings':settings,'State':0,'States':[st(t)]}
    A={
      '0,0':a('Workspace','workspace',{'label':'WORK','apps':'@browser\n@chat\n@music'},'WORK'),'1,0':a('Smart App','smart-app',{'role':'browser','label':'BROWSER','path':''},'BROWSER'),'2,0':a('Smart App','smart-app',{'role':'chat','label':'CHAT','path':''},'CHAT'),'3,0':a('Smart App','smart-app',{'role':'music','label':'MUSIC','path':''},'MUSIC'),'4,0':a('Capture','capture',{},'CAPTURE'),
      '0,1':a('Window Control','window',{'mode':'left'},'LEFT'),'1,1':a('Window Control','window',{'mode':'right'},'RIGHT'),'2,1':a('Window Control','window',{'mode':'maximize'},'MAX'),'3,1':a('Window Control','window',{'mode':'next-monitor'},'NEXT\nMONITOR'),'4,1':a('Media Control','media',{'mode':'mute'},'MUTE'),
      '0,2':a('Clipboard Slot','clipboard',{'slot':1},'CLIP 1'),'1,2':a('Clipboard Slot','clipboard',{'slot':2},'CLIP 2'),'2,2':a('Clipboard Slot','clipboard',{'slot':3},'CLIP 3'),'3,2':a('Clipboard Slot','clipboard',{'slot':4},'CLIP 4'),'4,2':a('Media Control','media',{'mode':'play-pause'},'PLAY')}
    top={'Device':{'Model':'20GAA9902','UUID':''},'Name':name,'Pages':{'Current':pageid,'Pages':[pageid]},'Version':'2.0'}; page={'Controllers':[{'Actions':A,'Type':'Keypad'}]}
    out=plugin/'profiles'; out.mkdir(parents=True,exist_ok=True); target=out/f'{name}.streamDeckProfile'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr(f'{root}/manifest.json',json.dumps(top,separators=(',',':'))); z.writestr(f'{root}/Profiles/{pageid}/manifest.json',json.dumps(page,separators=(',',':')))
    return target

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); ns.plugin=ns.plugin.resolve(); icons(ns.plugin); print(profile(ns.plugin))
if __name__=='__main__': main()
