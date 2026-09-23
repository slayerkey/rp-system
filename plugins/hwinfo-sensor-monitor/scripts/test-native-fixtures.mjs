import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SENSOR_SIZE=264, READING_SIZE=316, HEADER=48;
const ACTIVE=0x53695748, DEAD=0x44414544;
function fixed(buffer,offset,size,text){
  const bytes=Buffer.from(String(text||""),"utf8");
  bytes.copy(buffer,offset,0,Math.min(size-1,bytes.length));
}
function fixture(devices,readings,{dead=false}={}){
  const sensorOffset=HEADER, readingOffset=sensorOffset+devices.length*SENSOR_SIZE;
  const b=Buffer.alloc(readingOffset+readings.length*READING_SIZE);
  b.writeUInt32LE(dead?DEAD:ACTIVE,0); b.writeUInt32LE(1,4); b.writeUInt32LE(1,8);
  b.writeBigInt64LE(BigInt(1700000000),12);
  b.writeUInt32LE(sensorOffset,20); b.writeUInt32LE(SENSOR_SIZE,24); b.writeUInt32LE(devices.length,28);
  b.writeUInt32LE(readingOffset,32); b.writeUInt32LE(READING_SIZE,36); b.writeUInt32LE(readings.length,40); b.writeUInt32LE(500,44);
  devices.forEach((d,i)=>{
    const o=sensorOffset+i*SENSOR_SIZE;
    b.writeUInt32LE(d.id>>>0,o); b.writeUInt32LE(d.inst>>>0,o+4);
    fixed(b,o+8,128,d.orig); fixed(b,o+136,128,d.user||d.orig);
  });
  readings.forEach((x,i)=>{
    const o=readingOffset+i*READING_SIZE;
    b.writeUInt32LE(x.type??1,o); b.writeUInt32LE(x.sensorIndex>>>0,o+4); b.writeUInt32LE(x.id>>>0,o+8);
    fixed(b,o+12,128,x.orig); fixed(b,o+140,128,x.user||x.orig); fixed(b,o+268,16,x.unit||"");
    b.writeDoubleLE(x.value,o+284); b.writeDoubleLE(x.min??x.value,o+292); b.writeDoubleLE(x.max??x.value,o+300); b.writeDoubleLE(x.avg??x.value,o+308);
  });
  return b;
}
function run(path){
  const exe=resolve("com.packrat.hwinfo-sensor-monitor.sdPlugin","native","PackRat.HWiNFOReader.exe");
  const p=spawnSync(exe,["--fixture",path,"--once"],{encoding:"utf8",windowsHide:true});
  assert.equal(p.status,0,p.stderr||p.stdout);
  const lines=String(p.stdout||"").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  assert.ok(lines.length>0);
  return lines[0];
}

const dir=await mkdtemp(join(tmpdir(),"packrat-hwinfo-fixtures-"));
try{
  const devices=[
    {id:10,inst:0,orig:"AMD Ryzen 9 9950X"},
    {id:20,inst:0,orig:"Intel Core Ultra 9 285K"},
    {id:30,inst:0,orig:"NVIDIA GeForce RTX 5090"},
    {id:40,inst:0,orig:"温度センサー – マザーボード"}
  ];
  const readings=[
    {sensorIndex:0,id:1,type:1,orig:"CPU (Tctl/Tdie)",unit:"°C",value:71.125,min:35,max:93,avg:62},
    {sensorIndex:1,id:1,type:7,orig:"Total CPU Usage",unit:"%",value:55,min:0,max:100,avg:40},
    {sensorIndex:2,id:7,type:1,orig:"GPU Temperature",unit:"°C",value:68,min:30,max:89,avg:61},
    {sensorIndex:2,id:8,type:3,orig:"GPU Fan",unit:"RPM",value:1450,min:0,max:3100,avg:1200},
    {sensorIndex:2,id:9,type:5,orig:"GPU Power",unit:"W",value:375.55,min:22,max:600,avg:290},
    {sensorIndex:2,id:10,type:1,orig:"Duplicate Label",unit:"°C",value:50,min:20,max:70,avg:45},
    {sensorIndex:2,id:11,type:1,orig:"Duplicate Label",unit:"°C",value:51,min:21,max:71,avg:46},
    {sensorIndex:3,id:1,type:8,orig:"热点温度",unit:"",value:1e300,min:-1e300,max:1e300,avg:0}
  ];
  const normal=join(dir,"normal.bin"); await writeFile(normal,fixture(devices,readings));
  const message=run(normal);
  assert.equal(message.type,"catalog");
  assert.equal(message.status.state,"ready");
  assert.equal(message.sensors.length,readings.length);
  assert.equal(message.sensors[2].id,"hwinfo:30:0:7");
  assert.equal(message.sensors[5].name,message.sensors[6].name);
  assert.notEqual(message.sensors[5].id,message.sensors[6].id);
  assert.equal(message.sensors[7].deviceName,"温度センサー – マザーボード");
  assert.equal(message.sensors[7].name,"热点温度");
  assert.equal(message.sensors[7].unit,"");
  assert.equal(message.sensors[7].value,1e300);

  const manyDevices=[{id:100,inst:0,orig:"Stress Device"}];
  const manyReadings=Array.from({length:1600},(_,i)=>({sensorIndex:0,id:i+1,type:(i%8)+1,orig:"Sensor "+i,unit:i%2?"%":"",value:i-800,min:-999999,max:999999,avg:0}));
  const many=join(dir,"many.bin"); await writeFile(many,fixture(manyDevices,manyReadings));
  const manyMessage=run(many);
  assert.equal(manyMessage.sensors.length,1600);
  assert.equal(new Set(manyMessage.sensors.map(s=>s.id)).size,1600);

  const dead=join(dir,"dead.bin"); await writeFile(dead,fixture([],[],{dead:true}));
  const deadMessage=run(dead);
  assert.equal(deadMessage.type,"status");
  assert.equal(deadMessage.status.state,"shared_memory_expired");

  console.log("PASS: native HWiNFO fixtures: AMD, Intel, NVIDIA, Unicode, duplicates, missing units, extremes, 1600 sensors, DEAD/expired.");
} finally {
  await rm(dir,{recursive:true,force:true});
}
