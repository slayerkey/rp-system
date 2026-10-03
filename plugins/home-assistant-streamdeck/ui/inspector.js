(() => {'use strict';
const UUID='com.packrat.home-assistant-streamdeck.';
const $=id=>document.getElementById(id);const kinds=['status','graph','overview','control','trigger','brightness','neo-infobar'];
let socket=null,uiUuid='',actionContext='',kind='status',catalog=[],globals={},confirmed={},draft={},dirty=false,waiting=false,connected=false;
function send(event,payload={}){if(socket?.readyState===1)socket.send(JSON.stringify({event,context:uiUuid,payload}))}
function read(){
 const entityIds=[$('entity0').value,$('entity1').value,$('entity2').value].map(v=>v.trim());
 return {entityId:$('entityId').value.trim(),entityIds,windowMs:Number($('windowMs').value),dialStep:Number($('dialStep').value)};
}
function show(){
 const group=kind==='overview'||kind==='neo-infobar';$('one').hidden=group;$('three').hidden=!group;
 $('graph').hidden=kind!=='graph';$('dial').hidden=kind!=='brightness';
 const hints={status:'Shows the exact live value, including units.',graph:'Live numerical sensors show observed rolling history. Press a graph key to change its history window.',overview:'One key shows up to three actual Home Assistant entities.',control:'Light, switch or input_boolean only. Press to toggle if the server advertises the required service.',trigger:'Select a scene or script. Press to execute.',brightness:'Stream Deck + dial: select a dimmable light. Rotate to adjust; press to toggle.','neo-infobar':'Neo Infobar: display three live entities; place the Infobar action in the Neo Infobar slot.'};
 $('hint').textContent=hints[kind]||hints.status;
}
function apply(value){
 const d={entityId:'',entityIds:[],windowMs:60000,dialStep:5,...value};
 $('entityId').value=d.entityId;[0,1,2].forEach(i=>$('entity'+i).value=d.entityIds[i]||'');
 $('windowMs').value=d.windowMs;$('dialStep').value=d.dialStep;show();
}
function message(text,klass=''){$('connection').textContent=text;$('connection').className='state '+klass}
function catalogRender(){
 const list=$('entityList');list.replaceChildren();for(const entity of catalog){
  const option=document.createElement('option');option.value=entity.id;option.label=entity.name+' · '+entity.state;list.append(option);
 }
 $('stats').textContent=catalog.length?`${catalog.length} entities available. Select by exact entity ID; duplicate names remain distinct.`:'No live entity catalog yet.';
}
function validate(settings){
 const ids=(kind==='overview'||kind==='neo-infobar'?settings.entityIds:[settings.entityId]).filter(Boolean);
 if(!ids.length)return 'Select at least one entity.';
 if(kind==='trigger'&&!ids.every(id=>/^(scene|script)\./.test(id)))return 'Select a scene or script.';
 if(kind==='control'&&!ids.every(id=>/^(light|switch|input_boolean)\./.test(id)))return 'Choose a light or switch.';
 if(kind==='brightness'&&!ids.every(id=>/^light\./.test(id)))return 'Choose a light for the dial.';
 if(kind==='graph'&&!ids.every(id=>/^sensor\./.test(id)))return 'History requires a numerical sensor.';
 return '';
}
function setDirty(){dirty=true;$('saveStatus').textContent='Unsaved changes'}
function accept(settings){
 const expected=read();
 if(waiting){
  const keys=['entityId','entityIds','windowMs','dialStep'];
  if(keys.every(k=>JSON.stringify(expected[k])===JSON.stringify(settings[k]??(k==='entityIds'?[]:undefined)))){
   waiting=false;dirty=false;$('saveStatus').textContent='Saved';confirmed=settings;return;
  }
 }
 // A stale push must not erase edits or an outstanding save.
 if(dirty||waiting)return;
 confirmed=settings;apply(settings);
}
window.connectElgatoStreamDeckSocket=function(port,uuid,_event,info,actionInfo){
 uiUuid=uuid;let data={};try{data=JSON.parse(actionInfo)}catch{}actionContext=data.context||'';
 kind=kinds.find(k=>data.action===UUID+k)||'status';show();
 socket=new WebSocket('ws://127.0.0.1:'+port);
 socket.onopen=()=>{connected=true;send('getSettings');send('getGlobalSettings');send('sendToPlugin',{type:'ha.inspect',actionContext});};
 socket.onmessage=event=>{let msg;try{msg=JSON.parse(event.data)}catch{return}
  if(msg.event==='didReceiveSettings')accept(msg.payload?.settings||{});
  if(msg.event==='didReceiveGlobalSettings'){globals=msg.payload?.settings||{};if(!$('url').matches(':focus'))$('url').value=globals.homeAssistantUrl||'';}
  if(msg.event==='sendToPropertyInspector'&&msg.payload?.type==='ha.state'){
   const data=msg.payload;if(data.actionContext!==actionContext)return;
   catalog=Array.isArray(data.catalog)?data.catalog:[];catalogRender();
   message(data.connection==='LIVE'?`Connected · ${catalog.length} entities`:data.connection==='SETUP'?'Enter server URL and access token':data.connection==='AUTH_ERROR'?'Access token rejected':data.connection==='ERROR'?`Error: ${data.detail}`:data.connection==='RECONNECTING'?'Reconnecting…':'Connecting / unavailable',data.connection==='LIVE'?'live':data.connection==='AUTH_ERROR'||data.connection==='ERROR'?'error':'');
   accept(data.settings||{});
  }
 };
 socket.onclose=()=>{connected=false;message('Property Inspector disconnected','error')};
};
$('save').onclick=()=>{
 const payload=read(),error=validate(payload);if(error){$('saveStatus').textContent=error;return}
 waiting=true;dirty=true;$('saveStatus').textContent='Saving…';
 // Uses PI websocket UUID; selected key context is separate for plugin messages.
 send('setSettings',payload);
};
$('connect').onclick=()=>{
 const url=$('url').value.trim(),token=$('token').value.trim();
 try{const parsed=new URL(url);if(!/^https?:$/.test(parsed.protocol)||parsed.username||parsed.password)throw Error('HTTP(S) URL required')}catch{$('connection').textContent='Provide a valid HTTP(S) Home Assistant URL';return}
 if(!token&&!globals.homeAssistantToken){message('Paste a token first','error');return}
 send('setGlobalSettings',{...globals,homeAssistantUrl:url,homeAssistantToken:token||globals.homeAssistantToken});
 $('token').value='';message('Saving connection…');
};
$('forget').onclick=()=>{globals={homeAssistantUrl:'',homeAssistantToken:''};send('setGlobalSettings',globals);$('url').value='';$('token').value='';message('Credentials cleared');};
$('refresh').onclick=()=>send('sendToPlugin',{type:'ha.inspect',actionContext});
for(const id of ['entityId','entity0','entity1','entity2','windowMs','dialStep'])$(id).addEventListener('input',setDirty);
})();
