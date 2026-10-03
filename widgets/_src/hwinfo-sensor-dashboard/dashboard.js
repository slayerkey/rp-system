(function(){
"use strict";

var WS_URL="ws://127.0.0.1:17489/widget";
var SETUP_URL="http://127.0.0.1:17489/";
var COMPANION_URL="https://github.com/slayerkey/rp-system/releases/tag/hwinfo-bridge-v1.0.0";
var HWINFO_URL="https://www.hwinfo.com/download/";
var PROTOCOL=1;
var STORE_KEY="packrat.hwinfo-dashboard.v1";
var slots=[
{id:"s-h",w:840,h:344,limit:2},{id:"s-v",w:696,h:416,limit:2},{id:"m-h",w:840,h:696,limit:4},{id:"m-v",w:696,h:840,limit:4},
{id:"l-h",w:1688,h:696,limit:6},{id:"l-v",w:696,h:1688,limit:6},{id:"xl-h",w:2536,h:696,limit:8},{id:"xl-v",w:696,h:2536,limit:8}
];

var model={
socket:null,reconnectTimer:null,reconnectAttempt:0,staleTimer:null,fixtureMode:false,shuttingDown:false,booted:false,
connection:"starting",provider:"unknown",providerStatus:null,sensors:[],byKey:Object.create(null),histories:Object.create(null),
session:Object.create(null),lastSnapshotAt:0,lastPollTime:0,slot:"s-h",thresholdTarget:null,search:"",
settings:{bridgeKey:"",historyWindow:180,staleSeconds:8,textColor:"#F4F6F8",accentColor:"#2BE86A",backgroundColor:"#070A0D",graphColor:"#55D6FF"},
persist:{schema:1,slots:{},favorites:{},thresholds:{}}
};

function byId(id){return document.getElementById(id)}
function bool(v){return v===true||v===1||String(v).toLowerCase()==="true"}
function num(v,f){var n=Number(v);return Number.isFinite(n)?n:f}
function text(v,f){return v===undefined||v===null?f:String(v)}
function safeJson(raw,f){try{var v=JSON.parse(raw);return v&&typeof v==="object"?v:f}catch(e){return f}}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function now(){return Date.now()}

function openExternal(url){
 try{if(window.plugins&&window.plugins.Linkprovider&&typeof pluginLinkprovider_initialized!=="undefined"&&pluginLinkprovider_initialized){window.plugins.Linkprovider.open(url);return true}}catch(e){}
 try{window.open(url,"_blank");return true}catch(e){return false}
}

function readSettings(){
 try{if(typeof globalThis.__ratpackIcueSyncGlobals==="function")globalThis.__ratpackIcueSyncGlobals()}catch(e){}
 var oldKey=model.settings.bridgeKey;
 try{model.settings.bridgeKey=text(typeof bridgeKey!=="undefined"?bridgeKey:model.settings.bridgeKey,"").trim()}catch(e){}
 try{model.settings.historyWindow=clamp(num(typeof historyWindow!=="undefined"?historyWindow:model.settings.historyWindow,180),60,900)}catch(e){}
 try{model.settings.staleSeconds=clamp(num(typeof staleSeconds!=="undefined"?staleSeconds:model.settings.staleSeconds,8),3,30)}catch(e){}
 try{model.settings.textColor=text(typeof textColor!=="undefined"?textColor:model.settings.textColor,"#F4F6F8")}catch(e){}
 try{model.settings.accentColor=text(typeof accentColor!=="undefined"?accentColor:model.settings.accentColor,"#2BE86A")}catch(e){}
 try{model.settings.backgroundColor=text(typeof backgroundColor!=="undefined"?backgroundColor:model.settings.backgroundColor,"#070A0D")}catch(e){}
 try{model.settings.graphColor=text(typeof graphColor!=="undefined"?graphColor:model.settings.graphColor,"#55D6FF")}catch(e){}
 document.documentElement.style.setProperty("--text",model.settings.textColor);
 document.documentElement.style.setProperty("--accent",model.settings.accentColor);
 document.documentElement.style.setProperty("--bg",model.settings.backgroundColor);
 document.documentElement.style.setProperty("--graph",model.settings.graphColor);
 trimHistories();
 if(oldKey!==model.settings.bridgeKey&&model.socket){try{model.socket.close()}catch(e){}}
}

function nearestSlot(){
 var w=window.innerWidth||840,h=window.innerHeight||344,best=slots[0],d=Infinity;
 slots.forEach(function(s){var dx=w-s.w,dy=h-s.h,n=dx*dx+dy*dy;if(n<d){best=s;d=n}});
 model.slot=best.id;document.body.setAttribute("data-slot",best.id);return best
}
function currentSlot(){return slots.find(function(s){return s.id===model.slot})||slots[0]}

function loadPersist(){
 var value=safeJson(localStorage.getItem(STORE_KEY),null);
 if(!value||value.schema!==1){model.persist={schema:1,slots:{},favorites:{},thresholds:{}};return}
 model.persist={schema:1,slots:value.slots&&typeof value.slots==="object"?value.slots:{},favorites:value.favorites&&typeof value.favorites==="object"?value.favorites:{},thresholds:value.thresholds&&typeof value.thresholds==="object"?value.thresholds:{}}
}
function savePersist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(model.persist))}catch(e){}}
function selectedFingerprints(){
 var list=model.persist.slots[model.slot];return Array.isArray(list)?list.slice(0,currentSlot().limit):[]
}
function sensorFingerprint(sensor){
 return text(sensor.fingerprint,"")||[text(sensor.sensorName,""),text(sensor.label,""),text(sensor.unit,""),text(sensor.type,"")].join("\u241f")
}
function sensorRawKey(sensor){return text(sensor.key,"")}
function findSensor(fp){
 var exact=model.byKey[fp];if(exact)return exact;
 for(var i=0;i<model.sensors.length;i++){if(sensorFingerprint(model.sensors[i])===fp)return model.sensors[i]}
 return null
}

