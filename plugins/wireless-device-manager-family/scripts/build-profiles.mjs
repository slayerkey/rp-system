import { resolve } from "node:path";
import { profileAction, writeProfiles } from "../../../tools/streamdeck/profile-builder.mjs";

const U={
  liteDevice:"com.packrat.wireless-device-manager.device",
  proDevice:"com.packrat.wireless-device-manager-pro.device",
  dashboard:"com.packrat.wireless-device-manager-pro.dashboard",
  cycle:"com.packrat.wireless-device-manager-pro.cycle"
};

function liteDevice(seed,label,view){
  return profileAction(seed,U.liteDevice,"Wireless Device",{label,view});
}

function proDevice(seed,view,slot,label=""){
  return profileAction(seed,U.proDevice,"Wireless Device",{
    label,
    view,
    lowBatteryThreshold:20,
    favorite:true,
    groupName:"",
    slot
  });
}

function dashboard(seed,groupName=""){
  return profileAction(seed,U.dashboard,"Device Dashboard",{groupName});
}

function cycle(seed){
  return profileAction(seed,U.cycle,"Cycle Device",{});
}

function fullDevicePage(prefix){
  return {
    label:"DEVICES",
    keypad:{
      "0,0":proDevice(prefix+":device1-status","status","DEVICE_1"),
      "1,0":proDevice(prefix+":device1-battery","battery","DEVICE_1","BATTERY"),
      "2,0":proDevice(prefix+":device2-status","status","DEVICE_2"),
      "3,0":proDevice(prefix+":device2-battery","battery","DEVICE_2","BATTERY"),
      "4,0":dashboard(prefix+":all"),
      "0,1":proDevice(prefix+":device1-control","control","DEVICE_1"),
      "1,1":cycle(prefix+":cycle")
    }
  };
}

function compactDevicePage(prefix){
  return {
    label:"DEVICES",
    keypad:{
      "0,0":proDevice(prefix+":device1-status","status","DEVICE_1"),
      "1,0":proDevice(prefix+":device1-battery","battery","DEVICE_1","BATTERY"),
      "2,0":proDevice(prefix+":device2-status","status","DEVICE_2"),
      "3,0":proDevice(prefix+":device2-battery","battery","DEVICE_2","BATTERY"),
      "0,1":proDevice(prefix+":device1-control","control","DEVICE_1"),
      "1,1":cycle(prefix+":cycle"),
      "2,1":dashboard(prefix+":all")
    }
  };
}

function miniDevicePage(prefix){
  return {
    label:"DEVICES",
    keypad:{
      "0,0":proDevice(prefix+":device1-status","status","DEVICE_1"),
      "1,0":proDevice(prefix+":device1-battery","battery","DEVICE_1","BATTERY"),
      "2,0":dashboard(prefix+":all"),
      "0,1":proDevice(prefix+":device1-control","control","DEVICE_1"),
      "1,1":cycle(prefix+":cycle"),
      "2,1":proDevice(prefix+":device2-status","status","DEVICE_2")
    }
  };
}

function groupPage(prefix,compact=false){
  const keypad={
    "0,0":dashboard(prefix+":all-groups"),
    "1,0":dashboard(prefix+":gaming","GAMING"),
    "2,0":dashboard(prefix+":work","WORK")
  };
  if(!compact)keypad["3,0"]=dashboard(prefix+":travel","TRAVEL");
  else keypad["0,1"]=dashboard(prefix+":travel","TRAVEL");
  return {label:"GROUPS",keypad};
}

const liteSpecs=[
  ["standard","Stream Deck"],["mini","Stream Deck Mini"],["xl","Stream Deck XL"],
  ["plus","Stream Deck +"],["neo","Stream Deck Neo"]
].map(([suffix,name])=>({
  file:"wireless-device-manager-"+suffix,
  name:"Wireless Device Manager Lite - "+name,
  keypad:{
    "0,0":liteDevice("lite:"+suffix+":status","MY DEVICE","status"),
    "1,0":liteDevice("lite:"+suffix+":battery","BATTERY","battery"),
    "2,0":liteDevice("lite:"+suffix+":control","CONNECT","control")
  }
}));

const proSpecs=[
  {suffix:"standard",name:"Stream Deck",pages:[fullDevicePage("standard"),groupPage("standard")]},
  {suffix:"mini",name:"Stream Deck Mini",pages:[miniDevicePage("mini"),groupPage("mini",true)]},
  {suffix:"xl",name:"Stream Deck XL",pages:[fullDevicePage("xl"),groupPage("xl")]},
  {suffix:"plus",name:"Stream Deck +",pages:[compactDevicePage("plus"),groupPage("plus",true)]},
  {suffix:"neo",name:"Stream Deck Neo",pages:[compactDevicePage("neo"),groupPage("neo",true)]}
].map(spec=>({
  file:"wireless-device-manager-pro-"+spec.suffix,
  name:"Wireless Device Manager Pro - "+spec.name,
  pages:spec.pages
}));

await writeProfiles(resolve("com.packrat.wireless-device-manager.sdPlugin","profiles"),liteSpecs);
await writeProfiles(resolve("com.packrat.wireless-device-manager-pro.sdPlugin","profiles"),proSpecs);
console.log("Built ten Wireless Device Manager profiles with canonical full-key ownership and Pro workflow pages.");
