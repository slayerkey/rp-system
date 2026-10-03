import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,mkdir,rm,copyFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve,join,dirname} from "node:path";
import {spawnSync} from "node:child_process";
const repo=resolve(import.meta.dirname,"../../..");
const audit=resolve(repo,"tools/qa/streamdeck-key-visual-audit.mjs");
const owned=resolve(repo,"plugins/home-assistant-streamdeck/com.packrat.home-assistant-streamdeck.sdPlugin/imgs/actions/status");
test("shared key audit accepts one vendor 1x/@2x icon pair, rejects competing format",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"packrat-vendor-icon-"));const plugin=join(dir,"qa.sdPlugin");
 try{
  const icons=join(plugin,"imgs/actions/status");await mkdir(icons,{recursive:true});
  await copyFile(join(owned,"icon.png"),join(icons,"icon.png"));
  await copyFile(join(owned,"icon@2x.png"),join(icons,"icon@2x.png"));
  await writeFile(join(icons,"key.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#080A0E"/></svg>');
  await writeFile(join(plugin,"manifest.json"),JSON.stringify({UUID:"com.packrat.audit-fixture",Actions:[{UUID:"com.packrat.audit-fixture.status",Name:"Status",Icon:"imgs/actions/status/icon",Controllers:["Keypad"],States:[{Image:"imgs/actions/status/key",ShowTitle:false}]}],Profiles:[]}));
  const check=()=>spawnSync(process.execPath,[audit,plugin],{encoding:"utf8"});
  let pass=check();assert.equal(pass.status,0,pass.stdout+pass.stderr);
  await writeFile(join(icons,"icon.svg"),'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"></svg>');
  const fail=check();assert.notEqual(fail.status,0,fail.stdout);
  assert.match(fail.stdout+fail.stderr,/ambiguous/);
 }finally{await rm(dir,{recursive:true,force:true})}
});