function rebuildIndex(){
 model.byKey=Object.create(null);
 model.sensors.forEach(function(s){
  if(sensorRawKey(s))model.byKey[sensorRawKey(s)]=s;
  var fp=sensorFingerprint(s);if(fp&&!model.byKey[fp])model.byKey[fp]=s
 })
}

function historyKey(sensor){return sensorFingerprint(sensor)||sensorRawKey(sensor)}
function addSample(sensor,stamp){
 var value=Number(sensor.value);if(!Number.isFinite(value))return;
 var key=historyKey(sensor);if(!key)return;
 var hist=model.histories[key]||(model.histories[key]=[]);
 if(hist.length&&hist[hist.length-1].t===stamp)return;
 hist.push({t:stamp,v:value});
 var cutoff=stamp-model.settings.historyWindow*1000;
 while(hist.length&&hist[0].t<cutoff)hist.shift();
 if(hist.length>900)hist.splice(0,hist.length-900);
 var st=model.session[key]||(model.session[key]={min:value,max:value,sum:0,count:0});
 st.min=Math.min(st.min,value);st.max=Math.max(st.max,value);st.sum+=value;st.count+=1
}
function trimHistories(){
 var cutoff=now()-model.settings.historyWindow*1000;
 Object.keys(model.histories).forEach(function(k){var h=model.histories[k];while(h.length&&h[0].t<cutoff)h.shift();if(h.length>900)h.splice(0,h.length-900)})
}
function sessionStats(sensor){
 var st=model.session[historyKey(sensor)];
 if(!st||!st.count)return {min:null,max:null,avg:null};
 return {min:st.min,max:st.max,avg:st.sum/st.count}
}

