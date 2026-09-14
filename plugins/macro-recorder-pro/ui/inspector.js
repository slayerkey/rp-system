(() => {
  const edition=document.body.dataset.edition;
  const pro=edition==="pro";
  let socket=null,uiUuid="",actionContext="",actionUuid="",kind="",settings={},state=null,stateConnected=false,stateRetryTimer=null,stateRetries=0,diagnostic=null,diagnosticTimer=null,manualRefreshPending=false,refreshFeedbackTimer=null,libraryFeedbackTimer=null;
  const PAGE_SIZE=200;
  const MAX_IMPORT_BYTES=16*1024*1024;
  let timelinePage=0,timelineMacroId="";
  const $=id=>document.getElementById(id);
  const send=msg=>{if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(msg));return true;}return false;};
  const command=(command,extra={})=>send({event:"sendToPlugin",action:actionUuid,context:uiUuid,payload:{type:"macroRecorder.command",actionContext,command,...extra}});
  const saveSettings=next=>{settings={...settings,...next};if(state)state={...state,settings:{...(state.settings||{}),...next}};send({event:"setSettings",action:actionUuid,context:uiUuid,payload:settings});};

  function showLibraryFeedback(message,type="success",duration=3500){
    const el=$("libraryFeedback");
    if(!el)return;
    if(libraryFeedbackTimer){clearTimeout(libraryFeedbackTimer);libraryFeedbackTimer=null;}
    el.textContent=message;
    el.className=`hint library-feedback ${type}`;
    el.hidden=false;
    if(duration>0)libraryFeedbackTimer=setTimeout(()=>{el.hidden=true;el.textContent="";el.className="hint library-feedback";},duration);
  }

  function requestState(reset=false,manual=false){
    if(reset){stateConnected=false;stateRetries=0;}
    if(manual){
      manualRefreshPending=true;
      const button=$("refreshLibrary");
      if(button){button.disabled=true;button.textContent="Refreshing…";}
    }
    if(stateRetryTimer){clearTimeout(stateRetryTimer);stateRetryTimer=null;}
    send({event:"sendToPlugin",action:actionUuid,context:uiUuid,payload:{type:"macroRecorder.inspect",actionContext}});
    if(!stateConnected&&stateRetries<5){
      stateRetries+=1;
      stateRetryTimer=setTimeout(()=>requestState(false,manualRefreshPending),500);
    }else if(!stateConnected){
      const el=$("stateConnection");
      if(el)el.textContent="Macro Library connection failed. Playback settings still save, but library/editor state is unavailable.";
      if(manualRefreshPending){
        manualRefreshPending=false;
        const button=$("refreshLibrary");
        if(button){button.disabled=false;button.textContent="Refresh";}
        showLibraryFeedback("Refresh failed · Macro Library did not respond.","error",5000);
      }
    }
  }

  function updateStateConnection(){
    const el=$("stateConnection");
    if(!el)return;
    if(stateConnected)el.textContent=`Macro Library connected · ${state?.library?.length??0} macros`;
    else el.textContent="Connecting to Macro Library…";
  }

  function diagnosticText(report){
    if(!report)return "No diagnostic has been run yet.";
    const lines=[
      `Macro Recorder Pro diagnostic · ${report.timestamp||""}`,
      `Summary: ${report.summary||""}`,
      "",
      "CHECKS",
      ...(report.checks||[]).map(item=>`${item.ok?"PASS":"FAIL"} · ${item.name}${item.detail?" · "+item.detail:""}`),
      "",
      "TRANSPORT",
      JSON.stringify(report.transport||{},null,2),
      "",
      "CLIENT",
      JSON.stringify(report.client||{},null,2),
      "",
      "SELECTED ACTION",
      JSON.stringify(report.selectedAction||null,null,2),
      "",
      "RUNTIME",
      JSON.stringify(report.runtime||{},null,2),
      "",
      "LIBRARY",
      JSON.stringify(report.library||null,null,2),
    ];
    return lines.join("\n");
  }

  function showDiagnostic(report){
    if(diagnosticTimer){clearTimeout(diagnosticTimer);diagnosticTimer=null;}
    diagnostic=report;
    const output=$("diagnosticReport");
    if(output)output.textContent=diagnosticText(report);
    const status=$("diagnosticStatus");
    if(status)status.textContent=report?.summary||"Diagnostic complete.";
    const copy=$("copyDiagnostic");
    if(copy)copy.disabled=!report;
  }

  function runDiagnostic(){
    const status=$("diagnosticStatus");
    if(status)status.textContent="Running end-to-end diagnostic…";
    const output=$("diagnosticReport");
    if(output)output.textContent="Waiting for plugin response…";
    diagnostic=null;
    $("copyDiagnostic").disabled=true;
    const client={
      uiUuid,
      actionContext,
      actionUuid,
      kind,
      websocketOpen:socket?.readyState===WebSocket.OPEN,
      stateConnected,
      stateRetries,
      localSettings:settings,
      lastLibraryCount:state?.library?.length??null,
      selectedMacroId:state?.settings?.macroId??settings.macroId??"",
    };
    const sent=send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{
        type:"macroRecorder.diagnostic",
        actionContext,
        client,
      }
    });
    if(diagnosticTimer)clearTimeout(diagnosticTimer);
    diagnosticTimer=setTimeout(()=>{
      if(diagnostic)return;
      showDiagnostic({
        type:"macroRecorder.diagnostic",
        timestamp:new Date().toISOString(),
        summary:"FAIL: no plugin diagnostic response within 2.5 seconds.",
        checks:[
          {name:"Property Inspector websocket open",ok:Boolean(client.websocketOpen),detail:`readyState=${socket?.readyState??"none"}`},
          {name:"Diagnostic request sent",ok:Boolean(sent),detail:sent?"websocket send succeeded":"websocket send failed"},
          {name:"Selected action context available",ok:Boolean(actionContext),detail:actionContext||"missing"},
          {name:"Plugin response received",ok:false,detail:"No macroRecorder.diagnostic response arrived within 2.5 seconds"},
        ],
        transport:{mode:"property-inspector-timeout",uiUuid,actionContext},
        client,
        selectedAction:null,
        runtime:null,
        library:null,
      });
    },2500);
  }

  function detectKind(){if(actionUuid.endsWith(".record"))return"record";if(actionUuid.endsWith(".stop"))return"stop";return"replay";}
  function filterKind(){document.querySelectorAll("[data-kind]").forEach(n=>n.hidden=n.dataset.kind!==kind);}

  function updateStatus(){
    const dot=$("dot");dot.className="dot";
    if(state?.lastError){dot.classList.add("error");}
    else if(state?.recording||state?.playback){dot.classList.add("busy");}
    else{dot.classList.add("ready");}
    if(state?.recording){$("statusTitle").textContent="Recording";$("statusDetail").textContent=`${state.recording.eventCount||0} events · ${Math.round((state.recording.elapsedMs||0)/100)/10}s · press Record again to save`;}
    else if(state?.playback){$("statusTitle").textContent="Playing";$("statusDetail").textContent=state.playback.macroName||"Macro playback active";}
    else if(state?.lastError){$("statusTitle").textContent="Needs attention";$("statusDetail").textContent="See the message below.";}
    else if(state?.recentSaved){dot.classList.add("saved");$("statusTitle").textContent="Macro saved";$("statusDetail").textContent=state.recentSaved.assignedToPlay?`${state.recentSaved.name} · added to Macro Library and ready on Play`:`${state.recentSaved.name} · added to Macro Library`;}
    else{$("statusTitle").textContent="Macro Recorder ready";$("statusDetail").textContent="Record a workflow once, then replay it from Stream Deck.";}
    $("recordLimit").textContent=state?.limits?`Limit: ${Math.round(state.limits.maxDurationMs/1000)} seconds · ${state.limits.maxEvents.toLocaleString()} events`:"";
    $("cancelRecording").disabled=!state?.recording;
    $("stopPlayback").disabled=!(state?.recording||state?.playback);
    $("assignLatest").disabled=!state?.hasLatestMacro;
    $("errorText").hidden=!state?.lastError;
    $("errorText").textContent=state?.lastError||"";
    if($("assignedSummary")){
      $("assignedSummary").textContent=state?.macro?.name
        ? `Assigned: ${state.macro.name} · ${state.macro.events?.length||0} events · ${((state.macro.durationMs||0)/1000).toFixed(2)}s`
        : "No macro assigned yet. Record one or choose one below.";
    }
  }

  function populateLibrary(){
    if(!pro)return;
    const select=$("macroSelect"),chosen=String(state?.settings?.macroId??settings.macroId??"");
    select.replaceChildren(new Option("Choose a macro",""));
    for(const item of state?.library||[]){const fresh=state?.recentSaved?.macroId===item.id?"NEW · ":state?.latestMacroId===item.id?"LATEST · ":"";select.appendChild(new Option(`${fresh}${item.name} · ${item.eventCount} events`,item.id));}
    select.value=(state?.library||[]).some(x=>x.id===chosen)?chosen:"";
    const hasMacro=Boolean(state?.macro);
    $("renameMacro").disabled=!hasMacro;
    $("duplicateMacro").disabled=!hasMacro;
    $("deleteMacro").disabled=!hasMacro;
    $("exportMacro").disabled=!hasMacro;
    if(state?.libraryWarning&&!state?.lastError){$("errorText").hidden=false;$("errorText").textContent=state.libraryWarning;}
  }

  function eventLabel(ev){
    if(!ev)return"Unknown";
    if(ev.type==="keyDown")return`Key down · ${ev.name||("VK "+Number(ev.vk||0).toString(16).toUpperCase().padStart(2,"0"))}`;
    if(ev.type==="keyUp")return`Key up · ${ev.name||("VK "+Number(ev.vk||0).toString(16).toUpperCase().padStart(2,"0"))}`;
    if(ev.type==="mouseMove")return`Move mouse · ${ev.x}, ${ev.y}`;
    if(ev.type==="mouseDown")return`${String(ev.button||"mouse")} mouse down`;
    if(ev.type==="mouseUp")return`${String(ev.button||"mouse")} mouse up`;
    if(ev.type==="wheel")return`${ev.horizontal?"Horizontal":"Vertical"} wheel · ${ev.delta}`;
    return ev.type||"Unknown";
  }
  function saveTimeline(macro){if(!macro)return;if(pro)command("saveMacro",{macroId:macro.id,macro});else command("saveLiteMacro",{macro});}
  function renderTimeline(){
    const timeline=$("timeline"),pager=$("timelinePager"),warning=$("timelineWarning"),details=$("recordedStepsDetails");
    timeline.replaceChildren();
    const macro=state?.macro;
    if(!macro?.events?.length){$("macroMeta").textContent=macro?"No playable events":"No macro selected";timeline.textContent=macro?"This macro has no events.":"Record something first, or choose a macro from the library.";pager.hidden=true;warning.hidden=true;timelinePage=0;return;}
    $("macroMeta").textContent=`${macro.events.length.toLocaleString()} events · ${(macro.durationMs/1000).toFixed(2)}s`;
    if(details&&!details.open){pager.hidden=true;warning.hidden=true;return;}
    const pageCount=Math.max(1,Math.ceil(macro.events.length/PAGE_SIZE));timelinePage=Math.max(0,Math.min(pageCount-1,timelinePage));const first=timelinePage*PAGE_SIZE;const last=Math.min(macro.events.length,first+PAGE_SIZE);pager.hidden=pageCount<=1;$("timelinePageLabel").textContent=`${first+1}–${last} of ${macro.events.length}`;$("timelinePrev").disabled=timelinePage<=0;$("timelineNext").disabled=timelinePage>=pageCount-1;
    macro.events.slice(first,last).forEach((ev,offset)=>{
      const index=first+offset,row=document.createElement("div");row.className="event";const main=document.createElement("div");main.className="event-main";const title=document.createElement("div");title.className="event-title";title.textContent=eventLabel(ev);main.appendChild(title);
      if(pro){const controls=document.createElement("div");controls.className="event-controls";const mk=(label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);return b;};controls.append(mk("↑",()=>{if(index<1)return;[macro.events[index-1],macro.events[index]]=[macro.events[index],macro.events[index-1]];saveTimeline(macro);}),mk("↓",()=>{if(index>=macro.events.length-1)return;[macro.events[index+1],macro.events[index]]=[macro.events[index],macro.events[index+1]];saveTimeline(macro);}),mk("Copy",()=>{macro.events.splice(index+1,0,structuredClone(ev));saveTimeline(macro);}),mk("Delete",()=>{macro.events.splice(index,1);saveTimeline(macro);}));main.appendChild(controls);}
      const durationLimit=Math.max(0,Number(state?.limits?.maxDurationMs||60000));const totalDelay=macro.events.reduce((sum,item)=>sum+Math.max(0,Number(item.delayMs||0)),0);const otherDelay=Math.max(0,totalDelay-Math.max(0,Number(ev.delayMs||0)));const maxDelay=Math.max(0,durationLimit-otherDelay);const delay=document.createElement("input");delay.type="number";delay.className="delay";delay.min="0";delay.max=String(maxDelay);delay.value=String(ev.delayMs||0);delay.title="Delay before event (ms)";delay.addEventListener("change",()=>{ev.delayMs=Math.max(0,Math.min(maxDelay,Number(delay.value||0)));saveTimeline(macro);});row.append(main,delay);timeline.appendChild(row);
    });
    const validation=state?.validation;const heldKeys=validation?.unmatchedKeys?.length||0,heldButtons=validation?.unmatchedButtons?.length||0;warning.hidden=!(heldKeys||heldButtons);warning.textContent=(heldKeys||heldButtons)?"Timeline has unmatched held inputs. Playback cleanup will still release them, but review the edits.":"";
  }

  function applyStatus(next){state={...(state||{}),...(next||{})};if(!state)return;updateStatus();}
  function applyState(next){
    stateConnected=true;
    if(stateRetryTimer){clearTimeout(stateRetryTimer);stateRetryTimer=null;}
    const nextMacroId=String(next?.macro?.id||"");
    if(nextMacroId!==timelineMacroId){timelineMacroId=nextMacroId;timelinePage=0;}
    state=next||state;
    if(!state)return;
    if(next?.settings)applySettings(next.settings);
    updateStateConnection();
    updateStatus();
    populateLibrary();
    renderTimeline();
    if(manualRefreshPending){
      manualRefreshPending=false;
      const button=$("refreshLibrary");
      if(button){
        button.disabled=false;
        button.textContent="Refreshed ✓";
        if(refreshFeedbackTimer)clearTimeout(refreshFeedbackTimer);
        refreshFeedbackTimer=setTimeout(()=>{button.textContent="Refresh";refreshFeedbackTimer=null;},1800);
      }
      showLibraryFeedback(`Refreshed · ${state?.library?.length??0} macros`,"success",3000);
    }
  }
  function applySettings(next){settings={...(next||{})};if(pro){$("captureMouseMovement").checked=settings.captureMouseMovement!==false;const speed=Number(settings.playbackSpeed);$("playbackSpeed").value=["0.25","0.5","1","1.5","2","4"].includes(String(speed))?String(speed):"1";$("playbackMode").value=["once","count","while-held","toggle"].includes(settings.playbackMode)?settings.playbackMode:"once";$("repeatCount").value=Number.isFinite(Number(settings.repeatCount))?Number(settings.repeatCount):2;$("coordinateMode").value=settings.coordinateMode==="active-window"?"active-window":"absolute";$("repeatRow").hidden=$("playbackMode").value!=="count";}}

  window.connectElgatoStreamDeckSocket=(port,uuid,registerEvent,info,rawActionInfo)=>{uiUuid=uuid;const ai=JSON.parse(rawActionInfo||"{}");actionContext=String(ai.context||"");actionUuid=String(ai.action||"");kind=detectKind();applySettings(ai.payload?.settings||{});filterKind();updateStateConnection();socket=new WebSocket(`ws://127.0.0.1:${port}`);socket.onopen=()=>{send({event:registerEvent,uuid:uiUuid});send({event:"getSettings",action:actionUuid,context:uiUuid});requestState(true);};socket.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(m.event==="didReceiveSettings"){applySettings(m.payload?.settings||{});if(!stateConnected)requestState(false);}if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.state")applyState(m.payload);if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.status")applyStatus(m.payload);if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.diagnostic")showDiagnostic(m.payload);if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.export"){const blob=new Blob([JSON.stringify(m.payload.data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=m.payload.filename||"macro.packrat-macro.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.exportSaved"){showLibraryFeedback(`Exported · ${m.payload.path||m.payload.filename||"saved"}`,"success",7000);}};};

  $("cancelRecording").addEventListener("click",()=>command("cancelRecording"));
  $("stopPlayback").addEventListener("click",()=>command("stopPlayback"));
  $("assignLatest").addEventListener("click",()=>command("assignLatest"));
  $("timelinePrev").addEventListener("click",()=>{if(timelinePage>0){timelinePage-=1;renderTimeline();}});
  $("timelineNext").addEventListener("click",()=>{timelinePage+=1;renderTimeline();});
  $("refreshLibrary").addEventListener("click",()=>requestState(true,true));
  $("recordedStepsDetails").addEventListener("toggle",()=>{if($("recordedStepsDetails").open)renderTimeline();});
  $("runDiagnostic").addEventListener("click",runDiagnostic);
  $("copyDiagnostic").addEventListener("click",async()=>{
    if(!diagnostic)return;
    const value=diagnosticText(diagnostic);
    try{
      await navigator.clipboard.writeText(value);
      $("diagnosticStatus").textContent="Diagnostic copied to clipboard.";
    }catch{
      const area=$("diagnosticReport");
      area?.focus?.();
      const selection=window.getSelection?.();
      if(selection&&area){selection.removeAllRanges();const range=document.createRange();range.selectNodeContents(area);selection.addRange(range);}
      $("diagnosticStatus").textContent="Clipboard access was blocked. The report is selected for manual copy.";
    }
  });
  $("packratLink").addEventListener("click",event=>{
    event.preventDefault();
    send({event:"openUrl",payload:{url:"https://marketplace.elgato.com/maker/packrat"}});
  });
  if(pro){
    $("captureMouseMovement").addEventListener("change",()=>saveSettings({captureMouseMovement:$("captureMouseMovement").checked}));
    $("macroSelect").addEventListener("change",()=>{const macroId=$("macroSelect").value;settings={...settings,macroId,autoLatest:false};if(state)state={...state,settings:{...(state.settings||{}),macroId,autoLatest:false}};command("selectMacro",{macroId});});
    $("renameMacro").addEventListener("click",()=>{if(!state?.macro)return;const name=prompt("Rename macro",state.macro.name||"");if(name?.trim()){const macro={...state.macro,name:name.trim()};command("saveMacro",{macroId:macro.id,macro});}});
    $("duplicateMacro").addEventListener("click",()=>command("duplicateMacro",{macroId:$("macroSelect").value}));
    $("deleteMacro").addEventListener("click",()=>{if(confirm("Delete this macro from the local library?"))command("deleteMacro",{macroId:$("macroSelect").value});});
    $("exportMacro").addEventListener("click",()=>command("exportMacro",{macroId:$("macroSelect").value}));
    $("importFile").addEventListener("change",async()=>{const input=$("importFile"),file=input.files?.[0];if(!file)return;try{if(file.size>MAX_IMPORT_BYTES)throw new Error("too-large");command("importMacro",{data:JSON.parse(await file.text())});}catch(error){$("errorText").hidden=false;$("errorText").textContent=error?.message==="too-large"?"That macro file is larger than 16 MB.":"That file is not valid PackRat macro JSON.";}finally{input.value="";}});
    $("playbackSpeed").addEventListener("change",()=>saveSettings({playbackSpeed:Number($("playbackSpeed").value)}));
    $("playbackMode").addEventListener("change",()=>{const value=$("playbackMode").value;$("repeatRow").hidden=value!=="count";saveSettings({playbackMode:value});});
    $("repeatCount").addEventListener("change",()=>saveSettings({repeatCount:Math.max(1,Math.min(100,Number($("repeatCount").value||1)))}));
    $("coordinateMode").addEventListener("change",()=>saveSettings({coordinateMode:$("coordinateMode").value}));
  }
})();