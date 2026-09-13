let websocket=null,uuid=null,actionUuid="",settings={},monitorRows=[],profiles=[];
const A={
 brightness:"com.packrat.monitormanagerpro.brightness",
 contrast:"com.packrat.monitormanagerpro.contrast",
 volume:"com.packrat.monitormanagerpro.volume",
 power:"com.packrat.monitormanagerpro.power",
 input:"com.packrat.monitormanagerpro.input",
 refresh:"com.packrat.monitormanagerpro.refresh-rate",
 resolution:"com.packrat.monitormanagerpro.resolution",
 hdr:"com.packrat.monitormanagerpro.hdr",
 topology:"com.packrat.monitormanagerpro.topology",
 orientation:"com.packrat.monitormanagerpro.orientation",
 save:"com.packrat.monitormanagerpro.save-profile",
 apply:"com.packrat.monitormanagerpro.apply-profile"
};

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
      profiles=Array.isArray(message.payload.profiles)?message.payload.profiles:[];
      render();
    }
  };
}
function save(){if(websocket?.readyState===WebSocket.OPEN)websocket.send(JSON.stringify({event:"setSettings",action:actionUuid,context:uuid,payload:settings}));}
function requestData(){if(websocket?.readyState===WebSocket.OPEN)websocket.send(JSON.stringify({event:"sendToPlugin",action:actionUuid,context:uuid,payload:{type:"refresh-monitors"}}));}
function opt(select,value,label){const o=document.createElement("option");o.value=value;o.textContent=label;select.appendChild(o);}
function currentMonitor(){return settings.monitorKey?monitorRows.find(m=>m.monitorKey===settings.monitorKey)??null:monitorRows[0]??null;}
function state(v){return typeof v==="string"?v:(v?.state??"UNKNOWN");}
function inputLabel(v){const labels={15:"DisplayPort 1",16:"DisplayPort 2",17:"HDMI 1",18:"HDMI 2",27:"USB-C"};return labels[v]??("Input 0x"+Number(v).toString(16).toUpperCase().padStart(2,"0"));}

