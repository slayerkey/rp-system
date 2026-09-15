(() => {
  let socket=null,uiUuid="",actionContext="",actionUuid="",kind="",settings={},state=null,stateConnected=false,stateRetryTimer=null,stateRetries=0,diagnostic=null,diagnosticTimer=null;
  const PAGE_SIZE=200;
  let timelinePage=0,timelineMacroId="";
  const $=id=>document.getElementById(id);
  const send=msg=>{if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(msg));return true;}return false;};
  const command=(command,extra={})=>send({event:"sendToPlugin",action:actionUuid,context:uiUuid,payload:{type:"macroRecorder.command",actionContext,command,...extra}});

  function detectKind(){
    if(actionUuid.endsWith(".record"))return"record";
    if(actionUuid.endsWith(".stop"))return"stop";
    return"replay";
  }

  function filterKind(){
    document.querySelectorAll("[data-kind]").forEach(node=>node.hidden=node.dataset.kind!==kind);
  }

  function requestState(reset=false){
    if(reset){stateConnected=false;stateRetries=0;}
    if(stateRetryTimer){clearTimeout(stateRetryTimer);stateRetryTimer=null;}
    send({event:"sendToPlugin",action:actionUuid,context:uiUuid,payload:{type:"macroRecorder.inspect",actionContext}});
    if(!stateConnected&&stateRetries<5){
      stateRetries+=1;
      stateRetryTimer=setTimeout(()=>requestState(false),500);
    }else if(!stateConnected){
      $("errorText").hidden=false;
      $("errorText").textContent="Macro Recorder state connection failed. Run Troubleshooting below and copy the report.";
    }
  }

  function updateStatus(){
    const dot=$("dot");
    dot.className="dot";
    if(state?.lastError)dot.classList.add("error");
    else if(state?.recording||state?.playback)dot.classList.add("busy");
    else dot.classList.add("ready");

    if(state?.recording){
      $("statusTitle").textContent="Recording";
      $("statusDetail").textContent=`${state.recording.eventCount||0} events · ${Math.round((state.recording.elapsedMs||0)/100)/10}s · press Record again to save`;
    }else if(state?.playback){
      $("statusTitle").textContent="Playing";
      $("statusDetail").textContent=state.playback.macroName||"Keyboard macro playback active";
    }else if(state?.lastError){
      $("statusTitle").textContent="Needs attention";
      $("statusDetail").textContent="See the message below.";
    }else if(state?.recentSaved){
      dot.classList.add("saved");
      $("statusTitle").textContent="Macro saved";
      $("statusDetail").textContent=state.recentSaved.assignedToPlay
        ? `${state.recentSaved.name} · ready on Play`
        : `${state.recentSaved.name} · use Assign latest recording on a Play key`;
    }else{
      $("statusTitle").textContent="Macro Recorder ready";
      $("statusDetail").textContent="Keyboard-only recording stays on this PC.";
    }

    $("recordLimit").textContent=state?.limits
      ? `Lite limit: ${Math.round(state.limits.maxDurationMs/1000)} seconds · ${state.limits.maxEvents.toLocaleString()} keyboard events`
      : "";
    $("cancelRecording").disabled=!state?.recording;
    $("stopPlayback").disabled=!(state?.recording||state?.playback);
    $("assignLatest").disabled=!state?.hasLatestMacro;
    $("errorText").hidden=!state?.lastError;
    $("errorText").textContent=state?.lastError||"";

    const summary=$("assignedSummary");
    if(summary){
      summary.textContent=state?.macro?.name
        ? `Assigned: ${state.macro.name} · ${state.macro.events?.length||0} events · ${((state.macro.durationMs||0)/1000).toFixed(2)}s`
        : "No macro assigned yet. Record one first.";
    }
  }

  function eventLabel(ev){
    if(!ev)return"Unknown";
    if(ev.type==="keyDown")return`Key down · ${ev.name||("VK "+Number(ev.vk||0).toString(16).toUpperCase().padStart(2,"0"))}`;
    if(ev.type==="keyUp")return`Key up · ${ev.name||("VK "+Number(ev.vk||0).toString(16).toUpperCase().padStart(2,"0"))}`;
    return ev.type||"Unknown";
  }

  function saveTimeline(macro){
    if(!macro)return;
    command("saveLiteMacro",{macro});
  }

  function renderTimeline(){
    const details=$("recordedStepsDetails"),timeline=$("timeline"),pager=$("timelinePager"),warning=$("timelineWarning");
    timeline.replaceChildren();
    const macro=state?.macro;
    if(!macro?.events?.length){
      $("macroMeta").textContent=macro?"No playable events":"No macro selected";
      timeline.textContent=macro?"This macro has no events.":"Record a keyboard macro first.";
      pager.hidden=true;
      warning.hidden=true;
      timelinePage=0;
      return;
    }

    $("macroMeta").textContent=`${macro.events.length.toLocaleString()} events · ${(macro.durationMs/1000).toFixed(2)}s`;
    if(details&&!details.open){
      pager.hidden=true;
      warning.hidden=true;
      return;
    }

    const pageCount=Math.max(1,Math.ceil(macro.events.length/PAGE_SIZE));
    timelinePage=Math.max(0,Math.min(pageCount-1,timelinePage));
    const first=timelinePage*PAGE_SIZE;
    const last=Math.min(macro.events.length,first+PAGE_SIZE);
    pager.hidden=pageCount<=1;
    $("timelinePageLabel").textContent=`${first+1}–${last} of ${macro.events.length}`;
    $("timelinePrev").disabled=timelinePage<=0;
    $("timelineNext").disabled=timelinePage>=pageCount-1;

    macro.events.slice(first,last).forEach((ev,offset)=>{
      const row=document.createElement("div");
      row.className="event";

      const main=document.createElement("div");
      main.className="event-main";
      const title=document.createElement("div");
      title.className="event-title";
      title.textContent=eventLabel(ev);
      main.appendChild(title);

      const durationLimit=Math.max(0,Number(state?.limits?.maxDurationMs||30000));
      const totalDelay=macro.events.reduce((sum,item)=>sum+Math.max(0,Number(item.delayMs||0)),0);
      const otherDelay=Math.max(0,totalDelay-Math.max(0,Number(ev.delayMs||0)));
      const maxDelay=Math.max(0,durationLimit-otherDelay);
      const delay=document.createElement("input");
      delay.type="number";
      delay.className="delay";
      delay.min="0";
      delay.max=String(maxDelay);
      delay.value=String(ev.delayMs||0);
      delay.title="Delay before event (ms)";
      delay.addEventListener("change",()=>{
        ev.delayMs=Math.max(0,Math.min(maxDelay,Number(delay.value||0)));
        saveTimeline(macro);
      });
      row.append(main,delay);
      timeline.appendChild(row);
    });

    const heldKeys=state?.validation?.unmatchedKeys?.length||0;
    warning.hidden=!heldKeys;
    warning.textContent=heldKeys
      ? "Timeline has an unmatched held key. Playback cleanup will release it, but review the recording."
      : "";
  }

  function applySettings(next){
    settings={...(next||{})};
  }

  function applyStatus(next){
    state={...(state||{}),...(next||{})};
    updateStatus();
  }

  function applyState(next){
    stateConnected=true;
    if(stateRetryTimer){clearTimeout(stateRetryTimer);stateRetryTimer=null;}
    const nextMacroId=String(next?.macro?.id||"");
    if(nextMacroId!==timelineMacroId){timelineMacroId=nextMacroId;timelinePage=0;}
    state=next||state;
    if(!state)return;
    if(next?.settings)applySettings(next.settings);
    updateStatus();
    renderTimeline();
  }

  function diagnosticText(report){
    if(!report)return"No diagnostic has been run yet.";
    const lines=[
      `Macro Recorder Lite diagnostic · ${report.timestamp||""}`,
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
    ];
    if(report.library){
      lines.push("","LIBRARY",JSON.stringify(report.library,null,2));
    }
    return lines.join("\n");
  }

  function showDiagnostic(report){
    if(diagnosticTimer){clearTimeout(diagnosticTimer);diagnosticTimer=null;}
    diagnostic=report;
    $("diagnosticReport").textContent=diagnosticText(report);
    $("diagnosticStatus").textContent=report?.summary||"Diagnostic complete.";
    $("copyDiagnostic").disabled=!report;
  }

  function runDiagnostic(){
    $("diagnosticStatus").textContent="Running end-to-end diagnostic…";
    $("diagnosticReport").textContent="Waiting for plugin response…";
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
      assignedMacroId:state?.macro?.id||"",
      assignedEventCount:state?.macro?.events?.length??0,
    };
    const sent=send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{type:"macroRecorder.diagnostic",actionContext,client}
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
      });
    },2500);
  }

  window.connectElgatoStreamDeckSocket=(port,uuid,registerEvent,info,rawActionInfo)=>{
    uiUuid=uuid;
    const ai=JSON.parse(rawActionInfo||"{}");
    actionContext=String(ai.context||"");
    actionUuid=String(ai.action||"");
    kind=detectKind();
    applySettings(ai.payload?.settings||{});
    filterKind();

    socket=new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onopen=()=>{
      send({event:registerEvent,uuid:uiUuid});
      send({event:"getSettings",action:actionUuid,context:uiUuid});
      requestState(true);
    };
    socket.onmessage=event=>{
      let message;
      try{message=JSON.parse(event.data);}catch{return;}
      if(message.event==="didReceiveSettings"){
        applySettings(message.payload?.settings||{});
        if(!stateConnected)requestState(false);
      }
      if(message.event==="sendToPropertyInspector"&&message.payload?.type==="macroRecorder.state")applyState(message.payload);
      if(message.event==="sendToPropertyInspector"&&message.payload?.type==="macroRecorder.status")applyStatus(message.payload);
      if(message.event==="sendToPropertyInspector"&&message.payload?.type==="macroRecorder.diagnostic")showDiagnostic(message.payload);
    };
  };

  $("cancelRecording").addEventListener("click",()=>command("cancelRecording"));
  $("stopPlayback").addEventListener("click",()=>command("stopPlayback"));
  $("assignLatest").addEventListener("click",()=>{
    $("assignLatest").textContent="Assigning…";
    command("assignLatest");
    setTimeout(()=>{$("assignLatest").textContent="Assign latest recording";},1000);
  });
  $("timelinePrev").addEventListener("click",()=>{if(timelinePage>0){timelinePage-=1;renderTimeline();}});
  $("timelineNext").addEventListener("click",()=>{timelinePage+=1;renderTimeline();});
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
      if(selection&&area){
        selection.removeAllRanges();
        const range=document.createRange();
        range.selectNodeContents(area);
        selection.addRange(range);
      }
      $("diagnosticStatus").textContent="Clipboard access was blocked. The report is selected for manual copy.";
    }
  });
  $("packratLink").addEventListener("click",event=>{
    event.preventDefault();
    send({event:"openUrl",payload:{url:"https://marketplace.elgato.com/maker/packrat"}});
  });
})();
