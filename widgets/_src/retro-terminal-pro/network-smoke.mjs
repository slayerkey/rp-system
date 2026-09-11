import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

await import("./verify.mjs");

const entry=process.argv[2];
const outDir=process.argv[3]||"artifacts/retro-terminal-pro-smoke";
if(!entry||!fs.existsSync(entry))throw new Error("usage: node network-smoke.mjs <packaged-index.html> [output-dir]");
fs.mkdirSync(outDir,{recursive:true});

const slots={
  "S_H":[840,344],"S_V":[696,416],"M_H":[840,696],"M_V":[696,840],
  "L_H":[1688,696],"L_V":[696,1688],"XL_H":[2536,696],"XL_V":[696,2536]
};

function addHarness(page,{withSensors=true,boot="none"}={}){
  return page.addInitScript(({withSensors,boot})=>{
    globalThis.uniqueId="retro-terminal-pro-smoke";
    globalThis.iCUE={isPreview:false};
    globalThis.startProgram="prompt";
    globalThis.bootSequence=boot;
    globalThis.autoProgram=false;
    globalThis.autoStyle=false;
    globalThis.rotationSeconds=45;
    globalThis.idleEnabled=true;
    globalThis.idleSeconds=900;
    globalThis.idleProgram="rain";
    globalThis.machineName="QA-RIG";
    globalThis.username="tester";
    globalThis.promptText="status --local";
    globalThis.terminalLines="RETRO TERMINAL PRO ONLINE|fixture text is decorative|SYSTEM is provider backed";
    globalThis.terminalStyle="green";
    globalThis.textColor="#B8FFC7";
    globalThis.accentColor="#5CFF7F";
    globalThis.backgroundColor="#031006";
    globalThis.scanlineStrength=55;
    globalThis.glowStrength=55;
    globalThis.flickerStrength=0;
    globalThis.vignetteStrength=60;
    globalThis.crtCurvature=true;
    globalThis.tr=async value=>value;
    try{localStorage.clear();}catch(e){}
    if(!withSensors){globalThis.plugins={};return;}

    function signal(){
      const listeners=[];
      return{connect(fn){listeners.push(fn);},emit(id,value){for(const fn of listeners)fn(id,value);}};
    }
    function makeAsync(methods){
      const asyncResponse=signal();
      const obj={asyncResponse};
      for(const [name,fn] of Object.entries(methods)){
        obj[name]=(id,...args)=>setTimeout(()=>asyncResponse.emit(id,fn(...args)),0);
      }
      return obj;
    }
    const values={"cpu-load":42,"cpu-temp":61,"gpu-load":87,"gpu-temp":67,"ram":58};
    const meta={
      "cpu-load":["AMD Ryzen 9","CPU Total Load","%","load","cpu"],
      "cpu-temp":["AMD Ryzen 9","CPU Package Temperature","°C","temperature","package"],
      "gpu-load":["NVIDIA GeForce RTX","GPU Load","%","load","gpu"],
      "gpu-temp":["NVIDIA GeForce RTX","GPU Temperature","°C","temperature","gpu"],
      "ram":["System Memory","Memory Usage","%","load","memory"]
    };
    globalThis.plugins={Sensorsdataprovider:makeAsync({
      getAllSensorIds:()=>Object.keys(values),
      getSensorDeviceName:id=>meta[id][0],
      getSensorName:id=>meta[id][1],
      getSensorUnits:id=>meta[id][2],
      getSensorType:id=>meta[id][3],
      getSensorKind:id=>meta[id][4],
      getSensorValue:id=>values[id]
    })};
  },{withSensors,boot});
}

const browser=await chromium.launch({headless:true});
let failures=[];

async function open(width,height,options={}){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push("pageerror: "+String(e)));
  page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text());});
  await addHarness(page,options);
  await page.goto(pathToFileURL(path.resolve(entry)).href,{waitUntil:"load"});
  return{page,errors};
}

