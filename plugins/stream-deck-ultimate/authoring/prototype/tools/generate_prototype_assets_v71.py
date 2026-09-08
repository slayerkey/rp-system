from pathlib import Path
import argparse, shutil
from PIL import Image, ImageDraw
import generate_prototype_assets_v4 as v4
import generate_prototype_assets_v5 as v5
import generate_prototype_assets_v7 as v7

BG=v5.BG; FG=v5.FG; SOFT=v4.SOFT; ACCENT=v5.ACCENT

def save(im,p): p.parent.mkdir(parents=True,exist_ok=True); im.save(p)

def brand_mark(size, transparent=False):
    """Compact PackRat rat + package mark designed to survive the 28px sidebar size."""
    bg=(0,0,0,0) if transparent else BG
    im=Image.new('RGBA',(size,size),bg); d=ImageDraw.Draw(im)
    k=size/256.0; S=lambda v:int(round(v*k)); W=lambda v:max(1,S(v))
    # Rounded brand container used in current PackRat marketplace footers.
    d.rounded_rectangle((S(29),S(29),S(227),S(227)),radius=S(43),outline=FG,width=W(12))
    # Tail sits behind the body and gives the silhouette an unmistakable rodent read.
    d.arc((S(42),S(115),S(144),S(211)),75,275,fill=FG,width=W(13))
    # Body and head are deliberately chunky for tiny rendering.
    d.ellipse((S(63),S(100),S(159),S(189)),fill=FG)
    d.ellipse((S(64),S(66),S(137),S(137)),fill=FG)
    d.ellipse((S(68),S(54),S(92),S(79)),fill=FG)
    d.ellipse((S(104),S(52),S(130),S(78)),fill=FG)
    # Face cutout; transparent for sidebar art and true background for marketplace art.
    cut=(0,0,0,0) if transparent else BG
    d.ellipse((S(107),S(86),S(117),S(96)),fill=cut)
    d.ellipse((S(132),S(103),S(143),S(114)),fill=ACCENT)
    # Green package is the brand accent and overlaps the body to read as "carrying".
    d.rounded_rectangle((S(126),S(119),S(194),S(183)),radius=S(10),fill=ACCENT)
    d.line((S(160),S(121),S(160),S(181)),fill=FG,width=W(7))
    d.line((S(128),S(143),S(192),S(143)),fill=FG,width=W(7))
    # Small forepaw over the package edge.
    d.line((S(119),S(132),S(143),S(145)),fill=FG,width=W(12))
    return im

def brand_plugin_icons(plugin):
    pdir=plugin/'imgs'/'plugin'; pdir.mkdir(parents=True,exist_ok=True)
    for size,sfx in ((256,''),(512,'@2x')): save(brand_mark(size,False),pdir/f'marketplace{sfx}.png')
    for size,sfx in ((28,''),(56,'@2x')): save(brand_mark(size,True),pdir/f'category{sfx}.png')

def diagnostics_key(size=144):
    im=Image.new('RGBA',(size,size),BG); d=ImageDraw.Draw(im); k=size/144.0
    S=lambda v:int(round(v*k)); W=lambda v:max(1,S(v))
    d.rounded_rectangle((S(29),S(18),S(96),S(88)),radius=S(8),outline=FG,width=W(5))
    d.line((S(45),S(35),S(80),S(35)),fill=SOFT,width=W(4))
    # Heartbeat/report line: instantly communicates a health check rather than settings.
    d.line((S(38),S(59),S(50),S(59),S(57),S(47),S(66),S(72),S(74),S(57),S(88),S(57)),fill=ACCENT,width=W(5),joint='curve')
    f=v4.fit_font(d,'REPORT',size-20,19,10); b=d.textbbox((0,0),'REPORT',font=f); tw=b[2]-b[0]; th=b[3]-b[1]
    d.text(((size-tw)/2,size-22-th/2),'REPORT',font=f,fill=FG)
    return im

def diagnostics_icons(plugin):
    action=plugin/'imgs'/'actions'/'diagnostics'; action.mkdir(parents=True,exist_ok=True)
    for size,sfx in ((20,''),(40,'@2x')):
        im=Image.new('RGBA',(size,size),(0,0,0,0)); d=ImageDraw.Draw(im); k=size/40.0
        S=lambda v:int(round(v*k)); W=lambda v:max(1,S(v))
        d.rounded_rectangle((S(8),S(4),S(32),S(35)),radius=S(4),outline=FG,width=W(3))
        d.line((S(12),S(22),S(17),S(22),S(20),S(16),S(24),S(28),S(28),S(21)),fill=ACCENT,width=W(3),joint='curve')
        save(im,action/f'icon{sfx}.png')
    for size,sfx in ((72,''),(144,'@2x')):
        im=diagnostics_key(size); save(im,action/f'key{sfx}.png'); save(im,plugin/'imgs'/'keys'/f'diagnostics{sfx}.png')

def make_action_list_icons_white(plugin):
    """Enforce Elgato's white, monochrome, transparent action-list icon contract."""
    paths=list((plugin/'imgs'/'actions').glob('*/icon*.png'))
    paths += [plugin/'imgs'/'plugin'/'category.png', plugin/'imgs'/'plugin'/'category@2x.png']
    for path in paths:
        if not path.is_file():
            continue
        im=Image.open(path).convert('RGBA')
        im.putdata([(255,255,255,a) if a else (0,0,0,0) for _,_,_,a in im.getdata()])
        save(im,path)

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('plugin',type=Path); ns=ap.parse_args(); plugin=ns.plugin.resolve()
    v4.generate_icons(plugin); v5.extra_icons(plugin); v7.extra_context_icons(plugin)
    brand_plugin_icons(plugin); diagnostics_icons(plugin)
    make_action_list_icons_white(plugin)
    profiles=plugin/'profiles'; shutil.rmtree(profiles,ignore_errors=True); profiles.mkdir(parents=True,exist_ok=True)
    prev=plugin.parent/'previews'; shutil.rmtree(prev,ignore_errors=True); prev.mkdir(parents=True,exist_ok=True)
    standard=v5.standard_specs()
    standard[0][1]['1,2']=v5.act('navigation',{'profile':'profiles/Stream Deck Ultimate - Smart'},'smart','Smart Context')
    specs=standard+[v7.smart_profile(),v5.xl_spec(),v5.plus_spec(),v5.neo_spec()]
    for entry in specs:
        if len(entry)==5: name,spec,cols,rows,device=entry; encoders=None
        else: name,spec,cols,rows,device,encoders=entry
        v5.build_profile(plugin,name,spec,cols,rows,device,encoders)
        v5.preview(plugin,name,spec,cols,rows,prev/(name.lower().replace(' ','-').replace('&','and')+'.png'))
    print('generated v0.7.1 support candidate: 8 profiles, PackRat rat/package brand mark, diagnostics art, white action-list icons')

if __name__=='__main__': main()