function providerMessage(status){
 var code=status&&status.code||"unknown";
 if(code==="live")return ["Live HWiNFO sensors","Receiving Shared Memory data from HWiNFO."];
 if(code==="hwinfo_not_running")return ["HWiNFO is not running","Start HWiNFO in Sensors mode, then enable Shared Memory Support."];
 if(code==="shared_memory_unavailable")return ["Shared Memory is unavailable","HWiNFO is running, but the documented Shared Memory mapping is not available. Open Sensors and enable Shared Memory Support."];
 if(code==="shared_memory_lost")return ["Shared Memory stopped","The HWiNFO feed was available and then disappeared. Free HWiNFO64 can disable Shared Memory after 12 hours; re-enable it in HWiNFO, or use a licensed edition without that runtime limit."];
 if(code==="shared_memory_inactive")return ["Shared Memory is inactive","HWiNFO is present, but its Shared Memory block is not active. Make sure Sensors are active and Shared Memory Support is enabled."];
 if(code==="no_sensors")return ["No HWiNFO sensors found","Shared Memory is active, but HWiNFO exposed no sensor readings. Open the HWiNFO Sensors window and wait for sensors to populate."];
 if(code==="access_denied")return ["HWiNFO access was denied","Run the PackRat bridge at the same Windows privilege level as HWiNFO, then reconnect."];
 if(code==="malformed")return ["HWiNFO data could not be read","The Shared Memory header or row layout was invalid. Restart HWiNFO and the bridge; unsupported layouts fail closed instead of showing fake values."];
 return ["Waiting for HWiNFO","Start HWiNFO Sensors and enable Shared Memory Support."]
}

function setConnection(connection,provider,status){
 model.connection=connection;if(provider)model.provider=provider;if(status!==undefined)model.providerStatus=status;
 document.body.setAttribute("data-connection",connection);document.body.setAttribute("data-provider",model.provider);
 var label="CONNECTING";
 if(connection==="offline")label="COMPANION OFFLINE";
 else if(connection==="pairing")label="PAIRING KEY";
 else if(connection==="mismatch")label="UPDATE BRIDGE";
 else if(model.provider==="live")label="LIVE";
 else if(model.provider==="stale")label="STALE";
 else if(model.provider==="error")label="HWiNFO CHECK";
 byId("statusText").textContent=label;
 render()
}

function stateForNoDashboard(){
 if(model.connection==="offline")return ["Companion offline","Install or start PackRat HWiNFO Bridge. The widget connects only to 127.0.0.1 on this PC."];
 if(model.connection==="pairing")return ["Pairing key required","Open Bridge Setup, copy the local key, and paste it into HWiNFO Bridge Pairing Key in iCUE settings."];
 if(model.connection==="mismatch")return ["Companion update required","The widget and bridge protocol versions do not match. Install the current PackRat HWiNFO Bridge."];
 if(model.connection!=="live")return ["Starting local companion","Connecting to PackRat HWiNFO Bridge on this PC."];
 return providerMessage(model.providerStatus)
}

function isStale(sensor){
 var stamp=Number(sensor.sampleTime||model.lastPollTime||model.lastSnapshotAt);if(!Number.isFinite(stamp)||stamp<=0)return true;
 return now()-stamp>model.settings.staleSeconds*1000
}
function formatValue(v){
 if(v===null||v===undefined||v==="")return "—";var n=Number(v);if(!Number.isFinite(n))return "—";
 var a=Math.abs(n);if(a>=1000000)return n.toExponential(2);if(a>=1000)return n.toFixed(a>=10000?0:1);if(a>=100)return n.toFixed(1);if(a>=10)return n.toFixed(1);return n.toFixed(2)
}
function thresholdFor(sensor){return model.persist.thresholds[sensorFingerprint(sensor)]||{}}
function alertFor(sensor){
 if(isStale(sensor)||!Number.isFinite(Number(sensor.value)))return "none";
 var t=thresholdFor(sensor),v=Number(sensor.value),critical=Number(t.critical),warning=Number(t.warning);
 if(t.critical!==""&&t.critical!==undefined&&Number.isFinite(critical)&&v>=critical)return "critical";
 if(t.warning!==""&&t.warning!==undefined&&Number.isFinite(warning)&&v>=warning)return "warning";
 return "none"
}

