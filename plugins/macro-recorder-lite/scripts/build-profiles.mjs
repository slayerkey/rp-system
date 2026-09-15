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

function uuid(seed){
  const h=createHash("sha256").update(seed).digest("hex").slice(0,32).split("");
  h[12]="4";
  h[16]=["8","9","a","b"][parseInt(h[16],16)%4];
  return `${h.slice(0,8).join("")}-${h.slice(8,12).join("")}-${h.slice(12,16).join("")}-${h.slice(16,20).join("")}-${h.slice(20).join("")}`.toUpperCase();
}
function folder(id){
  const chunks=(id.replace(/-/g,"")+"000").match(/.{5}/g)||[];
  return chunks.map(v=>parseInt(v,16).toString(32).padStart(4,"0")).join("").slice(0,26).toUpperCase().replace(/V/g,"W").replace(/U/g,"V")+"Z";
}
function action(seed,kind,name,settings={}){
  return {
    _seed:seed,
    LinkedTitle:false,
    Name:name,
    UUID:`${PREFIX}.${kind}`,
    Settings:settings,
    State:0,
    States:[{
      Title:name,
      ShowTitle:false,
      TitleAlignment:"middle",
      TitleColor:"#FFFFFF",
      FontFamily:"Arial",
      FontSize:11,
      FontStyle:"Regular",
      FontUnderline:false,
    }],
  };
}
function key(vk,name,down=true,delayMs=80){
  return {type:down?"keyDown":"keyUp",delayMs,vk,scan:0,extended:false,name};
}
function tap(vk,name,delay=80){
  return [key(vk,name,true,delay),key(vk,name,false,55)];
}
function chord(modVk,modName,keyVk,keyName){
  return [key(modVk,modName,true,60),key(keyVk,keyName,true,40),key(keyVk,keyName,false,45),key(modVk,modName,false,35)];
}
function macro(id,name,events){
  return {
    schema:1,
    id,
    name,
    createdAt:"2026-09-14T00:00:00.000Z",
    updatedAt:"2026-09-14T00:00:00.000Z",
    durationMs:events.reduce((sum,event)=>sum+Number(event.delayMs||0),0),
    events,
  };
}
function preset(seed,name,value){
  return action(seed,"replay",name,{macro:value});
}

const examples={
  find:macro("starter-find","Find in App",chord(17,"Ctrl",70,"F")),
  save:macro("starter-save","Save",chord(17,"Ctrl",83,"S")),
  next3:macro("starter-next-fields","Next Fields",[...tap(9,"Tab",70),...tap(9,"Tab",120),...tap(9,"Tab",120)]),
};

function litePage(){
  return {
    label:"BASIC",
    actions:{
      "0,0":action("record","record","RECORD"),
      "1,0":action("play","replay","PLAY"),
      "2,0":action("stop","stop","STOP"),
      "0,1":preset("find","FIND",examples.find),
      "1,1":preset("save","SAVE",examples.save),
      "2,1":preset("next","NEXT x3",examples.next3),
    },
  };
}

function materializeActions(actions,fileSeed,pageIndex){
  const out={};
  for(const [position,source] of Object.entries(actions)){
    const value=structuredClone(source);
    value.ActionID=uuid(`action:${fileSeed}:${pageIndex}:${position}:${source._seed}:${source.UUID}`);
    delete value._seed;
    out[position]=value;
  }
  return out;
}

