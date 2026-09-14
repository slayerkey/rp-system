import { deflateRawSync } from "node:zlib";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const profileDir=resolve("com.packrat.monitormanagerlite.sdPlugin","profiles");
const UUID="com.packrat.monitormanagerlite.brightness";
function deterministicUuid(seed){const hex=createHash("sha256").update(seed).digest("hex").slice(0,32);return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20,32)].join("-");}
function pageFolderId(pageUuid){return pageUuid.replaceAll("-","").toUpperCase();}
function action(seed,title,settings){return{ActionID:deterministicUuid("monitor-lite-action:"+seed),LinkedTitle:true,Name:"Monitor Brightness",UUID,Settings:settings,State:0,States:[{Title:"",ShowTitle:false,TitleAlignment:"bottom",TitleColor:"#FFFFFF",FontFamily:"Arial",FontSize:12,FontStyle:"Regular",FontUnderline:false}]};}
function keypad(prefix){return{
  "0,0":action(prefix+":25","25%",{mode:"set",value:25}),
  "1,0":action(prefix+":50","50%",{mode:"set",value:50}),
  "2,0":action(prefix+":75","75%",{mode:"set",value:75}),
  "3,0":action(prefix+":100","100%",{mode:"set",value:100}),
  "0,1":action(prefix+":down","BRIGHT -",{mode:"down",step:5}),
  "1,1":action(prefix+":up","BRIGHT +",{mode:"up",step:5})
};}
function page(prefix,plus=false){return{label:"BRIGHTNESS",keypad:keypad(prefix),encoder:plus?{"0,0":action(prefix+":dial","BRIGHTNESS",{mode:"set",value:65,step:2})}:null};}
const specs=[
  {file:"monitor-manager-lite-standard",name:"Monitor Manager Lite",page:page("standard")},
  {file:"monitor-manager-lite-xl",name:"Monitor Manager Lite XL",page:page("xl")},
  {file:"monitor-manager-lite-plus",name:"Monitor Manager Lite +",page:page("plus",true)},
  {file:"monitor-manager-lite-virtual",name:"Monitor Manager Lite Virtual",page:page("virtual")}
];
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit+=1)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function zip(entries){const locals=[],centrals=[];let offset=0;const date=((2026-1980)<<9)|(1<<5)|1;for(const [entryPath,rawValue] of entries){const name=Buffer.from(entryPath.replace(/\\/g,"/"),"utf8"),raw=Buffer.isBuffer(rawValue)?rawValue:Buffer.from(rawValue,"utf8"),compressed=deflateRawSync(raw,{level:9}),crc=crc32(raw),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(8,8);local.writeUInt16LE(0,10);local.writeUInt16LE(date,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(name.length,26);local.writeUInt16LE(0,28);const record=Buffer.concat([local,name,compressed]);locals.push(record);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(8,10);central.writeUInt16LE(0,12);central.writeUInt16LE(date,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(name.length,28);central.writeUInt16LE(0,30);central.writeUInt16LE(0,32);central.writeUInt16LE(0,34);central.writeUInt16LE(0,36);central.writeUInt32LE(0,38);central.writeUInt32LE(offset,42);centrals.push(Buffer.concat([central,name]));offset+=record.length;}const centralData=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(0,4);end.writeUInt16LE(0,6);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralData.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(0,20);return Buffer.concat([...locals,centralData,end]);}
function build(spec){const rootUuid=deterministicUuid("monitor-lite-root:"+spec.file),pageUuid=deterministicUuid("monitor-lite-page:"+spec.file+":BRIGHTNESS"),rootPath=rootUuid+".sdProfile",controllers=[{Actions:spec.page.keypad,Type:"Keypad"}];if(spec.page.encoder)controllers.push({Actions:spec.page.encoder,Type:"Encoder"});return zip([[rootPath+"/manifest.json",JSON.stringify({Name:spec.name,Pages:{Current:pageUuid,Pages:[pageUuid]},Version:"2.0"},null,2)],[rootPath+"/Profiles/"+pageFolderId(pageUuid)+"/manifest.json",JSON.stringify({Controllers:controllers},null,2)]]);}
await rm(profileDir,{recursive:true,force:true});await mkdir(profileDir,{recursive:true});for(const spec of specs){await writeFile(resolve(profileDir,spec.file+".streamDeckProfile"),build(spec));console.log("Built "+spec.file);}