function sparkMarkup(sensor){
 var hist=model.histories[historyKey(sensor)]||[];if(hist.length<2)return '<svg class="spark" viewBox="0 0 300 80" preserveAspectRatio="none"><line class="grid" x1="0" y1="40" x2="300" y2="40"/></svg>';
 var values=hist.map(function(p){return p.v}).filter(Number.isFinite);if(values.length<2)return "";
 var min=Math.min.apply(null,values),max=Math.max.apply(null,values);if(max===min){max+=1;min-=1}
 var pts=hist.map(function(p,i){var x=(i/(hist.length-1))*300,y=72-((p.v-min)/(max-min))*64;return x.toFixed(1)+","+y.toFixed(1)}).join(" ");
 var fill="0,80 "+pts+" 300,80";
 return '<svg class="spark" viewBox="0 0 300 80" preserveAspectRatio="none"><line class="grid" x1="0" y1="40" x2="300" y2="40"/><polygon class="fill" points="'+fill+'"/><polyline class="trace" points="'+pts+'"/></svg>'
}

function makeCard(sensor,index){
 var card=document.createElement("article");card.className="sensorCard";card.dataset.alert=alertFor(sensor);
 var stale=isStale(sensor),stats=sessionStats(sensor),fav=Boolean(model.persist.favorites[sensorFingerprint(sensor)]);
 var value=stale?"—":formatValue(sensor.value),unit=stale?"":text(sensor.unit,"");
 card.innerHTML=
  '<div class="sensorHead"><div class="sensorNames"><div class="sensorDevice"></div><div class="sensorLabel"></div></div><button class="favorite '+(fav?"on":"")+'" type="button" aria-label="Favorite sensor">★</button></div>'+
  '<div class="valueLine"><span class="sensorValue '+(stale?"unavailable":"")+'">'+value+'</span><span class="sensorUnit"></span></div>'+
  sparkMarkup(sensor)+
  '<div class="stats"><div class="stat"><span>SESSION MIN</span><b>'+formatValue(stats.min)+'</b></div><div class="stat"><span>SESSION AVG</span><b>'+formatValue(stats.avg)+'</b></div><div class="stat"><span>SESSION MAX</span><b>'+formatValue(stats.max)+'</b></div></div>'+
  '<button class="thresholdButton" type="button" aria-label="Edit thresholds">⚑</button>';
 card.querySelector(".sensorDevice").textContent=text(sensor.sensorName,"HWiNFO");
 card.querySelector(".sensorLabel").textContent=text(sensor.label,"Unnamed sensor");
 card.querySelector(".sensorUnit").textContent=unit;
 card.querySelector(".favorite").addEventListener("click",function(ev){ev.stopPropagation();toggleFavorite(sensor)});
 card.querySelector(".thresholdButton").addEventListener("click",function(ev){ev.stopPropagation();openThreshold(sensor)});
 return card
}

function render(){
 nearestSlot();
 var selected=selectedFingerprints(),found=[];
 selected.forEach(function(fp){var s=findSensor(fp);if(s)found.push(s)});
 var dashboard=byId("dashboard"),state=byId("statePanel");
 dashboard.replaceChildren();
 var canShow=model.connection==="live"&&model.provider==="live"&&found.length>0;
 if(canShow){
  state.hidden=true;dashboard.hidden=false;found.forEach(function(sensor,i){dashboard.appendChild(makeCard(sensor,i))})
 }else{
  dashboard.hidden=true;state.hidden=false;
  var pair=stateForNoDashboard();
  if(model.connection==="live"&&model.provider==="live"&&!found.length&&model.sensors.length){pair=["Choose your HWiNFO sensors","Tap the gear to search any sensor HWiNFO exposes and assign it to this dashboard layout."]}
  byId("stateTitle").textContent=pair[0];byId("stateBody").textContent=pair[1]
 }
 if(!byId("configSheet").hidden)renderPicker()
}

