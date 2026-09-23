import { resolve } from "node:path";
import { profileAction, writeProfiles } from "../../../tools/streamdeck/profile-builder.mjs";

const profileDir = resolve("com.packrat.hwinfo-sensor-monitor.sdPlugin","profiles");
const UUID = {
  sensor:"com.packrat.hwinfo-sensor-monitor.sensor",
  graph:"com.packrat.hwinfo-sensor-monitor.graph",
  dashboard:"com.packrat.hwinfo-sensor-monitor.dashboard",
  alert:"com.packrat.hwinfo-sensor-monitor.alert"
};
const A = {
  cpuTemp:"auto:cpu-temp", cpuLoad:"auto:cpu-load", cpuPower:"auto:cpu-power",
  gpuTemp:"auto:gpu-temp", gpuLoad:"auto:gpu-load", gpuPower:"auto:gpu-power",
  gpuFan:"auto:gpu-fan", ram:"auto:ram-load"
};
const action=(seed,uuid,name,settings={})=>profileAction("hwinfo-"+seed,uuid,name,settings);
const sensor=(seed,id,name)=>action(seed,UUID.sensor,name,{sensorId:id,precision:1,showMinMax:true,refreshMs:1000});
const graph=(seed,id,name,window=60000)=>action(seed,UUID.graph,name,{sensorId:id,precision:1,historyEnabled:true,historyWindowMs:window,refreshMs:1000});
const alert=(seed,id,name,warn,crit)=>action(seed,UUID.alert,name,{sensorId:id,warningThreshold:warn,criticalThreshold:crit,thresholdDirection:"above",refreshMs:1000});
const dash=(seed,ids,name="HWiNFO Dashboard")=>action(seed,UUID.dashboard,name,{sensorIds:ids,precision:1,historyEnabled:true,historyWindowMs:60000,refreshMs:1000});

function standard(prefix="mk2"){
  return {
    "0,0":graph(prefix+"-gpu-temp",A.gpuTemp,"GPU Temperature",60000),
    "1,0":graph(prefix+"-cpu-temp",A.cpuTemp,"CPU Temperature",60000),
    "2,0":sensor(prefix+"-gpu-load",A.gpuLoad,"GPU Load"),
    "3,0":sensor(prefix+"-cpu-load",A.cpuLoad,"CPU Load"),
    "4,0":sensor(prefix+"-ram",A.ram,"RAM Load"),
    "0,1":sensor(prefix+"-gpu-power",A.gpuPower,"GPU Power"),
    "1,1":sensor(prefix+"-cpu-power",A.cpuPower,"CPU Power"),
    "2,1":sensor(prefix+"-gpu-fan",A.gpuFan,"GPU Fan"),
    "3,1":alert(prefix+"-gpu-alert",A.gpuTemp,"GPU Temperature Alert",80,90),
    "4,1":alert(prefix+"-cpu-alert",A.cpuTemp,"CPU Temperature Alert",85,95),
    "0,2":dash(prefix+"-dash",[A.gpuTemp,A.cpuTemp,A.gpuLoad,A.cpuLoad,A.ram,A.gpuFan]),
    "1,2":graph(prefix+"-gpu-30",A.gpuTemp,"GPU Temp 30s",30000),
    "2,2":graph(prefix+"-cpu-5m",A.cpuTemp,"CPU Temp 5m",300000),
    "3,2":graph(prefix+"-gpu-load-5m",A.gpuLoad,"GPU Load 5m",300000),
    "4,2":graph(prefix+"-ram-5m",A.ram,"RAM Load 5m",300000)
  };
}
function xl(){
  const out={...standard("xl")};
  const extras=[
    [5,0,A.gpuTemp,"GPU Temp"],[6,0,A.cpuTemp,"CPU Temp"],[7,0,A.gpuFan,"GPU Fan"],
    [5,1,A.gpuPower,"GPU Power"],[6,1,A.cpuPower,"CPU Power"],[7,1,A.ram,"RAM Load"],
    [5,2,A.gpuLoad,"GPU Load"],[6,2,A.cpuLoad,"CPU Load"],[7,2,A.gpuTemp,"GPU Temp"],
    [0,3,A.cpuTemp,"CPU Temp"],[1,3,A.gpuFan,"GPU Fan"],[2,3,A.gpuPower,"GPU Power"],[3,3,A.cpuPower,"CPU Power"],
    [4,3,A.ram,"RAM Load"],[5,3,A.gpuLoad,"GPU Load"],[6,3,A.cpuLoad,"CPU Load"]
  ];
  for(const [x,y,id,name] of extras) out[x+","+y]=sensor("xl-extra-"+x+"-"+y,id,name);
  out["7,3"]=dash("xl-dash2",[A.gpuTemp,A.cpuTemp,A.gpuLoad,A.cpuLoad,A.ram,A.gpuFan,A.gpuPower,A.cpuPower]);
  return out;
}
const compact=(prefix)=>({
  "0,0":graph(prefix+"-gpu-temp",A.gpuTemp,"GPU Temp",60000),
  "1,0":graph(prefix+"-cpu-temp",A.cpuTemp,"CPU Temp",60000),
  "2,0":sensor(prefix+"-gpu-load",A.gpuLoad,"GPU Load"),
  "3,0":sensor(prefix+"-cpu-load",A.cpuLoad,"CPU Load"),
  "0,1":sensor(prefix+"-ram",A.ram,"RAM Load"),
  "1,1":sensor(prefix+"-fan",A.gpuFan,"GPU Fan"),
  "2,1":sensor(prefix+"-power",A.gpuPower,"GPU Power"),
  "3,1":dash(prefix+"-dash",[A.gpuTemp,A.cpuTemp,A.gpuLoad,A.cpuLoad,A.ram,A.gpuFan])
});
const plusEncoders={
  "0,0":dash("plus-dial-0",[A.gpuTemp,A.gpuLoad,A.gpuPower],"GPU Sensors"),
  "1,0":dash("plus-dial-1",[A.cpuTemp,A.cpuLoad,A.cpuPower],"CPU Sensors"),
  "2,0":dash("plus-dial-2",[A.ram,A.gpuFan,A.gpuTemp],"System Sensors"),
  "3,0":dash("plus-dial-3",[A.gpuTemp,A.cpuTemp,A.gpuLoad,A.cpuLoad,A.ram,A.gpuFan],"All Sensors")
};

await writeProfiles(profileDir,[
  {file:"hwinfo-dashboard-mk2",name:"PackRat HWiNFO Dashboard",width:5,height:3,keypad:standard()},
  {file:"hwinfo-dashboard-xl",name:"PackRat HWiNFO Dashboard XL",width:8,height:4,keypad:xl()},
  {file:"hwinfo-dashboard-plus",name:"PackRat HWiNFO Dashboard +",width:4,height:2,keypad:compact("plus"),encoder:plusEncoders},
  {file:"hwinfo-dashboard-neo",name:"PackRat HWiNFO Dashboard Neo",width:4,height:2,keypad:compact("neo")}
]);
