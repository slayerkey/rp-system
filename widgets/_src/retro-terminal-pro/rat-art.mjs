export const variants = [
  { name: "amber", slot: "XL_H", style: "amber", program: "prompt" },
  { name: "cyber", slot: "XL_H", style: "cyber", program: "rain" },
  { name: "system", slot: "XL_H", style: "green", program: "system" }
];

const FIXED_LOCAL={year:2026,month:8,day:10,hour:20,minute:35,second:0};

function selected(context,key,fallback){
  return context.variant&&context.variant[key] ? context.variant[key] : fallback;
}

export async function prepare(page,context){
  const style=selected(context,"style","green");
  const program=selected(context,"program","prompt");
  await page.addInitScript(({fixedLocal,style,program})=>{
    const NativeDate=Date;
    const fixedNow=new NativeDate(fixedLocal.year,fixedLocal.month,fixedLocal.day,fixedLocal.hour,fixedLocal.minute,fixedLocal.second,0).getTime();
    class FixedDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[fixedNow]));}
      static now(){return fixedNow;}
    }
    globalThis.Date=FixedDate;
    globalThis.uniqueId="rat-art-retro-terminal-pro";
    globalThis.iCUE={isPreview:false};
    globalThis.startProgram=program;
    globalThis.bootSequence="none";
    globalThis.autoProgram=false;
    globalThis.autoStyle=false;
    globalThis.rotationSeconds=45;
    globalThis.idleEnabled=false;
    globalThis.idleSeconds=120;
    globalThis.idleProgram="clock";
    globalThis.machineName="RIG-07";
    globalThis.username="operator";
    globalThis.promptText="status --local";
    globalThis.terminalLines="RETRO TERMINAL PRO ONLINE|profile: "+style.toUpperCase()+"|touch SYSTEM for live iCUE sensors|ambient programs remain terminal-first";
    globalThis.terminalStyle=style;
    globalThis.textColor="#B8FFC7";
    globalThis.accentColor="#5CFF7F";
    globalThis.backgroundColor="#031006";
    globalThis.scanlineStrength=55;
    globalThis.glowStrength=62;
    globalThis.flickerStrength=0;
    globalThis.vignetteStrength=58;
    globalThis.crtCurvature=true;
    globalThis.tr=async value=>value;
    try{localStorage.clear();}catch(e){}

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
  },{fixedLocal:FIXED_LOCAL,style,program});
}

export async function ready(page,context){
  const style=selected(context,"style","green");
  const program=selected(context,"program","prompt");
  await page.waitForFunction(()=>globalThis.__retroTerminalPro?.started===true,null,{timeout:10000});
  await page.evaluate(async ({style,program})=>{
    for(const timer of globalThis.__retroTerminalPro.timers||[])clearInterval(timer);
    globalThis.__retroTerminalPro.timers=[];
    globalThis.__retroTerminalPro.startedAt=Date.now()-3723000;
    globalThis.__retroTerminalProTest.setStyle(style);
    globalThis.__retroTerminalProTest.setProgram(program);
    globalThis.__retroTerminalProTest.forcePromptComplete();
    if(program==="system"){
      await globalThis.__retroTerminalProTest.discoverSensors();
      await globalThis.__retroTerminalProTest.pollSensors();
      globalThis.__retroTerminalProTest.setProgram("system");
    }
  },{style,program});
  await page.waitForTimeout(120);
}

export async function assert(page,context){
  const style=selected(context,"style","green");
  const program=selected(context,"program","prompt");
  const result=await page.evaluate(()=>({
    slot:document.body.getAttribute("data-slot"),
    program:document.body.getAttribute("data-program"),
    style:document.body.getAttribute("data-style"),
    overflowX:document.documentElement.scrollWidth-innerWidth,
    overflowY:document.documentElement.scrollHeight-innerHeight,
    system:document.getElementById("systemState")?.textContent||"",
    cpu:document.querySelector('.sensorRow[data-role="cpuLoad"] .sensorValue')?.textContent||"",
    ram:document.querySelector('.sensorRow[data-role="ram"] .sensorValue')?.textContent||"",
    prompt:document.getElementById("promptHistory")?.textContent||""
  }));
  const expectedSlot=String(context.slot).toLowerCase().replace("_","-");
  if(result.slot!==expectedSlot)throw new Error("slot mismatch "+JSON.stringify(result));
  if(result.program!==program||result.style!==style)throw new Error("variant mismatch "+JSON.stringify(result));
  if(result.overflowX>0.5||result.overflowY>0.5)throw new Error("overflow "+JSON.stringify(result));
  if(program==="system"&&(!result.system.includes("LIVE iCUE")||result.cpu!=="42%"||result.ram!=="58%"))throw new Error("SYSTEM fixture mismatch "+JSON.stringify(result));
  if(program==="prompt"&&!result.prompt.includes("RETRO TERMINAL PRO ONLINE"))throw new Error("prompt fixture mismatch "+JSON.stringify(result));
}
