let ws, uiUuid="", actionUuid="", actionContext="", actionInfo={}, settings={}, snapshot=null, responseTimer=null, requestSequence=0, lastRequestId="";
const $=id=>document.getElementById(id);

function piLog(stage,details={}){
  const entry={stage,actionUuid,actionContext,uiUuid,...details};
  try{console.info("[Wireless PI]",entry);}catch{}
  if(ws?.readyState===WebSocket.OPEN){
    try{ws.send(JSON.stringify({event:"logMessage",payload:{message:"[Wireless PI] "+JSON.stringify(entry)}}));}catch{}
  }
}
function showStatus(text,bad=false,detail=""){
  const node=$("status"), detailNode=$("status-detail");
  if(node){node.textContent=text;node.className=bad?"status bad":"status";}
  if(detailNode)detailNode.textContent=detail||"";
}
function renderSafe(){
  try{render();}
  catch(error){
    const message=error instanceof Error?error.message:String(error);
    piLog("render-exception",{message,stack:error?.stack||""});
    showStatus("Property Inspector render failed",true,message);
  }
}

window.addEventListener("error",event=>{
  piLog("window-error",{message:String(event.message||event.error||"unknown")});
});
window.addEventListener("unhandledrejection",event=>{
  piLog("unhandled-rejection",{message:String(event.reason?.message||event.reason||"unknown")});
});

window.connectElgatoStreamDeckSocket=(port,inUUID,event,info,rawActionInfo)=>{
  uiUuid=inUUID;
  actionInfo=JSON.parse(rawActionInfo||"{}");
  actionUuid=String(actionInfo.action||"");
  actionContext=String(actionInfo.context||"");
  settings=actionInfo.payload?.settings||{};
  ws=new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onopen=()=>{
    ws.send(JSON.stringify({event,uuid:uiUuid}));
    piLog("websocket-registered",{port,registerEvent:event});
    showStatus("Property Inspector connected",false,"Requesting live wireless state...");
    renderSafe();
    requestSnapshot();
  };
  ws.onclose=event=>{
    clearTimeout(responseTimer);
    responseTimer=null;
    piLog("websocket-closed",{code:event.code,reason:event.reason||""});
    showStatus("Stream Deck Property Inspector connection closed",true,`WebSocket code ${event.code}`);
  };
  ws.onerror=()=>piLog("websocket-error");
  ws.onmessage=e=>{
    let msg;
    try{msg=JSON.parse(e.data);}
    catch(error){piLog("message-json-error",{raw:String(e.data).slice(0,240)});return;}
    piLog("message-received",{event:msg.event,payloadType:String(msg.payload?.type||""),requestId:String(msg.payload?.requestId||"")});
    if(msg.event==="didReceiveSettings"){
      settings=msg.payload?.settings||{};
      renderSafe();
    }
    if(msg.event==="sendToPropertyInspector" && msg.payload?.type==="wireless-snapshot"){
      snapshot=msg.payload;
      clearTimeout(responseTimer);
      responseTimer=null;
      const productTitle=$("product-title");
      if(productTitle)productTitle.textContent=snapshot.edition==="pro"?"Wireless Device Manager Pro":"Wireless Device Manager";
      const d=snapshot.diagnostics||{};
      piLog("snapshot-received",{
        devices:Array.isArray(snapshot.devices)?snapshot.devices.length:0,
        error:snapshot.error??null,
        refreshCount:d.refreshCount??0,
        runtimeStarted:d.runtimeStarted??false,
        responseRequestId:msg.payload?.requestId??null
      });
      renderSafe();
    }
    if(msg.event==="sendToPropertyInspector" && msg.payload?.type==="wireless-error"){
      clearTimeout(responseTimer);
      responseTimer=null;
      const message=String(msg.payload?.message||"Wireless plugin error");
      piLog("plugin-error",{message});
      showStatus("Wireless plugin error",true,message);
    }
  };
};

