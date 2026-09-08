from pathlib import Path
import argparse, io, json, shutil, uuid, zipfile, sys
from PIL import Image, ImageDraw, ImageFont
import generate_prototype_assets_v4 as v4

BG=v4.BG; FG=v4.FG; SOFT=v4.SOFT; ACCENT=v4.ACCENT
PLUGIN="com.packrat.stream-deck-ultimate-bundle"

def save(im,p): p.parent.mkdir(parents=True,exist_ok=True); im.save(p)


def premium_key(symbol,label,size=144):
    im=Image.new("RGBA",(size,size),BG)
    icon_size=int(size*.53); icon=Image.new("RGBA",(icon_size,icon_size),(0,0,0,0)); d=ImageDraw.Draw(icon); k=icon_size/72.0
    def S(v): return int(round(v*k))
    def L(points,w=4,fill=FG): d.line(tuple(S(v) for v in points),fill=fill,width=max(1,S(w)),joint="curve")
    def RR(box,r=4,fill=None,outline=FG,w=4): d.rounded_rectangle(tuple(S(v) for v in box),radius=max(1,S(r)),fill=fill,outline=outline,width=max(1,S(w)))
    if symbol in ("mic","mic-muted"):
        RR((27,10,45,42),9,outline=FG,w=4)
        d.arc((S(19),S(25),S(53),S(54)),0,180,fill=FG,width=max(1,S(4)))
        L((36,53,36,62),4); L((27,62,45,62),4)
        if symbol=="mic-muted": L((17,14,56,57),5,fill=v4.RED)
        else: d.ellipse((S(52),S(13),S(60),S(21)),fill=ACCENT)
    elif symbol=="headphones":
        d.arc((S(13),S(12),S(59),S(56)),180,360,fill=FG,width=max(1,S(5)))
        RR((13,32,24,55),4,fill=FG,outline=FG,w=1); RR((48,32,59,55),4,fill=FG,outline=FG,w=1)
    elif symbol=="input":
        RR((27,11,45,40),8,outline=FG,w=4); d.arc((S(20),S(24),S(52),S(53)),0,180,fill=FG,width=max(1,S(4))); L((36,51,36,61),4)
        d.polygon([(S(52),S(51)),(S(63),S(57)),(S(52),S(63))],fill=ACCENT)
    elif symbol=="focus":
        for r,w in ((24,4),(14,3)): d.ellipse((S(36-r),S(36-r),S(36+r),S(36+r)),outline=FG,width=max(1,S(w)))
        d.ellipse((S(31),S(31),S(41),S(41)),fill=ACCENT)
    elif symbol=="meeting":
        RR((12,22,47,51),6,outline=FG,w=4); d.polygon([(S(49),S(29)),(S(63),S(21)),(S(63),S(52)),(S(49),S(44))],fill=FG)
        d.ellipse((S(24),S(30),S(34),S(40)),fill=ACCENT)
    elif symbol=="gaming":
        RR((10,25,62,52),11,outline=FG,w=4); L((22,32,22,45),4); L((16,38,28,38),4)
        d.ellipse((S(47),S(32),S(54),S(39)),fill=FG); d.ellipse((S(39),S(40),S(46),S(47)),fill=FG)
    elif symbol=="setup":
        for y,x in ((20,27),(36,47),(52,23)):
            L((12,y,60,y),3); d.ellipse((S(x-5),S(y-5),S(x+5),S(y+5)),fill=BG,outline=FG,width=max(1,S(3)))
    elif symbol=="audio":
        d.polygon([(S(13),S(30)),(S(26),S(30)),(S(40),S(18)),(S(40),S(54)),(S(26),S(42)),(S(13),S(42))],fill=FG)
        d.arc((S(39),S(24),S(58),S(48)),-55,55,fill=ACCENT,width=max(1,S(4))); d.arc((S(38),S(17),S(66),S(55)),-55,55,fill=FG,width=max(1,S(3)))
    else:
        return v4.render_key("workspace",label,"",size)
    im.alpha_composite(icon,((size-icon_size)//2,int(size*.08)))
    dd=ImageDraw.Draw(im); f=v4.fit_font(dd,label,size-20,19,11); b=dd.textbbox((0,0),label,font=f); tw=b[2]-b[0]; th=b[3]-b[1]
    dd.text(((size-tw)/2,size-22-th/2),label,font=f,fill=FG)
    return im

def extra_icons(plugin):
    # Reuse v4's strong monochrome geometry, but give every premium system a distinct face.
    action_defaults={
      "audio":("media","AUDIO","volume-up","audio"),
      "audio-preset":("workspace","MODE","","audio"),
      "routine":("workspace","ROUTINE","","focus"),
      "setup":("system","SETUP","settings","setup"),
    }
    for name,(kind,label,variant,symbol) in action_defaults.items():
        out=plugin/"imgs"/"actions"/name; out.mkdir(parents=True,exist_ok=True)
        for size,sfx in ((20,""),(40,"@2x")): save(v4.render_action_icon(kind,variant,size),out/f"icon{sfx}.png")
        for size,sfx in ((72,""),(144,"@2x")): save(premium_key(symbol,label,size),out/f"key{sfx}.png")

    specs={
      "audio":("audio","AUDIO"),
      "output":("headphones","OUT"),
      "input":("input","IN"),
      "mic-live":("mic","MIC"),
      "mic-muted":("mic-muted","MUTED"),
      "mode-work":("audio","WORK"),
      "mode-focus":("focus","FOCUS"),
      "mode-meeting":("meeting","MEET"),
      "mode-gaming":("gaming","GAME"),
      "focus":("focus","FOCUS"),
      "meeting":("meeting","MEET"),
      "gaming":("gaming","GAME"),
      "setup":("setup","SETUP"),
      "setup-needed":("setup","START"),
    }
    for name,(symbol,label) in specs.items():
        for size,sfx in ((72,""),(144,"@2x")): save(premium_key(symbol,label,size),plugin/"imgs"/"keys"/f"{name}{sfx}.png")
    for name,label in {"switched":"SWITCHED","applied":"APPLIED","started":"STARTED"}.items():
        for size,sfx in ((72,""),(144,"@2x")): save(v4.render_key("system",label,"settings",size),plugin/"imgs"/"status"/f"{name}{sfx}.png")

def act(slug,settings,image,display):
    return v4.action(slug,settings,image,display)

def enc(slug,settings,display):
    return {
      "ActionID":str(uuid.uuid4()),"LinkedTitle":False,"Name":display,"UUID":f"{PLUGIN}.{slug}","Settings":settings,
      "State":0,"States":[{"Title":"","ShowTitle":False,"TitleAlignment":"bottom","TitleColor":"#FFFFFF","FontFamily":"Arial","FontSize":10,"FontStyle":"Bold","FontUnderline":False}]
    }

def standard_specs():
    home={
      "0,0":act("routine",{"mode":"work"},"work","Work"),
      "1,0":act("smart-app",{"role":"browser","behavior":"focus"},"web","Web"),
      "2,0":act("smart-app",{"role":"discord","behavior":"focus"},"discord","Discord"),
      "3,0":act("smart-app",{"role":"spotify","behavior":"focus"},"spotify","Spotify"),
      "4,0":act("capture",{"mode":"region"},"shot","Capture"),
      "0,1":act("routine",{"mode":"focus"},"focus","Focus"),
      "1,1":act("routine",{"mode":"meeting"},"meeting","Meeting"),
      "2,1":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),
      "3,1":act("audio",{"mode":"output-cycle"},"output","Output"),
      "4,1":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Audio & Modes"},"audio","Audio"),
      "0,2":act("clipboard",{"mode":"slot","slot":1},"clip1","Clipboard"),
      "1,2":act("media",{"mode":"play-pause"},"play","Play Pause"),
      "2,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Windows"},"windows","Windows"),
      "3,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Utilities"},"utilities","Utilities"),
      "4,2":act("setup",{},"setup","Setup"),
    }
    windows={
      "0,0":act("window",{"mode":"left"},"left","Left"),"1,0":act("window",{"mode":"right"},"right","Right"),"2,0":act("window",{"mode":"maximize"},"max","Max"),"3,0":act("window",{"mode":"restore"},"restore","Restore"),"4,0":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Home"},"home","Home"),
      "0,1":act("window",{"mode":"top-left"},"top-left","Top Left"),"1,1":act("window",{"mode":"top-right"},"top-right","Top Right"),"2,1":act("window",{"mode":"center"},"center","Center"),"3,1":act("window",{"mode":"bottom-left"},"bottom-left","Bottom Left"),"4,1":act("window",{"mode":"bottom-right"},"bottom-right","Bottom Right"),
      "0,2":act("window",{"mode":"minimize"},"minimize","Minimize"),"1,2":act("window",{"mode":"topmost"},"topmost","Always On Top"),"2,2":act("window",{"mode":"next-monitor"},"screen","Next Screen"),"3,2":act("routine",{"mode":"work"},"work","Work"),"4,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Audio & Modes"},"audio","Audio")
    }
    utilities={
      "0,0":act("capture",{"mode":"region"},"shot","Region"),"1,0":act("capture",{"mode":"full"},"shot-full","Full Screen"),"2,0":act("capture",{"mode":"window"},"shot-window","Active Window"),"3,0":act("capture",{"mode":"folder"},"shots-folder","Screenshots"),"4,0":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Home"},"home","Home"),
      "0,1":act("clipboard",{"mode":"slot","slot":1},"clip1","Clip 1"),"1,1":act("clipboard",{"mode":"slot","slot":2},"clip2","Clip 2"),"2,1":act("clipboard",{"mode":"slot","slot":3},"clip3","Clip 3"),"3,1":act("clipboard",{"mode":"slot","slot":4},"clip4","Clip 4"),"4,1":act("clipboard",{"mode":"clear"},"clip-clear","Clear Clipboard"),
      "0,2":act("snippet",{"text":"","restoreClipboard":True},"snippet","Snippet"),"1,2":act("media",{"mode":"previous"},"previous","Previous"),"2,2":act("media",{"mode":"play-pause"},"play","Play Pause"),"3,2":act("media",{"mode":"next"},"next","Next"),"4,2":act("system",{"mode":"desktop"},"desktop","Desktop")
    }
    audio={
      "0,0":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),"1,0":act("audio",{"mode":"output-cycle"},"output","Output"),"2,0":act("audio",{"mode":"input-cycle"},"input","Input"),"3,0":act("media",{"mode":"volume-down"},"vol-down","Volume Down"),"4,0":act("media",{"mode":"volume-up"},"vol-up","Volume Up"),
      "0,1":act("audio-preset",{"mode":"work"},"mode-work","Work Audio"),"1,1":act("audio-preset",{"mode":"focus"},"mode-focus","Focus Audio"),"2,1":act("audio-preset",{"mode":"meeting"},"mode-meeting","Meeting Audio"),"3,1":act("audio-preset",{"mode":"gaming"},"mode-gaming","Gaming Audio"),"4,1":act("setup",{},"setup","Setup"),
      "0,2":act("routine",{"mode":"work"},"work","Work"),"1,2":act("routine",{"mode":"focus"},"focus","Focus"),"2,2":act("routine",{"mode":"meeting"},"meeting","Meeting"),"3,2":act("routine",{"mode":"gaming"},"gaming","Gaming"),"4,2":act("navigation",{"profile":"profiles/Stream Deck Ultimate - Home"},"home","Home")
    }
    return [
      ("Stream Deck Ultimate - Home",home,5,3,0),
      ("Stream Deck Ultimate - Windows",windows,5,3,0),
      ("Stream Deck Ultimate - Utilities",utilities,5,3,0),
      ("Stream Deck Ultimate - Audio & Modes",audio,5,3,0),
    ]