function toggleFavorite(sensor){
 var fp=sensorFingerprint(sensor);if(model.persist.favorites[fp])delete model.persist.favorites[fp];else model.persist.favorites[fp]=true;savePersist();render();toast(model.persist.favorites[fp]?"Added to favorites":"Removed from favorites")
}
function assignedIndex(sensor){
 var fp=sensorFingerprint(sensor),list=selectedFingerprints();return list.indexOf(fp)
}
function assignSensor(sensor){
 var fp=sensorFingerprint(sensor),list=selectedFingerprints(),at=list.indexOf(fp),limit=currentSlot().limit;
 if(at>=0)list.splice(at,1);else{if(list.length>=limit)list.shift();list.push(fp)}
 model.persist.slots[model.slot]=list;savePersist();render();toast(at>=0?"Removed from this layout":"Sensor assigned")
}
function presetMatches(sensor,preset){
 var s=(text(sensor.sensorName,"")+" "+text(sensor.label,"")+" "+text(sensor.type,"")).toLowerCase();
 if(preset==="cpu-gpu")return /cpu|gpu/.test(s)&&/(temperature|temp|load|usage|power|clock|hot spot|hotspot)/.test(s);
 if(preset==="thermals")return text(sensor.type,"").toLowerCase()==="temperature"||/temp|vrm|chipset/.test(s);
 if(preset==="fans")return text(sensor.type,"").toLowerCase()==="fan"||/fan|pump/.test(s);
 if(preset==="storage")return /nvme|ssd|hdd|drive|storage|disk/.test(s);
 if(preset==="favorites")return Boolean(model.persist.favorites[sensorFingerprint(sensor)]);
 return false
}
function applyPreset(name){
 var matches=model.sensors.filter(function(s){return presetMatches(s,name)}).slice(0,currentSlot().limit);
 model.persist.slots[model.slot]=matches.map(sensorFingerprint);savePersist();render();toast(matches.length?("Loaded "+matches.length+" sensors"):"No matching sensors found")
}

function renderPicker(){
 var query=model.search.trim().toLowerCase(),picker=byId("sensorPicker"),limit=currentSlot().limit,list=selectedFingerprints();
 byId("slotSummary").textContent=model.slot.toUpperCase()+" • "+list.length+" / "+limit+" slots assigned • "+model.sensors.length+" sensors discovered";
 var sensors=model.sensors.filter(function(s){
  if(!query)return true;return (text(s.sensorName,"")+" "+text(s.label,"")+" "+text(s.unit,"")+" "+text(s.type,"")).toLowerCase().indexOf(query)>=0
 }).slice(0,140);
 picker.replaceChildren();
 sensors.forEach(function(sensor){
  var row=document.createElement("div");row.className="pickerRow";
  var assigned=assignedIndex(sensor)>=0,fav=Boolean(model.persist.favorites[sensorFingerprint(sensor)]);
  row.innerHTML='<div class="pickerMain"><div class="pickerLabel"></div><div class="pickerMeta"></div></div><div class="pickerValue"></div><div class="pickerActions"><button class="pickFav '+(fav?"assigned":"")+'" type="button" aria-label="Favorite">★</button><button class="pickAssign '+(assigned?"assigned":"")+'" type="button" aria-label="Assign">'+(assigned?"✓":"+")+'</button></div>';
  row.querySelector(".pickerLabel").textContent=text(sensor.label,"Unnamed sensor");
  row.querySelector(".pickerMeta").textContent=text(sensor.sensorName,"HWiNFO")+" • "+text(sensor.type,"Other")+" • "+text(sensor.unit,"unitless");
  row.querySelector(".pickerValue").textContent=isStale(sensor)?"STALE":formatValue(sensor.value)+" "+text(sensor.unit,"");
  row.querySelector(".pickFav").addEventListener("click",function(){toggleFavorite(sensor)});
  row.querySelector(".pickAssign").addEventListener("click",function(){assignSensor(sensor)});
  picker.appendChild(row)
 });
 if(!sensors.length){var empty=document.createElement("div");empty.className="pickerRow";empty.textContent=query?"No sensors match this search.":"No sensors are currently exposed by HWiNFO.";picker.appendChild(empty)}
}

