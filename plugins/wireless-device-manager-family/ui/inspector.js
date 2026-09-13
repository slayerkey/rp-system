let ws, uuid, actionInfo={}, settings={}, snapshot=null;
const $=id=>document.getElementById(id);

window.connectElgatoStreamDeckSocket=(port,inUUID,event,info,rawActionInfo)=>{
  uuid=inUUID; actionInfo=JSON.parse(rawActionInfo||"{}"); settings=actionInfo.payload?.settings||{};
  ws=new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onopen=()=>{
    ws.send(JSON.stringify({event,uuid}));
    ws.send(JSON.stringify({event:"getSettings",context:actionInfo.context}));
    ws.send(JSON.stringify({event:"sendToPlugin",action:actionInfo.action,context:actionInfo.context,payload:{type:"get-wireless-snapshot"}}));
  };
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.event==="didReceiveSettings"){settings=msg.payload?.settings||{}; render();}
    if(msg.event==="sendToPropertyInspector" && msg.payload?.type==="wireless-snapshot"){snapshot=msg.payload; render();}
  };
};

function save(patch){
  settings={...settings,...patch};
  ws?.send(JSON.stringify({event:"setSettings",context:actionInfo.context,payload:settings}));
}
function esc(s){return String(s||"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function render(){
  const action=actionInfo.action||"";
  const isDevice=action.endsWith(".device"), isDashboard=action.endsWith(".dashboard"), isCycle=action.endsWith(".cycle");
  $("device-fields").hidden=!isDevice; $("dashboard-fields").hidden=!isDashboard; $("cycle-fields").hidden=!isCycle;
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
    const selectedId=snapshot?.edition==="lite" ? (snapshot?.liteDeviceId||settings.deviceId||"") : (settings.deviceId||"");
    select.value=selectedId;
    $("view").value=settings.view||"status"; $("label").value=settings.label||"";
    $("threshold").value=settings.lowBatteryThreshold??20; $("favorite").checked=settings.favorite===true; $("groupName").value=settings.groupName||"";
    $("pro-fields").hidden=snapshot?.edition!=="pro";
    const d=devices.find(x=>x.stableId===selectedId);
    $("caps").innerHTML=d?["STATUS","CONNECT","DISCONNECT","BATTERY","CHARGING"].map(c=>`<span class="cap ${d.capabilities?.[c]?"":"off"}">${c}</span>`).join(""):"";
  }
  if(isDashboard) $("dashboardGroup").value=settings.groupName||"";
}
["deviceId","view","label","threshold","favorite","groupName","dashboardGroup"].forEach(id=>{
  const el=$(id); if(!el)return;
  el.addEventListener(el.type==="checkbox"?"change":"change",()=>{
    if(id==="threshold") save({lowBatteryThreshold:Number(el.value||20)});
    else if(id==="favorite") save({favorite:el.checked});
    else if(id==="dashboardGroup") save({groupName:el.value});
    else save({[id]:el.value});
  });
});
render();