def xl_spec():
    s={}
    entries=[
      ("routine",{"mode":"work"},"work","WORK"),("smart-app",{"role":"browser"},"web","WEB"),("smart-app",{"role":"discord"},"discord","DISCORD"),("smart-app",{"role":"spotify"},"spotify","SPOTIFY"),("capture",{"mode":"region"},"shot","SHOT"),("clipboard",{"mode":"slot","slot":1},"clip1","CLIP 1"),("media",{"mode":"play-pause"},"play","PLAY"),("setup",{},"setup","SETUP"),
      ("routine",{"mode":"focus"},"focus","FOCUS"),("routine",{"mode":"meeting"},"meeting","MEET"),("audio",{"mode":"mic-toggle"},"mic-live","MIC"),("audio",{"mode":"output-cycle"},"output","OUTPUT"),("audio",{"mode":"input-cycle"},"input","INPUT"),("audio-preset",{"mode":"work"},"mode-work","WORK MODE"),("audio-preset",{"mode":"meeting"},"mode-meeting","MEET MODE"),("audio-preset",{"mode":"gaming"},"mode-gaming","GAME MODE"),
      ("window",{"mode":"left"},"left","LEFT"),("window",{"mode":"right"},"right","RIGHT"),("window",{"mode":"maximize"},"max","MAX"),("window",{"mode":"restore"},"restore","RESTORE"),("window",{"mode":"center"},"center","CENTER"),("window",{"mode":"next-monitor"},"screen","SCREEN"),("window",{"mode":"minimize"},"minimize","MIN"),("window",{"mode":"topmost"},"topmost","PIN"),
      ("clipboard",{"mode":"slot","slot":2},"clip2","CLIP 2"),("snippet",{"text":"","restoreClipboard":True},"snippet","SNIP"),("capture",{"mode":"full"},"shot-full","FULL"),("capture",{"mode":"window"},"shot-window","WINDOW"),("media",{"mode":"previous"},"previous","PREV"),("media",{"mode":"next"},"next","NEXT"),("system",{"mode":"desktop"},"desktop","DESKTOP"),("system",{"mode":"task"},"task","TASKS")
    ]
    for i,e in enumerate(entries): s[f"{i%8},{i//8}"]=act(*e)
    return ("Stream Deck Ultimate - XL",s,8,4,2)

