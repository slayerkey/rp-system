import test from "node:test";import assert from "node:assert/strict";
import {LightingCompanion} from "../src/companion.js";
class Socket{
 static instances=[];static OPEN=1;
 constructor(url){this.url=url;this.readyState=0;this.sent=[];Socket.instances.push(this);}
 open(){this.readyState=1;this.onopen?.();}
 send(x){this.sent.push(JSON.parse(x));}
 emit(x){this.onmessage?.({data:JSON.stringify(x)});}
 close(){this.readyState=3;this.onclose?.();}
}
const wait=()=>new Promise(resolve=>setTimeout(resolve,0));
const base={type:"snapshot",protocol:1,updatedAt:"2026-10-02T00:00:01Z",providers:{hue:{connected:true},govee:{connected:true}},targets:[{id:"hue:one",on:false},{id:"govee:one",on:false}]};
function connected(){
 Socket.instances.length=0;
 const c=new LightingCompanion({Socket});
 c.configure("private-token");
 const ws=Socket.instances.at(-1);ws.open();ws.emit({type:"auth_ok",protocol:1});ws.emit(base);
 return {c,ws};
}
test("local WS and exact token; no provider credentials stored",()=>{const {c,ws}=connected();assert.equal(ws.url,"ws://127.0.0.1:17486/widget");assert.deepEqual(ws.sent[0],{type:"hello",token:"private-token"});assert.equal(c.state,"connected");assert.equal(JSON.stringify(c).includes("HueBridgeAppKey"),false);c.close();});
test("bad token fails closed, no snapshot",()=>{const {c,ws}=connected();ws.emit({type:"auth_error"});assert.equal(c.state,"unauthorized");assert.equal(c.snapshot,null);c.close();});
test("wrong protocol fails closed",()=>{Socket.instances.length=0;const c=new LightingCompanion({Socket});c.configure("token");const w=Socket.instances[0];w.open();w.emit({type:"auth_ok",protocol:999});assert.equal(c.state,"incompatible");c.close();});
test("no token never attempts socket",()=>{Socket.instances.length=0;const c=new LightingCompanion({Socket});c.configure("");assert.equal(Socket.instances.length,0);c.close();});
test("power waits for observed state, not just socket send",async()=>{const {c,ws}=connected();const p=c.send({command:"power",id:"hue:one",value:true});await wait();assert.equal(ws.sent[1].command,"power");ws.emit({...base,updatedAt:"2026-10-02T00:00:02Z",targets:[{id:"hue:one",on:true}]});assert.equal(await p,"observed");c.close();});
test("provider error rejects, next command can run",async()=>{const {c,ws}=connected();const p=c.send({command:"power",id:"hue:one",value:true});await wait();ws.emit({type:"error",error:"provider unavailable"});await assert.rejects(p,/provider unavailable/);c.close();});
test("stale snapshot cannot resolve a new command",async()=>{const {c,ws}=connected();const p=c.send({command:"power",id:"hue:one",value:true});await wait();ws.emit({...base,updatedAt:"2026-10-01T23:00:00Z",targets:[{id:"hue:one",on:true}]});assert.ok(c.pending);ws.emit({...base,updatedAt:"2026-10-02T00:00:03Z",targets:[{id:"hue:one",on:true}]});assert.equal(await p,"observed");c.close();});
test("companion restart clears stale live state",()=>{const {c,ws}=connected();ws.close();assert.equal(c.snapshot,null);assert.equal(c.state,"offline");c.close();});
test("two simultaneous clients do not share socket or token",()=>{const a=connected();const b=new LightingCompanion({Socket});b.configure("other-token");assert.notEqual(a.ws,Socket.instances.at(-1));assert.equal(a.c.state,"connected");a.c.close();b.close();});
