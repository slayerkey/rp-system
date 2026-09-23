import test from "node:test";
import assert from "node:assert/strict";
import { HwinfoService } from "../src/hwinfo-service.js";

function catalog(count=500){
  return Array.from({length:count},(_,i)=>({
    id:"hwinfo:1:0:"+i,deviceId:"1:0",deviceName:i%2?"NVIDIA GeForce RTX 5090":"AMD Ryzen 9 9950X",
    name:i===7||i===8?"Duplicate Label":"Sensor "+i,originalName:"Original "+i,unit:i%3?"°C":"",type:i%2?"temperature":"usage",
    value:i,min:i-5,max:i+5,avg:i
  }));
}
test("large catalog search is paged and Unicode-safe", () => {
  const service=new HwinfoService();
  const sensors=catalog();
  sensors[3].deviceName="温度センサー – GPU";
  sensors[3].name="热点温度";
  service._handleLine(JSON.stringify({type:"catalog",status:{state:"ready"},sensors}));
  const page=service.search("",0,80);
  assert.equal(page.total,500);
  assert.equal(page.items.length,80);
  assert.equal(service.search("热点",0,80).items[0].id,sensors[3].id);
});
test("duplicate labels remain independently selectable", () => {
  const service=new HwinfoService();
  service._handleLine(JSON.stringify({type:"catalog",status:{state:"ready"},sensors:catalog(20)}));
  const matches=service.search("Duplicate Label",0,80).items;
  assert.equal(matches.length,2);
  assert.notEqual(matches[0].id,matches[1].id);
});
test("shutdown and restart preserve watched identity and recover", () => {
  const service=new HwinfoService();
  service.watch("hwinfo:1:0:7");
  service._handleLine(JSON.stringify({type:"status",status:{state:"not_running"}}));
  assert.equal(service.status.state,"not_running");
  service._handleLine(JSON.stringify({type:"catalog",status:{state:"ready"},sensors:catalog(20)}));
  assert.equal(service.status.state,"ready");
  assert.equal(service.sensor("hwinfo:1:0:7")?.name,"Duplicate Label");
});
test("rapid values do not create unbounded history", () => {
  const service=new HwinfoService();
  service.watch("hwinfo:1:0:1");
  service._handleLine(JSON.stringify({type:"catalog",status:{state:"ready"},sensors:catalog(3)}));
  for(let i=0;i<5000;i++) service._handleLine(JSON.stringify({type:"values",status:{state:"ready"},values:[{id:"hwinfo:1:0:1",value:i,min:0,max:i,avg:i/2}]}));
  assert.ok(service.histories.get("hwinfo:1:0:1").raw.length<=1500);
});
