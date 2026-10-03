import test from 'node:test';import assert from 'node:assert/strict';
import {HAClient,wsAddress} from '../src/ha-client.js';import {numeric,BoundedHistory} from '../src/history.js';
function rig(){
 const sockets=[];let now=1_000_000,scheduled=[];
 class FakeSocket{
  static OPEN=1;constructor(url){this.url=url;this.sent=[];this.readyState=1;this.closed=false;sockets.push(this)}
  send(s){this.sent.push(JSON.parse(s))}close(){this.closed=true;this.readyState=3}
  receive(m){this.onmessage?.({data:JSON.stringify(m)})}lose(){this.readyState=3;this.onclose?.()}
 }
 const timers={setTimer:(fn)=>{const job={fn,active:true,unref(){}};scheduled.push(job);return job},clearTimer:job=>{if(job)job.active=false}};
 const client=new HAClient({WebSocketImpl:FakeSocket,clock:()=>now,...timers});
 const connect=()=>{client.configure('http://local:8123','secret');const s=sockets.at(-1);s.receive({type:'auth_required'});s.receive({type:'auth_ok'});return s};
 const finish=(s,entities=[],services={light:{turn_on:{},turn_off:{}},scene:{turn_on:{}}})=>{
  const sub=s.sent.find(m=>m.type==='subscribe_events'),snap=s.sent.find(m=>m.type==='get_states'),svc=s.sent.find(m=>m.type==='get_services');
  s.receive({type:'result',id:sub.id,success:true});s.receive({type:'result',id:snap.id,success:true,result:entities});s.receive({type:'result',id:svc.id,success:true,result:services});
 };
 return {client,sockets,connect,finish,timers,advance:n=>{now+=n},runTimers:()=>{const batch=scheduled;scheduled=[];for(const job of batch)if(job.active)job.fn()}};
}
const temp=(state='0',ts='2026-10-01T00:00:00Z')=>({entity_id:'sensor.office_temperature',state,attributes:{friendly_name:'Office Temperature',unit_of_measurement:'°C'},last_updated:ts});
const light=(state='on',ts='2026-10-01T00:00:00Z')=>({entity_id:'light.office',state,attributes:{friendly_name:'Office',brightness:128,supported_color_modes:['brightness']},last_updated:ts});
test('URL validates scheme credentials and strips trailing slash',()=>{assert.equal(wsAddress('https://ha.local:8123/'),'wss://ha.local:8123/api/websocket');assert.throws(()=>wsAddress('file:///tmp'));assert.throws(()=>wsAddress('http://bob:password@ha.local'))});
test('missing settings do not open connection',()=>{const r=rig();r.client.configure('', '');assert.equal(r.sockets.length,0)});
test('single socket authenticates and sends one snapshot, one service request, one subscription',()=>{const r=rig(),s=r.connect();assert.deepEqual(s.sent.map(x=>x.type),['auth','subscribe_events','get_states','get_services']);assert.equal(s.sent[0].access_token,'secret');r.finish(s,[temp('0'),light()]);assert.equal(r.client.state,'LIVE');assert.equal(r.client.liveNumeric('sensor.office_temperature'),0);assert.equal(r.client.catalog().length,2)});
test('initial snapshot seeds genuine observed numeric history including true zero',()=>{const r=rig(),s=r.connect();r.finish(s,[temp('0')]);assert.equal(r.client.history.get('sensor.office_temperature').raw[0][1],0);assert.equal(r.client.history.get('sensor.office_temperature').raw.length,1)});
test('null empty unknown unavailable never become a fabricated zero',()=>{for(const x of [null,undefined,'',false,'unknown','unavailable'])assert.equal(numeric(x),null);const r=rig(),s=r.connect();r.finish(s,[temp('unavailable')]);assert.equal(r.client.liveNumeric('sensor.office_temperature'),null);assert.equal(r.client.history.size,0)});
test('live state_changed pushes observed values and not duplicate events',()=>{
 const r=rig(),s=r.connect();r.finish(s,[temp('20')]);r.advance(100);
 const ev={type:'event',id:s.sent[1].id,event:{data:{entity_id:'sensor.office_temperature',new_state:temp('21','2026-10-02T00:00:00Z')}}};
 s.receive(ev);s.receive(ev);assert.equal(r.client.liveNumeric('sensor.office_temperature'),21);assert.deepEqual(r.client.history.get('sensor.office_temperature').raw.map(x=>x[1]),[20,21]);
});
test('older event cannot roll back newer state',()=>{const r=rig(),s=r.connect();r.finish(s,[temp('25','2026-10-02T00:00:00Z')]);s.receive({type:'event',id:s.sent[1].id,event:{data:{entity_id:'sensor.office_temperature',new_state:temp('5','2026-10-01T00:00:00Z')}}});assert.equal(r.client.liveNumeric('sensor.office_temperature'),25)});
test('event during initial snapshot wins when newer',()=>{
 const r=rig(),s=r.connect();const sub=s.sent[1].id,snap=s.sent[2].id;
 s.receive({type:'result',id:sub,success:true});s.receive({type:'event',id:sub,event:{data:{entity_id:'sensor.office_temperature',new_state:temp('31','2026-10-02T00:00:00Z')}}});
 s.receive({type:'result',id:snap,success:true,result:[temp('20','2026-10-01T00:00:00Z')]});assert.equal(r.client.liveNumeric('sensor.office_temperature'),31);
});
test('auth errors stop retries without exposing token',()=>{const r=rig(),s=r.connect();s.receive({type:'auth_invalid',message:'bad'});assert.equal(r.client.state,'AUTH_ERROR');s.lose();r.runTimers();assert.equal(r.sockets.length,1);assert(!JSON.stringify({state:r.client.state,detail:r.client.detail}).includes('secret'))});
test('socket loss immediately invalidates stale values and reconnects once',()=>{const r=rig(),s=r.connect();r.finish(s,[temp('3')]);s.lose();assert.equal(r.client.liveNumeric('sensor.office_temperature'),null);r.runTimers();assert.equal(r.sockets.length,2);assert.equal(r.client.state,'RECONNECTING')});
test('changing credentials invalidates old websocket events',()=>{const r=rig(),old=r.connect();r.finish(old,[temp('1')]);r.client.configure('https://new.local','newsecret');old.receive({type:'event',id:old.sent[1].id,event:{data:{entity_id:'sensor.office_temperature',new_state:temp('99')}}});assert.equal(r.client.liveNumeric('sensor.office_temperature'),null);assert.equal(r.sockets.at(-1).url,'wss://new.local/api/websocket')});
test('service whitelist availability and successful acknowledgement',async()=>{
 const r=rig(),s=r.connect();r.finish(s,[light()]);assert.equal(r.client.serviceAvailable('light','turn_on'),true);const p=r.client.call('light','turn_on','light.office',{brightness_pct:70});const req=s.sent.at(-1);assert.deepEqual(req.target,{entity_id:'light.office'});assert.equal(req.service_data.brightness_pct,70);s.receive({type:'result',id:req.id,success:true,result:{}});await p;
});
test('missing services, unsupported domain and missing entity reject before network calls',async()=>{const r=rig(),s=r.connect();r.finish(s,[light()],{light:{turn_on:{}}});const before=s.sent.length;await assert.rejects(()=>r.client.call('switch','toggle','light.office'));await assert.rejects(()=>r.client.call('light','turn_off','light.office'));await assert.rejects(()=>r.client.call('light','turn_on','light.not_found'));assert.equal(s.sent.length,before)});
test('failed service operation rejects and stays unchanged until server state event',async()=>{const r=rig(),s=r.connect();r.finish(s,[light()]);const p=r.client.call('light','turn_on','light.office');s.receive({type:'result',id:s.sent.at(-1).id,success:false,error:{message:'Denied'}});await assert.rejects(p,/Denied/);assert.equal(r.client.entity('light.office').state,'on')});
test('entity removals prune state and history',()=>{const r=rig(),s=r.connect();r.finish(s,[temp('3')]);s.receive({type:'event',id:s.sent[1].id,event:{data:{entity_id:'sensor.office_temperature',new_state:null}}});assert.equal(r.client.entity('sensor.office_temperature'),null);assert.equal(r.client.history.size,0)});
test('bounded history rejects duplicate timestamps and retains a bounded archive',()=>{const b=new BoundedHistory(3,2,1000);for(let i=0;i<8;i++)b.push(i*1000,i);assert.equal(b.raw.length,3);assert.equal(b.archive.length,2);assert.equal(b.push(7000,8),false);assert.equal(b.series(7000,8000).at(-1)[1],7)});
test('disconnect clears listeners pending socket timers and state',()=>{const r=rig(),s=r.connect();r.finish(s,[temp('3')]);r.client.disconnect();assert.equal(s.closed,true);assert.equal(r.client.history.size,0);assert.equal(r.client.entities.size,0)});
test('a late old-socket event cannot resurrect an entity during reconnect',()=>{
 const r=rig(),s=r.connect();r.finish(s,[temp('15')]);s.lose();
 assert.equal(r.client.entity('sensor.office_temperature'),null);
 s.receive({type:'event',id:s.sent[1].id,event:{data:{entity_id:'sensor.office_temperature',new_state:temp('99','2026-10-04T00:00:00Z')}}});
 r.runTimers();const newSocket=r.sockets.at(-1);newSocket.receive({type:'auth_required'});newSocket.receive({type:'auth_ok'});r.finish(newSocket,[temp('17','2026-10-03T00:00:00Z')]);
 assert.equal(r.client.liveNumeric('sensor.office_temperature'),17);
});
test('late get_services response refreshes control keys after initial state snapshot',()=>{
 const r=rig(),s=r.connect();let updates=0;r.client.on('update',()=>updates++);
 const sub=s.sent[1].id,snap=s.sent[2].id,svc=s.sent[3].id;
 s.receive({type:'result',id:sub,success:true});s.receive({type:'result',id:snap,success:true,result:[light()]});
 assert.equal(r.client.serviceAvailable('light','turn_on'),false);
 const before=updates;s.receive({type:'result',id:svc,success:true,result:{light:{turn_on:{}}}});
 assert(updates>before);assert.equal(r.client.serviceAvailable('light','turn_on'),true);
});