function openThreshold(sensor){
 model.thresholdTarget=sensor;var t=thresholdFor(sensor);
 byId("thresholdTitle").textContent=text(sensor.label,"Sensor")+" • "+text(sensor.unit,"");
 byId("warningThreshold").value=t.warning===undefined?"":t.warning;byId("criticalThreshold").value=t.critical===undefined?"":t.critical;
 byId("thresholdSheet").hidden=false;byId("thresholdSheet").setAttribute("aria-hidden","false")
}
function closeThreshold(){model.thresholdTarget=null;byId("thresholdSheet").hidden=true;byId("thresholdSheet").setAttribute("aria-hidden","true")}
function saveThreshold(){
 var sensor=model.thresholdTarget;if(!sensor)return closeThreshold();
 var w=byId("warningThreshold").value.trim(),c=byId("criticalThreshold").value.trim();
 if(w!==""&&!Number.isFinite(Number(w)))return toast("Warning must be a number or blank");
 if(c!==""&&!Number.isFinite(Number(c)))return toast("Critical must be a number or blank");
 if(w!==""&&c!==""&&Number(c)<Number(w))return toast("Critical should be at or above warning");
 model.persist.thresholds[sensorFingerprint(sensor)]={warning:w,critical:c};savePersist();closeThreshold();render();toast("Thresholds saved")
}

function toast(message){var el=byId("toast");el.textContent=message;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(function(){el.classList.remove("show")},1400)}

function handleSnapshot(msg){
 var sensors=Array.isArray(msg.sensors)?msg.sensors:[];
 model.sensors=sensors.filter(function(s){return s&&Number.isFinite(Number(s.value))||s&&s.available===false});
 rebuildIndex();model.lastSnapshotAt=now();model.lastPollTime=Number(msg.pollTime)||model.lastSnapshotAt;
 model.providerStatus=msg.status||{code:sensors.length?"live":"no_sensors"};
 model.provider=model.providerStatus.code==="live"?"live":(model.providerStatus.code==="stale"?"stale":"error");
 if(model.provider==="live"){
  var stamp=model.lastPollTime;model.sensors.forEach(function(s){if(s.available!==false)addSample(s,Number(s.sampleTime)||stamp)})
 }
 document.body.setAttribute("data-provider",model.provider);render()
}

function handleMessage(raw){
 var msg;try{msg=JSON.parse(raw)}catch(e){return}
 if(!msg||typeof msg!=="object")return;
 if(msg.type==="auth_ok"){model.connection="live";model.reconnectAttempt=0;setConnection("live",model.provider,model.providerStatus);return}
 if(msg.type==="pairing_required"){setConnection("pairing","error",{code:"pairing_required"});return}
 if(msg.type==="protocol_mismatch"){setConnection("mismatch","error",{code:"protocol_mismatch"});return}
 if(msg.type==="snapshot"){handleSnapshot(msg);return}
 if(msg.type==="status"){model.providerStatus=msg.status||{code:"unknown"};model.provider=msg.status&&msg.status.code==="live"?"live":(msg.status&&msg.status.code==="stale"?"stale":"error");document.body.setAttribute("data-provider",model.provider);render()}
}

function scheduleReconnect(){
 if(model.shuttingDown||model.fixtureMode||model.reconnectTimer)return;
 var delay=Math.min(10000,1200*Math.pow(1.55,model.reconnectAttempt++));
 model.reconnectTimer=setTimeout(function(){model.reconnectTimer=null;connect()},delay)
}
function connect(){
 if(model.shuttingDown||model.fixtureMode)return;
 if(!model.settings.bridgeKey){setConnection("pairing","error",{code:"pairing_required"});scheduleReconnect();return}
 try{
  var ws=new WebSocket(WS_URL);model.socket=ws;setConnection("starting","unknown",model.providerStatus);
  ws.addEventListener("open",function(){if(ws!==model.socket)return;ws.send(JSON.stringify({type:"hello",protocol:PROTOCOL,key:model.settings.bridgeKey,client:"xeneon-edge"}))});
  ws.addEventListener("message",function(ev){if(ws===model.socket)handleMessage(ev.data)});
  ws.addEventListener("close",function(){if(ws!==model.socket)return;model.socket=null;if(model.connection!=="pairing"&&model.connection!=="mismatch")setConnection("offline","error",{code:"companion_offline"});scheduleReconnect()});
  ws.addEventListener("error",function(){try{ws.close()}catch(e){}})
 }catch(e){setConnection("offline","error",{code:"companion_offline"});scheduleReconnect()}
}

