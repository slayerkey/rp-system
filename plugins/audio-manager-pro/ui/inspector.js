(() => {
const PACKRAT_MAKER_URL="https://marketplace.elgato.com/maker/packrat";
const K={
  "com.packrat.audio-manager-pro.apply-profile":"apply",
  "com.packrat.audio-manager-pro.set-output":"set-output",
  "com.packrat.audio-manager-pro.set-input":"set-input",
  "com.packrat.audio-manager-pro.cycle-profile":"cycle",
  "com.packrat.audio-manager-pro.profile-status":"status",
  "com.packrat.audio-manager-pro.mute-default-mic":"mute-mic",
  "com.packrat.audio-manager-pro.profile-output-volume":"volume",
};
const S=[
  ["outputDefault","outputs"],
  ["outputCommunications","outputs"],
  ["inputDefault","inputs"],
  ["inputCommunications","inputs"],
];
const PROFILE_KINDS=new Set(["apply","cycle","status","volume"]);
let ws=null,uiUuid="",actionContext="",aid="",kind="apply";
let settings={profileId:"",role:"default",device:null,step:2};
let snap=null,g={profiles:[],lastAppliedProfileId:""},edit="",requestSeq=0;
let pendingAction=null,editorDirty=false,editorDraft=null,savingProfileId="";
let activeProfile=null,defaultMic=null;

const $=id=>document.getElementById(id);
const norm=v=>String(v||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();

function send(x){
  if(ws?.readyState!==WebSocket.OPEN)return false;
  ws.send(JSON.stringify(x));
  return true;
}
function showResult(id,status,message,failures=[]){
  const b=$(id);
  if(!b)return;
  const st=String(status||"").toUpperCase();
  const f=Array.isArray(failures)?failures:[];
  if(!st&&!message&&!f.length){b.hidden=true;return}
  b.hidden=false;
  b.className=`result ${st?st.toLowerCase():"pending"}`;
  b.textContent=f.length
    ? `${st||"FAILED"} · ${f.map(x=>x?.error).filter(Boolean).slice(0,2).join(" · ")}`
    : st&&message
      ? `${st} · ${message}`
      : message||st;
}
function pendingProfile(message){showResult("profileResultBox","",message)}
function pendingActionResult(message){showResult("actionResultBox","",message);$("actionFeedbackCard").hidden=false}
function transportFailure(message){showResult("resultBox","FAILED",message)}
function nextRequestId(){requestSeq+=1;return `audio-manager-pi-${Date.now()}-${requestSeq}`}
function cmd(command,extra={}){
  const ok=send({
    event:"sendToPlugin",
    action:aid,
    context:uiUuid,
    payload:{type:"audioManager.command",actionContext,requestId:nextRequestId(),command,...extra},
  });
  if(!ok)transportFailure("Property Inspector is not connected to Stream Deck.");
  return ok;
}

function ident(e){
  return{
    endpointId:String(e?.id||e?.endpointId||""),
    name:String(e?.name||""),
    instanceId:String(e?.instanceId||""),
    containerId:String(e?.containerId||"").toLowerCase(),
  };
}
function resolve(saved,list=[]){
  if(!saved)return null;
  let x=list.find(e=>String(e.id)===String(saved.endpointId||""));
  if(x)return x;
  if(saved.containerId&&saved.name){
    const m=list.filter(e=>norm(e.containerId)===norm(saved.containerId)&&norm(e.name)===norm(saved.name));
    if(m.length===1)return m[0];
  }
  return null;
}
function opt(sel,v,t,s=false){
  const o=document.createElement("option");
  o.value=v;o.textContent=t;o.selected=s;sel.appendChild(o);
}
function devices(sel,list,saved,blank=true){
  const found=resolve(saved,list);
  sel.replaceChildren();
  if(blank)opt(sel,"","Preserve current / not configured",!saved);
  else opt(sel,"","Choose a device",!saved);
  if(saved&&!found)opt(sel,"__saved__",`Missing · ${saved.name||"saved device"} · rebind required`,true);
  for(const e of list)opt(sel,String(e.id),String(e.name||"Unnamed audio device"),found?.id===e.id);
}
function profiles(){return Array.isArray(g.profiles)?g.profiles:[]}
function prof(id){return profiles().find(p=>p.id===id)||null}
function nextProfileName(){
  const names=new Set(profiles().map(p=>norm(p.name)));
  let n=1;while(names.has(norm(`Audio Profile ${n}`)))n++;
  return `Audio Profile ${n}`;
}

function actionSig(v={}){
  return JSON.stringify({
    profileId:String(v.profileId||""),
    role:v.role==="communications"?"communications":"default",
    device:v.device?ident(v.device):null,
    step:[1,2,5,10].includes(Number(v.step))?Number(v.step):2,
  });
}
function applyActionSettings(incoming={}){
  const hadPending=Boolean(pendingAction);
  const next={...settings,...incoming};
  if(pendingAction){
    if(actionSig(next)===actionSig(pendingAction))pendingAction=null;
    else Object.assign(next,pendingAction);
  }
  settings=next;
  actionUI();
  if(hadPending&&!pendingAction){
    pendingActionResult("Saved for this key");
    showResult("actionResultBox","SUCCESS","Saved for this key");
  }
}
function saveAction(){
  const n={...settings};
  if(["apply","status","volume"].includes(kind))n.profileId=$("actionProfile").value;
  if(["set-output","set-input"].includes(kind)){
    n.role=$("actionRole").value==="communications"?"communications":"default";
    const list=kind==="set-output"?snap?.outputs||[]:snap?.inputs||[];
    const v=$("actionDevice").value;
    if(!v)n.device=null;
    else if(v!=="__saved__"){
      const e=list.find(x=>String(x.id)===v);
      if(e)n.device=ident(e);
    }
  }
  if(kind==="volume")n.step=Number($("dialStep").value||2);
  settings=n;
  pendingAction={...n};
  pendingActionResult("Saving this key…");
  const ok=send({event:"setSettings",action:aid,context:uiUuid,payload:n});
  if(!ok)transportFailure("Could not save this action setting.");
}

function activeName(){
  return activeProfile?.name||"Custom / no exact profile match";
}
function roleEndpoint(){
  if(!snap)return null;
  const isOutput=kind==="set-output";
  const role=settings.role==="communications"?"communications":"default";
  const id=isOutput
    ? (role==="communications"?snap.communicationsOutputId:snap.defaultOutputId)
    : (role==="communications"?snap.communicationsInputId:snap.defaultInputId);
  const list=isOutput?snap.outputs||[]:snap.inputs||[];
  return list.find(x=>String(x.id)===String(id||""))||null;
}
function voiceMeeterDetected(){
  const all=[...(snap?.inputs||[]),...(snap?.outputs||[])];
  return all.some(item=>/voicemeeter/i.test(String(item?.name||"")));
}
function actionUI(){
  const usesProfile=["apply","status","volume"].includes(kind);
  $("profileAction").hidden=!usesProfile;
  $("cycleAction").hidden=kind!=="cycle";
  $("deviceAction").hidden=!["set-output","set-input"].includes(kind);
  $("micAction").hidden=kind!=="mute-mic";
  $("dialAction").hidden=kind!=="volume";
  $("profileManager").hidden=!PROFILE_KINDS.has(kind);
  $("waveNote").hidden=kind==="mute-mic"||kind==="set-input";

  if(usesProfile){
    const sel=$("actionProfile"),cur=settings.profileId||"";
    sel.replaceChildren();
    opt(sel,"",profiles().length?"Choose a profile":"Create a profile below",!cur);
    for(const p of profiles())opt(sel,p.id,p.name,p.id===cur);
    const hint=$("actionProfileHint"),valid=Boolean(cur&&prof(cur));
    hint.classList.toggle("warn",!valid);
    hint.textContent=valid
      ?"This key is pinned to the selected Audio Profile."
      :profiles().length
        ?"Choose the Audio Profile this key should use."
        :"Capture an Audio Profile below, then select it here.";
    $("activeProfileName").textContent=activeName();
  }

  if(kind==="cycle")$("cycleActiveProfileName").textContent=activeName();

  if(["set-output","set-input"].includes(kind)){
    const list=kind==="set-output"?snap?.outputs||[]:snap?.inputs||[];
    $("actionRole").value=settings.role==="communications"?"communications":"default";
    devices($("actionDevice"),list,settings.device,false);
    const hint=$("actionDeviceHint"),resolved=settings.device&&resolve(settings.device,list);
    hint.classList.toggle("warn",!resolved);
    hint.textContent=settings.device&&!resolved
      ?"Saved device identity changed. Select the intended device to rebind it."
      :resolved
        ?"This key switches only the selected Windows role."
        :"Choose the device this key should switch to.";
    $("currentRoleDevice").textContent=roleEndpoint()?.name||"No active device";
  }

  if(kind==="mute-mic"){
    const name=defaultMic?.name||"No default microphone";
    $("currentMicName").textContent=name;
    $("micRoutingNote").hidden=!voiceMeeterDetected();
    const pill=$("currentMicState");
    pill.className="state-pill";
    if(!defaultMic){
      pill.textContent="UNAVAILABLE";pill.classList.add("warn");
      $("currentMicHint").textContent="Windows does not currently expose a Default microphone.";
    }else if(defaultMic.split){
      pill.textContent="SPLIT";pill.classList.add("warn");
      $("currentMicHint").textContent="Windows Console and Multimedia inputs are different. Align the Default inputs before using this mute key.";
    }else if(!defaultMic.muteAvailable){
      pill.textContent="MUTE N/A";pill.classList.add("warn");
      $("currentMicHint").textContent="This Windows Default Input does not expose mute control.";
    }else if(defaultMic.muted){
      pill.textContent="MUTED";pill.classList.add("muted");
      $("currentMicHint").textContent="Press the key to unmute the Windows Default microphone.";
    }else{
      pill.textContent="LIVE";pill.classList.add("live");
      $("currentMicHint").textContent="Press the key to mute the Windows Default microphone.";
    }
  }

  $("dialStep").value=String(settings.step||2);
}

function connectionStatus(err){
  const d=$("statusDot");d.className="dot";
  if(err||snap?.error){
    d.classList.add("error");
    $("statusTitle").textContent="Windows audio unavailable";
    $("statusDetail").textContent=err||snap?.error;
  }else if(snap){
    d.classList.add("ready");
    $("statusTitle").textContent="Windows audio connected";
    $("statusDetail").textContent=`${snap.outputs?.length||0} outputs · ${snap.inputs?.length||0} inputs · role-aware`;
  }else{
    d.classList.add("warn");
    $("statusTitle").textContent="Connecting to Windows audio…";
    $("statusDetail").textContent="Reading the current Windows audio setup.";
  }
}
function renderLastResult(r){
  if(!r?.status)return;
  const target=r.scope==="profile"?"profileResultBox":"actionResultBox";
  showResult(target,r.status,r.message||"",r.failures||[]);
  if(target==="actionResultBox")$("actionFeedbackCard").hidden=false;
}

function editorProfile(){return prof(edit)||profiles()[0]||null}
function syncStateCtr(k){
  const pair=S.find(([key])=>key===k);
  const list=pair&&Array.isArray(snap?.[pair[1]])?snap[pair[1]]:[];
  const v=$(k+"Device").value,missingSaved=v==="__saved__";
  const current=v&&!missingSaved?list.find(x=>String(x.id)===v):null;
  const hasDevice=Boolean(v),volumeUnsupported=Boolean(current&&current.volumeAvailable===false);
  const muteUnsupported=Boolean(current&&current.muteAvailable===false);
  const rv=$(k+"RestoreVolume"),rm=$(k+"RestoreMute");
  if(volumeUnsupported)rv.checked=false;
  if(muteUnsupported)rm.checked=false;
  rv.disabled=!hasDevice||volumeUnsupported||(missingSaved&&!rv.checked);
  rm.disabled=!hasDevice||muteUnsupported||(missingSaved&&!rm.checked);
  $(k+"Volume").disabled=!hasDevice||volumeUnsupported||!rv.checked;
  $(k+"Muted").disabled=!hasDevice||muteUnsupported||!rm.checked;
}
function stateCtr(k,slot){
  const pair=S.find(([key])=>key===k);
  const list=pair&&Array.isArray(snap?.[pair[1]])?snap[pair[1]]:[];
  const v=$(k+"Device").value;
  const current=v&&v!=="__saved__"?list.find(x=>String(x.id)===v):null;
  const saved=slot?.volume;
  const hasSaved=saved!==null&&saved!==undefined&&saved!==""&&Number.isFinite(Number(saved));
  const live=current?.volumeAvailable===true&&Number.isFinite(Number(current.volume))?Math.round(Number(current.volume)):50;
  $(k+"RestoreVolume").checked=slot?.restoreVolume===true;
  $(k+"Volume").value=hasSaved?Math.round(Number(saved)):live;
  $(k+"RestoreMute").checked=slot?.restoreMute===true;
  $(k+"Muted").value=slot?.muted===true?"true":"false";
  syncStateCtr(k);
}
function profileFromEditor(p){
  if(!p)return null;
  const n={
    schemaVersion:1,id:p.id,
    name:$("profileName").value.trim().slice(0,80)||p.name,
    accent:/^#[0-9a-f]{6}$/i.test(String(p.accent||""))?String(p.accent).toUpperCase():"#FFB21E",
    slots:{},
  };
  for(const [k,l] of S)n.slots[k]=slot(k,l,p);
  return n;
}
function profileSig(p){
  if(!p)return "";
  const slots={};
  for(const [k] of S){
    const s=p?.slots?.[k]||null;
    slots[k]=s?{
      device:s.device?ident(s.device):null,
      restoreVolume:s.restoreVolume===true,
      volume:s.restoreVolume===true&&s.volume!==null?Number(s.volume):null,
      restoreMute:s.restoreMute===true,
      muted:s.muted===true,
    }:null;
  }
  return JSON.stringify({id:String(p.id||""),name:String(p.name||""),accent:String(p.accent||"").toUpperCase(),slots});
}
function updateSaveLabel(){
  const b=$("saveProfile");
  b.textContent=editorDirty?"Save profile · unsaved":"Save profile";
}
function clearEditorDraft(){editorDirty=false;editorDraft=null;savingProfileId="";updateSaveLabel()}
function markEditorDirty(){
  const p=editorProfile();if(!p)return;
  editorDirty=true;editorDraft=profileFromEditor(p);updateSaveLabel();
}
function editor(force=false){
  const ps=profiles();
  if(!ps.some(p=>p.id===edit)){edit=ps[0]?.id||"";clearEditorDraft()}
  const es=$("editorProfile"),current=edit;
  es.replaceChildren();
  opt(es,"",ps.length?"Choose a profile":"No profiles yet",!current);
  for(const p of ps)opt(es,p.id,p.name,p.id===current);
  const p=editorProfile();
  $("saveProfile").disabled=!p;$("deleteProfile").disabled=!p;
  if(!p){clearEditorDraft();validateEditor();return}
  if(editorDirty&&editorDraft?.id===p.id&&!force){updateSaveLabel();validateEditor();return}
  $("profileName").value=p.name||"";
  for(const [k,listKey] of S){
    const st=p?.slots?.[k]||null;
    devices($(k+"Device"),Array.isArray(snap?.[listKey])?snap[listKey]:[],st?.device||null,true);
    stateCtr(k,st);
  }
  updateSaveLabel();validateEditor();
}
function slot(k,listKey,p){
  const sel=$(k+"Device"),v=sel.value;
  if(!v)return null;
  const old=p?.slots?.[k]||null,list=Array.isArray(snap?.[listKey])?snap[listKey]:[];
  let device=old?.device||null;
  if(v!=="__saved__"){
    const e=list.find(x=>String(x.id)===v);
    device=e?ident(e):null;
  }
  if(!device)return null;
  const restoreVolume=$(k+"RestoreVolume").checked,restoreMute=$(k+"RestoreMute").checked;
  return{
    device,
    restoreVolume,
    volume:restoreVolume?Math.max(0,Math.min(100,Number($(k+"Volume").value||0))):null,
    restoreMute,
    muted:$(k+"Muted").value==="true",
  };
}
function validateEditor(){
  const box=$("profileValidation"),p=editorProfile();
  if(!p){box.hidden=true;return}
  const warnings=[],states=[];
  const proposedName=$("profileName").value.trim();
  if(proposedName&&profiles().some(x=>x.id!==p.id&&norm(x.name)===norm(proposedName)))
    warnings.push("Another Audio Profile already uses this name.");
  for(const [k,l] of S){
    const sel=$(k+"Device");
    if(sel.value==="__saved__")warnings.push("A saved device is missing and needs an explicit rebind.");
    const st=slot(k,l,p);if(st)states.push(st);
  }
  if(!states.length)warnings.push("This profile has no configured audio roles.");
  const seen=new Map();
  for(const st of states){
    const d=st.device||{},key=d.endpointId||(d.containerId&&d.name?`${norm(d.containerId)}|${norm(d.name)}`:"");
    if(!key)continue;
    const prior=seen.get(key);
    if(prior){
      if(st.restoreVolume&&prior.restoreVolume&&Number(st.volume)!==Number(prior.volume))
        warnings.push("The same device has conflicting saved volumes across roles; volume restore will be skipped.");
      if(st.restoreMute&&prior.restoreMute&&Boolean(st.muted)!==Boolean(prior.muted))
        warnings.push("The same device has conflicting saved mute states across roles; mute restore will be skipped.");
    }else seen.set(key,st);
  }
  const unique=[...new Set(warnings)];
  box.hidden=!unique.length;
  box.classList.toggle("warn",unique.length>0);
  box.textContent=unique.join(" ");
}
function saveProfile(){
  const p=editorProfile();if(!p)return;
  const n=profileFromEditor(p);
  editorDirty=true;editorDraft=n;savingProfileId=n.id;updateSaveLabel();
  pendingProfile("Saving Audio Profile…");
  cmd("save-profile",{profile:n});
}
function render(st={}){
  snap=st.snapshot||snap;
  g=st.globalSettings||g;
  activeProfile=st.activeProfile||null;
  defaultMic=st.defaultMic||null;
  if(savingProfileId&&editorDraft){
    const saved=prof(savingProfileId);
    if(saved&&profileSig(saved)===profileSig(editorDraft))clearEditorDraft();
  }
  if(edit&&!prof(edit)){edit=profiles()[0]?.id||"";clearEditorDraft()}
  connectionStatus(st.latestError);
  actionUI();
  if(PROFILE_KINDS.has(kind))editor();
  renderLastResult(st.lastResult);
}

window.connectElgatoStreamDeckSocket=(port,u,reg,info,raw)=>{
  uiUuid=u;
  const a=JSON.parse(raw||"{}");
  actionContext=String(a.context||"");
  aid=String(a.action||"");
  kind=K[aid]||"apply";
  settings={...settings,...(a.payload?.settings||{})};
  actionUI();
  ws=new WebSocket(`ws://127.0.0.1:${port}`);
  ws.onopen=()=>{
    send({event:reg,uuid:uiUuid});
    send({event:"getSettings",action:aid,context:uiUuid});
    send({event:"sendToPlugin",action:aid,context:uiUuid,payload:{type:"audioManager.inspect",actionContext,requestId:nextRequestId()}});
  };
  ws.onclose=()=>transportFailure("Property Inspector disconnected from Stream Deck.");
  ws.onerror=()=>transportFailure("Property Inspector WebSocket error.");
  ws.onmessage=e=>{
    let m;try{m=JSON.parse(e.data)}catch{return}
    if(m.event==="didReceiveSettings")applyActionSettings(m.payload?.settings||{});
    if(m.event==="sendToPropertyInspector"&&m.payload?.type==="audioManager.state")render(m.payload);
    if(m.event==="sendToPropertyInspector"&&m.payload?.type==="audioManager.profile-created"){
      edit=String(m.payload.profileId||"");clearEditorDraft();editor(true);
    }
  };
};

$("brandLink").addEventListener("click",()=>send({event:"openUrl",payload:{url:PACKRAT_MAKER_URL}}));
$("actionProfile").addEventListener("change",saveAction);
$("actionRole").addEventListener("change",saveAction);
$("actionDevice").addEventListener("change",saveAction);
$("dialStep").addEventListener("change",saveAction);
$("refresh").addEventListener("click",()=>{pendingProfile("Refreshing Windows audio…");cmd("refresh")});
$("captureCurrent").addEventListener("click",()=>{pendingProfile("Capturing current Windows setup…");cmd("create-profile",{name:nextProfileName()})});
$("editorProfile").addEventListener("change",()=>{
  const next=$("editorProfile").value;
  if(editorDirty&&next!==edit&&!window.confirm("Discard unsaved Audio Profile changes?")){
    $("editorProfile").value=edit;return;
  }
  clearEditorDraft();edit=next;editor(true);
});
$("profileName").addEventListener("input",()=>{markEditorDirty();validateEditor()});
$("profileName").addEventListener("keydown",e=>{
  if(e.key!=="Enter"||e.shiftKey||e.ctrlKey||e.altKey||e.metaKey)return;
  e.preventDefault();
  if(!$("saveProfile").disabled)saveProfile();
});
for(const [k] of S){
  $(k+"Device").addEventListener("change",()=>{syncStateCtr(k);markEditorDirty();validateEditor()});
  $(k+"RestoreVolume").addEventListener("change",()=>{syncStateCtr(k);markEditorDirty();validateEditor()});
  $(k+"RestoreMute").addEventListener("change",()=>{syncStateCtr(k);markEditorDirty();validateEditor()});
  $(k+"Volume").addEventListener("input",()=>{markEditorDirty();validateEditor()});
  $(k+"Muted").addEventListener("change",()=>{markEditorDirty();validateEditor()});
}
$("saveProfile").addEventListener("click",saveProfile);
$("deleteProfile").addEventListener("click",()=>{
  const p=editorProfile();if(!p)return;
  if(!window.confirm(`Delete Audio Profile "${p.name}"? Keys using it will require another profile selection.`))return;
  pendingProfile("Deleting Audio Profile…");
  cmd("delete-profile",{profileId:p.id});
  clearEditorDraft();edit="";
});
})();
