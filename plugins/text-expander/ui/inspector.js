(() => {
  const PACKRAT_MAKER_URL="https://marketplace.elgato.com/maker/packrat";
  const BUILD_VERIFIED_PRO_URL="__PACKRAT_VERIFIED_PRO_URL__";
  let socket=null;
  let uiUuid="";
  let actionUuid="";
  let actionContext="";
  let settings={};
  let edition="lite";
  let snippets=[];
  let builtinIds=new Set();
  let editingId="";
  let editorOpen=false;
  let saveTimer=null;
  let proUrl=BUILD_VERIFIED_PRO_URL.startsWith("__PACKRAT_")?"":BUILD_VERIFIED_PRO_URL;

  const $=(id)=>document.getElementById(id);
  const isManage=()=>actionUuid.endsWith(".manage");

  function send(message){
    if(socket?.readyState!==WebSocket.OPEN)return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function setStatus(text){$("editorStatus").textContent=text||"";}
  function setSaveStatus(text){$("saveStatus").textContent=text||"";}

  function requestSnippets(){
    const selectedId=editingId||settings.snippetId||$("snippet").value||"";
    return send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{type:"listSnippets",actionContext,selectedId}
    });
  }

  function requestSnippetDetail(snippetId){
    if(!snippetId)return false;
    return send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{type:"getSnippet",actionContext,snippetId}
    });
  }

  function collectSettings(){
    return {
      ...settings,
      snippetId:$("snippet").value,
      insertionMode:$("mode").value,
      afterInsert:edition==="pro"?$("after").value:"none"
    };
  }

  function saveSettings(){
    if(isManage())return;
    settings=collectSettings();
    const ok=send({event:"setSettings",action:actionUuid,context:uiUuid,payload:settings});
    setSaveStatus(ok?"Saving…":"Stream Deck connection unavailable.");
  }

  function queueSave(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(saveSettings,120);
  }

  function selectedSnippet(){
    return snippets.find((snippet)=>snippet.id===$("snippet").value)||null;
  }

  function updateSnippetMeta(){
    const snippet=selectedSnippet();
    if(!snippet){
      $("snippetMeta").textContent="Waiting for your local snippet library…";
      return;
    }
    const built=builtinIds.has(snippet.id);
    const folder=snippet.folder||"STARTER";
    $("snippetMeta").textContent=(built?"Built-in starter":"Local snippet")+" · "+folder+" · "+snippets.length+" available";
  }

  function fillEditor(snippet){
    editingId=snippet?.id||"";
    $("editName").value=snippet?.name||"";
    $("editFolder").value=snippet?.folder||(edition==="pro"?"QUICK":"STARTER");
    const hasContent=typeof snippet?.content==="string";
    $("editContent").value=hasContent?snippet.content:"";
    $("editContent").disabled=!!snippet&&!hasContent;
    $("dateTimePresets").classList.toggle("hidden",edition!=="pro");
    $("deleteSnippet").disabled=!editingId;
    $("editorTarget").textContent=snippet
      ?(builtinIds.has(snippet.id)?"Editing built-in starter: ":"Editing local snippet: ")+snippet.name
      :"Creating a new local snippet.";
    if(snippet&&!hasContent){
      setStatus("Loading snippet…");
      requestSnippetDetail(snippet.id);
    }else{
      setStatus("");
    }
  }

  function showEditor(force){
    editorOpen=force===undefined?!editorOpen:!!force;
    $("editor").classList.toggle("hidden",!editorOpen);
    $("editToggle").textContent=editorOpen?"Close library":"Open snippet library";
    if(editorOpen){
      fillEditor(selectedSnippet());
      $("editor").scrollIntoView?.({block:"nearest"});
    }
  }

  function renderGroupedOptions(before){
    const select=$("snippet");
    select.innerHTML="";
    if(!snippets.length){
      const option=document.createElement("option");
      option.textContent="No snippets available";
      option.value="";
      select.append(option);
      select.disabled=true;
      return "";
    }
    select.disabled=false;

    const groups=new Map();
    for(const snippet of snippets){
      const folder=String(snippet.folder||"STARTER").trim()||"STARTER";
      if(!groups.has(folder))groups.set(folder,[]);
      groups.get(folder).push(snippet);
    }
    for(const [folder,items] of groups){
      const group=document.createElement("optgroup");
      group.label=folder;
      for(const snippet of items){
        const option=document.createElement("option");
        option.value=snippet.id;
        option.textContent=snippet.name+(builtinIds.has(snippet.id)?" · built-in":"");
        group.append(option);
      }
      select.append(group);
    }

    const chosen=snippets.some((snippet)=>snippet.id===before)?before:snippets[0].id;
    select.value=chosen;
    return chosen;
  }

  function renderList(data){
    edition=data.edition||edition;
    snippets=Array.isArray(data.snippets)?data.snippets:[];
    if(data.selectedSnippet?.id){
      const index=snippets.findIndex((snippet)=>snippet.id===data.selectedSnippet.id);
      if(index>=0)snippets[index]={...snippets[index],...data.selectedSnippet};
    }
    builtinIds=new Set(Array.isArray(data.builtinIds)?data.builtinIds:[]);
    proUrl=String(data.verifiedProUrl||BUILD_VERIFIED_PRO_URL||"");

    $("productTitle").textContent=edition==="pro"?"Text Expander Pro":"Text Expander Lite";
    $("productSubtitle").textContent=edition==="pro"
      ?"Choose a built-in or local snippet, then press the key to insert it anywhere in Windows."
      :"Choose a local starter snippet, then press the key to insert it anywhere in Windows.";

    $("afterWrap").classList.toggle("hidden",edition!=="pro");
    $("folderWrap").classList.toggle("hidden",edition!=="pro");
    $("dynamicCard").classList.toggle("hidden",edition!=="pro");

    const before=data.selectedId||settings.snippetId||$("snippet").value||"";
    const chosen=renderGroupedOptions(before);
    updateSnippetMeta();

    $("mode").value=settings.insertionMode||"auto";
    $("after").value=edition==="pro"?(settings.afterInsert||"none"):"none";

    if(!isManage()&&chosen&&settings.snippetId!==chosen){
      settings={...settings,snippetId:chosen};
      saveSettings();
    }

    if(data.selectedId){
      $("snippet").value=data.selectedId;
      updateSnippetMeta();
      fillEditor(selectedSnippet());
      showEditor(true);
    }else if(editorOpen){
      fillEditor(selectedSnippet());
    }
    if(data.status)setStatus(data.status);

    const upgrade=$("upgrade");
    const topUpgrade=$("topUpgrade");
    if(edition==="lite"&&proUrl){
      upgrade.classList.remove("hidden");
      $("upgradeButton").classList.remove("hidden");
      topUpgrade.classList.remove("hidden");
    }else{
      upgrade.classList.add("hidden");
      $("upgradeButton").classList.add("hidden");
      topUpgrade.classList.add("hidden");
    }
  }

  function applyReceivedSettings(next){
    settings={...settings,...(next||{})};
    if(settings.snippetId&&snippets.some((snippet)=>snippet.id===settings.snippetId)){
      $("snippet").value=settings.snippetId;
      updateSnippetMeta();
    }
    $("mode").value=settings.insertionMode||"auto";
    $("after").value=edition==="pro"?(settings.afterInsert||"none"):"none";
  }

  $("snippet").addEventListener("change",()=>{
    updateSnippetMeta();
    if(editorOpen)fillEditor(selectedSnippet());
    queueSave();
  });
  $("mode").addEventListener("change",()=>{
    const mode=$("mode").value;
    $("modeHelp").textContent=mode==="clipboard"
      ?"Paste with clipboard temporarily uses your clipboard, then restores the previous clipboard when Windows allows."
      :mode==="unicode"
        ?"Type text injects the snippet directly without replacing your clipboard. Some protected apps can block synthetic text."
        :"Smart types short single-line snippets directly and uses clipboard paste for multiline, tabbed, or very long text.";
    queueSave();
  });
  $("after").addEventListener("change",queueSave);
  for(const button of document.querySelectorAll(".format-token")){
    button.addEventListener("click",()=>{
      const token=String(button.dataset.token||"");
      const area=$("editContent");
      if(!token||!area)return;
      const current=area.value.trim();
      const selectedId=editingId||$("snippet").value||"";
      const dynamicBuiltin=["pro-quick-time","pro-quick-date","pro-timestamp"].includes(selectedId);
      if(dynamicBuiltin&&/^\{(?:date|time|datetime)(?::[^}]+)?\}$/.test(current)){
        area.value=token;
        area.selectionStart=area.selectionEnd=token.length;
      }else{
        const start=Number.isInteger(area.selectionStart)?area.selectionStart:area.value.length;
        const end=Number.isInteger(area.selectionEnd)?area.selectionEnd:start;
        area.value=area.value.slice(0,start)+token+area.value.slice(end);
        area.selectionStart=area.selectionEnd=start+token.length;
      }
      area.focus();
      setStatus("Format inserted. Save changes to apply.");
    });
  }
  $("editToggle").addEventListener("click",()=>showEditor());
  $("newSnippet").addEventListener("click",()=>{
    fillEditor(null);
    editorOpen=true;
    $("editor").classList.remove("hidden");
    $("editToggle").textContent="Close library";
    $("editName").focus();
  });
  $("saveSnippet").addEventListener("click",()=>{
    setStatus("Saving…");
    send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{
        type:"saveSnippet",
        actionContext,
        snippet:{
          id:editingId,
          name:$("editName").value,
          folder:$("editFolder").value,
          content:$("editContent").value
        }
      }
    });
  });
  $("deleteSnippet").addEventListener("click",()=>{
    if(!editingId)return;
    setStatus("Deleting…");
    send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{type:"deleteSnippet",actionContext,snippetId:editingId}
    });
  });
  $("brandLink").addEventListener("click",()=>{
    send({event:"openUrl",payload:{url:PACKRAT_MAKER_URL}});
  });
  $("upgradeButton").addEventListener("click",()=>{
    if(proUrl)send({event:"openUrl",payload:{url:proUrl}});
  });
  $("topUpgrade").addEventListener("click",()=>{
    if(proUrl)send({event:"openUrl",payload:{url:proUrl}});
  });
  $("openManager").addEventListener("click",()=>{
    const ok=send({
      event:"sendToPlugin",
      action:actionUuid,
      context:uiUuid,
      payload:{type:"openManager",actionContext}
    });
    if(!ok)setStatus("Stream Deck connection unavailable.");
  });

  window.connectElgatoStreamDeckSocket=(port,uuid,registerEvent,info,rawActionInfo)=>{
    uiUuid=uuid;
    const actionInfo=JSON.parse(rawActionInfo||"{}");
    actionUuid=String(actionInfo.action||"");
    actionContext=String(actionInfo.context||"");
    settings=actionInfo.payload?.settings||{};

    const inferredPro=actionUuid.includes("textexpanderpro");
    $("productTitle").textContent=inferredPro?"Text Expander Pro":"Text Expander Lite";

    socket=new WebSocket("ws://127.0.0.1:"+port);
    socket.onopen=()=>{
      send({event:registerEvent,uuid:uiUuid});
      send({event:"getSettings",action:actionUuid,context:uiUuid});
      requestSnippets();
      setTimeout(requestSnippets,180);
    };
    socket.onmessage=(event)=>{
      let message=null;
      try{message=JSON.parse(event.data);}catch{return;}
      if(message.event==="didReceiveSettings"){
        applyReceivedSettings(message.payload?.settings||{});
        setSaveStatus("Saved");
      }
      if(message.event==="sendToPropertyInspector"&&message.payload?.type==="snippetList"){
        renderList(message.payload);
      }
      if(message.event==="sendToPropertyInspector"&&message.payload?.type==="snippetDetail"){
        const detail=message.payload.snippet;
        if(detail?.id){
          const index=snippets.findIndex((snippet)=>snippet.id===detail.id);
          if(index>=0)snippets[index]={...snippets[index],...detail};
          if(editorOpen&&$("snippet").value===detail.id)fillEditor(index>=0?snippets[index]:detail);
        }else if(editorOpen){
          setStatus("That snippet no longer exists. Refreshing library…");
          requestSnippets();
        }
      }
      if(message.event==="sendToPropertyInspector"&&message.payload?.type==="snippetError"){
        setStatus(message.payload.message||"Could not update snippets.");
      }
    };

    if(isManage()){
      $("insertSettings").classList.add("hidden");
      showEditor(true);
    }
  };
})();
