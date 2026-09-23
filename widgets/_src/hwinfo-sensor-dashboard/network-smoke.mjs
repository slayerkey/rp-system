import { chromium } from "playwright";
import { WebSocket } from "ws";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const entry=path.resolve(process.argv[2]||"");
const outDir=path.resolve(process.argv[3]||"artifacts/hwinfo-network-smoke");
const exe=path.resolve(process.argv[4]||process.env.PACKRAT_HWINFO_BRIDGE_EXE||"");
if(!entry||!exe)throw new Error("usage: node network-smoke.mjs <exact-index.html> <out-dir> <bridge-exe>");
await fs.mkdir(outDir,{recursive:true});

function launchBridge(extra=[]){
 return spawn(exe,["--fixture","--no-browser",...extra],{
  env:{...process.env,PACKRAT_HWINFO_BRIDGE_TEST:"1",PACKRAT_HWINFO_FIXTURE_STATE:"live"},
  stdio:["ignore","pipe","pipe"]
 });
}
async function health(timeout=10000){
 const deadline=Date.now()+timeout;
 while(Date.now()<deadline){
  try{const r=await fetch("http://127.0.0.1:17489/health");if(r.ok)return await r.json()}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 throw new Error("HWiNFO bridge did not become healthy");
}
async function stop(child){
 if(!child||child.exitCode!==null)return;
 child.kill();
 await Promise.race([new Promise(r=>child.once("exit",r)),new Promise(r=>setTimeout(r,2500))]);
 if(child.exitCode===null)child.kill("SIGKILL");
}
async function wsFirst(key,protocol=1){
 return await new Promise((resolve,reject)=>{
  const socket=new WebSocket("ws://127.0.0.1:17489/widget",{headers:{Origin:"null"}});
  const messages=[];const timer=setTimeout(()=>{socket.terminate();reject(new Error("websocket timeout"))},5000);
  socket.on("open",()=>socket.send(JSON.stringify({type:"hello",protocol,key,client:"qa"})));
  socket.on("message",data=>{messages.push(JSON.parse(String(data)));if(messages.length>=2||messages[0]?.type!=="auth_ok"){clearTimeout(timer);socket.close();resolve(messages)}});
  socket.on("error",reject);
 });
}

let bridge=launchBridge();
try{
 const h=await health();
 if(h.product!=="PackRat HWiNFO Bridge"||h.protocol!==1)throw new Error("health identity mismatch");

 const bad=await wsFirst("wrong-key");
 if(bad[0]?.type!=="pairing_required")throw new Error("wrong pairing key did not fail closed");
 const mismatch=await wsFirst("hwinfo-fixture-key",99);
 if(mismatch[0]?.type!=="protocol_mismatch")throw new Error("protocol mismatch did not fail closed");
 const good=await wsFirst("hwinfo-fixture-key",1);
 if(good[0]?.type!=="auth_ok"||good[1]?.type!=="snapshot"||good[1]?.sensors?.length<100)throw new Error("authenticated fixture snapshot missing 100+ sensors");

 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1688,height:696}});
  const errors=[];page.on("pageerror",e=>errors.push(String(e)));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  await page.addInitScript(()=>{
   globalThis.bridgeKey="hwinfo-fixture-key";globalThis.historyWindow="180";globalThis.staleSeconds=8;
   globalThis.textColor="#F4F6F8";globalThis.accentColor="#2BE86A";globalThis.backgroundColor="#070A0D";globalThis.graphColor="#55D6FF";
   globalThis.icueEvents={};globalThis.tr=async v=>v;
  });
  await page.goto(pathToFileURL(entry).href,{waitUntil:"load"});
  await page.waitForFunction(()=>globalThis.__PACKRAT_HWINFO_TEST__?.getState().sensors.length>=100,{timeout:10000});
  const state=await page.evaluate(()=>globalThis.__PACKRAT_HWINFO_TEST__.getState());
  const selected=state.sensors.slice(0,6).map(s=>s.fingerprint);
  await page.evaluate((selected)=>{const s=globalThis.__PACKRAT_HWINFO_TEST__.getState();s.persist.slots["l-h"]=selected;localStorage.setItem("packrat.hwinfo-dashboard.v1",JSON.stringify(s.persist));location.reload()},selected);
  await page.waitForFunction(()=>document.querySelectorAll(".sensorCard").length===6,{timeout:10000});

  await page.click("#configureButton");
  await page.fill("#sensorSearch","ポンプ温度");
  await page.waitForFunction(()=>document.querySelectorAll(".pickerRow").length>=1,{timeout:3000});
  const htmlBold=await page.locator("#sensorPicker b").count();
  if(htmlBold!==0)throw new Error("Unicode/HTML-looking sensor label rendered as markup");
  await page.click("#closeConfig");

  await stop(bridge);
  await page.waitForFunction(()=>document.body.getAttribute("data-connection")==="offline",{timeout:10000});
  bridge=launchBridge();await health();
  await page.waitForFunction(()=>document.body.getAttribute("data-connection")==="live"&&globalThis.__PACKRAT_HWINFO_TEST__.getState().sensors.length>=100,{timeout:15000});

  await page.screenshot({path:path.join(outDir,"recovered.png")});
  if(errors.length)throw new Error("browser errors: "+errors.join(" | "));
  await fs.writeFile(path.join(outDir,"result.json"),JSON.stringify({pass:true,sensors:good[1].sensors.length,wrongKey:"pass",protocolMismatch:"pass",restartRecovery:"pass",unicode:"pass"},null,2));
 }finally{await browser.close()}
}finally{await stop(bridge)}
console.log("HWiNFO EXACT-PACKAGE BRIDGE SMOKE PASS");
