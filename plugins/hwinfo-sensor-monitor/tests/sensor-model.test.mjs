import test from "node:test";
import assert from "node:assert/strict";
import { AUTO, finite, formatReading, normalizeSettings, resolveSensor, stableSensorId } from "../src/sensor-model.js";

test("stable identities do not depend on duplicate labels", () => {
  assert.equal(stableSensorId(1,0,44), "hwinfo:1:0:44");
  assert.notEqual(stableSensorId(1,0,44), stableSensorId(1,1,44));
  assert.notEqual(stableSensorId(1,0,44), stableSensorId(1,0,45));
});
test("missing values never become fake zero", () => {
  assert.equal(finite(null), null);
  assert.equal(finite(undefined), null);
  assert.equal(finite(""), null);
  assert.equal(formatReading(null, 1), "--");
  assert.equal(finite(0), 0);
});
test("smart selectors cover AMD Intel NVIDIA and RAM", () => {
  const catalog = [
    {id:"a",deviceName:"AMD Ryzen 9 9950X",name:"CPU Package",type:"temperature",unit:"°C"},
    {id:"b",deviceName:"Intel Core Ultra 9",name:"Total CPU Usage",type:"usage",unit:"%"},
    {id:"c",deviceName:"NVIDIA GeForce RTX 5090",name:"GPU Temperature",type:"temperature",unit:"°C"},
    {id:"d",deviceName:"Physical Memory",name:"Physical Memory Load",type:"usage",unit:"%"}
  ];
  assert.equal(resolveSensor(catalog,AUTO.CPU_TEMP)?.id,"a");
  assert.equal(resolveSensor(catalog,AUTO.CPU_LOAD)?.id,"b");
  assert.equal(resolveSensor(catalog,AUTO.GPU_TEMP)?.id,"c");
  assert.equal(resolveSensor(catalog,AUTO.RAM_LOAD)?.id,"d");
});
test("settings are bounded", () => {
  const s=normalizeSettings({precision:99,refreshMs:3,historyWindowMs:999,sensorIds:Array.from({length:30},(_,i)=>String(i))},"dashboard");
  assert.equal(s.precision,4);
  assert.equal(s.refreshMs,1000);
  assert.equal(s.historyWindowMs,30000);
  assert.equal(s.sensorIds.length,12);
});
