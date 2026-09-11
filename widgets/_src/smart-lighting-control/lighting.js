(function(){
'use strict';
var PORT=17486, PROTOCOL=1, WS_URL='ws://127.0.0.1:17486/widget';
var model={
  connection:'starting',auth:'pending',filter:'favorites',selectedId:null,targets:[],providers:{},
  socket:null,reconnect:null,fixture:false,lastError:'',socketGeneration:0,disposed:false,bound:false,
  connectAttempts:0,settings:null
};

function read(name,fallback){
  try{if(typeof globalThis.__ratpackIcueRead==='function'){var v=globalThis.__ratpackIcueRead(name);if(v!==undefined&&v!==null)return v;}}catch(e){}
  try{var g=globalThis[name];if(g!==undefined&&g!==null)return g;}catch(e){}
  return fallback;
}
function cfg(){return{
  token:String(read('pairingToken','')||'').trim(),
  defaultView:String(read('defaultView','favorites')||'favorites'),
  showOffline:read('showOffline',true)!==false
};}
function applyStyle(){
  var r=document.documentElement,m={textColor:'--text',accentColor:'--accent',backgroundColor:'--bg'};
  Object.keys(m).forEach(function(k){var v=read(k,'');if(v)r.style.setProperty(m[k],String(v));});
}
function escapeHtml(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
function providerName(p){return p==='hue'?'Hue':'Govee';}
function iconFor(t){if(t.kind==='scene')return'◈';if(t.kind==='room'||t.kind==='zone')return'⌂';return'●';}
function cssRgb(c){if(!c)return'#FFD66B';return'rgb('+[c.r,c.g,c.b].map(function(n){return Math.max(0,Math.min(255,Number(n)||0));}).join(',')+')';}
function cap(t,k){return Boolean(t&&t.capabilities&&t.capabilities[k]);}
function visibleTargets(){
  var c=cfg(),f=model.filter||c.defaultView;
  return model.targets.filter(function(t){
    if(!c.showOffline&&t.reachable===false)return false;
    if(f==='favorites')return Boolean(t.favorite);
    if(f==='hue'||f==='govee')return t.provider===f;
    return true;
  });
}
function selected(){return model.targets.find(function(t){return t.id===model.selectedId;})||null;}
function setBlocking(title,copy,hint){
  var el=document.getElementById('blockingState');el.hidden=false;
  document.getElementById('blockingTitle').textContent=title;
  document.getElementById('blockingCopy').textContent=copy;
  document.getElementById('blockingHint').textContent=hint||'Local setup: http://127.0.0.1:'+PORT+'/';
}
function clearBlocking(){document.getElementById('blockingState').hidden=true;}
var toastTimer=null;
function showToast(message){
  var el=document.getElementById('toast');if(!el)return;
  el.textContent=String(message||'Lighting command failed.');el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.hidden=true;},4200);
}
function providerState(s){
  if(s&&s.connected)return{label:'READY',cls:'live'};
  if(s&&(s.partial||s.lan||s.cloud))return{label:'PARTIAL',cls:'partial'};
  return{label:'OFF',cls:'offline'};
}
function renderStatus(){
  var host=document.getElementById('providerStatus'),parts=[];
  ['hue','govee'].forEach(function(p){
    var s=model.providers&&model.providers[p]||{},state=providerState(s),detail=String(s.detail||'Unavailable');
    parts.push('<span class="status-pill '+state.cls+'" title="'+escapeHtml(detail)+'"><i></i><span>'+providerName(p)+' '+state.label+'</span></span>');
  });
  host.innerHTML=parts.join('');
}
function emptyCopy(){
  var p=model.providers||{},h=p.hue||{},g=p.govee||{};
  if(model.filter==='favorites')return'No favorites yet. Star any light, room, or scene to pin it here.';
  if(model.filter==='hue'&&!h.connected)return'Hue is unavailable. Open the local companion to pair or reconnect your Hue Bridge.';
  if(model.filter==='govee'&&!g.connected&&!g.partial&&!g.lan&&!g.cloud)return'Govee is unavailable. Open the local companion to enable LAN discovery or configure the optional Developer API.';
  if(model.filter==='all'&&!h.connected&&!g.connected&&!g.partial&&!g.lan&&!g.cloud)return'No lighting devices found. Open the companion to connect Hue and/or scan Govee LAN.';
  return'No matching lights or scenes are available.';
}
function renderGrid(){
  var host=document.getElementById('targetGrid'),empty=document.getElementById('emptyState'),list=visibleTargets();
  if(!list.length){host.innerHTML='';empty.hidden=false;empty.textContent=emptyCopy();return;}
  empty.hidden=true;
  host.innerHTML=list.map(function(t){
    var on=t.kind==='scene'?false:Boolean(t.on),meta=providerName(t.provider)+' · '+String(t.kind||'light').replace('_',' ');
    if(t.kind!=='scene'&&Number.isFinite(Number(t.brightness)))meta+=' · '+Math.round(Number(t.brightness))+'%';
    if(t.reachable===false)meta+=' · offline';
    return '<button class="target-card '+(on?'on ':'')+(t.kind==='scene'?'scene ':'')+(t.reachable===false?'offline ':'')+(t.id===model.selectedId?'selected':'')+'" data-id="'+escapeHtml(t.id)+'" style="--device-color:'+escapeHtml(cssRgb(t.color))+'">'+
      '<span class="target-icon">'+iconFor(t)+'</span><span class="target-main"><span class="target-name">'+escapeHtml(t.name)+'</span><span class="target-meta">'+escapeHtml(meta)+'</span></span>'+
      '<span class="favorite-card '+(t.favorite?'on':'')+'" data-favorite="'+escapeHtml(t.id)+'">'+(t.favorite?'★':'☆')+'</span></button>';
  }).join('');
}
function renderControls(){
  var t=selected(),empty=document.getElementById('controlEmpty'),controls=document.getElementById('controls');
  if(!t){empty.hidden=false;controls.hidden=true;return;}
  empty.hidden=true;controls.hidden=false;
  var offline=t.reachable===false;
  document.getElementById('controlProvider').textContent=providerName(t.provider)+' · '+String(t.kind||'light').toUpperCase()+(offline?' · OFFLINE':'');
  document.getElementById('controlName').textContent=t.name;
  var fav=document.getElementById('favoriteButton');fav.textContent=t.favorite?'★':'☆';fav.classList.toggle('on',Boolean(t.favorite));
  var isScene=t.kind==='scene';
  document.getElementById('powerButton').hidden=isScene||!cap(t,'power');
  document.getElementById('brightnessControl').hidden=isScene||!cap(t,'brightness');
  document.getElementById('colorControl').hidden=isScene||!cap(t,'color');
  document.getElementById('temperatureControl').hidden=isScene||!cap(t,'temperature');
  document.getElementById('sceneControl').hidden=isScene||!Array.isArray(t.scenes)||!t.scenes.length;
  document.getElementById('activateSceneButton').hidden=!isScene;
  document.getElementById('activateSceneButton').disabled=offline;
  if(!isScene){
    var power=document.getElementById('powerButton');power.classList.toggle('on',Boolean(t.on));power.disabled=offline;document.getElementById('powerLabel').textContent=offline?'Offline':(t.on?'Turn off':'Turn on');
    var b=Math.max(1,Math.min(100,Math.round(Number(t.brightness)||1)));var bs=document.getElementById('brightnessSlider');bs.value=b;bs.disabled=offline;document.getElementById('brightnessValue').textContent=b+'%';
    var range=Array.isArray(t.temperatureRange)?t.temperatureRange:[2000,6500],temp=Math.round(Number(t.temperatureK)||4000),ts=document.getElementById('temperatureSlider');
    ts.min=Number(range[0])||2000;ts.max=Number(range[1])||6500;ts.value=Math.max(Number(ts.min),Math.min(Number(ts.max),temp));ts.disabled=offline;document.getElementById('temperatureValue').textContent=Math.round(Number(ts.value))+'K';
    document.getElementById('colorValue').textContent=t.color?Math.round(t.color.r)+', '+Math.round(t.color.g)+', '+Math.round(t.color.b):'RGB';
    document.getElementById('colorPad').setAttribute('aria-disabled',offline?'true':'false');
    document.querySelectorAll('#swatches button').forEach(function(button){button.disabled=offline;});
    if(Array.isArray(t.scenes)){
      document.getElementById('sceneCount').textContent=t.scenes.length;
      document.getElementById('sceneChips').innerHTML=t.scenes.map(function(s){return'<button class="scene-chip" data-scene="'+escapeHtml(s.id)+'" '+(offline?'disabled':'')+'>'+escapeHtml(s.name)+'</button>';}).join('');
    }
  }
}
function render(){
  applyStyle();document.body.setAttribute('data-state',model.connection);renderStatus();
  document.querySelectorAll('.filter').forEach(function(b){b.classList.toggle('active',b.dataset.filter===model.filter);});
  if(model.connection==='unauthorized'){setBlocking('Pairing token rejected','Copy the current Companion Pairing Token from the local PackRat Lighting Companion setup page.');return;}
  if(model.connection==='incompatible'){setBlocking('Companion update required','This widget and PackRat Lighting Companion use different local protocol versions. Install the companion included with this product version.');return;}
  if(model.connection==='offline'||model.connection==='starting'){setBlocking('Lighting Companion offline','Start PackRat Lighting Companion on this Windows PC. Hue and Govee control stays local through the companion.');return;}
  if(model.connection==='unconfigured'){setBlocking('Finish local setup','Open PackRat Lighting Companion, connect Philips Hue and/or Govee, then paste the Companion Pairing Token in iCUE settings.');return;}
  clearBlocking();renderGrid();renderControls();
}
function applySnapshot(s){
  if(s&&s.protocol!=null&&Number(s.protocol)!==PROTOCOL){model.connection='incompatible';render();return;}
  model.connection='live';model.providers=s.providers||{};model.targets=Array.isArray(s.targets)?s.targets:[];
  if(!model.selectedId||!model.targets.some(function(t){return t.id===model.selectedId;})){
    var v=visibleTargets();model.selectedId=v.length?v[0].id:(model.targets[0]&&model.targets[0].id)||null;
  }
  render();
}
function mutateFixture(cmd){
  var t=model.targets.find(function(x){return x.id===cmd.id;});
  if(cmd.command==='favorite'&&t)t.favorite=Boolean(cmd.value);
  if(cmd.command==='power'&&t)t.on=Boolean(cmd.value);
  if(cmd.command==='brightness'&&t)t.brightness=Number(cmd.value);
  if(cmd.command==='temperature'&&t)t.temperatureK=Number(cmd.value);
  if(cmd.command==='color'&&t)t.color={r:cmd.r,g:cmd.g,b:cmd.b};
  if(cmd.command==='scene'){
    var scene=model.targets.find(function(x){return x.id===cmd.sceneId;});
    if(scene&&scene.parentId){var parent=model.targets.find(function(x){return x.id===scene.parentId;});if(parent)parent.on=true;}
  }
  render();
}
function send(cmd){
  if(model.fixture){mutateFixture(cmd);return true;}
  if(!model.socket||model.socket.readyState!==WebSocket.OPEN)return false;
  try{model.socket.send(JSON.stringify(cmd));return true;}catch(e){return false;}
}
function clearReconnect(){if(model.reconnect){clearTimeout(model.reconnect);model.reconnect=null;}}
function invalidateSocket(){
  model.socketGeneration++;
  var ws=model.socket;model.socket=null;
  if(ws)try{ws.close();}catch(e){}
}
function scheduleReconnect(){
  if(model.fixture||model.disposed||model.connection==='unauthorized'||model.connection==='incompatible'||model.reconnect)return;
  model.reconnect=setTimeout(function(){model.reconnect=null;if(!model.disposed)connect(cfg().token);},1800);
}
function connect(token){
  if(model.fixture||model.disposed)return;
  clearReconnect();
  model.socketGeneration++;
  var gen=model.socketGeneration,old=model.socket;model.socket=null;
  if(old)try{old.close();}catch(e){}
  if(!token){model.connection='unconfigured';render();return;}
  model.connection='starting';model.connectAttempts++;render();
  var ws;
  try{ws=new WebSocket(WS_URL);}catch(e){model.connection='offline';render();scheduleReconnect();return;}
  model.socket=ws;
  var timer=setTimeout(function(){
    if(gen!==model.socketGeneration)return;
    if(ws.readyState!==WebSocket.OPEN){try{ws.close();}catch(e){}model.connection='offline';render();scheduleReconnect();}
  },2200);
  ws.onopen=function(){
    if(gen!==model.socketGeneration)return;
    clearTimeout(timer);
    ws.send(JSON.stringify({type:'hello',token:token,client:'xeneon',protocol:PROTOCOL}));
  };
  ws.onmessage=function(ev){
    if(gen!==model.socketGeneration)return;
    var m;try{m=JSON.parse(ev.data);}catch(e){return;}
    if(m.type==='auth_error'){model.connection='unauthorized';render();invalidateSocket();return;}
    if(m.type==='auth_ok'){
      if(Number(m.protocol)!==PROTOCOL){model.connection='incompatible';render();invalidateSocket();return;}
      model.connection='live';render();return;
    }
    if(m.type==='snapshot')applySnapshot(m);
    if(m.type==='error'){model.lastError=String(m.error||'Lighting command failed.');showToast(model.lastError);}
  };
  ws.onerror=function(){if(gen===model.socketGeneration&&model.connection!=='unauthorized'&&model.connection!=='incompatible'){model.connection='offline';render();}};
  ws.onclose=function(){
    clearTimeout(timer);
    if(gen!==model.socketGeneration)return;
    model.socket=null;
    if(model.connection!=='unauthorized'&&model.connection!=='incompatible'&&!model.disposed){model.connection='offline';render();scheduleReconnect();}
  };
}
function refreshFromSettings(forceReconnect){
  applyStyle();
  var next=cfg(),prev=model.settings;model.settings=next;
  if(!prev)model.filter=next.defaultView||'favorites';
  else if(prev.defaultView!==next.defaultView&&(model.filter===prev.defaultView||!model.filter))model.filter=next.defaultView||'favorites';
  if(model.fixture){render();return;}
  if(!next.token){
    clearReconnect();invalidateSocket();model.connection='unconfigured';render();return;
  }
  var tokenChanged=!prev||prev.token!==next.token;
  var dead=!model.socket||model.socket.readyState===WebSocket.CLOSED||model.socket.readyState===WebSocket.CLOSING;
  if(forceReconnect||tokenChanged||dead){connect(next.token);return;}
  render();
}
function rgbToHex(c){return'#'+[c.r,c.g,c.b].map(function(n){return Math.round(Math.max(0,Math.min(255,n))).toString(16).padStart(2,'0');}).join('');}
function hsv(h,s,v){var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}return{r:(r+m)*255,g:(g+m)*255,b:(b+m)*255};}
var colorTimer=null;
function colorFromPoint(ev){
  var t=selected();if(!t||t.reachable===false||!cap(t,'color'))return;
  var pad=document.getElementById('colorPad'),r=pad.getBoundingClientRect(),x=Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height)),rgb=hsv(x*360,1,1-y*.72);
  document.getElementById('colorCursor').style.left=(x*100)+'%';document.getElementById('colorCursor').style.top=(y*100)+'%';t.color=rgb;renderControls();
  var colorDelay=(t.kind==='room'||t.kind==='zone')?1050:((t.provider==='govee'&&t.transport==='cloud')?550:120);
  clearTimeout(colorTimer);colorTimer=setTimeout(function(){
    if(!send({command:'color',id:t.id,r:Math.round(rgb.r),g:Math.round(rgb.g),b:Math.round(rgb.b)}))showToast('Lighting Companion is offline.');
  },colorDelay);
}
function bind(){
  if(model.bound)return;model.bound=true;
  document.getElementById('filters').addEventListener('click',function(e){
    var b=e.target.closest('[data-filter]');if(!b)return;model.filter=b.dataset.filter;
    var v=visibleTargets();if(v.length&&!v.some(function(t){return t.id===model.selectedId;}))model.selectedId=v[0].id;render();
  });
  document.getElementById('targetGrid').addEventListener('click',function(e){
    var fav=e.target.closest('[data-favorite]');
    if(fav){e.stopPropagation();var id=fav.dataset.favorite,t=model.targets.find(function(x){return x.id===id;});if(t)send({command:'favorite',id:id,value:!t.favorite});return;}
    var card=e.target.closest('[data-id]');if(card){model.selectedId=card.dataset.id;render();}
  });
  document.getElementById('favoriteButton').addEventListener('click',function(){var t=selected();if(t)send({command:'favorite',id:t.id,value:!t.favorite});});
  document.getElementById('powerButton').addEventListener('click',function(){var t=selected();if(t)send({command:'power',id:t.id,value:!t.on});});
  document.getElementById('brightnessSlider').addEventListener('input',function(e){document.getElementById('brightnessValue').textContent=e.target.value+'%';});
  document.getElementById('brightnessSlider').addEventListener('change',function(e){var t=selected();if(t)send({command:'brightness',id:t.id,value:Number(e.target.value)});});
  document.getElementById('temperatureSlider').addEventListener('input',function(e){document.getElementById('temperatureValue').textContent=e.target.value+'K';});
  document.getElementById('temperatureSlider').addEventListener('change',function(e){var t=selected();if(t)send({command:'temperature',id:t.id,value:Number(e.target.value)});});
  var pad=document.getElementById('colorPad');pad.addEventListener('pointerdown',function(e){pad.setPointerCapture&&pad.setPointerCapture(e.pointerId);colorFromPoint(e);});pad.addEventListener('pointermove',function(e){if(e.buttons)colorFromPoint(e);});
  document.getElementById('swatches').addEventListener('click',function(e){var b=e.target.closest('[data-rgb]'),t=selected();if(!b||!t)return;var a=b.dataset.rgb.split(',').map(Number);send({command:'color',id:t.id,r:a[0],g:a[1],b:a[2]});});
  document.getElementById('sceneChips').addEventListener('click',function(e){var b=e.target.closest('[data-scene]'),t=selected();if(b&&t)send({command:'scene',id:t.id,sceneId:b.dataset.scene});});
  document.getElementById('activateSceneButton').addEventListener('click',function(){var t=selected();if(t)send({command:'scene',id:t.parentId||t.id,sceneId:t.id});});
  window.addEventListener('pagehide',cleanup,{once:true});
}
function cleanup(){
  model.disposed=true;clearReconnect();clearTimeout(colorTimer);colorTimer=null;clearTimeout(toastTimer);toastTimer=null;invalidateSocket();
}
function fixtureStart(f){
  model.fixture=true;model.settings=cfg();model.connection=f.connection||'live';model.providers=f.providers||{};model.targets=JSON.parse(JSON.stringify(f.targets||[]));model.filter=model.settings.defaultView||f.filter||'favorites';
  if(f.forceFilter)model.filter=f.forceFilter;var v=visibleTargets();model.selectedId=f.selectedId||(v[0]&&v[0].id)||(model.targets[0]&&model.targets[0].id)||null;render();
}
function start(){
  applyStyle();bind();
  var f=globalThis.__PACKRAT_LIGHTING_FIXTURE__;
  if(f)fixtureStart(f);else refreshFromSettings(true);
}
globalThis.icueEvents={
  onICUEInitialized:function(){refreshFromSettings(false);},
  onDataUpdated:function(){refreshFromSettings(false);}
};
globalThis.__PACKRAT_LIGHTING_TEST__={
  state:model,applySnapshot:applySnapshot,visibleTargets:visibleTargets,selected:selected,send:send,
  fixtureStart:fixtureStart,rgbToHex:rgbToHex,refreshFromSettings:refreshFromSettings,cleanup:cleanup,protocol:PROTOCOL
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();