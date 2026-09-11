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

function addHarness(page,{withSensors=true,boot="none",clearStorage=true}={}){
  return page.addInitScript(({withSensors,boot,clearStorage})=>{
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
    if(clearStorage){try{localStorage.clear();}catch(e){}}

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
    let sensorMode="normal";
    const provider=makeAsync({
      getAllSensorIds:()=>sensorMode==="empty"?[]:sensorMode==="error"?null:Object.keys(values),
      getSensorDeviceName:id=>meta[id]?.[0]||"",
      getSensorName:id=>meta[id]?.[1]||"",
      getSensorUnits:id=>meta[id]?.[2]||"",
      getSensorType:id=>meta[id]?.[3]||"",
      getSensorKind:id=>meta[id]?.[4]||"",
      getSensorValue:id=>sensorMode==="values-null"?null:values[id]
    });
    globalThis.__sensorProviderFixture=provider;
    globalThis.__setSensorFixtureMode=mode=>{sensorMode=String(mode||"normal");};
    globalThis.plugins=withSensors?{Sensorsdataprovider:provider}:{};
  },{withSensors,boot,clearStorage});
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

async function waitStarted(page){
  await page.waitForFunction(()=>globalThis.__retroTerminalPro?.started===true,null,{timeout:10000});
}

function expect(condition,message){
  if(!condition)failures.push(message);
}

try{
  for(const [slot,[width,height]] of Object.entries(slots)){
    const {page,errors}=await open(width,height);
    await page.waitForTimeout(250);
    if(errors.length)throw new Error(slot+" startup runtime errors: "+errors.join(" | "));
    await waitStarted(page);
    const expected=slot.toLowerCase().replace("_","-");

    let snap=await page.evaluate(()=>({
      slot:document.body.getAttribute("data-slot"),
      program:document.body.getAttribute("data-program"),
      style:document.body.getAttribute("data-style"),
      ox:document.documentElement.scrollWidth-innerWidth,
      oy:document.documentElement.scrollHeight-innerHeight,
      timers:globalThis.__retroTerminalProTest.snapshot().timers,
      hasInit:typeof globalThis.icueEvents?.onICUEInitialized==="function",
      hasUpdate:typeof globalThis.icueEvents?.onDataUpdated==="function",
      touch:Array.from(document.querySelectorAll("#terminalFooter button")).map(el=>{
        const r=el.getBoundingClientRect();return{w:r.width,h:r.height};
      }),
      bodyFont:parseFloat(getComputedStyle(document.body).fontSize),
      promptFont:parseFloat(getComputedStyle(document.getElementById("promptHistory")).fontSize),
      promptLine:parseFloat(getComputedStyle(document.getElementById("promptHistory")).lineHeight)
    }));
    expect(snap.slot===expected,slot+" slot "+JSON.stringify(snap));
    expect(snap.program==="prompt"&&snap.style==="green",slot+" initial state "+JSON.stringify(snap));
    expect(snap.ox<=0.5&&snap.oy<=0.5,slot+" overflow "+JSON.stringify(snap));
    expect(snap.hasInit&&snap.hasUpdate,slot+" missing iCUE lifecycle callbacks");
    expect(snap.timers===5,slot+" expected exactly five owned timers, got "+snap.timers);
    expect(snap.touch.every(r=>r.w>=44&&r.h>=44),slot+" touch target below 44px "+JSON.stringify(snap.touch));
    expect(Number.isFinite(snap.promptLine)&&snap.promptLine>=snap.promptFont*1.15,slot+" descender-unsafe prompt line height "+JSON.stringify(snap));
    if(width>=1688)expect(snap.bodyFont>=22,slot+" native-wide body font too small: "+snap.bodyFont);
    if(width>=2536)expect(snap.bodyFont>=24,slot+" XL-wide body font too small: "+snap.bodyFont);

    await page.evaluate(()=>{
      const before=globalThis.__retroTerminalProTest.snapshot().timers;
      for(let i=0;i<4;i++){
        globalThis.icueEvents.onICUEInitialized();
        globalThis.icueEvents.onDataUpdated();
      }
      globalThis.__lifecycleTimerBefore=before;
    });
    snap=await page.evaluate(()=>({before:globalThis.__lifecycleTimerBefore,after:globalThis.__retroTerminalProTest.snapshot().timers}));
    expect(snap.before===snap.after&&snap.after===5,slot+" lifecycle duplicated timers "+JSON.stringify(snap));

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
    expect(snap.program==="system"&&snap.system.includes("LIVE iCUE")&&snap.cpu==="42%"&&snap.gpu==="67°C"&&snap.ram==="58%",slot+" SYSTEM "+JSON.stringify(snap));

    for(const target of ["clock","rain","trace","system","prompt","clock","prompt"]){
      await page.click('#terminalFooter [data-program="'+target+'"]');
    }
    snap=await page.evaluate(()=>({
      program:document.body.getAttribute("data-program"),
      activePanels:document.querySelectorAll(".programPanel.is-active").length,
      activeButtons:document.querySelectorAll("#terminalFooter button.is-active").length
    }));
    expect(snap.program==="prompt"&&snap.activePanels===1&&snap.activeButtons===1,slot+" rapid touch switching "+JSON.stringify(snap));

    await page.evaluate(()=>{
      globalThis.terminalStyle="custom";
      globalThis.textColor="#FFF3D6";
      globalThis.accentColor="#FF274D";
      globalThis.backgroundColor="#18100B";
      globalThis.scanlineStrength=20;
      globalThis.glowStrength=30;
      globalThis.crtCurvature=false;
      globalThis.machineName="<b>not markup</b> gypqj";
      globalThis.username="user-Δ🐀-gypqj-long";
      globalThis.promptText="<i>status</i> gypqj Ω界🐀";
      globalThis.terminalLines="<b>not markup</b> gypqj|Unicode Ω界🐀 descenders gypqj";
      globalThis.icueEvents.onDataUpdated();
      globalThis.__retroTerminalProTest.forcePromptComplete();
    });
    snap=await page.evaluate(()=>({
      style:document.body.getAttribute("data-style"),
      text:getComputedStyle(document.documentElement).getPropertyValue("--text").trim().toLowerCase(),
      accent:getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase(),
      background:getComputedStyle(document.documentElement).getPropertyValue("--background").trim().toLowerCase(),
      crt:getComputedStyle(document.documentElement).getPropertyValue("--crt-accent").trim().toLowerCase(),
      radius:getComputedStyle(document.getElementById("crtViewport")).borderRadius,
      machine:document.getElementById("machineLabel").textContent,
      machineMarkup:!!document.querySelector("#machineLabel b"),
      promptMarkup:!!document.querySelector("#promptHistory b"),
      ox:document.documentElement.scrollWidth-innerWidth,
      oy:document.documentElement.scrollHeight-innerHeight
    }));
    expect(snap.style==="custom"&&snap.text==="#fff3d6"&&snap.accent==="#ff274d"&&snap.background==="#18100b"&&snap.crt==="#ff274d"&&snap.radius==="0px",slot+" live settings "+JSON.stringify(snap));
    expect(snap.machine.includes("<B>NOT MARKUP</B>")&&!snap.machineMarkup&&!snap.promptMarkup,slot+" user text escaped incorrectly "+JSON.stringify(snap));
    expect(snap.ox<=0.5&&snap.oy<=0.5,slot+" long/Unicode text overflow "+JSON.stringify(snap));

    await page.evaluate(()=>{globalThis.machineName="AUTOSYNC-Δ🐀-GYPQJ";});
    await page.waitForTimeout(500);
    snap=await page.evaluate(()=>({machine:document.getElementById("machineLabel").textContent}));
    expect(snap.machine==="AUTOSYNC-Δ🐀-GYPQJ",slot+" no-callback settings autosync failed "+JSON.stringify(snap));

    await page.evaluate(()=>{
      globalThis.startProgram="prompt";
      globalThis.idleProgram="rain";
      globalThis.idleEnabled=true;
      globalThis.icueEvents.onDataUpdated();
      globalThis.__retroTerminalProTest.setProgram("prompt");
      globalThis.__retroTerminalProTest.forceIdle();
    });
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.idle&&snap.program==="rain",slot+" idle "+JSON.stringify(snap));
    await page.dispatchEvent("body","pointerdown");
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(!snap.idle&&snap.program==="prompt",slot+" idle wake "+JSON.stringify(snap));

    await page.evaluate(()=>{
      globalThis.autoProgram=true;
      globalThis.autoStyle=true;
      globalThis.rotationSeconds=15;
      globalThis.icueEvents.onDataUpdated();
      globalThis.__retroTerminalProTest.setProgram("prompt");
      globalThis.__retroTerminalProTest.setStyle("green");
      globalThis.__retroTerminalPro.lastProgramRotation=Date.now()-16000;
      globalThis.__retroTerminalPro.lastStyleRotation=Date.now()-16000;
      globalThis.__retroTerminalProTest.lifecycleTick();
    });
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.program==="system"&&snap.style==="amber",slot+" automatic rotation "+JSON.stringify(snap));

    await page.screenshot({path:path.join(outDir,slot+".png")});
    if(errors.length)failures.push(slot+" runtime errors "+errors.join(" | "));
    await page.close();
  }

  {
    const {page,errors}=await open(840,696,{withSensors:true});
    await waitStarted(page);
    await page.click('#terminalFooter [data-program="system"]');
    await page.evaluate(async()=>{
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
      globalThis.__setSensorFixtureMode("empty");
      await globalThis.__retroTerminalProTest.discoverSensors();
    });
    let snap=await page.evaluate(()=>({
      state:document.getElementById("systemState").textContent,
      values:Array.from(document.querySelectorAll("#systemGrid .sensorValue")).map(el=>el.textContent)
    }));
    expect(snap.state==="NO iCUE SENSORS EXPOSED"&&snap.values.every(v=>v==="—"),"empty sensor state "+JSON.stringify(snap));

    await page.evaluate(async()=>{
      globalThis.__setSensorFixtureMode("error");
      await globalThis.__retroTerminalProTest.discoverSensors();
    });
    snap=await page.evaluate(()=>({state:document.getElementById("systemState").textContent}));
    expect(snap.state==="iCUE SENSOR PROVIDER ERROR","provider error state "+JSON.stringify(snap));

    await page.evaluate(async()=>{
      globalThis.__setSensorFixtureMode("normal");
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
      for(const value of Object.values(globalThis.__retroTerminalPro.sensorValues))value.at=Date.now()-9000;
      globalThis.__retroTerminalProTest.setProgram("system");
    });
    snap=await page.evaluate(()=>({
      state:document.getElementById("systemState").textContent,
      stale:Array.from(document.querySelectorAll("#systemGrid .sensorSource")).some(el=>el.textContent.startsWith("STALE //"))
    }));
    expect(snap.state==="STALE iCUE DATA"&&snap.stale,"stale sensor state "+JSON.stringify(snap));

    await page.evaluate(async()=>{
      await globalThis.__retroTerminalProTest.pollSensors();
    });
    snap=await page.evaluate(()=>({state:document.getElementById("systemState").textContent}));
    expect(snap.state.includes("LIVE iCUE"),"stale sensor recovery "+JSON.stringify(snap));

    await page.evaluate(async()=>{
      globalThis.plugins={};
      await globalThis.__retroTerminalProTest.discoverSensors();
    });
    snap=await page.evaluate(()=>({state:document.getElementById("systemState").textContent}));
    expect(snap.state==="iCUE SENSOR PROVIDER OFFLINE","provider unavailable state "+JSON.stringify(snap));

    await page.evaluate(async()=>{
      globalThis.plugins={Sensorsdataprovider:globalThis.__sensorProviderFixture};
      globalThis.__setSensorFixtureMode("normal");
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
    });
    snap=await page.evaluate(()=>({state:document.getElementById("systemState").textContent}));
    expect(snap.state.includes("LIVE iCUE"),"provider reconnect recovery "+JSON.stringify(snap));

    await page.screenshot({path:path.join(outDir,"PROVIDER_STATES.png")});
    if(errors.length)failures.push("provider-state runtime errors "+errors.join(" | "));
    await page.close();
  }

  {
    const {page,errors}=await open(840,696,{withSensors:false});
    await waitStarted(page);
    await page.click('#terminalFooter [data-program="system"]');
    await page.evaluate(async()=>{
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
    });
    const snap=await page.evaluate(()=>({
      state:document.getElementById("systemState").textContent,
      values:Array.from(document.querySelectorAll("#systemGrid .sensorValue")).map(el=>el.textContent)
    }));
    expect(snap.state==="iCUE SENSOR PROVIDER OFFLINE"&&snap.values.every(v=>v==="—"),"no-provider honesty "+JSON.stringify(snap));
    await page.screenshot({path:path.join(outDir,"NO_SENSORS.png")});
    if(errors.length)failures.push("no-provider runtime errors "+errors.join(" | "));
    await page.close();
  }

  {
    const {page,errors}=await open(840,696,{withSensors:false,clearStorage:false});
    await waitStarted(page);
    let snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.program==="prompt","persistence first-run fallback "+JSON.stringify(snap));

    await page.click('#terminalFooter [data-program="clock"]');
    snap=await page.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.endsWith(":retro-terminal-pro:program"));
      return{key,value:key?JSON.parse(localStorage.getItem(key)):null};
    });
    expect(!!snap.key&&snap.value?.schema===1&&snap.value?.value==="clock","versioned persistence write "+JSON.stringify(snap));

    await page.reload({waitUntil:"load"});
    await waitStarted(page);
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.program==="clock","persistence reload restore "+JSON.stringify(snap));

    await page.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.endsWith(":retro-terminal-pro:program"));
      localStorage.setItem(key,"{broken-json");
    });
    await page.reload({waitUntil:"load"});
    await waitStarted(page);
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.program==="prompt","corrupt persistence fallback "+JSON.stringify(snap));

    await page.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.endsWith(":retro-terminal-pro:program"));
      localStorage.setItem(key,JSON.stringify({base:"prompt",value:"system"}));
    });
    await page.reload({waitUntil:"load"});
    await waitStarted(page);
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.program==="system","legacy persistence compatibility "+JSON.stringify(snap));

    await page.evaluate(()=>{
      const key=Object.keys(localStorage).find(k=>k.endsWith(":retro-terminal-pro:program"));
      localStorage.removeItem(key);
    });
    await page.reload({waitUntil:"load"});
    await waitStarted(page);
    snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.program==="prompt","persistence clear/reset "+JSON.stringify(snap));

    if(errors.length)failures.push("persistence runtime errors "+errors.join(" | "));
    await page.close();
  }

  for(const boot of ["classic","cascade","fast","none"]){
    const {page,errors}=await open(840,344,{withSensors:false,boot});
    await page.waitForTimeout(700);
    let bootSnap=await page.evaluate(()=>({
      configured:globalThis.__retroTerminalPro?.cfg?.bootSequence,
      text:document.getElementById("bootText")?.textContent||"",
      started:globalThis.__retroTerminalPro?.started===true
    }));
    expect(bootSnap.configured===boot,boot+" boot setting mismatch "+JSON.stringify(bootSnap));
    if(boot!=="none")expect(bootSnap.text.includes("RETRO TERMINAL PRO"),boot+" boot transcript missing "+JSON.stringify(bootSnap));
    await waitStarted(page);
    expect(await page.getAttribute("body","data-booting")==="false",boot+" boot did not complete");
    if(errors.length)failures.push(boot+" boot runtime errors "+errors.join(" | "));
    await page.close();
  }

  {
    const {page,errors}=await open(840,696,{withSensors:true});
    await waitStarted(page);
    let snap=await page.evaluate(()=>globalThis.__retroTerminalProTest.snapshot());
    expect(snap.timers===5,"cleanup fixture expected five timers "+JSON.stringify(snap));
    await page.evaluate(()=>globalThis.__retroTerminalProTest.cleanup());
    snap=await page.evaluate(()=>({
      timers:globalThis.__retroTerminalProTest.snapshot().timers,
      pending:Object.keys(globalThis.__retroTerminalPro.pending).length
    }));
    expect(snap.timers===0&&snap.pending===0,"cleanup did not release timers/pending work "+JSON.stringify(snap));
    if(errors.length)failures.push("cleanup runtime errors "+errors.join(" | "));
    await page.close();
  }
}finally{
  await browser.close();
}

const report={
  schema_version:2,
  entry:path.basename(entry),
  slots:Object.keys(slots),
  coverage:[
    "all-eight-layouts","touch-targets","rapid-taps","native-wide-readability","descenders",
    "explicit-settings-callback","no-callback-autosync","onICUEInitialized","timer-idempotence",
    "idle-wake","auto-program-style-rotation","user-text-unicode-html-looking",
    "provider-normal-empty-error-stale-unavailable-recovery","persistence-reload-corrupt-legacy-clear",
    "boot-sequences","cleanup"
  ],
  failures,
  passed:failures.length===0
};
fs.writeFileSync(path.join(outDir,"retro-terminal-pro-smoke.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
console.log("RETRO TERMINAL PRO EXACT-PACKAGE SMOKE PASS");