def plus_spec():
    keys={
      "0,0":act("routine",{"mode":"work"},"work","Work"),"1,0":act("routine",{"mode":"focus"},"focus","Focus"),"2,0":act("routine",{"mode":"meeting"},"meeting","Meeting"),"3,0":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),
      "0,1":act("smart-app",{"role":"browser"},"web","Web"),"1,1":act("clipboard",{"mode":"slot","slot":1},"clip1","Clipboard"),"2,1":act("capture",{"mode":"region"},"shot","Capture"),"3,1":act("setup",{},"setup","Setup")
    }
    encs={"0,0":enc("audio",{"mode":"volume-dial"},"Master Volume"),"1,0":enc("audio",{"mode":"output-cycle"},"Output Device"),"2,0":enc("audio",{"mode":"input-cycle"},"Input Device"),"3,0":enc("audio",{"mode":"mic-volume-dial"},"Mic Level")}
    return ("Stream Deck Ultimate - Plus",keys,4,2,7,encs)

def neo_spec():
    s={
      "0,0":act("routine",{"mode":"work"},"work","Work"),"1,0":act("routine",{"mode":"focus"},"focus","Focus"),"2,0":act("routine",{"mode":"meeting"},"meeting","Meeting"),"3,0":act("audio",{"mode":"mic-toggle"},"mic-live","Mic"),
      "0,1":act("smart-app",{"role":"browser"},"web","Web"),"1,1":act("audio",{"mode":"output-cycle"},"output","Output"),"2,1":act("clipboard",{"mode":"slot","slot":1},"clip1","Clipboard"),"3,1":act("setup",{},"setup","Setup")
    }
    return ("Stream Deck Ultimate - Neo",s,4,2,9)