function staleSweep(){
 if(model.provider!=="live")return;
 var selected=selectedFingerprints().map(findSensor).filter(Boolean);
 if(selected.length&&selected.every(isStale)){model.provider="stale";document.body.setAttribute("data-provider","stale");render()}
}

function fixtureBoot(fixture){
 model.fixtureMode=true;model.connection="live";model.provider="live";model.providerStatus={code:"live"};
 handleSnapshot({type:"snapshot",pollTime:now(),status:{code:"live"},sensors:Array.isArray(fixture.sensors)?fixture.sensors:[]});
 var preset=fixture.selected||model.sensors.slice(0,currentSlot().limit).map(sensorFingerprint);model.persist.slots[model.slot]=preset.slice(0,currentSlot().limit);savePersist();
 if(fixture.histories){Object.keys(fixture.histories).forEach(function(k){model.histories[k]=fixture.histories[k]})}
 setConnection("live","live",{code:"live"})
}

function refresh(){
 readSettings();nearestSlot();render();
 if(!model.fixtureMode&&!model.socket)connect()
}

function boot(){
 if(model.booted)return;model.booted=true;loadPersist();nearestSlot();readSettings();
 byId("configureButton").addEventListener("click",function(){byId("configSheet").hidden=false;byId("configSheet").setAttribute("aria-hidden","false");renderPicker()});
 byId("closeConfig").addEventListener("click",function(){byId("configSheet").hidden=true;byId("configSheet").setAttribute("aria-hidden","true")});
 byId("sensorSearch").addEventListener("input",function(){model.search=this.value;renderPicker()});
 byId("presetRow").addEventListener("click",function(ev){var p=ev.target&&ev.target.getAttribute&&ev.target.getAttribute("data-preset");if(p)applyPreset(p)});
 byId("resetSession").addEventListener("click",function(){model.session=Object.create(null);model.histories=Object.create(null);render();toast("Dashboard session stats reset")});
 byId("closeThreshold").addEventListener("click",closeThreshold);byId("saveThreshold").addEventListener("click",saveThreshold);
 byId("openBridge").addEventListener("click",function(){if(!openExternal(SETUP_URL))openExternal(COMPANION_URL)});
 byId("openHwinfo").addEventListener("click",function(){openExternal(HWINFO_URL)});
 window.addEventListener("resize",function(){nearestSlot();render()});
 window.addEventListener("pagehide",shutdown,{once:true});
 model.staleTimer=setInterval(staleSweep,1000);
 var fixture=globalThis.__PACKRAT_HWINFO_FIXTURE__;if(fixture)fixtureBoot(fixture);else connect();
 var events;
 try{events=globalThis.icueEvents}catch(e){events=null}
 if(!events||typeof events!=="object")events={};
 var priorInit=events.onICUEInitialized,priorData=events.onDataUpdated;
 events.onICUEInitialized=function(){try{if(typeof priorInit==="function")priorInit()}catch(e){}refresh()};
 events.onDataUpdated=function(){try{if(typeof priorData==="function")priorData()}catch(e){}refresh()};
 globalThis.icueEvents=events;
}

function shutdown(){model.shuttingDown=true;if(model.reconnectTimer){clearTimeout(model.reconnectTimer);model.reconnectTimer=null}if(model.staleTimer){clearInterval(model.staleTimer);model.staleTimer=null}if(model.socket){try{model.socket.close()}catch(e){}model.socket=null}}

globalThis.__PACKRAT_HWINFO_TEST__={
 getState:function(){return JSON.parse(JSON.stringify({connection:model.connection,provider:model.provider,slot:model.slot,sensors:model.sensors,persist:model.persist,histories:model.histories,session:model.session}))},
 inject:function(snapshot){handleSnapshot(snapshot)},
 setSlot:function(slot){model.slot=slot;document.body.setAttribute("data-slot",slot);render()},
 fingerprint:sensorFingerprint,formatValue:formatValue,shutdown:shutdown
};

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot()
})();