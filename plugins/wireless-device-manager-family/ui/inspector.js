let ws, uuid, actionInfo={}, settings={}, snapshot=null;
const $=id=>document.getElementById(id);

window.connectElgatoStreamDeckSocket=(port,inUUID,event,info,rawActionInfo)=>{
  uuid=inUUID; actionInfo=JSON.parse(rawActionInfo||"{}"); settings=actionInfo.payload?.settings||{};
  ws=new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onopen=()=>{
    ws.send(JSON.stringify({event,uuid}));
    ws.send(JSON.stringify({event:"getSettings",context:actionInfo.context}));
    sendPlugin({type:"get-wireless-snapshot"});
  };
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.event==="didReceiveSettings"){settings=msg.payload?.settings||{}; render();}
    if(msg.event==="sendToPropertyInspector" && msg.payload?.type==="wireless-snapshot"){snapshot=msg.payload; render();}
  };
};

function sendPlugin(payload){
  ws?.send(JSON.stringify({
    event:"sendToPlugin",
    action:actionInfo.action,
    context:actionInfo.context,
    payload
  }));
}
function save(patch){
  settings={...settings,...patch};
  ws?.send(JSON.stringify({event:"setSettings",context:actionInfo.context,payload:settings}));
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
  $("device-fields").hidden=!isDevice; $("dashboard-fields").hidden=!isDashboard; $("cycle-fields").hidden=!isCycle;
  $("lite-upsell").hidden=snapshot?.edition!=="lite";
  if(snapshot){
    $("status").textContent=snapshot.adapterAvailable ? (snapshot.error||`${snapshot.devices.length} paired Bluetooth device(s) visible`) : "Bluetooth adapter unavailable or disabled";
    $("status").className="status"+(snapshot.adapterAvailable?"":" bad");
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
  if(isDashboard) $("dashboardGroup").value=settings.groupName||"";
}

["deviceId","view","label","threshold","favorite","groupName","dashboardGroup"].forEach(id=>{
  const el=$(id); if(!el)return;
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
      if(deviceId && snapshot?.edition==="pro") sendPlugin({type:"set-threshold",deviceId,value});
    }else if(id==="favorite"){
      save({favorite:el.checked});
      const deviceId=selectedDeviceId();
      if(deviceId && snapshot?.edition==="pro") sendPlugin({type:"set-favorite",deviceId,value:el.checked});
    }else if(id==="groupName"){
      save({groupName:el.value});
      const deviceId=selectedDeviceId();
      if(deviceId && snapshot?.edition==="pro") sendPlugin({type:"set-groups",deviceId,value:el.value});
    }else if(id==="dashboardGroup"){
      save({groupName:el.value});
    }else{
      save({[id]:el.value});
    }
  });
});
render();
