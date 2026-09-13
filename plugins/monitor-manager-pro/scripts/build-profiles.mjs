import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const profileDir=resolve(root,"com.packrat.monitormanagerpro.sdPlugin","profiles");

const U={
 brightness:"com.packrat.monitormanagerpro.brightness",
 contrast:"com.packrat.monitormanagerpro.contrast",
 volume:"com.packrat.monitormanagerpro.volume",
 power:"com.packrat.monitormanagerpro.power",
 input:"com.packrat.monitormanagerpro.input",
 refresh:"com.packrat.monitormanagerpro.refresh-rate",
 resolution:"com.packrat.monitormanagerpro.resolution",
 hdr:"com.packrat.monitormanagerpro.hdr",
 topology:"com.packrat.monitormanagerpro.topology",
 primary:"com.packrat.monitormanagerpro.primary",
 orientation:"com.packrat.monitormanagerpro.orientation",
 save:"com.packrat.monitormanagerpro.save-profile",
 apply:"com.packrat.monitormanagerpro.apply-profile",
 status:"com.packrat.monitormanagerpro.status"
};

function uuid(seed){
 const h=createHash("sha256").update(seed).digest("hex").slice(0,32).split("");
 h[12]="4";h[16]=["8","9","a","b"][parseInt(h[16],16)%4];
 return `${h.slice(0,8).join("")}-${h.slice(8,12).join("")}-${h.slice(12,16).join("")}-${h.slice(16,20).join("")}-${h.slice(20,32).join("")}`.toUpperCase();
}
function folder(id){
 const chunks=(id.replace(/-/g,"")+"000").match(/.{5}/g)||[];
 return chunks.map(x=>parseInt(x,16).toString(32).padStart(4,"0")).join("").slice(0,26).toUpperCase().replace(/V/g,"W").replace(/U/g,"V")+"Z";
}
function action(seed,id,name,title,settings={}){
 return {ActionID:uuid("pro-action:"+seed),LinkedTitle:true,Name:name,UUID:id,Settings:settings,State:0,States:[{Title:title,ShowTitle:true,TitleAlignment:"middle",TitleColor:"#FFFFFF",FontFamily:"Arial",FontSize:12,FontStyle:"Regular",FontUnderline:false}]};
}
function p(seed,name,apply=false){return action(seed,apply?U.apply:U.save,apply?"Apply Monitor Profile":"Save Monitor Profile",(apply?"":"SAVE\n")+name+(apply?"\nMODE":""),{profileName:name});}

function standardPages(prefix){
 return [
  {label:"MONITORS",keypad:{
    "0,0":action(prefix+":status",U.status,"Current Display Status","MONITORS",{}),
    "1,0":action(prefix+":primary",U.primary,"Set Primary Display","PRIMARY",{}),
    "2,0":action(prefix+":dp",U.input,"Input Source","DP",{inputValue:0x0f}),
    "3,0":action(prefix+":hdmi",U.input,"Input Source","HDMI",{inputValue:0x11}),
    "4,0":action(prefix+":hdr",U.hdr,"Windows HDR","HDR",{hdr:"toggle"}),
    "0,1":action(prefix+":bright",U.brightness,"Monitor Brightness","65%",{value:65}),
    "1,1":action(prefix+":contrast",U.contrast,"Monitor Contrast","50% CONTRAST",{contrast:50}),
    "2,1":action(prefix+":volume",U.volume,"Monitor Volume","50% VOLUME",{volume:50}),
    "3,1":action(prefix+":power",U.power,"Monitor Power","POWER",{power:"toggle"})
  }},
  {label:"PROFILES",keypad:{
    "0,0":p(prefix+":save-pc","PC",false),"1,0":p(prefix+":pc","PC",true),
    "2,0":p(prefix+":save-console","CONSOLE",false),"3,0":p(prefix+":console","CONSOLE",true),
    "0,1":p(prefix+":save-work","WORK LAPTOP",false),"1,1":p(prefix+":work","WORK LAPTOP",true),
    "2,1":p(prefix+":save-night","NIGHT",false),"3,1":p(prefix+":night","NIGHT",true)
  }},
  {label:"DISPLAY MODES",keypad:{
    "0,0":action(prefix+":extend",U.topology,"Display Mode","EXTEND",{topology:"extend"}),
    "1,0":action(prefix+":dup",U.topology,"Display Mode","DUPLICATE",{topology:"duplicate"}),
    "2,0":action(prefix+":internal",U.topology,"Display Mode","PC SCREEN",{topology:"internal"}),
    "3,0":action(prefix+":external",U.topology,"Display Mode","SECOND SCREEN",{topology:"external"}),
    "4,0":action(prefix+":hdr2",U.hdr,"Windows HDR","HDR",{hdr:"toggle"}),
    "0,1":action(prefix+":60",U.refresh,"Refresh Rate","60 HZ",{refreshRate:60}),
    "1,1":action(prefix+":120",U.refresh,"Refresh Rate","120 HZ",{refreshRate:120}),
    "2,1":action(prefix+":144",U.refresh,"Refresh Rate","144 HZ",{refreshRate:144}),
    "3,1":action(prefix+":165",U.refresh,"Refresh Rate","165 HZ",{refreshRate:165}),
    "4,1":action(prefix+":240",U.refresh,"Refresh Rate","240 HZ",{refreshRate:240}),
    "0,2":action(prefix+":1080",U.resolution,"Resolution","1080P",{width:1920,height:1080,frequency:60,orientation:0}),
    "1,2":action(prefix+":1440",U.resolution,"Resolution","1440P 165",{width:2560,height:1440,frequency:165,orientation:0}),
    "2,2":action(prefix+":landscape",U.orientation,"Orientation","LANDSCAPE",{orientation:0}),
    "3,2":action(prefix+":portrait",U.orientation,"Orientation","PORTRAIT",{orientation:1})
  }},
  {label:"BRIGHTNESS",keypad:{
    "0,0":action(prefix+":25",U.brightness,"Monitor Brightness","25%",{value:25}),
    "1,0":action(prefix+":50",U.brightness,"Monitor Brightness","50%",{value:50}),
    "2,0":action(prefix+":65",U.brightness,"Monitor Brightness","65%",{value:65}),
    "3,0":action(prefix+":80",U.brightness,"Monitor Brightness","80%",{value:80}),
    "0,1":action(prefix+":c40",U.contrast,"Monitor Contrast","40% CONTRAST",{contrast:40}),
    "1,1":action(prefix+":c60",U.contrast,"Monitor Contrast","60% CONTRAST",{contrast:60}),
    "2,1":action(prefix+":v25",U.volume,"Monitor Volume","25% VOLUME",{volume:25}),
    "3,1":action(prefix+":v50",U.volume,"Monitor Volume","50% VOLUME",{volume:50})
  }}
 ];
}

