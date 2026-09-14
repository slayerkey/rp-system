import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const profileDir=resolve(root,"com.packrat.macro-recorder-pro.sdPlugin","profiles");
const profileMapDir=resolve(root,"..","..","artifacts","profile-maps");
const PREFIX="com.packrat.macro-recorder-pro";

function uuid(seed){const h=createHash("sha256").update(seed).digest("hex").slice(0,32).split("");h[12]="4";h[16]=["8","9","a","b"][parseInt(h[16],16)%4];return `${h.slice(0,8).join("")}-${h.slice(8,12).join("")}-${h.slice(12,16).join("")}-${h.slice(16,20).join("")}-${h.slice(20).join("")}`.toUpperCase();}
function folder(id){const c=(id.replace(/-/g,"")+"000").match(/.{5}/g)||[];return c.map(v=>parseInt(v,16).toString(32).padStart(4,"0")).join("").slice(0,26).toUpperCase().replace(/V/g,"W").replace(/U/g,"V")+"Z";}
function act(seed,kind,name,settings={}){return {ActionID:uuid("action:"+seed),LinkedTitle:false,Name:name,UUID:`${PREFIX}.${kind}`,Settings:settings,State:0,States:[{Title:"",ShowTitle:false,TitleAlignment:"middle",TitleColor:"#FFFFFF",FontFamily:"Arial",FontSize:11,FontStyle:"Regular",FontUnderline:false}]};}
function proPages(){return [{label:"MACROS",actions:{
 "0,0":act("p-rec","record","Record"),
 "1,0":act("p-play","replay","Play",{autoLatest:true}),
 "2,0":act("p-stop","stop","Stop")
}}];}

function crc32(b){let crc=0xffffffff;for(const x of b){crc^=x;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(entries){const locals=[],centrals=[];let offset=0;const date=((2026-1980)<<9)|(9<<5)|12;for(const [path,value] of entries){const name=Buffer.from(path);const raw=Buffer.from(value);const z=deflateRawSync(raw,{level:9});const crc=crc32(raw);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(z.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);locals.push(Buffer.concat([local,name,z]));const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(z.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);centrals.push(Buffer.concat([c,name]));offset+=30+name.length+z.length;}const cd=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,cd,end]);}

function compactPages(pages,columns=4,rows=2){return pages.map(page=>{const actions={};Object.values(page.actions).slice(0,columns*rows).forEach((action,index)=>{const row=Math.floor(index/columns),col=index%columns;actions[`${col},${row}`]=action;});return {...page,actions};});}
function materializeProfilePages(pages,fileSeed){
 return pages.map((page,pageIndex)=>({
   ...page,
   actions:Object.fromEntries(Object.entries(page.actions).map(([position,action])=>[
     position,
     {...action,ActionID:uuid(`action:${fileSeed}:${pageIndex}:${position}:${action.UUID}`)}
   ]))
 }));
}
function buildProfile(pages,fileSeed,profileName){
 const rootId=uuid(`profile-root:${fileSeed}`),pageIds=pages.map((_,i)=>uuid(`profile-page:${fileSeed}:${i}`)),rootPath=`${rootId}.sdProfile`;
 const entries=[[`${rootPath}/manifest.json`,JSON.stringify({Name:profileName,Pages:{Current:pageIds[0],Pages:pageIds},Version:"2.0"},null,2)]];
 pages.forEach((page,i)=>entries.push([`${rootPath}/Profiles/${folder(pageIds[i])}/manifest.json`,JSON.stringify({Controllers:[{Actions:page.actions,Type:"Keypad"}]},null,2)]));
 return zip(entries);
}

await rm(profileDir,{recursive:true,force:true});
await mkdir(profileDir,{recursive:true});
await mkdir(profileMapDir,{recursive:true});
const basePages=proPages();
const variants=[
 {suffix:"mk2",deviceType:0,pages:basePages,name:"Macro Recorder Pro Starter"},
 {suffix:"mini",deviceType:1,pages:compactPages(basePages,3,2),name:"Macro Recorder Pro Starter Mini"},
 {suffix:"xl",deviceType:2,pages:basePages,name:"Macro Recorder Pro Starter XL"},
 {suffix:"plus",deviceType:7,pages:compactPages(basePages,4),name:"Macro Recorder Pro Starter +"},
 {suffix:"neo",deviceType:9,pages:compactPages(basePages,4),name:"Macro Recorder Pro Starter Neo"}
];
for(const variant of variants){
 const file=`macro-recorder-pro-starter-${variant.suffix}`;
 const pages=materializeProfilePages(variant.pages,file);
 await writeFile(resolve(profileDir,`${file}.streamDeckProfile`),buildProfile(pages,file,variant.name));
 await writeFile(resolve(profileMapDir,`${file}.profile-map.json`),JSON.stringify({
   deviceType:variant.deviceType,
   pages:pages.map((p,i)=>({
     index:i+1,
     label:p.label,
     actions:Object.entries(p.actions).map(([position,a])=>({position,name:a.Name,uuid:a.UUID,actionId:a.ActionID}))
   }))
 },null,2));
}
console.log("Built minimal Record / Play / Stop starter profiles with profile-unique action IDs.");
