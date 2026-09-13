import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const profileDir = resolve(root, "com.packrat.monitormanagerlite.sdPlugin", "profiles");

const UUID = {
  brightness: "com.packrat.monitormanagerlite.brightness",
  power: "com.packrat.monitormanagerlite.power",
  refresh: "com.packrat.monitormanagerlite.refresh-rate",
  status: "com.packrat.monitormanagerlite.status"
};

function deterministicUuid(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0,8).join("")}-${hex.slice(8,12).join("")}-${hex.slice(12,16).join("")}-${hex.slice(16,20).join("")}-${hex.slice(20,32).join("")}`.toUpperCase();
}

function pageFolderId(uuid) {
  const chunks = (uuid.replace(/-/g, "") + "000").match(/.{5}/g) || [];
  return chunks.map((chunk) => parseInt(chunk,16).toString(32).padStart(4,"0")).join("").slice(0,26).toUpperCase().replace(/V/g,"W").replace(/U/g,"V") + "Z";
}

function action(seed, uuid, name, title, settings = {}) {
  return {
    ActionID: deterministicUuid("monitor-lite-action:" + seed),
    LinkedTitle: true,
    Name: name,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [{
      Title: title,
      ShowTitle: true,
      TitleAlignment: "middle",
      TitleColor: "#FFFFFF",
      FontFamily: "Arial",
      FontSize: 12,
      FontStyle: "Regular",
      FontUnderline: false
    }]
  };
}

function pages(prefix, plus = false) {
  const monitorPage = {
    "0,0": action(prefix+":status", UUID.status, "Current Display Status", "MONITORS", {}),
    "1,0": action(prefix+":bright65", UUID.brightness, "Monitor Brightness", "65%", { mode:"set", value:65 }),
    "2,0": action(prefix+":power", UUID.power, "Monitor Power", "POWER", { power:"toggle" })
  };
  const modesPage = {
    "0,0": action(prefix+":60", UUID.refresh, "Refresh Rate Switch", "60 HZ", { refreshRate:60 }),
    "1,0": action(prefix+":120", UUID.refresh, "Refresh Rate Switch", "120 HZ", { refreshRate:120 }),
    "2,0": action(prefix+":144", UUID.refresh, "Refresh Rate Switch", "144 HZ", { refreshRate:144 }),
    "3,0": action(prefix+":165", UUID.refresh, "Refresh Rate Switch", "165 HZ", { refreshRate:165 }),
    "4,0": action(prefix+":240", UUID.refresh, "Refresh Rate Switch", "240 HZ", { refreshRate:240 })
  };
  if (plus) {\n    modesPage["0,1"] = modesPage["4,0"];\n    delete modesPage["4,0"];\n  }\n  const brightnessPage = {
    "0,0": action(prefix+":25", UUID.brightness, "Monitor Brightness", "25%", { mode:"set", value:25 }),
    "1,0": action(prefix+":50", UUID.brightness, "Monitor Brightness", "50%", { mode:"set", value:50 }),
    "2,0": action(prefix+":65b", UUID.brightness, "Monitor Brightness", "65%", { mode:"set", value:65 }),
    "3,0": action(prefix+":80", UUID.brightness, "Monitor Brightness", "80%", { mode:"set", value:80 }),
    "0,1": action(prefix+":down", UUID.brightness, "Monitor Brightness", "BRIGHT -", { mode:"down", step:5 }),
    "1,1": action(prefix+":up", UUID.brightness, "Monitor Brightness", "BRIGHT +", { mode:"up", step:5 })
  };
  const encoder = plus ? {
    "0,0": action(prefix+":dial", UUID.brightness, "Monitor Brightness", "BRIGHTNESS", { mode:"set", value:65, step:2 })
  } : null;
  return [
    { label:"MONITORS", keypad:monitorPage, encoder },
    { label:"DISPLAY MODES", keypad:modesPage, encoder },
    { label:"BRIGHTNESS", keypad:brightnessPage, encoder }
  ];
}

const specs = [
  { file:"monitor-manager-lite-standard", name:"Monitor Manager Lite", pages:pages("standard") },
  { file:"monitor-manager-lite-xl", name:"Monitor Manager Lite XL", pages:pages("xl") },
  { file:"monitor-manager-lite-plus", name:"Monitor Manager Lite +", pages:pages("plus", true) },
  { file:"monitor-manager-lite-virtual", name:"Monitor Manager Lite Virtual", pages:pages("virtual") }
];

function crc32(buffer) {
  let crc=0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit=0; bit<8; bit+=1) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}

function zip(entries) {
  const locals=[],centrals=[]; let offset=0;
  const date=((2026-1980)<<9)|(1<<5)|1;
  for (const [entryPath, rawValue] of entries) {
    const name=Buffer.from(entryPath.replace(/\\/g,"/"),"utf8");
    const raw=Buffer.isBuffer(rawValue)?rawValue:Buffer.from(rawValue,"utf8");
    const compressed=deflateRawSync(raw,{level:9});
    const crc=crc32(raw);
    const local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(0,6); local.writeUInt16LE(8,8);
    local.writeUInt16LE(0,10); local.writeUInt16LE(date,12); local.writeUInt32LE(crc,14); local.writeUInt32LE(compressed.length,18);
    local.writeUInt32LE(raw.length,22); local.writeUInt16LE(name.length,26); local.writeUInt16LE(0,28);
    const record=Buffer.concat([local,name,compressed]); locals.push(record);
    const central=Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0,8);
    central.writeUInt16LE(8,10); central.writeUInt16LE(0,12); central.writeUInt16LE(date,14); central.writeUInt32LE(crc,16);
    central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(raw.length,24); central.writeUInt16LE(name.length,28);
    central.writeUInt16LE(0,30); central.writeUInt16LE(0,32); central.writeUInt16LE(0,34); central.writeUInt16LE(0,36);
    central.writeUInt32LE(0,38); central.writeUInt32LE(offset,42); centrals.push(Buffer.concat([central,name])); offset+=record.length;
  }
  const centralData=Buffer.concat(centrals);
  const end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4); end.writeUInt16LE(0,6); end.writeUInt16LE(entries.length,8);
  end.writeUInt16LE(entries.length,10); end.writeUInt32LE(centralData.length,12); end.writeUInt32LE(offset,16); end.writeUInt16LE(0,20);
  return Buffer.concat([...locals,centralData,end]);
}

function buildProfile(spec) {
  const rootUuid=deterministicUuid("monitor-lite-root:"+spec.file);
  const pageIds=spec.pages.map((page,index)=>deterministicUuid("monitor-lite-page:"+spec.file+":"+index+":"+page.label));
  const rootPath=`${rootUuid}.sdProfile`;
  const entries=[[rootPath+"/manifest.json",JSON.stringify({
    Name:spec.name,
    Pages:{Current:pageIds[0],Pages:pageIds},
    Version:"2.0"
  },null,2)]];
  spec.pages.forEach((page,index)=>{
    const controllers=[{Actions:page.keypad,Type:"Keypad"}];
    if(page.encoder) controllers.push({Actions:page.encoder,Type:"Encoder"});
    entries.push([`${rootPath}/Profiles/${pageFolderId(pageIds[index])}/manifest.json`,JSON.stringify({Controllers:controllers},null,2)]);
  });
  return zip(entries);
}

await rm(profileDir,{recursive:true,force:true});
await mkdir(profileDir,{recursive:true});
for(const spec of specs){
  await writeFile(resolve(profileDir,spec.file+".streamDeckProfile"),buildProfile(spec));
  console.log("Built "+spec.file);
}
