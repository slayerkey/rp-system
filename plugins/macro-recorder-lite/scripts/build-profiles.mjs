import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const profileDir=resolve(root,"com.packrat.macro-recorder-lite.sdPlugin","profiles");
const profileMapDir=resolve(root,"..","..","artifacts","profile-maps");
const PREFIX="com.packrat.macro-recorder-lite";

function uuid(seed){const h=createHash("sha256").update(seed).digest("hex").slice(0,32).split("");h[12]="4";h[16]=["8","9","a","b"][parseInt(h[16],16)%4];return `${h.slice(0,8).join("")}-${h.slice(8,12).join("")}-${h.slice(12,16).join("")}-${h.slice(16,20).join("")}-${h.slice(20).join("")}`.toUpperCase();}
function folder(id){const c=(id.replace(/-/g,"")+"000").match(/.{5}/g)||[];return c.map(v=>parseInt(v,16).toString(32).padStart(4,"0")).join("").slice(0,26).toUpperCase().replace(/V/g,"W").replace(/U/g,"V")+"Z";}
function act(seed,kind,name,settings={}){return {ActionID:uuid("action:"+seed),LinkedTitle:true,Name:name,UUID:`${PREFIX}.${kind}`,Settings:settings,State:0,States:[{Title:name,ShowTitle:true,TitleAlignment:"middle",TitleColor:"#FFFFFF",FontFamily:"Arial",FontSize:11,FontStyle:"Regular",FontUnderline:false}]};}
function k(vk,name,down=true,delayMs=80){return {type:down?"keyDown":"keyUp",delayMs,vk,scan:0,extended:false,name};}
function tap(vk,name,delay=80){return [k(vk,name,true,delay),k(vk,name,false,55)];}
function chord(modVk,modName,keyVk,keyName){return [k(modVk,modName,true,60),k(keyVk,keyName,true,40),k(keyVk,keyName,false,45),k(modVk,modName,false,35)];}
function macro(id,name,events){return {schema:1,id,name,createdAt:"2026-09-12T00:00:00.000Z",updatedAt:"2026-09-12T00:00:00.000Z",durationMs:events.reduce((s,e)=>s+e.delayMs,0),events};}
function replay(seed,name,m,extra={}){const settings={macro:m,...extra};return act(seed,"replay",name,settings);}
const examples={
 find:macro("starter-find","Find in App",chord(17,"Ctrl",70,"F")),
 save:macro("starter-save","Save",chord(17,"Ctrl",83,"S")),
 next3:macro("starter-next-fields","Next Fields",[...tap(9,"Tab",70),...tap(9,"Tab",120),...tap(9,"Tab",120)]),
 menu:macro("starter-menu","Menu Down + Confirm",[...tap(40,"Down",70),...tap(13,"Enter",120)]),
 escape:macro("starter-menu-back","Menu Back",tap(27,"Esc",70)),
 leftRight:macro("starter-menu-cycle","Menu Left + Right",[...tap(37,"Left",70),...tap(39,"Right",130)]),
 pageDown:macro("starter-page-down","Page Down",tap(34,"Page Down",70)),
 home:macro("starter-home","Home",tap(36,"Home",70)),
 center:macro("starter-mouse-center","Center Active Window",[{type:"mouseMove",delayMs:80,x:960,y:540,relX:.5,relY:.5}]),
 scroll:macro("starter-scroll","Scroll Down",[{type:"wheel",delayMs:80,x:960,y:540,relX:.5,relY:.5,delta:-120,horizontal:false}]),
 clickDemo:macro("starter-click-demo","Click Demo",[{type:"mouseMove",delayMs:60,x:960,y:540,relX:.5,relY:.5},{type:"mouseDown",delayMs:80,button:"left",x:960,y:540,relX:.5,relY:.5},{type:"mouseUp",delayMs:65,button:"left",x:960,y:540,relX:.5,relY:.5}]),
 tab:macro("starter-loop-tab","Next Field",tap(9,"Tab",80)),
 right:macro("starter-loop-right","Navigate Right",tap(39,"Right",80)),
 down:macro("starter-loop-down","Navigate Down",tap(40,"Down",80)),
};

