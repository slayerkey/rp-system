import assert from "node:assert/strict";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "playwright";
const entry=path.resolve(process.argv[2]||"widgets/_src/audio-control-center/index.html");
const slots=[["s-h",840,344,48],["s-v",696,416,50],["m-h",840,696,56],["m-v",696,840,60],["l-h",1688,696,70],["l-v",696,1688,70],["xl-h",2536,696,70],["xl-v",696,2536,70]];
const base={protocol:1,bridge:{listening:true,version:"test"},capabilities:{defaultDeviceSwitching:true,outputVolume:true,inputVolume:true},defaultOutputId:"o1",defaultInputId:"i1",outputs:[{id:"o1",name:"Speakers (Realtek Audio)",volume:60,muted:false,volumeAvailable:true,muteAvailable:true},{id:"o2",name:"Headphones (Arctis Nova Pro Wireless)",volume:35,muted:false,volumeAvailable:true,muteAvailable:true},{id:"o3",name:"An Extremely Long USB Audio Interface Friendly Name That Must Stay Contained In Every Layout",volume:80,muted:false,volumeAvailable:true,muteAvailable:true}],inputs:[{id:"i1",name:"Microphone (Scarlett Solo USB)",volume:75,muted:false,volumeAvailable:true,muteAvailable:true},{id:"i2",name:"Microphone (USB Camera)",volume:50,muted:false,volumeAvailable:true,muteAvailable:true}],error:null};
const browser=await chromium.launch({headless:true});
try{
 for(const s of slots){
  const ctx=await browser.newContext({viewport:{width:s[1],height:s[2]}});
  await ctx.addInitScript(function(v){globalThis.__PACKRAT_AUDIO_FIXTURE__=v;globalThis.tr=async function(x){return x};globalThis.icueEvents={}},base);
  const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  await page.goto(pathToFileURL(entry).href,{waitUntil:"load"});await page.waitForFunction(()=>globalThis.__PACKRAT_AUDIO_TEST__&&document.body.dataset.connection==="ready");
  const state=await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.getState());assert.equal(state.slot,s[0]);assert.equal(state.outputs.length,3);assert.equal(state.inputs.length,2);
  const geo=await page.evaluate(()=>{const r=id=>{const x=document.getElementById(id).getBoundingClientRect();return[Math.min(x.width,x.height),x.width,x.height]};return{dw:document.documentElement.scrollWidth,dh:document.documentElement.scrollHeight,bw:document.body.scrollWidth,bh:document.body.scrollHeight,om:r("outputMute"),im:r("inputMute"),od:r("outputDown"),id:r("inputDown")}});
  assert.ok(geo.dw<=s[1]+1&&geo.bw<=s[1]+1&&geo.dh<=s[2]+1&&geo.bh<=s[2]+1,s[0]+" overflow");
  for(const k of ["om","im","od","id"])assert.ok(geo[k][0]>=s[3],s[0]+" touch "+k);
  if(s[0]==="m-h"){
   await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.clearCommands());
   await page.locator('.device[title="Headphones (Arctis Nova Pro Wireless)"]').click();let q=await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.getState());assert.equal(q.defaultOutputId,"o2");assert.equal(q.commands.at(-1).command,"set-default-output");
   await page.locator("#outputMute").click();q=await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.getState());assert.equal(q.outputs.find(x=>x.id==="o2").muted,true);
   await page.locator("#outputVolume").evaluate(el=>{el.value="27";el.dispatchEvent(new Event("change",{bubbles:true}))});q=await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.getState());assert.equal(q.outputs.find(x=>x.id==="o2").volume,27);
   await page.evaluate(v=>globalThis.__PACKRAT_AUDIO_TEST__.snapshot(v),{...base,outputs:base.outputs.slice(0,2)});assert.equal((await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.getState())).outputs.length,2);
   await page.evaluate(v=>globalThis.__PACKRAT_AUDIO_TEST__.snapshot(v),{...base,outputs:[],inputs:[],defaultOutputId:"",defaultInputId:""});assert.match(await page.locator("#outputDevices").innerText(),/No active Windows output/i);assert.match(await page.locator("#inputDevices").innerText(),/No active Windows input/i);
   await page.evaluate(()=>globalThis.__PACKRAT_AUDIO_TEST__.disconnect());assert.equal(await page.locator("body").getAttribute("data-connection"),"offline");await page.evaluate(v=>globalThis.__PACKRAT_AUDIO_TEST__.reconnect(v),base);assert.equal(await page.locator("body").getAttribute("data-connection"),"ready");
   await page.evaluate(v=>globalThis.__PACKRAT_AUDIO_TEST__.snapshot(v),{...base,capabilities:{...base.capabilities,defaultDeviceSwitching:false},inputs:[{id:"i1",name:"Fixed gain microphone",volume:null,muted:false,volumeAvailable:false,muteAvailable:true}],defaultInputId:"i1"});assert.equal(await page.locator("#inputVolume").isDisabled(),true);assert.equal(await page.locator("#inputVolumeValue").innerText(),"N/A");assert.equal(await page.locator('.device[title="Headphones (Arctis Nova Pro Wireless)"]').isDisabled(),true);
  }
  assert.deepEqual(errors,[]);await ctx.close();
 }
}finally{await browser.close()}
console.log("AUDIO CONTROL CENTER VISUAL QA PASS: eight layouts and requested failure/control fixtures");