try{
  for(const [slot,[width,height]] of Object.entries(slots)){
    const {page,errors}=await open(width,height);
    await page.waitForFunction(()=>globalThis.__retroTerminalPro?.started===true,{timeout:10000});
    const expected=slot.toLowerCase().replace("_","-");

    let snap=await page.evaluate(()=>({
      slot:document.body.getAttribute("data-slot"),
      program:document.body.getAttribute("data-program"),
      style:document.body.getAttribute("data-style"),
      ox:document.documentElement.scrollWidth-innerWidth,
      oy:document.documentElement.scrollHeight-innerHeight
    }));
    if(snap.slot!==expected)failures.push(slot+" slot "+JSON.stringify(snap));
    if(snap.program!=="prompt"||snap.style!=="green")failures.push(slot+" initial state "+JSON.stringify(snap));
    if(snap.ox>0.5||snap.oy>0.5)failures.push(slot+" overflow "+JSON.stringify(snap));

    await page.click('#terminalFooter [data-program="system"]');
    await page.evaluate(async()=>{
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
    });
    snap=await page.evaluate(()=>({
      program:document.body.getAttribute("data-program"),
      system:document.getElementById("systemState").textContent,
      cpu:document.querySelector('.sensorRow[data-role="cpuLoad"] .sensorValue').textContent,
      gpu:document.querySelector('.sensorRow[data-role="gpuTemp"] .sensorValue').textContent,
      ram:document.querySelector('.sensorRow[data-role="ram"] .sensorValue').textContent
    }));
    if(snap.program!=="system"||!snap.system.includes("LIVE iCUE")||snap.cpu!=="42%"||snap.gpu!=="67°C"||snap.ram!=="58%"){
      failures.push(slot+" SYSTEM "+JSON.stringify(snap));
    }

    await page.click('#terminalFooter [data-program="clock"]');
    if(await page.getAttribute("body","data-program")!=="clock")failures.push(slot+" touch clock failed");
    await page.click('#terminalFooter [data-program="prompt"]');

    await page.evaluate(()=>{
      globalThis.terminalStyle="custom";
      globalThis.textColor="#FFF3D6";
      globalThis.accentColor="#FF274D";
      globalThis.backgroundColor="#18100B";
      globalThis.scanlineStrength=20;
      globalThis.glowStrength=30;
      globalThis.crtCurvature=false;
      globalThis.icueEvents.onDataUpdated();
    });
    snap=await page.evaluate(()=>({
      style:document.body.getAttribute("data-style"),
      text:getComputedStyle(document.documentElement).getPropertyValue("--text").trim().toLowerCase(),
      accent:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase(),
      background:getComputedStyle(document.documentElement).getPropertyValue("--background").trim().toLowerCase(),
      crt:getComputedStyle(document.documentElement).getPropertyValue("--crt-accent").trim().toLowerCase(),
      radius:getComputedStyle(document.getElementById("crtViewport")).borderRadius
    }));
    if(snap.style!=="custom"||snap.text!=="#fff3d6"||snap.accent!=="#ff274d"||snap.background!=="#18100b"||snap.crt!=="#ff274d"||snap.radius!=="0px"){
      failures.push(slot+" live settings "+JSON.stringify(snap));
    }

    await page.evaluate(()=>globalThis.__retroTerminalProTest.forceIdle());
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    if(!snap.idle||snap.program!=="rain")failures.push(slot+" idle "+JSON.stringify(snap));
    await page.dispatchEvent("body","pointerdown");
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    if(snap.idle||snap.program!=="prompt")failures.push(slot+" idle wake "+JSON.stringify(snap));

    await page.evaluate(()=>{
      globalThis.__retroTerminalProTest.rotateProgram();
      globalThis.__retroTerminalProTest.rotateStyle();
    });
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    if(snap.program==="prompt"||snap.style==="custom")failures.push(slot+" manual rotation "+JSON.stringify(snap));

    await page.screenshot({path:path.join(outDir,slot+".png")});
    if(errors.length)failures.push(slot+" runtime errors "+errors.join(" | "));
    await page.close();
  }

  {
    const {page,errors}=await open(840,696,{withSensors:false});
    await page.waitForFunction(()=>globalThis.__retroTerminalPro?.started===true,{timeout:10000});
    await page.click('#terminalFooter [data-program="system"]');
    await page.evaluate(async()=>{
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
    });
    const snap=await page.evaluate(()=>({
      state:document.getElementById("systemState").textContent,
      values:Array.from(document.querySelectorAll("#systemGrid .sensorValue")).map(el=>el.textContent)
    }));
    if(snap.state!=="NO MATCHING iCUE SENSORS"||snap.values.some(v=>v!=="—"))failures.push("no-sensor honesty "+JSON.stringify(snap));
    await page.screenshot({path:path.join(outDir,"NO_SENSORS.png")});
    if(errors.length)failures.push("no-sensor runtime errors "+errors.join(" | "));
    await page.close();
  }

  {
    const {page,errors}=await open(840,344,{withSensors:false,boot:"fast"});
    await page.waitForFunction(()=>document.getElementById("bootText").textContent.includes("RETRO TERMINAL PRO"),{timeout:5000});
    const booting=await page.getAttribute("body","data-booting");
    if(booting!=="true")failures.push("fast boot did not render startup state");
    await page.waitForFunction(()=>globalThis.__retroTerminalPro?.started===true,{timeout:10000});
    if(errors.length)failures.push("boot runtime errors "+errors.join(" | "));
    await page.close();
  }
}finally{
  await browser.close();
}

const report={schema_version:1,entry:path.basename(entry),slots:Object.keys(slots),failures,passed:failures.length===0};
fs.writeFileSync(path.join(outDir,"retro-terminal-pro-smoke.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
console.log("RETRO TERMINAL PRO EXACT-PACKAGE SMOKE PASS");
