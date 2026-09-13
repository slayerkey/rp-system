let websocket=null,uuid=null,actionUuid="",settings={},monitorRows=[],proUrl=null;
const BRIGHTNESS="com.packrat.monitormanagerlite.brightness";
const POWER="com.packrat.monitormanagerlite.power";
const REFRESH="com.packrat.monitormanagerlite.refresh-rate";

function connectElgatoStreamDeckSocket(inPort,inUUID,inRegisterEvent,inInfo,inActionInfo){
  uuid=inUUID;
  try{const info=JSON.parse(inActionInfo);actionUuid=info.action??"";settings=info.payload?.settings??{};}catch{settings={};}
  websocket=new WebSocket("ws://127.0.0.1:"+inPort);
  websocket.onopen=()=>{websocket.send(JSON.stringify({event:inRegisterEvent,uuid:inUUID}));build();render();requestData();};
  websocket.onmessage=(event)=>{
    const message=JSON.parse(event.data);
    if(message.event==="didReceiveSettings"){settings=message.payload?.settings??{};render();}
    if(message.event==="sendToPropertyInspector"&&message.payload?.type==="monitor-data"){
      monitorRows=Array.isArray(message.payload.monitors)?message.payload.monitors:[];
      proUrl=message.payload.proMarketplaceUrl??null;
      render();
    }
  };
}
function save(){
  if(websocket?.readyState!==WebSocket.OPEN)return;
  websocket.send(JSON.stringify({event:"setSettings",action:actionUuid,context:uuid,payload:settings}));
}
function requestData(){
  if(websocket?.readyState!==WebSocket.OPEN)return;
  websocket.send(JSON.stringify({event:"sendToPlugin",action:actionUuid,context:uuid,payload:{type:"refresh-monitors"}}));
}
function openUrl(url){
  if(!url||websocket?.readyState!==WebSocket.OPEN)return;
  websocket.send(JSON.stringify({event:"openUrl",payload:{url}}));
}
function opt(select,value,label){const o=document.createElement("option");o.value=value;o.textContent=label;select.appendChild(o);}
function selectedMonitor(){return monitorRows.find(m=>m.monitorKey===settings.monitorKey)??monitorRows[0]??null;}
function render(){
  document.getElementById("brightnessCard")?.classList.toggle("hidden",actionUuid!==BRIGHTNESS);
  document.getElementById("powerCard")?.classList.toggle("hidden",actionUuid!==POWER);
  document.getElementById("refreshCard")?.classList.toggle("hidden",actionUuid!==REFRESH);
  document.getElementById("proCard")?.classList.toggle("hidden",!proUrl);

  const monitor=document.getElementById("monitor");
  if(monitor){
    monitor.textContent="";
    for(const m of monitorRows)opt(monitor,m.monitorKey,(m.description||m.deviceName)+(m.currentMode?(" · "+m.currentMode.width+"×"+m.currentMode.height+" @ "+m.currentMode.frequency+" Hz"):""));
    if(!settings.monitorKey&&monitorRows[0])settings={...settings,monitorKey:monitorRows[0].monitorKey};
    monitor.value=settings.monitorKey??"";
  }
  const row=selectedMonitor();
  const caps=document.getElementById("capabilities");
  if(caps&&row){
    const c=row.capabilities??{};
    const state=(x)=>typeof x==="string"?x:(x?.state??"UNKNOWN");
    caps.textContent="BRIGHTNESS "+state(c.brightness)+" · POWER "+state(c.power)+" · HDR "+state(c.hdr);
  }
  const refresh=document.getElementById("refreshRate");
  if(refresh&&row){
    const rates=[...new Set((row.modes??[]).filter(m=>!row.currentMode||m.width===row.currentMode.width&&m.height===row.currentMode.height).map(m=>m.frequency))].sort((a,b)=>a-b);
    refresh.textContent="";
    for(const rate of rates)opt(refresh,String(rate),String(rate)+" Hz");
    refresh.value=String(settings.refreshRate??row.currentMode?.frequency??rates[0]??60);
  }
  const bm=document.getElementById("brightnessMode");if(bm)bm.value=settings.mode??"set";
  const bv=document.getElementById("brightnessValue");if(bv&&document.activeElement!==bv)bv.value=String(settings.value??65);
  const bs=document.getElementById("brightnessStep");if(bs&&document.activeElement!==bs)bs.value=String(settings.step??5);
  const pm=document.getElementById("powerMode");if(pm)pm.value=settings.power??"toggle";
}
function build(){
  document.getElementById("refresh")?.addEventListener("click",requestData);
  document.getElementById("monitor")?.addEventListener("change",e=>{settings={...settings,monitorKey:e.target.value};save();render();});
  document.getElementById("brightnessMode")?.addEventListener("change",e=>{settings={...settings,mode:e.target.value};save();});
  document.getElementById("brightnessValue")?.addEventListener("change",e=>{settings={...settings,value:Number(e.target.value)};save();});
  document.getElementById("brightnessStep")?.addEventListener("change",e=>{settings={...settings,step:Number(e.target.value)};save();});
  document.getElementById("powerMode")?.addEventListener("change",e=>{settings={...settings,power:e.target.value};save();});
  document.getElementById("refreshRate")?.addEventListener("change",e=>{settings={...settings,refreshRate:Number(e.target.value)};save();});
  document.getElementById("pro")?.addEventListener("click",()=>openUrl(proUrl));
}
