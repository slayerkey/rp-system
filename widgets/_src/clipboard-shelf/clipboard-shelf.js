(function(){
"use strict";
var WS_URL="ws://127.0.0.1:17485/ws";
var WS_PROTOCOL="packrat-clipboard-shelf-v1-a91f6c";
var RECONNECT_MS=1200;
var socket=null,reconnectTimer=null,clearArmedUntil=0,toastTimer=null;
var state={connected:false,privateMode:false,maxHistory:40,currentId:"",entries:[],revision:0};
var ui={filter:"all",search:""};
var fixture=globalThis.__clipboardShelfFixture||null;

function classifyUrl(text){
  var raw=String(text||"").trim();
  if(!/^https?:\/\/[^\s]+$/i.test(raw))return null;
  try{var u=new URL(raw);return {url:raw,domain:u.hostname.replace(/^www\./i,"")};}catch(e){return null;}
}
function normalizeEntry(entry,index){
  var text=String(entry&&entry.text||"");
  var link=classifyUrl(text);
  return {
    id:String(entry&&entry.id||("fixture-"+index)),text:text,
    createdAt:String(entry&&entry.createdAt||new Date(Date.now()-index*60000).toISOString()),
    pinned:Boolean(entry&&entry.pinned),favorite:Boolean(entry&&entry.favorite),
    url:entry&&entry.url?String(entry.url):(link?link.url:""),
    domain:entry&&entry.domain?String(entry.domain):(link?link.domain:"")
  };
}
function dedupeEntries(entries,maxHistory){
  var seen=new Set(),out=[],limit=Math.max(1,Number(maxHistory)||40);
  (entries||[]).map(normalizeEntry).sort(function(a,b){
    if(a.pinned!==b.pinned)return a.pinned?-1:1;
    return Date.parse(b.createdAt)-Date.parse(a.createdAt);
  }).forEach(function(e){
    if(seen.has(e.text))return;seen.add(e.text);
    if(e.pinned||out.filter(function(x){return !x.pinned;}).length<limit)out.push(e);
  });
  return out;
}
function slotFor(w,h){
  if(w>2200)return"xl-h";
  if(h>2200)return"xl-v";
  if(w>1000&&h<=800)return"l-h";
  if(h>1000&&w<=800)return"l-v";
  if(w<=900&&h<=390)return"s-h";
  if(w<=720&&h<=500)return"s-v";
  if(w<=900&&h<=760)return"m-h";
  return"m-v";
}
function applySlot(){document.body.dataset.slot=slotFor(innerWidth,innerHeight);}
function readSetting(name,fallback){
  try{
    if(typeof globalThis.__ratpackIcueRead==="function"){
      var v=globalThis.__ratpackIcueRead(name);if(v!==undefined)return v;
    }
    if(globalThis[name]!==undefined)return globalThis[name];
  }catch(e){}
  return fallback;
}
function applyAppearance(){
  document.documentElement.style.setProperty("--text",String(readSetting("textColor","#F5F7FA")));
  document.documentElement.style.setProperty("--accent",String(readSetting("accentColor","#63E6BE")));
  document.documentElement.style.setProperty("--bg",String(readSetting("backgroundColor","#080B10")));
  var next=Math.max(10,Math.min(100,Number(readSetting("maxHistory",40))||40));
  if(next!==state.maxHistory){state.maxHistory=next;if(state.connected&&!fixture)send({command:"config",maxHistory:next});}
}
function formatTime(iso){
  var d=new Date(iso);if(Number.isNaN(d.getTime()))return"";
  try{return d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});}catch(e){return"";}
}
function visibleEntries(){
  var q=ui.search.trim().toLowerCase();
  return state.entries.filter(function(e){
    if(ui.filter==="pinned"&&!e.pinned)return false;
    if(ui.filter==="favorites"&&!e.favorite)return false;
    if(ui.filter==="links"&&!e.url)return false;
    if(q&&!(e.text.toLowerCase().includes(q)||e.domain.toLowerCase().includes(q)))return false;
    return true;
  });
}
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function badge(text,cls){return el("span","badge "+(cls||""),text);}
function actionButton(label,action,id,active){
  var b=el("button","icon-button"+(active?" active":""));b.type="button";b.dataset.action=action;b.dataset.id=id;b.setAttribute("aria-label",label);b.textContent=action==="pin"?"⌖":action==="favorite"?"★":"×";return b;
}
function makeCard(e){
  var card=el("article","clip-card"+(e.id===state.currentId?" current":""));card.dataset.id=e.id;
  var main=el("button","card-main");main.type="button";main.dataset.action="copy";main.dataset.id=e.id;main.setAttribute("aria-label","Copy clipboard entry");
  var badges=el("div","card-badges");if(e.pinned)badges.appendChild(badge("PINNED",""));if(e.favorite)badges.appendChild(badge("FAVORITE",""));if(e.url)badges.appendChild(badge("URL","url"));main.appendChild(badges);
  main.appendChild(el("div","preview",e.text));
  main.appendChild(el("div","meta",(e.url?e.domain+" • ":"")+formatTime(e.createdAt)));
  var actions=el("div","card-actions");
  actions.appendChild(actionButton(e.pinned?"Unpin":"Pin","pin",e.id,e.pinned));
  actions.appendChild(actionButton(e.favorite?"Remove favorite":"Favorite","favorite",e.id,e.favorite));
  var del=actionButton("Delete","delete",e.id,false);del.classList.add("delete");actions.appendChild(del);
  card.appendChild(main);card.appendChild(actions);return card;
}
function showOnly(name){
  ["shelf","emptyState","offlineState","privateState"].forEach(function(id){document.getElementById(id).hidden=id!==name;});
}
function render(){
  applySlot();applyAppearance();
  var status=document.getElementById("bridgeStatus");status.classList.toggle("online",state.connected);
  status.querySelector(".status-text").textContent=state.connected?"Bridge connected":"Bridge offline";
  var priv=document.getElementById("privateButton");priv.setAttribute("aria-pressed",String(state.privateMode));priv.textContent=state.privateMode?"Private on":"Private";
  if(!state.connected&&!fixture){showOnly("offlineState");document.getElementById("countLabel").textContent="offline";return;}
  if(state.privateMode){showOnly("privateState");document.getElementById("countLabel").textContent="capture paused";return;}
  var entries=visibleEntries(),shelf=document.getElementById("shelf");shelf.textContent="";
  entries.forEach(function(e){shelf.appendChild(makeCard(e));});
  document.getElementById("countLabel").textContent=entries.length+" "+(entries.length===1?"item":"items");
  if(entries.length){showOnly("shelf");}else{showOnly("emptyState");}
}
function toast(text){
  var t=document.getElementById("toast");t.textContent=text;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.classList.remove("show");},950);
}
function applySnapshot(s){
  if(!s||s.type!=="snapshot")return;
  state.connected=true;state.privateMode=Boolean(s.privateMode);state.maxHistory=Number(s.maxHistory)||state.maxHistory;state.currentId=String(s.currentId||"");state.revision=Number(s.revision)||0;
  state.entries=dedupeEntries(Array.isArray(s.entries)?s.entries:[],state.maxHistory);
  render();
}
function fixtureCommand(cmd){
  var e=state.entries.find(function(x){return x.id===cmd.id;});
  if(cmd.command==="copy"&&e){state.currentId=e.id;toast("Copied");}
  if(cmd.command==="pin"&&e)e.pinned=Boolean(cmd.value);
  if(cmd.command==="favorite"&&e)e.favorite=Boolean(cmd.value);
  if(cmd.command==="delete")state.entries=state.entries.filter(function(x){return x.id!==cmd.id;});
  if(cmd.command==="clear"){state.entries=[];state.currentId="";}
  if(cmd.command==="private")state.privateMode=Boolean(cmd.value);
  if(cmd.command==="config")state.maxHistory=Number(cmd.maxHistory)||state.maxHistory;
  state.entries=dedupeEntries(state.entries,state.maxHistory);state.revision++;render();
}
function send(cmd){
  if(fixture){fixtureCommand(cmd);return true;}
  if(!socket||socket.readyState!==WebSocket.OPEN)return false;
  try{socket.send(JSON.stringify(cmd));return true;}catch(e){return false;}
}
function scheduleReconnect(){if(fixture||reconnectTimer)return;reconnectTimer=setTimeout(function(){reconnectTimer=null;connect();},RECONNECT_MS);}
function connect(){
  if(fixture)return;
  if(socket&&(socket.readyState===WebSocket.OPEN||socket.readyState===WebSocket.CONNECTING))return;
  var ws;try{ws=new WebSocket(WS_URL,WS_PROTOCOL);}catch(e){state.connected=false;render();scheduleReconnect();return;}
  socket=ws;
  ws.addEventListener("open",function(){if(socket!==ws)return;state.connected=true;send({command:"refresh"});send({command:"config",maxHistory:state.maxHistory});render();});
  ws.addEventListener("message",function(ev){var p;try{p=JSON.parse(String(ev.data||""));}catch(e){return;}applySnapshot(p);});
  ws.addEventListener("close",function(){if(socket!==ws)return;socket=null;state.connected=false;render();scheduleReconnect();});
  ws.addEventListener("error",function(){if(socket===ws){state.connected=false;render();}});
}
function handleAction(action,id){
  var e=state.entries.find(function(x){return x.id===id;});
  if(action==="copy"&&e){send({command:"copy",id:id});return;}
  if(action==="pin"&&e){send({command:"pin",id:id,value:!e.pinned});return;}
  if(action==="favorite"&&e){send({command:"favorite",id:id,value:!e.favorite});return;}
  if(action==="delete"&&e){send({command:"delete",id:id});return;}
}
function installEvents(){
  document.getElementById("shelf").addEventListener("click",function(ev){
    var target=ev.target.closest("[data-action]");if(!target)return;ev.preventDefault();handleAction(target.dataset.action,target.dataset.id);
  });
  document.querySelector(".filters").addEventListener("click",function(ev){
    var b=ev.target.closest("[data-filter]");if(!b)return;ui.filter=b.dataset.filter;document.querySelectorAll(".filter").forEach(function(x){x.classList.toggle("active",x===b);});render();
  });
  document.getElementById("searchInput").addEventListener("input",function(ev){ui.search=ev.target.value||"";render();});
  document.getElementById("privateButton").addEventListener("click",function(){send({command:"private",value:!state.privateMode});});
  document.getElementById("resumeButton").addEventListener("click",function(){send({command:"private",value:false});});
  document.getElementById("clearButton").addEventListener("click",function(){
    var now=Date.now(),b=this;if(now<clearArmedUntil){clearArmedUntil=0;b.classList.remove("armed");b.textContent="Clear";send({command:"clear"});toast("History cleared");}
    else{clearArmedUntil=now+2600;b.classList.add("armed");b.textContent="Tap again";setTimeout(function(){if(Date.now()>=clearArmedUntil){b.classList.remove("armed");b.textContent="Clear";}},2700);}
  });
  addEventListener("resize",render);
}
globalThis.icueEvents=globalThis.icueEvents||{};
globalThis.icueEvents.onDataUpdated=function(){applyAppearance();render();};
globalThis.__clipboardShelfTest={classifyUrl:classifyUrl,dedupeEntries:dedupeEntries,slotFor:slotFor};
if(typeof document==="undefined")return;
document.addEventListener("DOMContentLoaded",function(){
  installEvents();applySlot();applyAppearance();
  if(fixture){
    state.connected=true;state.privateMode=Boolean(fixture.privateMode);state.maxHistory=Number(fixture.maxHistory)||40;state.currentId=String(fixture.currentId||"");
    state.entries=dedupeEntries(fixture.entries||[],state.maxHistory);render();
  }else{render();connect();}
  globalThis.__clipboardShelfReady=true;
});
})();