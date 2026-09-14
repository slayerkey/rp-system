import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const plugins = {
  lite: {
    root: "com.packrat.wireless-device-manager.sdPlugin",
    prefix: "wireless-device-manager",
    deviceUuid: "com.packrat.wireless-device-manager.device"
  },
  pro: {
    root: "com.packrat.wireless-device-manager-pro.sdPlugin",
    prefix: "wireless-device-manager-pro",
    deviceUuid: "com.packrat.wireless-device-manager-pro.device",
    dashboardUuid: "com.packrat.wireless-device-manager-pro.dashboard",
    cycleUuid: "com.packrat.wireless-device-manager-pro.cycle"
  }
};

function deterministicUuid(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("").toUpperCase();
  return `${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
}

function action(seed, name, uuid, settings={}, title=name.toUpperCase()) {
  return {
    ActionID: deterministicUuid(seed),
    LinkedTitle: true,
    Name: name,
    UUID: uuid,
    Settings: settings,
    State: 0,
    States: [{ Title: title, ShowTitle: true, TitleAlignment: "bottom", TitleColor: "#FFFFFF", FontFamily: "Arial", FontSize: 10, FontStyle: "Regular", FontUnderline: false }]
  };
}
function device(seed, cfg, label, view="status", extra={}) {
  return action(seed, "Wireless Device", cfg.deviceUuid, { label, view, ...extra }, label);
}
function dashboard(seed, cfg, groupName="") {
  return action(seed, "Device Dashboard", cfg.dashboardUuid, { groupName }, groupName || "ALL DEVICES");
}
function cycle(seed, cfg) {
  return action(seed, "Cycle Device", cfg.cycleUuid, {}, "CYCLE");
}

const layouts = {
  lite: {
    "0,0": (c)=>device("lite:my",c,"MY DEVICE","status"),
    "1,0": (c)=>device("lite:battery",c,"BATTERY","battery"),
    "2,0": (c)=>device("lite:connect",c,"CONNECT","control")
  },
  pro: {
    default: {
      "0,0": (c)=>device("pro:headphones",c,"HEADPHONES","status",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"HEADPHONES"}),
      "1,0": (c)=>device("pro:keyboard",c,"KEYBOARD","battery",{lowBatteryThreshold:20,favorite:true,groupName:"WORK",slot:"KEYBOARD"}),
      "2,0": (c)=>device("pro:mouse",c,"MOUSE","battery",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"MOUSE"}),
      "3,0": (c)=>device("pro:controller",c,"CONTROLLER","status",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING",slot:"CONTROLLER"}),
      "4,0": (c)=>dashboard("pro:all",c),
      "0,1": (c)=>device("pro:headphones-control",c,"CONNECT","control",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"HEADPHONES"}),
      "1,1": (c)=>cycle("pro:cycle",c),
      "2,1": (c)=>dashboard("pro:gaming",c,"GAMING"),
      "3,1": (c)=>dashboard("pro:work",c,"WORK"),
      "4,1": (c)=>dashboard("pro:travel",c,"TRAVEL")
    },
    compact: {
      "0,0": (c)=>device("pro:compact:headphones",c,"HEADPHONES","status",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"HEADPHONES"}),
      "1,0": (c)=>device("pro:compact:keyboard",c,"KEYBOARD","battery",{lowBatteryThreshold:20,favorite:true,groupName:"WORK",slot:"KEYBOARD"}),
      "2,0": (c)=>device("pro:compact:mouse",c,"MOUSE","battery",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"MOUSE"}),
      "3,0": (c)=>device("pro:compact:controller",c,"CONTROLLER","status",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING",slot:"CONTROLLER"}),
      "0,1": (c)=>dashboard("pro:compact:all",c),
      "1,1": (c)=>device("pro:compact:headphones-control",c,"CONNECT","control",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"HEADPHONES"}),
      "2,1": (c)=>cycle("pro:compact:cycle",c),
      "3,1": (c)=>dashboard("pro:compact:gaming",c,"GAMING")
    },
    mini: {
      "0,0": (c)=>device("pro:mini:headphones",c,"HEADPHONES","status",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"HEADPHONES"}),
      "1,0": (c)=>device("pro:mini:keyboard",c,"KEYBOARD","battery",{lowBatteryThreshold:20,favorite:true,groupName:"WORK",slot:"KEYBOARD"}),
      "2,0": (c)=>device("pro:mini:controller",c,"CONTROLLER","status",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING",slot:"CONTROLLER"}),
      "0,1": (c)=>device("pro:mini:headphones-control",c,"CONNECT","control",{lowBatteryThreshold:20,favorite:true,groupName:"GAMING, TRAVEL",slot:"HEADPHONES"}),
      "1,1": (c)=>cycle("pro:mini:cycle",c),
      "2,1": (c)=>dashboard("pro:mini:all",c)
    }
  }
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc>>>1) ^ (0xedb88320 & -(crc&1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zipStore(entries) {
  const local=[], central=[]; let offset=0;
  for (const entry of entries) {
    const name=Buffer.from(entry.name.replaceAll("\\","/"),"utf8");
    const data=Buffer.isBuffer(entry.data)?entry.data:Buffer.from(entry.data,"utf8");
    const crc=crc32(data), lh=Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50,0); lh.writeUInt16LE(20,4); lh.writeUInt16LE(0x0800,6);
    lh.writeUInt32LE(crc,14); lh.writeUInt32LE(data.length,18); lh.writeUInt32LE(data.length,22); lh.writeUInt16LE(name.length,26);
    local.push(lh,name,data);
    const ch=Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50,0); ch.writeUInt16LE(20,4); ch.writeUInt16LE(20,6); ch.writeUInt16LE(0x0800,8);
    ch.writeUInt32LE(crc,16); ch.writeUInt32LE(data.length,20); ch.writeUInt32LE(data.length,24); ch.writeUInt16LE(name.length,28); ch.writeUInt32LE(offset,42);
    central.push(ch,name); offset += lh.length+name.length+data.length;
  }
  const cb=Buffer.concat(central), end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(cb.length,12); end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,cb,end]);
}

for (const [edition,cfg] of Object.entries(plugins)) {
  const out=path.resolve(cfg.root,"profiles"); await mkdir(out,{recursive:true});
  for (const variant of [
    {suffix:"standard",name:"Stream Deck",deviceType:0},
    {suffix:"mini",name:"Stream Deck Mini",deviceType:1},
    {suffix:"xl",name:"Stream Deck XL",deviceType:2},
    {suffix:"plus",name:"Stream Deck +",deviceType:7},
    {suffix:"neo",name:"Stream Deck Neo",deviceType:9}
  ]) {
    const actions={};
    const layout = edition === "pro"
      ? (variant.suffix === "mini" ? layouts.pro.mini : ["plus","neo"].includes(variant.suffix) ? layouts.pro.compact : layouts.pro.default)
      : layouts.lite;
    for (const [pos,builder] of Object.entries(layout)) actions[pos]=builder(cfg);
    const root=deterministicUuid(`${edition}:${variant.suffix}:profile`);
    const manifest={Actions:actions,Name:`Wireless Device Manager ${edition==="pro"?"Pro":"Lite"} - ${variant.name}`,Version:"1.0"};
    const archive=zipStore([{name:`${root}.sdProfile/manifest.json`,data:JSON.stringify(manifest,null,2)+"\n"}]);
    await writeFile(path.join(out,`${cfg.prefix}-${variant.suffix}.streamDeckProfile`),archive);
  }
}
console.log("Built ten Wireless Device Manager profiles (Lite/Pro × Standard/Mini/XL/Plus/Neo).");
