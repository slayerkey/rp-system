import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TextExpanderLibrary } from "../src/library.mjs";
import { PRO_SEEDS } from "../src/core.mjs";

async function temp(){return fs.mkdtemp(path.join(os.tmpdir(),"packrat-text-expander-"))}

test("Lite seeds only Email and Clipboard by default and enforces a 10 snippet cap",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"lite",rootDir:root});
  const seeded=await lib.load();
  assert.equal(seeded.schemaVersion,3);
  assert.deepEqual(seeded.snippets.map(s=>s.id),["lite-email","lite-clipboard"]);
  assert.equal(seeded.snippets[0].content,"REPLACE WITH YOUR EMAIL");
  assert.equal(seeded.snippets[1].content,"{clipboard}");
  const ten={...seeded,snippets:[...seeded.snippets]};
  while(ten.snippets.length<10)ten.snippets.push({id:"extra-"+ten.snippets.length,name:"Extra",folder:"STARTER",content:"x"});
  await lib.replace(ten);
  await assert.rejects(()=>lib.replace({...ten,snippets:[...ten.snippets,{id:"too-many",name:"No",folder:"STARTER",content:"x"}]}),/limit is 10/);
});

test("untouched legacy Lite defaults migrate to the simpler Email and Clipboard starter set",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"lite",rootDir:root});
  await fs.mkdir(root,{recursive:true});
  await fs.writeFile(lib.libraryPath,JSON.stringify({
    schemaVersion:1,
    snippets:[
      {id:"lite-email",name:"EMAIL",folder:"STARTER",content:"Hi there,\n\nThanks for your message.\n\nBest,\nREPLACE ME"},
      {id:"lite-date",name:"DATE",folder:"STARTER",content:"{date}"},
      {id:"lite-time",name:"TIME",folder:"STARTER",content:"{time}"},
      {id:"lite-clipboard",name:"CLIPBOARD",folder:"STARTER",content:"{clipboard}"},
      {id:"lite-address",name:"ADDRESS",folder:"STARTER",content:"REPLACE WITH YOUR ADDRESS"},
      {id:"lite-link",name:"LINK",folder:"STARTER",content:"REPLACE WITH YOUR LINK"}
    ],
    variables:{}
  },null,2),"utf8");
  const migrated=await lib.load();
  assert.equal(migrated.schemaVersion,3);
  assert.deepEqual(migrated.snippets.map(s=>s.id),["lite-email","lite-clipboard"]);
});

test("customized legacy Lite libraries preserve edits while restoring missing starter snippets",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"lite",rootDir:root});
  await fs.mkdir(root,{recursive:true});
  await fs.writeFile(lib.libraryPath,JSON.stringify({
    schemaVersion:1,
    snippets:[
      {id:"lite-email",name:"My Email",folder:"STARTER",content:"me@example.com"},
      {id:"custom-note",name:"Note",folder:"STARTER",content:"custom"}
    ],
    variables:{}
  },null,2),"utf8");
  const migrated=await lib.load();
  assert.equal(migrated.schemaVersion,3);
  assert.deepEqual(migrated.snippets.map(s=>s.id),["lite-email","lite-clipboard","custom-note"]);
  assert.equal(migrated.snippets[0].content,"me@example.com");
});

test("Pro defaults include the complete built-in starter library",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"pro",rootDir:root});
  const value=await lib.load();
  assert.equal(value.schemaVersion,3);
  assert.deepEqual(value.snippets.map(s=>s.id),PRO_SEEDS.map(s=>s.id));
  assert.deepEqual(value.snippets.slice(0,6).map(s=>s.id),[
    "pro-quick-email","pro-quick-clipboard","pro-quick-time","pro-quick-date","pro-quick-address","pro-quick-link"
  ]);
  value.variables.signature="Local only";
  value.snippets[0].folder="MY QUICK";
  await lib.replace(value);
  const reread=await lib.load();
  assert.equal(reread.variables.signature,"Local only");
  assert.equal(reread.snippets[0].folder,"MY QUICK");
});

test("schema v2 Pro libraries restore all missing built-ins without deleting edits or custom snippets",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"pro",rootDir:root});
  await fs.mkdir(root,{recursive:true});
  await fs.writeFile(lib.libraryPath,JSON.stringify({
    schemaVersion:2,
    snippets:[
      {id:"pro-quick-email",name:"My Work Email",folder:"QUICK",content:"me@example.com"},
      {id:"custom-local",name:"Local Custom",folder:"MY STUFF",content:"kept"}
    ],
    variables:{signature:"Custom signature"}
  },null,2),"utf8");
  const migrated=await lib.load();
  assert.equal(migrated.schemaVersion,3);
  assert.deepEqual(migrated.snippets.slice(0,PRO_SEEDS.length).map(s=>s.id),PRO_SEEDS.map(s=>s.id));
  assert.equal(migrated.snippets.find(s=>s.id==="pro-quick-email").content,"me@example.com");
  assert.equal(migrated.snippets.find(s=>s.id==="custom-local").content,"kept");
  assert.equal(migrated.variables.signature,"Custom signature");
});

test("Pro migration never exceeds the 5,000 snippet cap",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"pro",rootDir:root});
  await fs.mkdir(root,{recursive:true});
  const snippets=Array.from({length:5000},(_,i)=>({id:"old-"+i,name:"Old "+i,folder:"LEGACY",content:"x"}));
  await fs.writeFile(lib.libraryPath,JSON.stringify({schemaVersion:2,snippets,variables:{}},null,2),"utf8");
  const migrated=await lib.load();
  assert.equal(migrated.schemaVersion,3);
  assert.equal(migrated.snippets.length,5000);
  assert.equal(migrated.snippets[0].id,"old-0");
});

test("Corrupt library recovers from backup or defaults instead of crashing",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"lite",rootDir:root});
  const value=await lib.load();value.snippets[0].content="backup-value";await lib.replace(value);
  await fs.writeFile(lib.libraryPath,"{ broken","utf8");
  const recovered=await lib.load();assert.equal(recovered.snippets[0].content,"REPLACE WITH YOUR EMAIL");
  const names=await fs.readdir(root);assert.ok(names.some(n=>n.startsWith("library.corrupt-")));
});

test("Counters serialize rapid repeated insertion and commit only after successful insertion",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"pro",rootDir:root});
  const results=await Promise.all(Array.from({length:20},()=>lib.withNextCounters(["ticket"],async v=>v.ticket)));
  assert.deepEqual(results,Array.from({length:20},(_,i)=>i+1));
  await assert.rejects(()=>lib.withNextCounters(["ticket"],async()=>{throw new Error("cancelled")}));
  const next=await lib.withNextCounters(["ticket"],async v=>v.ticket);assert.equal(next,21);
});

test("Pro reusable variables cannot shadow built-in variables",async()=>{
  const root=await temp(),lib=new TextExpanderLibrary({edition:"pro",rootDir:root});
  const value=await lib.load();value.variables.date="not allowed";
  await assert.rejects(()=>lib.replace(value),/Invalid reusable variable: date/);
});
