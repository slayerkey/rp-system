#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot=resolve(".");
const designAudit=join(repoRoot,"tools","qa","streamdeck-plugin-design-audit.mjs");
const keyAudit=join(repoRoot,"tools","qa","streamdeck-key-visual-audit.mjs");

function run(script,args){
  return spawnSync(process.execPath,[script,...args],{encoding:"utf8",cwd:repoRoot});
}
function write(path,body=""){
  mkdirSync(resolve(path,".."),{recursive:true});
  writeFileSync(path,body);
}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),"packrat-streamdeck-audit-"));
  const plugin=join(root,"demo.sdPlugin");
  mkdirSync(plugin,{recursive:true});
  write(join(plugin,"manifest.json"),JSON.stringify({
    Name:"Demo Lite",
    Version:"1.0.0.0",
    UUID:"com.packrat.demo",
    Actions:[{
      Name:"Snap",
      UUID:"com.packrat.demo.snap",
      Icon:"imgs/actions/snap/icon",
      PropertyInspectorPath:"ui/snap.html",
      Controllers:["Keypad"],
      States:[{Image:"imgs/actions/snap/key",ShowTitle:false}]
    }]
  },null,2));
  write(join(plugin,"ui","snap.html"),`<!doctype html>
<link rel="stylesheet" href="pi.css">
<div class="packrat-topbar"><button class="packrat-brand"><img class="packrat-logo" src="../imgs/plugin/packrat-logo.png">PackRat ↗</button><button class="primary packrat-upgrade">Upgrade to Pro ↗</button></div>
<div class="section">Demo</div>
<div class="upsell"><strong>DEMO PRO</strong><button>Open Demo Pro ↗</button></div>
<script src="pi.js"></script>`);
  write(join(plugin,"ui","pi.css"),`:root{--accent:#FFB21E}
body{background:#080a0e}
body::before{background:radial-gradient(circle,rgba(255,178,30,.12),transparent)}
.section,.upsell{background:linear-gradient(145deg,#151920,#0d1015)}
.packrat-topbar{display:flex;justify-content:space-between}
.packrat-upgrade{white-space:nowrap}`);
  write(join(plugin,"ui","pi.js"),`const urls={
maker:"https://marketplace.elgato.com/maker/packrat",
pro:"https://marketplace.elgato.com/product/demo-pro-00000000-0000-0000-0000-000000000000"
};
let uiUuid="",actionContext="",actionUuid="",socket=null;
function send(message){socket?.send(JSON.stringify(message));}
function command(command){send({event:"sendToPlugin",action:actionUuid,context:uiUuid,payload:{type:"demo.command",actionContext,command}});}
function save(settings){send({event:"setSettings",action:actionUuid,context:uiUuid,payload:settings});}
`);
  write(join(root,"src","plugin.js"),`streamDeck.ui.onSendToPlugin((ev)=>{
  const actionContext=String(ev.payload?.actionContext||"");
  if(!actionContext)return;
  streamDeck.ui.sendToPropertyInspector({type:"demo.state",actionContext});
});`);
  write(join(plugin,"imgs","plugin","packrat-logo.png"),"png");
  write(join(plugin,"imgs","actions","snap","icon.svg"),`<svg viewBox="0 0 144 144"><path stroke="#fff" stroke-width="6"/></svg>`);
  write(join(plugin,"imgs","actions","snap","key.svg"),`<svg viewBox="0 0 144 144"><path stroke="#FFB21E" stroke-width="6"/></svg>`);
  return {root,plugin};
}

{
  const {root,plugin}=fixture();
  try{
    const result=run(designAudit,[root,"--require-canonical-pi","--require-lite-pro-upsell"]);
    assert.equal(result.status,0,`canonical design fixture should pass\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
    assert.match(result.stdout,/Property Inspectors: 1/);
    assert.match(result.stdout,/Lite→Pro pattern: required/);
  } finally { rmSync(root,{recursive:true,force:true}); }
}

{
  const {root,plugin}=fixture();
  try{
    const htmlPath=join(plugin,"ui","snap.html");
    const html=`<!doctype html>
<link rel="stylesheet" href="pi.css">
<div class="packrat-topbar"><button class="packrat-brand"><img class="packrat-logo" src="../imgs/plugin/packrat-logo.png">PackRat ↗</button><button>Upgrade to Pro ↗</button></div>
<div class="section">Demo</div>
<script src="pi.js"></script>`;
    write(htmlPath,html);
    const result=run(designAudit,[root,"--require-canonical-pi","--require-lite-pro-upsell"]);
    assert.notEqual(result.status,0,"Lite→Pro audit must fail when the bottom explanatory card is removed");
    assert.match(result.stderr,/bottom \.upsell feature card is missing/);
    assert.match(result.stderr,/bottom direct 'Open <Product> Pro ↗' CTA is missing/);
  } finally { rmSync(root,{recursive:true,force:true}); }
}

{
  const {root,plugin}=fixture();
  try{
    write(join(plugin,"ui","pi.js"),`let uiUuid="",actionUuid="",socket=null;
function send(message){socket?.send(JSON.stringify(message));}
function command(command){send({event:"sendToPlugin",action:actionUuid,context:uiUuid,payload:{type:"demo.command",command}});}
`);
    const result=run(designAudit,[root,"--require-canonical-pi"]);
    assert.notEqual(result.status,0,"design audit must fail when PI commands omit actionContext");
    assert.match(result.stderr,/does not carry the selected action separately as actionContext/);
  } finally { rmSync(root,{recursive:true,force:true}); }
}

{
  const {root,plugin}=fixture();
  try{
    write(join(root,"src","plugin.js"),`streamDeck.ui.onSendToPlugin((ev)=>{
  const actionContext=String(ev.payload?.actionContext||"");
  ev.action.sendToPropertyInspector({type:"demo.state",actionContext});
});`);
    const result=run(designAudit,[root,"--require-canonical-pi"]);
    assert.notEqual(result.status,0,"design audit must fail when global PI requests use per-action response transport");
    assert.match(result.stderr,/without the global streamDeck.ui channel/);
    assert.match(result.stderr,/Per-action sendToPropertyInspector found/);
  } finally { rmSync(root,{recursive:true,force:true}); }
}

{
  const {root,plugin}=fixture();
  try{
    write(join(plugin,"imgs","actions","snap","key.png"),Buffer.alloc(32));
    const result=run(keyAudit,[plugin]);
    assert.notEqual(result.status,0,"key audit must fail on competing extensionless key assets");
    assert.match(result.stderr,/extensionless asset path is ambiguous/);
  } finally { rmSync(root,{recursive:true,force:true}); }
}

console.log("PASS: Stream Deck global audit regressions");