function crc32(buffer){
  let crc=0xffffffff;
  for(const value of buffer){
    crc^=value;
    for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return(crc^0xffffffff)>>>0;
}
function zip(entries){
  const locals=[],centrals=[];
  let offset=0;
  const date=((2026-1980)<<9)|(9<<5)|14;
  for(const [path,value] of entries){
    const name=Buffer.from(path);
    const raw=Buffer.from(value);
    const compressed=deflateRawSync(raw,{level:9});
    const crc=crc32(raw);

    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0);
    local.writeUInt16LE(20,4);
    local.writeUInt16LE(8,8);
    local.writeUInt16LE(date,12);
    local.writeUInt32LE(crc,14);
    local.writeUInt32LE(compressed.length,18);
    local.writeUInt32LE(raw.length,22);
    local.writeUInt16LE(name.length,26);
    locals.push(Buffer.concat([local,name,compressed]));

    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0);
    central.writeUInt16LE(20,4);
    central.writeUInt16LE(20,6);
    central.writeUInt16LE(8,10);
    central.writeUInt16LE(date,14);
    central.writeUInt32LE(crc,16);
    central.writeUInt32LE(compressed.length,20);
    central.writeUInt32LE(raw.length,24);
    central.writeUInt16LE(name.length,28);
    central.writeUInt32LE(offset,42);
    centrals.push(Buffer.concat([central,name]));
    offset+=30+name.length+compressed.length;
  }
  const directory=Buffer.concat(centrals);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);
  end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}

function buildProfile(page,fileSeed,profileName){
  const rootId=uuid(`profile-root:${fileSeed}`);
  const pageId=uuid(`profile-page:${fileSeed}:0`);
  const rootPath=`${rootId}.sdProfile`;
  const actions=materializeActions(page.actions,fileSeed,0);
  const entries=[
    [`${rootPath}/manifest.json`,JSON.stringify({Name:profileName,Pages:{Current:pageId,Pages:[pageId]},Version:"2.0"},null,2)],
    [`${rootPath}/Profiles/${folder(pageId)}/manifest.json`,JSON.stringify({Controllers:[{Actions:actions,Type:"Keypad"}]},null,2)],
  ];
  return {archive:zip(entries),actions};
}

await rm(profileDir,{recursive:true,force:true});
await mkdir(profileDir,{recursive:true});
await mkdir(profileMapDir,{recursive:true});

const variants=[
  {suffix:"mk2",deviceType:0,name:"Macro Recorder Lite Starter"},
  {suffix:"mini",deviceType:1,name:"Macro Recorder Lite Starter Mini"},
  {suffix:"xl",deviceType:2,name:"Macro Recorder Lite Starter XL"},
  {suffix:"plus",deviceType:7,name:"Macro Recorder Lite Starter +"},
  {suffix:"neo",deviceType:9,name:"Macro Recorder Lite Starter Neo"},
];

const allActionIds=new Map();
for(const variant of variants){
  const file=`macro-recorder-lite-starter-${variant.suffix}`;
  const page=litePage();
  const built=buildProfile(page,file,variant.name);

  for(const [position,item] of Object.entries(built.actions)){
    if(!item.ActionID)throw new Error(`${file} ${position} is missing ActionID`);
    if(allActionIds.has(item.ActionID)){
      throw new Error(`Duplicate ActionID ${item.ActionID}: ${allActionIds.get(item.ActionID)} and ${file} ${position}`);
    }
    allActionIds.set(item.ActionID,`${file} ${position}`);
  }

  if(Object.keys(built.actions).length!==6)throw new Error(`${file} expected exactly 6 actions`);

  await writeFile(resolve(profileDir,`${file}.streamDeckProfile`),built.archive);
  await writeFile(resolve(profileMapDir,`${file}.profile-map.json`),JSON.stringify({
    deviceType:variant.deviceType,
    pages:[{
      index:1,
      label:"BASIC",
      actions:Object.entries(built.actions).map(([position,item])=>({
        position,
        name:item.Name,
        uuid:item.UUID,
        actionId:item.ActionID,
      })),
    }],
  },null,2));
}

if(allActionIds.size!==variants.length*6)throw new Error("Expected 30 unique bundled profile ActionIDs.");
console.log("Built five Macro Recorder Lite profiles with Record / Play / Stop + Find / Save / Next x3 and unique ActionIDs.");