function litePages(){return [{label:"BASIC",actions:{
 "0,0":act("lite-rec","record","REC"),"1,0":act("lite-stop","stop","STOP"),
 "2,0":replay("lite-find","FIND",examples.find),"3,0":replay("lite-save","SAVE",examples.save),"4,0":replay("lite-next","NEXT x3",examples.next3),
 "0,1":act("lite-play","replay","PLAY"),"1,1":replay("lite-home","HOME",examples.home),"2,1":replay("lite-page","PAGE DOWN",examples.pageDown)
}}];}
function proPages(){return [
 {label:"MACROS",actions:{"0,0":act("p-rec","record","REC"),"1,0":act("p-stop","stop","STOP"),"2,0":replay("p-find","FIND",examples.find),"3,0":replay("p-save","SAVE",examples.save),"4,0":replay("p-next","NEXT x3",examples.next3)}},
 {label:"GAMING",actions:{"0,0":replay("g-menu","MENU OK",examples.menu),"1,0":replay("g-back","MENU BACK",examples.escape),"2,0":replay("g-cycle","MENU CYCLE",examples.leftRight)}},
 {label:"PRODUCTIVITY",actions:{"0,0":replay("prod-find","FIND",examples.find),"1,0":replay("prod-save","SAVE",examples.save),"2,0":replay("prod-next","NEXT FIELDS",examples.next3),"3,0":replay("prod-home","HOME",examples.home),"4,0":replay("prod-page","PAGE DOWN",examples.pageDown)}},
 {label:"MOUSE",actions:{"0,0":replay("m-center","CENTER",examples.center,{coordinateMode:"active-window"}),"1,0":replay("m-scroll","SCROLL",examples.scroll,{coordinateMode:"active-window"}),"2,0":replay("m-click","CLICK DEMO",examples.clickDemo,{coordinateMode:"active-window"})}},
 {label:"LOOPS",actions:{"0,0":replay("l-count","TAB x3",examples.tab,{playbackMode:"count",repeatCount:3}),"1,0":replay("l-held","RIGHT HELD",examples.right,{playbackMode:"while-held"}),"2,0":replay("l-toggle","DOWN TOGGLE",examples.down,{playbackMode:"toggle"}),"4,0":act("l-stop","stop","STOP ALL")}}
];}

function crc32(b){let crc=0xffffffff;for(const x of b){crc^=x;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(entries){const locals=[],centrals=[];let offset=0;const date=((2026-1980)<<9)|(9<<5)|12;for(const [path,value] of entries){const name=Buffer.from(path);const raw=Buffer.from(value);const z=deflateRawSync(raw,{level:9});const crc=crc32(raw);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(z.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);locals.push(Buffer.concat([local,name,z]));const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(z.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);centrals.push(Buffer.concat([c,name]));offset+=30+name.length+z.length;}const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,end]);}
function build(pages){const rootId=uuid("profile-root:macro-recorder-lite"),pageIds=pages.map((_,i)=>uuid("profile-page:macro-recorder-lite:"+i));const rootPath=`${rootId}.sdProfile`;const entries=[[`${rootPath}/manifest.json`,JSON.stringify({Name:"Macro Recorder Lite Starter",Pages:{Current:pageIds[0],Pages:pageIds},Version:"2.0"},null,2)]];pages.forEach((page,i)=>entries.push([`${rootPath}/Profiles/${folder(pageIds[i])}/manifest.json`,JSON.stringify({Controllers:[{Actions:page.actions,Type:"Keypad"}]},null,2)]));return zip(entries);}
await rm(profileDir,{recursive:true,force:true});await mkdir(profileDir,{recursive:true});
const pages=litePages();
await writeFile(resolve(profileDir,"macro-recorder-lite-starter.streamDeckProfile"),build(pages));
await mkdir(profileMapDir,{recursive:true});
await writeFile(resolve(profileMapDir,"macro-recorder-lite-starter.profile-map.json"),JSON.stringify({pages:pages.map((p,i)=>({index:i+1,label:p.label,actions:Object.values(p.actions).map(a=>a.Name)}))},null,2));
console.log("Built Lite starter profile.");