function sendPlugin(payload){
  if(ws?.readyState!==WebSocket.OPEN){
    piLog("command-not-sent",{reason:"websocket-not-open",type:String(payload?.type||"")});
    return false;
  }
  piLog("command-sent",{type:String(payload?.type||""),requestId:String(payload?.requestId||"")});
  ws.send(JSON.stringify({
    event:"sendToPlugin",
    action:actionUuid,
    context:uiUuid,
    payload:{...payload,actionContext}
  }));
  return true;
}
function requestSnapshot(){
  lastRequestId=`wireless-${Date.now()}-${++requestSequence}`;
  snapshot=null;
  showStatus("Refreshing wireless devices...",false,`Request ${lastRequestId}`);
  clearTimeout(responseTimer);
  responseTimer=null;
  if(!sendPlugin({type:"refresh-wireless",requestId:lastRequestId})){
    showStatus("Stream Deck connection unavailable",true,"The Property Inspector websocket is not open.");
    return;
  }
  responseTimer=setTimeout(()=>{
    responseTimer=null;
    if(snapshot)return;
    piLog("snapshot-timeout",{requestId:lastRequestId});
    showStatus(
      "Plugin process did not reply",
      true,
      `Request ${lastRequestId} reached the Stream Deck websocket but no Wireless snapshot returned within 4 seconds.`
    );
  },4000);
}
function save(patch){
  settings={...settings,...patch};
  piLog("settings-save",{keys:Object.keys(patch)});
  ws?.send(JSON.stringify({event:"setSettings",action:actionUuid,context:uiUuid,payload:settings}));
}
function esc(s){return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function selectedDeviceId(){
  if(snapshot?.edition==="lite") return snapshot?.liteDeviceId||settings.deviceId||"";
  const slot=settings.slot;
  return (slot && snapshot?.slots?.[slot]) || settings.deviceId || "";
}
function groupsFor(id){
  if(!id)return "";
  return Object.entries(snapshot?.groups||{})
    .filter(([,members])=>Array.isArray(members)&&members.includes(id))
    .map(([name])=>name)
    .join(", ");
}
function render(){
  const action=actionInfo.action||"";
  const isDevice=action.endsWith(".device"), isDashboard=action.endsWith(".dashboard"), isCycle=action.endsWith(".cycle");
  $("device-fields").hidden=!isDevice;
  $("dashboard-fields").hidden=!isDashboard;
  $("cycle-fields").hidden=!isCycle;
  $("lite-upsell").hidden=snapshot?.edition!=="lite";
  const proLink=$("pro-link");
  const proUrl=String(window.WIRELESS_PRO_MARKETPLACE_URL||"");
  const directProUrl=/^https:\/\/marketplace\.elgato\.com\/product\/[a-z0-9][a-z0-9-]*-[0-9a-f-]{36}\/?$/i.test(proUrl);
  proLink.hidden=!(snapshot?.edition==="lite" && directProUrl);
  if(!proLink.hidden)proLink.href=proUrl;

  if(snapshot){
    const devices=snapshot.devices||[];
    const bluetooth=snapshot.adapterAvailable===true;
    const hid=snapshot.hidAvailable===true;
    const d=snapshot.diagnostics||{};
    const diagnostic=`Plugin alive · refresh #${d.refreshCount??0} · bridge ${d.lastRefreshDurationMs??0} ms`;
    if(snapshot.error){
      showStatus("Wireless scan failed",true,`${snapshot.error} · ${diagnostic}`);
    }else if(devices.length){
      showStatus(`${devices.length} wireless device(s) visible${bluetooth?"":" · Bluetooth unavailable"}`,false,diagnostic);
    }else if(!bluetooth && hid){
      showStatus("No supported USB wireless devices found",true,`Bluetooth unavailable · ${diagnostic}`);
    }else{
      showStatus("No supported wireless devices found",true,diagnostic);
    }
  }

  if(isDevice){
    const select=$("deviceId");
    const devices=snapshot?.devices||[];
    select.innerHTML='<option value="">Select a device</option>'+devices.map(d=>{
      const suffix=d.address?d.address.slice(-4):d.stableId.slice(-4);
      return `<option value="${esc(d.stableId)}">${esc(d.name)} · ${esc(suffix)}</option>`;
    }).join("");
    const selectedId=selectedDeviceId();
    select.value=selectedId;
    $("view").value=settings.view||"status";
    $("label").value=settings.label||"";
    $("pro-fields").hidden=snapshot?.edition!=="pro";

    if(snapshot?.edition==="pro" && selectedId){
      $("threshold").value=snapshot?.thresholds?.[selectedId]??settings.lowBatteryThreshold??20;
      $("favorite").checked=(snapshot?.favorites||[]).includes(selectedId);
      $("groupName").value=groupsFor(selectedId);
    }else{
      $("threshold").value=settings.lowBatteryThreshold??20;
      $("favorite").checked=settings.favorite===true;
      $("groupName").value=settings.groupName||"";
    }

    const d=devices.find(x=>x.stableId===selectedId);
    $("caps").innerHTML=d?["STATUS","CONNECT","DISCONNECT","BATTERY","CHARGING"].map(c=>`<span class="cap ${d.capabilities?.[c]?"":"off"}">${c}</span>`).join(""):"";
  }
  if(isDashboard)$("dashboardGroup").value=settings.groupName||"";
}

["deviceId","view","label","threshold","favorite","groupName","dashboardGroup"].forEach(id=>{
  const el=$(id);if(!el)return;
  el.addEventListener("change",()=>{
    if(id==="deviceId"){
      const deviceId=el.value;
      save({deviceId});
      if(deviceId){
        sendPlugin({
          type:"select-device",
          deviceId,
          favorite:$("favorite").checked,
          groupName:$("groupName").value,
          lowBatteryThreshold:Number($("threshold").value||20),
          slot:settings.slot||""
        });
      }
    }else if(id==="threshold"){
      const value=Number(el.value||20);
      save({lowBatteryThreshold:value});
      const deviceId=selectedDeviceId();
      if(deviceId && snapshot?.edition==="pro")sendPlugin({type:"set-threshold",deviceId,value});
    }else if(id==="favorite"){
      save({favorite:el.checked});
      const deviceId=selectedDeviceId();
      if(deviceId && snapshot?.edition==="pro")sendPlugin({type:"set-favorite",deviceId,value:el.checked});
    }else if(id==="groupName"){
      save({groupName:el.value});
      const deviceId=selectedDeviceId();
      if(deviceId && snapshot?.edition==="pro")sendPlugin({type:"set-groups",deviceId,value:el.value});
    }else if(id==="dashboardGroup"){
      save({groupName:el.value});
    }else{
      save({[id]:el.value});
    }
  });
});

$("refresh")?.addEventListener("click",requestSnapshot);
renderSafe();

const packratBrand=$("packrat-brand");
packratBrand?.addEventListener("click",e=>{
  if(ws?.readyState!==WebSocket.OPEN)return;
  e.preventDefault();
  ws.send(JSON.stringify({event:"openUrl",payload:{url:"https://marketplace.elgato.com/maker/packrat"}}));
});
