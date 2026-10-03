// Shared native Home Assistant WebSocket transport. Derived from PackRat XENEON recovery protocol.
import { EventEmitter } from 'node:events';
import { BoundedHistory, numeric } from './history.js';
const BLOCKED = new Set(['unknown','unavailable','none']);
export const HA_STATES = Object.freeze({SETUP:'SETUP',CONNECTING:'CONNECTING',LIVE:'LIVE',RECONNECTING:'RECONNECTING',OFFLINE:'OFFLINE',AUTH_ERROR:'AUTH_ERROR',ERROR:'ERROR'});
export function wsAddress(input){
  const url=new URL(String(input||'').trim());
  if(!['http:','https:','ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Use a clean HTTP(S) Home Assistant URL');
  url.protocol=url.protocol==='https:'||url.protocol==='wss:'?'wss:':'ws:';
  url.pathname=url.pathname.replace(/\/+$/,'')+'/api/websocket';
  return url.toString();
}
function cleanError(error){return String(error?.message||error||'Connection failed').replace(/Bearer\s+\S+/gi,'Bearer [hidden]').slice(0,140)}
export class HAClient extends EventEmitter {
  constructor({WebSocketImpl=globalThis.WebSocket,clock=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
    super();this.WebSocketImpl=WebSocketImpl;this.clock=clock;this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.socket=null;this.url='';this.token='';this.generation=0;this.nextId=1;this.pending=new Map();this.entities=new Map();this.history=new Map();this.services={};this.versions=new Map();this.subscriptionAccepted=false;this.state=HA_STATES.SETUP;this.retry=0;this.retryTimer=null;this.snapshotId=null;this.subscriptionId=null;this.servicesId=null;
  }
  status(state,detail=''){this.state=state;this.detail=detail;this.emit('status',{state,detail});this.emit('update')}
  configure(url,token){
    const changed=this.url!==url||this.token!==token; if(!changed)return;
    this.disconnect();this.url=String(url||'').trim();this.token=String(token||'').trim();
    if(!this.url||!this.token){this.status(HA_STATES.SETUP);return}this.connect();
  }
  disconnect(){
    this.generation++;if(this.retryTimer){this.clearTimer(this.retryTimer);this.retryTimer=null}
    for(const item of this.pending.values())item.reject(new Error('Connection closed'));this.pending.clear();
    if(this.socket){const socket=this.socket;this.socket=null;socket.onmessage=socket.onerror=socket.onclose=socket.onopen=null;try{socket.close()}catch{}}
    this.entities.clear();this.history.clear();this.versions.clear();this.subscriptionAccepted=false;this.services={};this.snapshotId=null;this.subscriptionId=null;this.servicesId=null;
  }
  connect(){
    if(!this.url||!this.token){this.status(HA_STATES.SETUP);return}
    let address;try{address=wsAddress(this.url)}catch(error){this.status(HA_STATES.ERROR,cleanError(error));return}
    const generation=++this.generation;this.status(this.retry?HA_STATES.RECONNECTING:HA_STATES.CONNECTING);
    let socket;try{socket=new this.WebSocketImpl(address)}catch(error){this.lost(generation,error);return}
    this.socket=socket;
    socket.onmessage=ev=>{if(generation!==this.generation)return;let message;try{message=JSON.parse(String(ev.data))}catch{return}this.receive(message,generation)};
    socket.onerror=()=>{if(generation===this.generation)this.status(HA_STATES.OFFLINE,'Connection failed')};
    socket.onclose=()=>this.lost(generation,new Error('Disconnected'));
  }
  lost(generation,error){
    if(generation!==this.generation||this.state===HA_STATES.AUTH_ERROR)return;
    if(this.socket){this.socket.onmessage=this.socket.onerror=this.socket.onclose=this.socket.onopen=null}
    this.socket=null;for(const item of this.pending.values())item.reject(new Error('Disconnected'));this.pending.clear();this.snapshotId=null;this.subscriptionId=null;this.servicesId=null;
    this.entities.clear();this.services={};this.status(HA_STATES.RECONNECTING,cleanError(error));
    const reconnectGeneration=++this.generation;
    const delay=Math.min(30_000,1000*2**Math.min(5,this.retry++));this.retryTimer=this.setTimer(()=>{this.retryTimer=null;if(reconnectGeneration===this.generation)this.connect()},delay);this.retryTimer?.unref?.();
  }
  send(type,options={}){
    if(!this.socket||this.socket.readyState!==1)throw new Error('Home Assistant offline');
    const id=this.nextId++;this.socket.send(JSON.stringify({id,type,...options}));return id;
  }
  request(type,options={},timeout=10_000){
    const id=this.send(type,options);
    return new Promise((resolve,reject)=>{
      const timer=this.setTimer(()=>{this.pending.delete(id);reject(new Error('Home Assistant request timed out'))},timeout);timer?.unref?.();
      this.pending.set(id,{resolve:value=>{this.clearTimer(timer);resolve(value)},reject:error=>{this.clearTimer(timer);reject(error)}});
    });
  }
  receive(message,generation){
    if(message.type==='auth_required'){
      this.socket?.send(JSON.stringify({type:'auth',access_token:this.token}));return;
    }
    if(message.type==='auth_invalid'){
      this.disconnect();this.status(HA_STATES.AUTH_ERROR,'Token rejected');return;
    }
    if(message.type==='auth_ok'){
      this.retry=0;
      // Subscribe before snapshot; state updates arriving during snapshot are replayed in arrival order.
      this.subscriptionId=this.send('subscribe_events',{event_type:'state_changed'});
      this.snapshotId=this.send('get_states');
      this.servicesId=this.send('get_services');return;
    }
    if(message.type==='result'){
      if(message.id===this.subscriptionId){this.subscriptionAccepted=!!message.success;if(!message.success)this.status(HA_STATES.ERROR,'State subscription denied');return}
      if(message.id===this.snapshotId){
        if(!message.success||!Array.isArray(message.result)){this.status(HA_STATES.ERROR,'Entity discovery denied');return}
        const next=new Map();for(const e of message.result)if(e?.entity_id)next.set(String(e.entity_id),e);
        // Snapshot is authoritative for entity removal; do not restore stale offline readings.
        if(!this.subscriptionAccepted){this.status(HA_STATES.ERROR,'State subscription unconfirmed');return}
        // Merge only events newer than the snapshot: snapshot may race with live events.
        for(const [id,event] of this.entities){const prior=next.get(id);if(!prior || Date.parse(event.last_updated||0)>Date.parse(prior.last_updated||0))next.set(id,event)}
        this.entities=next;this.status(HA_STATES.LIVE);
        for(const [id,entity] of this.entities)this.observe(id,entity,true);
        this.emit('catalog',this.catalog());return;
      }
      if(message.id===this.servicesId){this.services=message.success&&message.result&&typeof message.result==='object'?message.result:{};this.emit('catalog',this.catalog());this.emit('update');return}
      const request=this.pending.get(message.id);if(request){this.pending.delete(message.id);message.success?request.resolve(message.result):request.reject(new Error(cleanError(message.error?.message||'Home Assistant rejected operation')))}
      return;
    }
    if(message.type==='event'&&message.id===this.subscriptionId){
      const data=message.event?.data;if(!data?.entity_id)return;
      const id=String(data.entity_id),prior=this.entities.get(id),incoming=data.new_state;
      if(incoming&&prior&&Date.parse(incoming.last_updated||0)<Date.parse(prior.last_updated||0))return;
      if(incoming)this.entities.set(id,incoming);else{this.entities.delete(id);this.history.delete(id);this.versions.delete(id)}
      this.observe(id,incoming);this.emit('update');this.emit('catalog',this.catalog());
    }
  }
  observe(id,entity,initial=false){
    if(!entity||this.state!==HA_STATES.LIVE||!id.startsWith('sensor.'))return;
    if(BLOCKED.has(String(entity.state).toLowerCase()))return;
    const value=numeric(entity.state);if(value===null)return;
    const version=String(entity.last_updated||'')+'|'+String(entity.state);
    if(this.versions.get(id)===version)return;this.versions.set(id,version);
    if(!this.history.has(id))this.history.set(id,new BoundedHistory());
    const at=this.clock(); // Receipt time: genuinely observed live samples, never inferred historical samples.
    this.history.get(id).push(at,value);
  }
  catalog(){return [...this.entities.values()].map(e=>({id:e.entity_id,name:String(e.attributes?.friendly_name||e.entity_id),state:String(e.state||''),unit:String(e.attributes?.unit_of_measurement||'')})).sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id))}
  entity(id){return this.state===HA_STATES.LIVE?this.entities.get(id)||null:null}
  liveNumeric(id){const entity=this.entity(id);return entity&&!BLOCKED.has(String(entity.state).toLowerCase())?numeric(entity.state):null}
  serviceAvailable(domain,name){return Boolean(this.state===HA_STATES.LIVE&&this.services?.[domain]?.[name])}
  async call(domain,service,id,options={}){
    if(!id||!this.entity(id))throw new Error('Selected entity not found');
    if(id.split('.')[0]!==domain)throw new Error('Service does not match entity domain');
    if(!this.serviceAvailable(domain,service))throw new Error('Service unavailable or unauthorized');
    return this.request('call_service',{domain,service,service_data:options,target:{entity_id:id}});
  }
  close(){this.disconnect();this.status(HA_STATES.SETUP)}
}