function plusPages(prefix){
 const pages=standardPages(prefix);
 pages[0].keypad={
  "0,0":pages[0].keypad["0,0"],"1,0":pages[0].keypad["2,0"],"2,0":pages[0].keypad["3,0"],"3,0":pages[0].keypad["4,0"],
  "0,1":pages[0].keypad["0,1"],"1,1":pages[0].keypad["1,1"],"2,1":pages[0].keypad["2,1"],"3,1":pages[0].keypad["3,1"]
 };
 pages[2].keypad={
  "0,0":pages[2].keypad["0,0"],"1,0":pages[2].keypad["1,0"],"2,0":pages[2].keypad["2,0"],"3,0":pages[2].keypad["3,0"],
  "0,1":pages[2].keypad["0,1"],"1,1":pages[2].keypad["2,1"],"2,1":pages[2].keypad["3,1"],"3,1":pages[2].keypad["4,1"]
 };
 pages[3].keypad={
  "0,0":pages[3].keypad["0,0"],"1,0":pages[3].keypad["1,0"],"2,0":pages[3].keypad["2,0"],"3,0":pages[3].keypad["3,0"],
  "0,1":pages[3].keypad["0,1"],"1,1":pages[3].keypad["1,1"],"2,1":pages[3].keypad["2,1"],"3,1":pages[3].keypad["3,1"]
 };
 for(const [i,page] of pages.entries()){
  page.encoder={
   "0,0":action(prefix+":dial-b:"+i,U.brightness,"Monitor Brightness","BRIGHTNESS",{value:65,step:2}),
   "1,0":action(prefix+":dial-c:"+i,U.contrast,"Monitor Contrast","CONTRAST",{contrast:50,step:2}),
   "2,0":action(prefix+":dial-v:"+i,U.volume,"Monitor Volume","VOLUME",{volume:50,step:2})
  };
 }
 return pages;
}

const specs=[
 {file:"monitor-manager-pro-standard",name:"Monitor Manager Pro",pages:standardPages("standard")},
 {file:"monitor-manager-pro-xl",name:"Monitor Manager Pro XL",pages:standardPages("xl")},
 {file:"monitor-manager-pro-plus",name:"Monitor Manager Pro +",pages:plusPages("plus")},
 {file:"monitor-manager-pro-virtual",name:"Monitor Manager Pro Virtual",pages:standardPages("virtual")}
];

function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit+=1)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(entries){
 const locals=[],centrals=[];let offset=0;const date=((2026-1980)<<9)|(1<<5)|1;
 for(const [entryPath,value] of entries){
  const name=Buffer.from(entryPath.replace(/\\/g,"/"),"utf8");const raw=Buffer.from(value,"utf8");const compressed=deflateRawSync(raw,{level:9});const crc=crc32(raw);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);
  const record=Buffer.concat([local,name,compressed]);locals.push(record);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt16LE(date,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
  centrals.push(Buffer.concat([central,name]));offset+=record.length;
 }
 const cd=Buffer.concat(centrals);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,cd,end]);
}
function build(spec){
 const rootId=uuid("pro-root:"+spec.file);const pageIds=spec.pages.map((p,i)=>uuid("pro-page:"+spec.file+":"+i+":"+p.label));const rootPath=rootId+".sdProfile";
 const entries=[[rootPath+"/manifest.json",JSON.stringify({Name:spec.name,Pages:{Current:pageIds[0],Pages:pageIds},Version:"2.0"},null,2)]];
 spec.pages.forEach((page,i)=>{const controllers=[{Actions:page.keypad,Type:"Keypad"}];if(page.encoder)controllers.push({Actions:page.encoder,Type:"Encoder"});entries.push([rootPath+"/Profiles/"+folder(pageIds[i])+"/manifest.json",JSON.stringify({Controllers:controllers},null,2)]);});
 return zip(entries);
}
await rm(profileDir,{recursive:true,force:true});await mkdir(profileDir,{recursive:true});
for(const spec of specs){await writeFile(resolve(profileDir,spec.file+".streamDeckProfile"),build(spec));console.log("Built "+spec.file);}