function render(){
  const continuous=[A.brightness,A.contrast,A.volume].includes(actionUuid);
  document.getElementById("continuousCard")?.classList.toggle("hidden",!continuous);
  document.getElementById("powerCard")?.classList.toggle("hidden",actionUuid!==A.power);
  document.getElementById("inputCard")?.classList.toggle("hidden",actionUuid!==A.input);
  document.getElementById("refreshCard")?.classList.toggle("hidden",actionUuid!==A.refresh);
  document.getElementById("resolutionCard")?.classList.toggle("hidden",actionUuid!==A.resolution);
  document.getElementById("hdrCard")?.classList.toggle("hidden",actionUuid!==A.hdr);
  document.getElementById("topologyCard")?.classList.toggle("hidden",actionUuid!==A.topology);
  document.getElementById("orientationCard")?.classList.toggle("hidden",actionUuid!==A.orientation);
  document.getElementById("profileCard")?.classList.toggle("hidden",![A.save,A.apply].includes(actionUuid));

  const mon=document.getElementById("monitor");
  if(mon){
    mon.textContent="";
    if(settings.monitorKey&&!monitorRows.some(m=>m.monitorKey===settings.monitorKey)) opt(mon,settings.monitorKey,"Configured monitor not connected");
    for(const m of monitorRows){
      const suffix=m.currentMode?(" · "+m.currentMode.width+"×"+m.currentMode.height+" @ "+m.currentMode.frequency+" Hz"):"";
      opt(mon,m.monitorKey,(m.description||m.deviceName)+(m.primary?" · PRIMARY":"")+suffix);
    }
    if(!settings.monitorKey&&monitorRows[0]) {
      settings={...settings,monitorKey:monitorRows[0].monitorKey};
      save();
    }
    mon.value=settings.monitorKey??"";
  }

  const row=currentMonitor();
  const caps=document.getElementById("capabilities");
  if(caps){
    if(!row) caps.textContent=settings.monitorKey?"CONFIGURED MONITOR NOT CONNECTED":"NO MONITOR DETECTED";
    else {
      const c=row.capabilities??{};
      caps.textContent=[
        "BRIGHTNESS "+state(c.brightness),"CONTRAST "+state(c.contrast),"INPUT "+state(c.input),
        "VOLUME "+state(c.volume),"POWER "+state(c.power),"HDR "+state(c.hdr)
      ].join(" · ");
    }
  }

  if(continuous){
    const field=actionUuid===A.brightness?"value":actionUuid===A.contrast?"contrast":"volume";
    const label=actionUuid===A.brightness?"Brightness":actionUuid===A.contrast?"Contrast":"Monitor Volume";
    document.getElementById("continuousTitle").textContent=label;
    const input=document.getElementById("continuousValue");
    if(input&&document.activeElement!==input)input.value=String(settings[field]??65);
    const step=document.getElementById("continuousStep");
    if(step&&document.activeElement!==step)step.value=String(settings.step??2);
  }

  const power=document.getElementById("power");if(power)power.value=settings.power??"toggle";
  const hdr=document.getElementById("hdr");if(hdr)hdr.value=settings.hdr??"toggle";
  const topology=document.getElementById("topology");if(topology)topology.value=settings.topology??"extend";
  const orientation=document.getElementById("orientation");if(orientation)orientation.value=String(settings.orientation??0);

  const input=document.getElementById("inputValue");
  if(input&&!row) input.textContent="";
  if(input&&row){
    input.textContent="";
    const values=row.capabilities?.input?.values??[];
    if(!values.length)opt(input,"","No advertised input values");
    for(const v of values)opt(input,String(v),inputLabel(v));
    input.value=settings.inputValue===undefined?"":String(settings.inputValue);
  }

  const refresh=document.getElementById("refreshRate");
  if(refresh&&!row) refresh.textContent="";
  if(refresh&&row){
    const cur=row.currentMode;
    const rates=[...new Set((row.modes??[]).filter(m=>!cur||(m.width===cur.width&&m.height===cur.height)).map(m=>m.frequency))].sort((a,b)=>a-b);
    refresh.textContent="";for(const rate of rates)opt(refresh,String(rate),String(rate)+" Hz");
    refresh.value=String(settings.refreshRate??cur?.frequency??rates[0]??60);
  }

  const mode=document.getElementById("resolutionMode");
  if(mode&&!row) mode.textContent="";
  if(mode&&row){
    mode.textContent="";
    const modes=row.modes??[];
    modes.forEach((m,i)=>opt(mode,String(i),m.width+"×"+m.height+" @ "+m.frequency+" Hz"+(m.orientation?(" · rotation "+m.orientation):"")));
    const found=modes.findIndex(m=>m.width===settings.width&&m.height===settings.height&&m.frequency===settings.frequency&&Number(m.orientation??0)===Number(settings.orientation??0));
    mode.value=String(found>=0?found:0);
  }

  const list=document.getElementById("profiles");
  if(list){
    list.textContent="";
    opt(list,"","Saved profiles…");
    for(const name of profiles)opt(list,name,name);
  }
  const profile=document.getElementById("profileName");
  if(profile&&document.activeElement!==profile)profile.value=settings.profileName??"";
}
function build(){
  document.getElementById("refresh")?.addEventListener("click",requestData);
  document.getElementById("monitor")?.addEventListener("change",e=>{settings={...settings,monitorKey:e.target.value};save();render();});
  document.getElementById("continuousValue")?.addEventListener("change",e=>{
    const field=actionUuid===A.brightness?"value":actionUuid===A.contrast?"contrast":"volume";
    settings={...settings,[field]:Number(e.target.value)};save();
  });
  document.getElementById("continuousStep")?.addEventListener("change",e=>{settings={...settings,step:Number(e.target.value)};save();});
  document.getElementById("power")?.addEventListener("change",e=>{settings={...settings,power:e.target.value};save();});
  document.getElementById("inputValue")?.addEventListener("change",e=>{settings={...settings,inputValue:Number(e.target.value)};save();});
  document.getElementById("refreshRate")?.addEventListener("change",e=>{settings={...settings,refreshRate:Number(e.target.value)};save();});
  document.getElementById("resolutionMode")?.addEventListener("change",e=>{
    const m=currentMonitor()?.modes?.[Number(e.target.value)];
    if(!m)return;
    settings={...settings,width:m.width,height:m.height,frequency:m.frequency,orientation:Number(m.orientation??0)};save();
  });
  document.getElementById("hdr")?.addEventListener("change",e=>{settings={...settings,hdr:e.target.value};save();});
  document.getElementById("topology")?.addEventListener("change",e=>{settings={...settings,topology:e.target.value};save();});
  document.getElementById("orientation")?.addEventListener("change",e=>{settings={...settings,orientation:Number(e.target.value)};save();});
  document.getElementById("profileName")?.addEventListener("change",e=>{settings={...settings,profileName:e.target.value.trim()};save();render();});
}
