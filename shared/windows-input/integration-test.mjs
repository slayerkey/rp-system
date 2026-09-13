import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("SKIP: native integration harness requires Windows.");
  process.exit(0);
}

const here=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(here,"..","..");
const exe=resolve(repoRoot,"artifacts","input-host","PackRat.InputHost.exe");

async function exists(path){
  try { await access(path); return true; } catch { return false; }
}
function delay(ms){ return new Promise(resolvePromise=>setTimeout(resolvePromise,ms)); }
function withTimeout(promise,ms,label){
  let timer;
  return Promise.race([
    promise.finally(()=>clearTimeout(timer)),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Timeout: ${label}`)),ms);})
  ]);
}

class Host {
  constructor(args=[]){
    this.args=args;
    this.proc=null;
    this.pending=new Map();
    this.events=[];
    this.waiters=[];
    this.seq=0;
    this.stderr="";
  }

  async start(){
    const proc=spawn(exe,["--daemon",...this.args],{
      windowsHide:true,
      stdio:["pipe","pipe","pipe"]
    });
    this.proc=proc;
    const lines=createInterface({input:proc.stdout});
    lines.on("line",(line)=>{
      let msg;
      try { msg=JSON.parse(line); } catch { return; }
      if(msg.event){
        const waiterIndex=this.waiters.findIndex(w=>w.event===msg.event);
        if(waiterIndex>=0){
          const [waiter]=this.waiters.splice(waiterIndex,1);
          clearTimeout(waiter.timer);
          waiter.resolve(msg);
        }else{
          this.events.push(msg);
        }
        return;
      }
      const id=String(msg.id??"");
      const pending=this.pending.get(id);
      if(!pending) return;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      if(msg.ok===false) pending.reject(new Error(String(msg.error||"Input host command failed.")));
      else pending.resolve(msg);
    });
    proc.stderr.on("data",chunk=>{this.stderr+=String(chunk);});
    proc.on("exit",(code,signal)=>{
      for(const pending of this.pending.values()){
        clearTimeout(pending.timer);
        pending.reject(new Error(`Input host exited (${code??"?"}/${signal??"?"}). ${this.stderr}`));
      }
      this.pending.clear();
      for(const waiter of this.waiters){
        clearTimeout(waiter.timer);
        waiter.reject(new Error(`Input host exited before ${waiter.event}. ${this.stderr}`));
      }
      this.waiters=[];
    });
    await this.command("ping",{},5000);
    return this;
  }

  command(command,payload={},timeoutMs=5000){
    if(!this.proc?.stdin?.writable) return Promise.reject(new Error("Input host stdin unavailable."));
    const id=String(++this.seq);
    return new Promise((resolvePromise,rejectPromise)=>{
      const timer=setTimeout(()=>{
        this.pending.delete(id);
        rejectPromise(new Error(`Command timed out: ${command}`));
      },timeoutMs);
      this.pending.set(id,{resolve:resolvePromise,reject:rejectPromise,timer});
      this.proc.stdin.write(JSON.stringify({id,command,...payload})+"\n");
    });
  }

  event(name,timeoutMs=5000){
    const index=this.events.findIndex(e=>e.event===name);
    if(index>=0) return Promise.resolve(this.events.splice(index,1)[0]);
    return new Promise((resolvePromise,rejectPromise)=>{
      const waiter={event:name,resolve:resolvePromise,reject:rejectPromise,timer:null};
      waiter.timer=setTimeout(()=>{
        const i=this.waiters.indexOf(waiter);
        if(i>=0)this.waiters.splice(i,1);
        rejectPromise(new Error(`Event timed out: ${name}`));
      },timeoutMs);
      this.waiters.push(waiter);
    });
  }

  exit(timeoutMs=5000){
    if(!this.proc || this.proc.exitCode!==null) return Promise.resolve({code:this.proc?.exitCode??null,signal:this.proc?.signalCode??null});
    return withTimeout(new Promise(resolvePromise=>{
      this.proc.once("exit",(code,signal)=>resolvePromise({code,signal}));
    }),timeoutMs,"helper exit");
  }

  kill(){
    try { this.proc?.kill(); } catch {}
  }

  async close(){
    try { await this.command("stopPlayback",{},1000); } catch {}
    try { await this.command("cancelRecording",{},1000); } catch {}
    this.kill();
    try { await this.exit(2000); } catch {}
  }
}

async function makeState(label){
  return await mkdtemp(join(tmpdir(),`packrat-macro-${label}-`));
}
async function cleanup(...paths){
  for(const path of paths) if(path) await rm(path,{recursive:true,force:true}).catch(()=>{});
}
async function run(name,fn){
  try{
    await fn();
    console.log(`PASS native integration: ${name}`);
  }catch(error){
    console.error(`FAIL native integration: ${name}`);
    console.error(error?.stack||error);
    throw error;
  }
}

await run("recovery occurs before forced hook-start failure",async()=>{
  const state=await makeState("prehook");
  try{
    const journal=join(state,"held-input.json");
    await writeFile(journal,JSON.stringify({
      keys:[{vk:16,scan:42,extended:false}],
      buttons:[]
    }));

    const proc=spawn(exe,[
      "--daemon",
      "--packrat-test-state-dir",state,
      "--packrat-test-force-hook-failure"
    ],{windowsHide:true,stdio:["pipe","pipe","pipe"]});

    let stderr="";
    proc.stderr.on("data",chunk=>stderr+=String(chunk));
    const result=await withTimeout(new Promise(resolvePromise=>{
      proc.once("exit",(code,signal)=>resolvePromise({code,signal}));
    }),5000,"forced hook failure exit");

    assert.notEqual(result.code,0,"forced hook failure should terminate non-zero");
    assert.equal(await exists(journal),false,`stale journal should be recovered before hook failure. stderr=${stderr}`);
  }finally{
    await cleanup(state);
  }
});

await run("only one family input session can be active",async()=>{
  const state=await makeState("family-lock");
  const a=new Host(["--packrat-test-state-dir",state]);
  const b=new Host(["--packrat-test-state-dir",state]);
  try{
    await a.start();
    await b.start();
    await a.command("startRecording",{includeMouse:false,maxDurationMs:10000,maxEvents:100});

    await assert.rejects(
      ()=>b.command("startRecording",{includeMouse:false,maxDurationMs:10000,maxEvents:100}),
      /already has an active recording or playback session/i
    );

    await a.command("cancelRecording");
    await b.command("startRecording",{includeMouse:false,maxDurationMs:10000,maxEvents:100});
    await b.command("cancelRecording");
  }finally{
    await a.close();
    await b.close();
    await cleanup(state);
  }
});

await run("idle sibling helper leaves live journal untouched and next owner recovers it",async()=>{
  const state=await makeState("journal-owner");
  const a=new Host(["--packrat-test-state-dir",state]);
  let b;
  try{
    await a.start();
    await a.command("startRecording",{includeMouse:false,maxDurationMs:10000,maxEvents:100});

    const journal=join(state,"held-input.json");
    const sentinel=JSON.stringify({keys:[{vk:16,scan:42,extended:false}],buttons:[]});
    await writeFile(journal,sentinel);

    b=new Host(["--packrat-test-state-dir",state]);
    await b.start();
    assert.equal(await readFile(journal,"utf8"),sentinel,"sibling helper touched live journal without session ownership");

    a.kill();
    await a.exit(3000);

    await b.command("startRecording",{includeMouse:false,maxDurationMs:10000,maxEvents:100});
    assert.equal(await exists(journal),false,"new owner did not recover stale journal after crashed owner released lock");
    await b.command("cancelRecording");
  }finally{
    a.kill();
    if(b) await b.close();
    await cleanup(state);
  }
});

await run("journal write failure aborts before held-input injection",async()=>{
  const state=await makeState("journal-fail");
  const blocked=join(state,"blocked-parent");
  await writeFile(blocked,"not a directory");
  const recovery=join(blocked,"held-input.json");
  const host=new Host([
    "--packrat-test-state-dir",state,
    "--packrat-test-recovery-file",recovery
  ]);
  try{
    await host.start();
    const stopped=host.event("playbackStopped",5000);
    await host.command("play",{
      events:[{type:"keyDown",delayMs:0,vk:135,scan:0,extended:false}],
      speed:1,
      repeatCount:1,
      coordinateMode:"absolute"
    });
    const result=await stopped;
    assert.equal(result.reason,"error");
    assert.match(String(result.error||""),/blocked-parent|directory|path|file/i);
    assert.equal(await exists(recovery),false);
  }finally{
    await host.close();
    await cleanup(state);
  }
});

await run("SendInput release failure preserves recovery state until next helper recovers",async()=>{
  const state=await makeState("sendinput-fail");
  const journal=join(state,"held-input.json");
  const failing=new Host([
    "--packrat-test-state-dir",state,
    "--packrat-test-fail-sendinput-after","1"
  ]);
  let recoveryHost;
  try{
    await failing.start();
    const stopped=failing.event("playbackStopped",5000);
    await failing.command("play",{
      events:[
        {type:"keyDown",delayMs:0,vk:135,scan:0,extended:false},
        {type:"keyUp",delayMs:20,vk:135,scan:0,extended:false}
      ],
      speed:1,
      repeatCount:1,
      coordinateMode:"absolute"
    });
    const result=await stopped;
    assert.equal(result.reason,"error");
    assert.match(String(result.error||""),/forced SendInput failure/i);
    assert.equal(await exists(journal),true,"failed release should preserve held-input recovery journal");
    const saved=JSON.parse(await readFile(journal,"utf8"));
    assert.equal(saved.keys?.[0]?.vk,135);

    failing.kill();
    await failing.exit(3000);

    recoveryHost=new Host(["--packrat-test-state-dir",state]);
    await recoveryHost.start();
    assert.equal(await exists(journal),false,"next helper did not recover preserved held input");
  }finally{
    failing.kill();
    if(recoveryHost) await recoveryHost.close();
    await cleanup(state);
  }
});

await run("helper exits when configured parent process dies",async()=>{
  const state=await makeState("parent");
  const parent=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{
    windowsHide:true,
    stdio:"ignore"
  });
  const host=new Host([
    "--packrat-test-state-dir",state,
    "--parent-pid",String(parent.pid)
  ]);
  try{
    await host.start();
    parent.kill();
    const result=await host.exit(5000);
    assert.ok(result.code===0||result.signal,"helper did not exit after parent death");
  }finally{
    try { parent.kill(); } catch {}
    host.kill();
    await cleanup(state);
  }
});

console.log("PASS: all Macro Recorder Windows native integration tests.");
