import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

function inspectorFixture(source){
  const ids=['url','token','connection','one','three','graph','dial','hint','entityId','entity0','entity1','entity2','windowMs','dialStep','entityList','stats','saveStatus','save','connect','forget','refresh'];
  const elements=new Map(ids.map(id=>[id,{value:'',hidden:false,textContent:'',className:'',listeners:{},addEventListener(type,handler){this.listeners[type]=handler},matches(){return false},replaceChildren(){this.children=[]},append(item){(this.children??=[]).push(item)}}]));
  class WebSocketMock{static latest;constructor(){this.readyState=1;this.sent=[];WebSocketMock.latest=this}send(text){this.sent.push(JSON.parse(text))}receive(event,payload){this.onmessage?.({data:JSON.stringify({event,payload})})}}
  const document={getElementById:id=>elements.get(id),createElement:()=>({})};
  const window={};runInNewContext(source,{window,WebSocket:WebSocketMock,document,URL,console});
  window.connectElgatoStreamDeckSocket(1234,'ui-uuid','',{},JSON.stringify({context:'action-123',action:'com.packrat.home-assistant-streamdeck.status'}));
  const socket=WebSocketMock.latest;socket.onopen();
  return {elements,socket};
}

test('PI uses its own websocket context and keeps selected action context separate',async()=>{
  const {socket}=inspectorFixture(await readFile(new URL('../ui/inspector.js',import.meta.url),'utf8'));
  assert.equal(socket.sent[0].context,'ui-uuid');assert.equal(socket.sent[1].context,'ui-uuid');
  assert.equal(socket.sent[2].payload.actionContext,'action-123');
});

test('unsaved local entity selection survives stale host and plugin updates and saves exactly once',async()=>{
  const {socket,elements:e}=inspectorFixture(await readFile(new URL('../ui/inspector.js',import.meta.url),'utf8'));
  const previous={entityId:'sensor.old',entityIds:['','',''],windowMs:60000,dialStep:5};
  socket.receive('didReceiveSettings',{settings:previous});
  assert.equal(e.get('entityId').value,'sensor.old');
  e.get('entityId').value='sensor.new';e.get('entityId').listeners.input();
  socket.receive('didReceiveSettings',{settings:previous});
  socket.receive('sendToPropertyInspector',{type:'ha.state',actionContext:'action-123',connection:'LIVE',catalog:[],settings:previous});
  assert.equal(e.get('entityId').value,'sensor.new','stale state must not overwrite draft');
  e.get('save').onclick();
  assert.equal(e.get('saveStatus').textContent,'Saving…');
  socket.receive('didReceiveSettings',{settings:previous});
  assert.equal(e.get('entityId').value,'sensor.new');
  const writes=socket.sent.filter(v=>v.event==='setSettings');assert.equal(writes.length,1);assert.equal(writes[0].context,'ui-uuid');
  socket.receive('didReceiveSettings',{settings:writes[0].payload});
  assert.equal(e.get('saveStatus').textContent,'Saved');
});
