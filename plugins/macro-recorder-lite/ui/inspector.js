(() => {
  const edition=document.body.dataset.edition;
  const pro=edition==="pro";
  let socket=null,uiUuid="",context="",actionUuid="",kind="",settings={},state=null;
  const PAGE_SIZE=200;
  let timelinePage=0,timelineMacroId="";
  const $=id=>document.getElementById(id);
  const send=msg=>{if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(msg));return true;}return false;};
  const command=(command,extra={})=>send({event:"sendToPlugin",action:actionUuid,context,payload:{type:"macroRecorder.command",command,...extra}});
  const saveSettings=next=>{settings={...settings,...next};send({event:"setSettings",action:actionUuid,context,payload:settings});};

  function detectKind(){if(actionUuid.endsWith(".record"))return"record";if(actionUuid.endsWith(".stop"))return"stop";return"replay";}
  function filterKind(){document.querySelectorAll("[data-kind]").forEach(n=>n.hidden=n.dataset.kind!==kind);}

  function updateStatus(){
    const dot=$("dot");dot.className="dot";
    if(state?.recording){dot.classList.add("busy");$("statusTitle").textContent="RECORDING";$("statusDetail").textContent=`${state.recording.eventCount||0} events · ${Math.round((state.recording.elapsedMs||0)/100)/10}s`;}
    else if(state?.playback){dot.classList.add("busy");$("statusTitle").textContent="PLAYING";$("statusDetail").textContent=state.playback.macroName||"Macro playback active";}
    else{dot.classList.add("ready");$("statusTitle").textContent="Macro Recorder ready";$("statusDetail").textContent="Everything stays on this PC.";}
    $("recordLimit").textContent=state?.limits?`Limit: ${Math.round(state.limits.maxDurationMs/1000)} seconds · ${state.limits.maxEvents.toLocaleString()} events`:"";
    $("cancelRecording").disabled=!state?.recording;
    $("stopPlayback").disabled=!state?.playback;
    $("errorText").hidden=!state?.lastError;
    $("errorText").textContent=state?.lastError||"";
  }

  function populateLibrary(){
    if(!pro)return;
    const select=$("macroSelect"),chosen=String(settings.macroId||"");
    select.replaceChildren(new Option("Choose a macro",""));
    for(const item of state?.library||[])select.appendChild(new Option(`${item.name} · ${item.eventCount} events`,item.id));
    select.value=(state?.library||[]).some(x=>x.id===chosen)?chosen:"";
    if(state?.libraryWarning){$("errorText").hidden=false;$("errorText").textContent=state.libraryWarning;}
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
  function saveTimeline(macro){
    if(!macro)return;
    if(pro)command("saveMacro",{macroId:macro.id,macro});
    else command("saveLiteMacro",{macro});
  }
  function renderTimeline(){
    const timeline=$("timeline"),pager=$("timelinePager"),warning=$("timelineWarning");
    timeline.replaceChildren();
    const macro=state?.macro;
    if(!macro?.events?.length){
      timeline.textContent="No macro assigned yet.";
      $("macroMeta").textContent="";
      pager.hidden=true;
      warning.hidden=true;
      timelinePage=0;
      return;
    }

    $("macroMeta").textContent=`${macro.events.length} events · ${(macro.durationMs/1000).toFixed(2)}s`;
    const pageCount=Math.max(1,Math.ceil(macro.events.length/PAGE_SIZE));
    timelinePage=Math.max(0,Math.min(pageCount-1,timelinePage));
    const first=timelinePage*PAGE_SIZE;
    const last=Math.min(macro.events.length,first+PAGE_SIZE);
    pager.hidden=pageCount<=1;
    $("timelinePageLabel").textContent=`${first+1}–${last} of ${macro.events.length}`;
    $("timelinePrev").disabled=timelinePage<=0;
    $("timelineNext").disabled=timelinePage>=pageCount-1;

    macro.events.slice(first,last).forEach((ev,offset)=>{
      const index=first+offset;
      const row=document.createElement("div");row.className="event";
      const main=document.createElement("div");main.className="event-main";
      const title=document.createElement("div");title.className="event-title";title.textContent=eventLabel(ev);
      main.appendChild(title);
      if(pro){
        const controls=document.createElement("div");controls.className="event-controls";
        const mk=(label,fn)=>{const b=document.createElement("button");b.type="button";b.textContent=label;b.addEventListener("click",fn);return b;};
        controls.append(
          mk("↑",()=>{if(index<1)return;[macro.events[index-1],macro.events[index]]=[macro.events[index],macro.events[index-1]];saveTimeline(macro);}),
          mk("↓",()=>{if(index>=macro.events.length-1)return;[macro.events[index+1],macro.events[index]]=[macro.events[index],macro.events[index+1]];saveTimeline(macro);}),
          mk("Copy",()=>{macro.events.splice(index+1,0,structuredClone(ev));saveTimeline(macro);}),
          mk("Delete",()=>{macro.events.splice(index,1);saveTimeline(macro);})
        );
        main.appendChild(controls);
      }
      const maxDelay=Math.max(1000,Number(state?.limits?.maxDurationMs||60000));
      const delay=document.createElement("input");delay.type="number";delay.className="delay";delay.min="0";delay.max=String(maxDelay);delay.value=String(ev.delayMs||0);delay.title="Delay before event (ms)";
      delay.addEventListener("change",()=>{ev.delayMs=Math.max(0,Math.min(maxDelay,Number(delay.value||0)));saveTimeline(macro);});
      row.append(main,delay);timeline.appendChild(row);
    });

    const validation=state?.validation;
    const heldKeys=validation?.unmatchedKeys?.length||0,heldButtons=validation?.unmatchedButtons?.length||0;
    warning.hidden=!(heldKeys||heldButtons);
    warning.textContent=(heldKeys||heldButtons)?"Timeline has unmatched held inputs. Playback cleanup will still release them, but review the edits.":"";
  }

  function applyState(next){
    const nextMacroId=String(next?.macro?.id||"");
    if(nextMacroId!==timelineMacroId){timelineMacroId=nextMacroId;timelinePage=0;}
    state=next||state; if(!state)return;
    updateStatus();populateLibrary();renderTimeline();
  }
  function applySettings(next){
    settings={...(next||{})};
    if(pro){
      $("captureMouseMovement").checked=settings.captureMouseMovement!==false;
      $("playbackSpeed").value=String(settings.playbackSpeed||1);
      $("playbackMode").value=["once","count","while-held","toggle"].includes(settings.playbackMode)?settings.playbackMode:"once";
      $("repeatCount").value=Number(settings.repeatCount||2);
      $("coordinateMode").value=settings.coordinateMode==="active-window"?"active-window":"absolute";
      $("repeatRow").hidden=$("playbackMode").value!=="count";
    }
  }

  window.connectElgatoStreamDeckSocket=(port,uuid,registerEvent,info,rawActionInfo)=>{
    uiUuid=uuid;const ai=JSON.parse(rawActionInfo||"{}");context=String(ai.context||uuid);actionUuid=String(ai.action||"");kind=detectKind();applySettings(ai.payload?.settings||{});filterKind();
    socket=new WebSocket(`ws://127.0.0.1:${port}`);
    socket.onopen=()=>{send({event:registerEvent,uuid:uiUuid});send({event:"getSettings",action:actionUuid,context});send({event:"sendToPlugin",action:actionUuid,context,payload:{type:"macroRecorder.inspect"}});};
    socket.onmessage=event=>{let m;try{m=JSON.parse(event.data);}catch{return;}if(m.event==="didReceiveSettings")applySettings(m.payload?.settings||{});if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.state")applyState(m.payload);if(m.event==="sendToPropertyInspector"&&m.payload?.type==="macroRecorder.export"){const blob=new Blob([JSON.stringify(m.payload.data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=m.payload.filename||"macro.packrat-macro.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}};
  };

  $("cancelRecording").addEventListener("click",()=>command("cancelRecording"));
  $("stopPlayback").addEventListener("click",()=>command("stopPlayback"));
  $("assignLatest").addEventListener("click",()=>command("assignLatest"));
  $("timelinePrev").addEventListener("click",()=>{if(timelinePage>0){timelinePage-=1;renderTimeline();}});
  $("timelineNext").addEventListener("click",()=>{timelinePage+=1;renderTimeline();});
  if(pro){
    $("captureMouseMovement").addEventListener("change",()=>saveSettings({captureMouseMovement:$("captureMouseMovement").checked}));
    $("macroSelect").addEventListener("change",()=>command("selectMacro",{macroId:$("macroSelect").value}));
    $("duplicateMacro").addEventListener("click",()=>command("duplicateMacro",{macroId:$("macroSelect").value}));
    $("deleteMacro").addEventListener("click",()=>{if(confirm("Delete this macro from the local library?"))command("deleteMacro",{macroId:$("macroSelect").value});});
    $("exportMacro").addEventListener("click",()=>command("exportMacro",{macroId:$("macroSelect").value}));
    $("importFile").addEventListener("change",async()=>{
      const input=$("importFile"),file=input.files?.[0];
      if(!file)return;
      try{
        if(file.size>5*1024*1024)throw new Error("too-large");
        command("importMacro",{data:JSON.parse(await file.text())});
      }catch(error){
        $("errorText").hidden=false;
        $("errorText").textContent=error?.message==="too-large"?"That macro file is larger than 5 MB.":"That file is not valid PackRat macro JSON.";
      }finally{
        input.value="";
      }
    });
    $("playbackSpeed").addEventListener("change",()=>saveSettings({playbackSpeed:Number($("playbackSpeed").value)}));
    $("playbackMode").addEventListener("change",()=>{const value=$("playbackMode").value;$("repeatRow").hidden=value!=="count";saveSettings({playbackMode:value});});
    $("repeatCount").addEventListener("change",()=>saveSettings({repeatCount:Math.max(1,Math.min(100,Number($("repeatCount").value||1)))}));
    $("coordinateMode").addEventListener("change",()=>saveSettings({coordinateMode:$("coordinateMode").value}));
  }
})();