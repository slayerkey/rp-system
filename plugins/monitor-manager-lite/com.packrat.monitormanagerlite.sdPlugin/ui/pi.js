const PACKRAT_MAKER_URL="https://marketplace.elgato.com/maker/packrat";
const VERIFIED_PRO_URL="https://marketplace.elgato.com/product/monitor-manager-pro-d1f16ff0-2433-4b67-991d-8dd9fcddd425";
let websocket=null,uiUuid="",actionId="",actionContext="",settings={},globalSettings={},monitorRows=[],proUrl=VERIFIED_PRO_URL;
function connectElgatoStreamDeckSocket(inPort,inUUID,inRegisterEvent,inInfo,inActionInfo){
  uiUuid=inUUID;
  try{const info=JSON.parse(inActionInfo||"{}");actionId=String(info.action||"");actionContext=String(info.context||"");settings=info.payload?.settings??{};}catch{settings={};}
  websocket=new WebSocket("ws://127.0.0.1:"+inPort);
  websocket.onopen=()=>{websocket.send(JSON.stringify({event:inRegisterEvent,uuid:uiUuid}));build();render();requestGlobalSettings();requestData();};
  websocket.onmessage=(event)=>{const message=JSON.parse(event.data);if(message.event==="didReceiveSettings"){settings=message.payload?.settings??{};render();}if(message.event==="didReceiveGlobalSettings"){globalSettings=message.payload?.settings??{};render();}if(message.event==="sendToPropertyInspector"&&message.payload?.type==="monitor-data"){monitorRows=Array.isArray(message.payload.monitors)?message.payload.monitors:[];if(message.payload.configuredMonitorKey)globalSettings={...globalSettings,monitorKey:message.payload.configuredMonitorKey};proUrl=message.payload.proMarketplaceUrl||VERIFIED_PRO_URL;render();}};
}
function send(event,payload={}){if(websocket?.readyState===WebSocket.OPEN)websocket.send(JSON.stringify({event,...payload}));}
function save(){send("setSettings",{action:actionId,context:uiUuid,payload:settings});}
function requestData(){send("sendToPlugin",{action:actionId,context:uiUuid,payload:{type:"refresh-monitors",actionContext}});}
function requestGlobalSettings(){send("getGlobalSettings",{context:uiUuid});}
function saveGlobalSettings(){send("setGlobalSettings",{context:uiUuid,payload:globalSettings});}
function openUrl(url){send("openUrl",{payload:{url:url||PACKRAT_MAKER_URL}});}
function opt(select,value,label){const o=document.createElement("option");o.value=value;o.textContent=label;select.appendChild(o);}
function selectedMonitor(){return globalSettings.monitorKey?monitorRows.find(m=>m.monitorKey===globalSettings.monitorKey)??null:monitorRows[0]??null;}
function render(){
  const monitor=document.getElementById("monitor");if(monitor){monitor.textContent="";const configured=globalSettings.monitorKey;if(configured&&!monitorRows.some(m=>m.monitorKey===configured))opt(monitor,configured,"Configured monitor not connected");for(const m of monitorRows)opt(monitor,m.monitorKey,(m.description||m.deviceName)+(m.currentMode?(" · "+m.currentMode.width+"×"+m.currentMode.height+" @ "+m.currentMode.frequency+" Hz"):""));monitor.value=configured??monitorRows[0]?.monitorKey??"";}
  const row=selectedMonitor(),caps=document.getElementById("capabilities");if(caps){if(!row)caps.textContent=globalSettings.monitorKey?"CONFIGURED MONITOR NOT CONNECTED":"NO MONITOR DETECTED";else{const v=row.capabilities?.brightness;caps.textContent="BRIGHTNESS "+(typeof v==="string"?v:(v?.state??"UNKNOWN"));}}
  const bm=document.getElementById("brightnessMode");if(bm)bm.value=settings.mode??"set";const bv=document.getElementById("brightnessValue");if(bv&&document.activeElement!==bv)bv.value=String(settings.value??65);const bs=document.getElementById("brightnessStep");if(bs&&document.activeElement!==bs)bs.value=String(settings.step??5);
}
function build(){
  document.getElementById("packratBrand")?.addEventListener("click",()=>openUrl(PACKRAT_MAKER_URL));
  document.getElementById("topPro")?.addEventListener("click",()=>openUrl(proUrl));
  document.getElementById("pro")?.addEventListener("click",()=>openUrl(proUrl));
  document.getElementById("refresh")?.addEventListener("click",requestData);
  document.getElementById("monitor")?.addEventListener("change",e=>{globalSettings={...globalSettings,monitorKey:e.target.value};saveGlobalSettings();render();});
  document.getElementById("brightnessMode")?.addEventListener("change",e=>{settings={...settings,mode:e.target.value};save();});
  document.getElementById("brightnessValue")?.addEventListener("change",e=>{settings={...settings,value:Number(e.target.value)};save();});
  document.getElementById("brightnessStep")?.addEventListener("change",e=>{settings={...settings,step:Number(e.target.value)};save();});
}
