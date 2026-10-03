import { PORT, PROTOCOL, observed } from "./state.js";
// One shared connection per Stream Deck plugin process. The existing XENEON
// widget remains another independent authenticated client of the same listener.
export class LightingCompanion {
 constructor({Socket=globalThis.WebSocket,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  this.Socket=Socket;this.setTimer=setTimer;this.clearTimer=clearTimer;
  this.token="";this.socket=null;this.snapshot=null;this.state="setup";this.detail="";
  this.watchers=new Set();this.reconnect=null;this.generation=0;
  this.queue=Promise.resolve();this.pending=null;this.disposed=false;
 }
 subscribe(fn){this.watchers.add(fn);return()=>this.watchers.delete(fn);}
 notify(){for(const cb of this.watchers)try{cb(this);}catch{}}
 configure(token) {
  const value=typeof token==="string"?token.trim():"";
  if(value===this.token&&!this.disposed)return;
  this.token=value;this.generation++;this.clearTimer(this.reconnect);this.reconnect=null;
  if(this.pending){this.pending.reject(new Error("Companion connection changed"));this.pending=null;}
  if(this.socket){const old=this.socket;this.socket=null;try{old.close();}catch{}}
  this.snapshot=null;this.state=value?"connecting":"setup";this.detail="";
  this.notify();
  if(value)this.connect();
 }
 connect() {
  if(this.disposed||!this.token||this.socket)return;
  const gen=++this.generation;
  this.state="connecting";this.notify();
  let ws;
  try{ws=new this.Socket("ws://127.0.0.1:"+PORT+"/widget");}
  catch(e){this.disconnect(gen,"offline",e?.message||"Companion unavailable");return;}
  this.socket=ws;
  let authorized=false;
  const handshake=this.setTimer(()=>{if(!authorized&&this.generation===gen){this.disconnect(gen,"offline","Companion handshake timed out");}},4500);
  handshake?.unref?.();
  ws.onopen=()=>{if(gen!==this.generation)return;ws.send(JSON.stringify({type:"hello",token:this.token}));};
  ws.onmessage=(e)=>{
   if(gen!==this.generation)return;
   let m;try{m=JSON.parse(typeof e.data==="string"?e.data:String(e.data));}catch{return;}
   if(m.type==="auth_error"){this.disconnect(gen,"unauthorized","Companion pairing token rejected");return;}
   if(m.type==="auth_ok"){
    if(Number(m.protocol)!==PROTOCOL){this.disconnect(gen,"incompatible","Companion protocol mismatch");return;}
    authorized=true;this.clearTimer(handshake);this.state="connected";this.detail="";this.notify();return;
   }
   if(!authorized)return;
   if(m.type==="snapshot"&&Number(m.protocol)===PROTOCOL){
    // Ignore older timestamps after reconnect or an out-of-order transport frame.
    if(this.snapshot?.updatedAt&&Date.parse(m.updatedAt)<Date.parse(this.snapshot.updatedAt))return;
    this.snapshot=m;this.state="connected";this.detail="";this.notify();
    if(this.pending?.command && observed(m,this.pending.command)){this.pending.resolve("observed");this.pending=null;}
    else if(this.pending?.command?.command==="scene"){this.pending.resolve("sent");this.pending=null;}
    return;
   }
   if(m.type==="error"&&this.pending){this.pending.reject(new Error(String(m.error||"Lighting command failed")));this.pending=null;return;}
  };
  ws.onerror=()=>{}; // close is authoritative; no credentials in logs
  ws.onclose=()=>{this.clearTimer(handshake);this.disconnect(gen,"offline","Start or restart PackRat Lighting Companion");};
 }
 disconnect(gen,status,detail) {
  if(this.generation!==gen||this.disposed)return;
  this.generation++;this.state=status;this.detail=detail;
  const s=this.socket;this.socket=null;this.snapshot=null;
  if(this.pending){this.pending.reject(new Error(detail));this.pending=null;}
  if(s)try{s.close();}catch{}
  this.notify();
  // Authentication/protocol errors require a deliberate fix, not endless retries.
  if(this.token&&status==="offline"){
   this.reconnect=this.setTimer(()=>{this.reconnect=null;this.connect();},4000);
   this.reconnect?.unref?.();
  }
 }
 async send(command) {
  const task=()=>this.sendOne(command);
  const next=this.queue.then(task,task);
  this.queue=next.catch(()=>{});
  return next;
 }
 async sendOne(command){
  if(this.state!=="connected"||this.socket?.readyState!==1)throw new Error("Lighting Companion is offline");
  if(this.pending)throw new Error("Lighting command already pending");
  // v1 companion broadcasts a snapshot after each command and sends error on failure.
  // Do not call an unobserved command successful.
  return new Promise((resolve,reject)=>{
   const timer=this.setTimer(()=>{
     if(this.pending?.command===command){
       this.pending=null;
       reject(new Error(command.command==="scene"?"Scene sent; confirmation unavailable":"Command not confirmed by current lighting state"));
     }
   },4000);
   timer?.unref?.();
   this.pending={command,
    resolve:(v)=>{this.clearTimer(timer);resolve(v);},
    reject:(e)=>{this.clearTimer(timer);reject(e);}
   };
   try{this.socket.send(JSON.stringify(command));}
   catch(e){const p=this.pending;this.pending=null;p.reject(e);}
  });
 }
 close(){
  this.disposed=true;this.generation++;this.clearTimer(this.reconnect);
  if(this.pending){this.pending.reject(new Error("Plugin stopping"));this.pending=null;}
  this.socket?.close();this.socket=null;this.watchers.clear();
 }
}
