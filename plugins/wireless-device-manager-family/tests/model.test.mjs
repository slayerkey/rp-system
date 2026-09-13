import assert from "node:assert/strict";
import test from "node:test";
import {
  DeviceCatalog,
  capabilities,
  groupSummary,
  nextFavorite,
  normalizeDevice,
  shouldLowBatteryAlert,
  stableId
} from "../src/model.ts";

const headphone={
  id:"AABBCCDDEEFF",name:"Studio Headphones",address:"AA:BB:CC:DD:EE:FF",
  paired:true,connected:true,present:true,batteryPercent:64,charging:true,
  control:{connect:true,disconnect:true}
};
const keyboard={
  id:"112233445566",name:"Wireless Keyboard",address:"11:22:33:44:55:66",
  paired:true,connected:true,present:true,batteryPercent:41,charging:null,
  control:{connect:false,disconnect:false}
};
const mouse={
  id:"778899AABBCC",name:"Wireless Mouse",address:"77:88:99:AA:BB:CC",
  paired:true,connected:false,present:false,batteryPercent:null,charging:null,
  control:{connect:false,disconnect:false}
};
const controller={
  id:"CCBBAA998877",name:"Xbox Wireless Controller",address:"CC:BB:AA:99:88:77",
  paired:true,connected:true,present:true,batteryPercent:18,charging:false,
  control:{connect:false,disconnect:false}
};

test("capabilities are advertised per-device, never globally",()=>{
  assert.deepEqual(capabilities(headphone),{STATUS:true,CONNECT:true,DISCONNECT:true,BATTERY:true,CHARGING:true});
  assert.deepEqual(capabilities(keyboard),{STATUS:true,CONNECT:false,DISCONNECT:false,BATTERY:true,CHARGING:false});
  assert.deepEqual(capabilities(mouse),{STATUS:true,CONNECT:false,DISCONNECT:false,BATTERY:false,CHARGING:false});
});

test("battery values are clamped only when telemetry exists",()=>{
  assert.equal(normalizeDevice({...headphone,batteryPercent:155}).batteryPercent,100);
  assert.equal(normalizeDevice({...mouse,batteryPercent:null}).batteryPercent,null);
});

test("stable identity prefers container then Bluetooth address then endpoint id",()=>{
  assert.equal(stableId({...headphone,containerId:"ABC-123"}),"container:abc-123");
  assert.equal(stableId(headphone),"bt:aabbccddeeff");
  assert.equal(stableId({id:"Endpoint-X"}),"id:endpoint-x");
});

test("duplicate friendly names remain distinct by stable identity",()=>{
  const c=new DeviceCatalog();
  c.ingest([
    {...keyboard,name:"MX Keys",address:"00:00:00:00:00:01"},
    {...keyboard,name:"MX Keys",address:"00:00:00:00:00:02"}
  ],1000);
  assert.equal(c.list().length,2);
  assert.notEqual(c.list()[0].stableId,c.list()[1].stableId);
});

test("device endpoint id changes survive when Bluetooth address is stable",()=>{
  const c=new DeviceCatalog();
  c.ingest([{...keyboard,id:"old-endpoint"}],1000);
  c.ingest([{...keyboard,id:"new-endpoint",batteryPercent:39}],2000);
  assert.equal(c.list().length,1);
  assert.equal(c.list()[0].batteryPercent,39);
  assert.equal(c.list()[0].lastObservedAt,2000);
});

test("removed/sleeping devices become unavailable rather than disappearing silently",()=>{
  const c=new DeviceCatalog();
  c.ingest([headphone,keyboard,mouse],1000);
  c.ingest([headphone],2000);
  const sleeping=c.get(stableId(mouse));
  assert.equal(sleeping?.present,false);
  assert.equal(sleeping?.connected,false);
  assert.equal(sleeping?.capabilities.CONNECT,false);
});

test("several devices at once summarize correctly",()=>{
  const devices=[headphone,keyboard,mouse,controller].map(d=>normalizeDevice(d));
  const ids=devices.map(d=>d.stableId);
  assert.deepEqual(groupSummary(devices,ids),{connected:3,total:4,low:1});
});

test("favorites cycle deterministically",()=>{
  const devices=[headphone,keyboard,controller].map(d=>normalizeDevice(d));
  const favorites=devices.map(d=>d.stableId);
  assert.equal(nextFavorite(devices,favorites,null)?.stableId,favorites[0]);
  assert.equal(nextFavorite(devices,favorites,favorites[0])?.stableId,favorites[1]);
  assert.equal(nextFavorite(devices,favorites,favorites[2])?.stableId,favorites[0]);
});

test("low battery alert fires only on threshold crossing",()=>{
  const d=normalizeDevice(controller);
  assert.deepEqual(shouldLowBatteryAlert(d,20,false),{low:true,fire:true});
  assert.deepEqual(shouldLowBatteryAlert(d,20,true),{low:true,fire:false});
  assert.deepEqual(shouldLowBatteryAlert({...d,batteryPercent:55},20,true),{low:false,fire:false});
});

test("unpaired fixture remains representable without inventing control",()=>{
  const d=normalizeDevice({...mouse,paired:false,present:false});
  assert.equal(d.paired,false);
  assert.equal(d.capabilities.CONNECT,false);
});

test("no-battery fixture does not advertise battery or charging",()=>{
  const d=normalizeDevice(mouse);
  assert.equal(d.capabilities.BATTERY,false);
  assert.equal(d.capabilities.CHARGING,false);
});

test("charging-supported fixture is distinct from plain battery",()=>{
  const a=normalizeDevice(headphone);
  const b=normalizeDevice(keyboard);
  assert.equal(a.capabilities.CHARGING,true);
  assert.equal(b.capabilities.CHARGING,false);
});
