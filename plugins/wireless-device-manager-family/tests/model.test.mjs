import assert from "node:assert/strict";
import test from "node:test";
import {
  DeviceCatalog,
  batteryLabel,
  capabilities,
  deviceViewTitle,
  groupSummary,
  nextFavorite,
  normalizeDevice,
  parseGroupNames,
  resolveSelectedDeviceId,
  shouldApplySnapshot,
  shouldLowBatteryAlert,
  stableId,
  statusLabel
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

test("stable identity prefers physical container, then Bluetooth address, then endpoint id",()=>{
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

test("sleeping paired devices remain paired and render as sleep/off",()=>{
  const c=new DeviceCatalog();
  c.ingest([mouse],1000);
  const sleeping=c.get(stableId(mouse));
  assert.equal(sleeping?.paired,true);
  assert.equal(sleeping?.present,false);
  assert.match(statusLabel(sleeping),/SLEEP\/OFF/);
});

test("removed devices become unpaired and stale telemetry/control is hidden",()=>{
  const c=new DeviceCatalog();
  c.ingest([headphone,keyboard,mouse],1000);
  c.ingest([headphone],2000);
  const removed=c.get(stableId(mouse));
  assert.equal(removed?.paired,false);
  assert.equal(removed?.present,false);
  assert.equal(removed?.connected,false);
  assert.equal(removed?.capabilities.CONNECT,false);
  assert.equal(removed?.capabilities.BATTERY,false);
  assert.match(statusLabel(removed),/UNPAIRED/);
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


test("Lite shares one selected device while Pro keeps per-key targets",()=>{
  assert.equal(resolveSelectedDeviceId("lite","bt:global","bt:local"),"bt:global");
  assert.equal(resolveSelectedDeviceId("lite",null,"bt:local"),"bt:local");
  assert.equal(resolveSelectedDeviceId("pro","bt:global","bt:local"),"bt:local");
  assert.equal(resolveSelectedDeviceId("pro","bt:global",null),null);
});

test("battery label exposes charging only when Windows reports it",()=>{
  assert.match(batteryLabel(normalizeDevice(headphone)),/CHARGING/);
  assert.match(batteryLabel(normalizeDevice(keyboard)),/BATTERY/);
  assert.equal(batteryLabel(normalizeDevice(mouse)),"BATTERY\nN/A");
});


test("disconnected but present audio device can advertise CONNECT without DISCONNECT",()=>{
  const d=normalizeDevice({...headphone,connected:false,present:true,control:{connect:true,disconnect:false}});
  assert.equal(d.connected,false);
  assert.equal(d.capabilities.CONNECT,true);
  assert.equal(d.capabilities.DISCONNECT,false);
  assert.equal(statusLabel(d).endsWith("DISCONNECTED"),true);
});

test("adapter-off and bridge-error snapshots are preserved rather than applied as removals",()=>{
  assert.equal(shouldApplySnapshot(true,true),true);
  assert.equal(shouldApplySnapshot(true,false),false);
  assert.equal(shouldApplySnapshot(false,true),false);
  assert.equal(shouldApplySnapshot(false,false),false);
});

test("sleep-resume transition restores live telemetry for the same stable device",()=>{
  const c=new DeviceCatalog();
  c.ingest([headphone],1000);
  c.ingest([{...headphone,connected:false,present:false,batteryPercent:63,charging:false}],2000);
  const asleep=c.get(stableId(headphone));
  assert.equal(asleep?.paired,true);
  assert.equal(asleep?.connected,false);
  assert.equal(asleep?.lastObservedAt,2000);
  c.ingest([{...headphone,connected:true,present:true,batteryPercent:62,charging:false}],3000);
  const resumed=c.get(stableId(headphone));
  assert.equal(resumed?.connected,true);
  assert.equal(resumed?.present,true);
  assert.equal(resumed?.batteryPercent,62);
  assert.equal(resumed?.lastObservedAt,3000);
});

test("dashboard low count respects per-device thresholds",()=>{
  const devices=[headphone,controller].map(d=>normalizeDevice(d));
  const ids=devices.map(d=>d.stableId);
  assert.deepEqual(groupSummary(devices,ids),{connected:2,total:2,low:1});
  assert.deepEqual(groupSummary(devices,ids,{[devices[0].stableId]:80,[devices[1].stableId]:10}),{connected:2,total:2,low:1});
  assert.deepEqual(groupSummary(devices,ids,{[devices[0].stableId]:80,[devices[1].stableId]:20}),{connected:2,total:2,low:2});
});


test("dual-mode endpoints sharing one Windows container union telemetry and control",()=>{
  const c=new DeviceCatalog();
  c.ingest([
    {
      ...headphone,
      id:"ble-endpoint",
      address:"AA:BB:CC:DD:EE:01",
      containerId:"physical-headset",
      kind:"ble",
      batteryPercent:73,
      charging:true,
      connected:false,
      control:{connect:false,disconnect:false}
    },
    {
      ...headphone,
      id:"classic-endpoint",
      address:"AA:BB:CC:DD:EE:02",
      containerId:"physical-headset",
      kind:"classic",
      controlId:"AABBCCDDEE02",
      batteryPercent:null,
      charging:null,
      connected:true,
      control:{connect:true,disconnect:true}
    }
  ],1000);
  assert.equal(c.list().length,1);
  const device=c.list()[0];
  assert.equal(device.stableId,"container:physical-headset");
  assert.equal(device.kind,"dual");
  assert.equal(device.connected,true);
  assert.equal(device.batteryPercent,73);
  assert.equal(device.charging,true);
  assert.equal(device.capabilities.BATTERY,true);
  assert.equal(device.capabilities.CHARGING,true);
  assert.equal(device.capabilities.CONNECT,true);
  assert.equal(device.capabilities.DISCONNECT,true);
  assert.equal(device.controlId,"AABBCCDDEE02");
  assert.equal(c.get("classic-endpoint")?.stableId,device.stableId);
  assert.equal(c.get("ble-endpoint")?.stableId,device.stableId);
});


test("fresh snapshot replaces prior connected state instead of OR-ing stale history",()=>{
  const c=new DeviceCatalog();
  c.ingest([{...headphone,containerId:"headset",connected:true,present:true}],1000);
  c.ingest([{...headphone,containerId:"headset",connected:false,present:true,control:{connect:true,disconnect:false}}],2000);
  const device=c.get("container:headset");
  assert.equal(device?.connected,false);
  assert.equal(device?.capabilities.CONNECT,true);
  assert.equal(device?.capabilities.DISCONNECT,false);
});


test("labeled bundled keys preserve live values",()=>{
  const connected=normalizeDevice(headphone);
  const disconnected=normalizeDevice({...headphone,connected:false,present:true,control:{connect:true,disconnect:false}});
  assert.equal(deviceViewTitle(connected,"status","HEADPHONES"),"HEADPHONES\nCONNECTED");
  assert.equal(deviceViewTitle(connected,"battery","HEADPHONES"),"HEADPHONES\n64% CHG");
  assert.equal(deviceViewTitle(normalizeDevice(keyboard),"battery","KEYBOARD"),"KEYBOARD\n41%");
  assert.equal(deviceViewTitle(normalizeDevice(mouse),"battery","MOUSE"),"MOUSE\nN/A");
  assert.equal(deviceViewTitle(connected,"control","CONNECT"),"DISCONNECT");
  assert.equal(deviceViewTitle(disconnected,"control","CONNECT"),"CONNECT");
});


test("group names are case-insensitive, trimmed and deduplicated",()=>{
  assert.deepEqual(parseGroupNames(" gaming, TRAVEL, gaming , work "),["GAMING","TRAVEL","WORK"]);
  assert.deepEqual(parseGroupNames(" , , "),[]);
});


test("classic control target survives reverse dual-mode endpoint order",()=>{
  const c=new DeviceCatalog();
  c.ingest([
    {...headphone,id:"classic",containerId:"physical",address:"AA:BB:CC:DD:EE:02",controlId:"AABBCCDDEE02",kind:"classic",control:{connect:true,disconnect:true}},
    {...headphone,id:"ble",containerId:"physical",address:"AA:BB:CC:DD:EE:01",kind:"ble",control:{connect:false,disconnect:false}}
  ],1000);
  const device=c.list()[0];
  assert.equal(device.controlId,"AABBCCDDEE02");
  assert.equal(device.capabilities.CONNECT,true);
});