def build_profile(plugin,name,spec,cols,rows,device_type,encoders=None):
    root_id=str(uuid.uuid4()).upper();page_id=str(uuid.uuid4());folder_id=v4.profile_folder_id(page_id);root=f"{root_id}.sdProfile";actions={};images={}
    for coord,item in spec.items():
        item=dict(item);image=item.pop("_image");actions[coord]=item;images[("Keypad",coord)]=Image.open(plugin/"imgs"/"keys"/f"{image}.png").convert("RGBA")
    controllers=[{"Actions":actions,"Type":"Keypad"}]
    if encoders: controllers.append({"Actions":encoders,"Type":"Encoder"})
    top={"Name":name,"Pages":{"Current":page_id,"Pages":[page_id]},"Version":"2.0"};page={"Controllers":controllers};target=plugin/"profiles"/f"{name}.streamDeckProfile"
    with zipfile.ZipFile(target,"w",zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{root}/manifest.json",json.dumps(top,separators=(",",":")));z.writestr(f"{root}/Profiles/{folder_id}/manifest.json",json.dumps(page,separators=(",",":")))
        for (controller,coord),im in images.items():
            b=io.BytesIO();im.save(b,"PNG");z.writestr(f"{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png",b.getvalue())
    validate_profile(target,page_id,folder_id,len(spec),bool(encoders))
    return target

def validate_profile(target,page_id,folder_id,key_count,has_encoders=False):
    with zipfile.ZipFile(target) as z:
        names=z.namelist();roots={n.split("/")[0] for n in names if "/" in n};assert len(roots)==1;root=next(iter(roots));top=json.loads(z.read(f"{root}/manifest.json"));assert top["Version"]=="2.0" and "Device" not in top and top["Pages"]["Current"]==page_id
        page=json.loads(z.read(f"{root}/Profiles/{folder_id}/manifest.json"));keypad=next(c for c in page["Controllers"] if c["Type"]=="Keypad");assert len(keypad["Actions"])==key_count
        if has_encoders: assert any(c["Type"]=="Encoder" and len(c["Actions"])==4 for c in page["Controllers"])
        for coord,a in keypad["Actions"].items(): assert a["States"][0]["ShowTitle"] is False and f"{root}/Profiles/{folder_id}/{coord}/CustomImages/state0.png" in names

def preview(plugin,name,spec,cols,rows,out):
    cell=170;canvas=Image.new("RGB",(cols*cell,rows*cell),(31,33,37));d=ImageDraw.Draw(canvas)
    for coord,item in spec.items():
        x,y=map(int,coord.split(","));im=Image.open(plugin/"imgs"/"keys"/f"{item['_image']}.png").convert("RGBA").resize((144,144),Image.Resampling.LANCZOS);ox=x*cell+13;oy=y*cell+13;canvas.paste(im,(ox,oy),im)
    out.parent.mkdir(parents=True,exist_ok=True);canvas.save(out)

def main():
    ap=argparse.ArgumentParser();ap.add_argument("plugin",type=Path);ns=ap.parse_args();plugin=ns.plugin.resolve();v4.generate_icons(plugin);extra_icons(plugin)
    profiles=plugin/"profiles";shutil.rmtree(profiles,ignore_errors=True);profiles.mkdir(parents=True,exist_ok=True);prev=plugin.parent/"previews";shutil.rmtree(prev,ignore_errors=True);prev.mkdir(parents=True,exist_ok=True)
    specs=standard_specs()+[xl_spec(),plus_spec(),neo_spec()]
    for entry in specs:
        if len(entry)==5:name,spec,cols,rows,device=entry;encoders=None
        else:name,spec,cols,rows,device,encoders=entry
        build_profile(plugin,name,spec,cols,rows,device,encoders);preview(plugin,name,spec,cols,rows,prev/(name.lower().replace(" ","-").replace("&","and")+".png"))
    print("generated 7 premium hardware profiles, semantic key art, setup states, dials, and previews")

if __name__=="__main__":main()
