"use strict";

var SLOT_SPECS=[
  {id:"s-h",w:840,h:344},{id:"s-v",w:696,h:416},
  {id:"m-h",w:840,h:696},{id:"m-v",w:696,h:840},
  {id:"l-h",w:1688,h:696},{id:"l-v",w:696,h:1688},
  {id:"xl-h",w:2536,h:696},{id:"xl-v",w:696,h:2536}
];
var PROGRAMS=["prompt","system","trace","rain","clock"];
var ROTATING_STYLES=["green","amber","white","blue","cyber"];
var PALETTES={
  green:{text:"#B8FFC7",accent:"#5CFF7F",bg:"#031006",alt:"#8AF59F",label:"GREEN PHOSPHOR"},
  amber:{text:"#FFD79A",accent:"#FFB347",bg:"#120B02",alt:"#FFE3B2",label:"AMBER"},
  white:{text:"#F2F2EC",accent:"#FFFFFF",bg:"#070707",alt:"#CFCFC7",label:"WHITE MONO"},
  blue:{text:"#B9E2FF",accent:"#4FB4FF",bg:"#02111F",alt:"#8DD3FF",label:"BLUE TERMINAL"},
  cyber:{text:"#FFE8FB",accent:"#FF2BD6",bg:"#050015",alt:"#19F7FF",label:"CYBERPUNK"}
};

var state={
  started:false,startedAt:Date.now(),activeProgram:"prompt",activeStyle:"green",
  booting:true,idle:false,idlePrevious:"prompt",lastInteraction:Date.now(),
  lastProgramRotation:Date.now(),lastStyleRotation:Date.now(),
  cfg:null,settingsFingerprint:"",timers:[],requestId:9000,
  pending:{},sensorConnected:false,sensorCatalog:{},sensorIds:{cpuLoad:null,cpuTemp:null,gpuLoad:null,gpuTemp:null,ram:null},
  sensorValues:{},promptIndex:0,promptChar:0,promptRendered:[],ambientTick:0
};

function byId(id){return document.getElementById(id)}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function cleanText(v,fallback,max){
  var s=String(v==null?"":v).replace(/[\r\n\t]+/g," ").trim();
  if(!s)s=fallback;
  return s.slice(0,max||80);
}
function readIcue(name,fallback){
  try{
    if(typeof globalThis.__ratpackIcueRead==="function"){
      var direct=globalThis.__ratpackIcueRead(name);
      if(direct!==undefined&&direct!==null)return direct;
    }
  }catch(e){}
  try{
    var v=globalThis[name];
    if(typeof Node!=="undefined"&&v instanceof Node)return fallback;
    return v===undefined||v===null?fallback:v;
  }catch(e2){return fallback}
}
function bool(name,fallback){return readIcue(name,fallback)!==false}
function settings(){
  var style=String(readIcue("terminalStyle","green")||"green").toLowerCase();
  if(["green","amber","white","blue","cyber","custom"].indexOf(style)<0)style="green";
  var start=String(readIcue("startProgram","prompt")||"prompt").toLowerCase();
  if(PROGRAMS.indexOf(start)<0)start="prompt";
  var boot=String(readIcue("bootSequence","classic")||"classic").toLowerCase();
  if(["classic","cascade","fast","none"].indexOf(boot)<0)boot="classic";
  var idle=String(readIcue("idleProgram","clock")||"clock").toLowerCase();
  if(["clock","rain","trace"].indexOf(idle)<0)idle="clock";
  return{
    startProgram:start,bootSequence:boot,
    autoProgram:bool("autoProgram",false),autoStyle:bool("autoStyle",false),
    rotationSeconds:clamp(Number(readIcue("rotationSeconds",45))||45,15,180),
    idleEnabled:bool("idleEnabled",true),
    idleSeconds:clamp(Number(readIcue("idleSeconds",120))||120,30,900),
    idleProgram:idle,
    machineName:cleanText(readIcue("machineName","XENEON"),"XENEON",24).toUpperCase(),
    username:cleanText(readIcue("username","packrat"),"packrat",24),
    promptText:cleanText(readIcue("promptText","status --local"),"status --local",64),
    terminalLines:String(readIcue("terminalLines","retro terminal pro online|touch SYSTEM for live iCUE sensors|edit this script in iCUE settings|scanlines glow flicker and style are configurable")||"")
      .split("|").map(function(x){return cleanText(x,"",92)}).filter(Boolean).slice(0,8),
    terminalStyle:style,
    textColor:String(readIcue("textColor","#B8FFC7")||"#B8FFC7"),
    accentColor:String(readIcue("accentColor","#5CFF7F")||"#5CFF7F"),
    backgroundColor:String(readIcue("backgroundColor","#031006")||"#031006"),
    scanlines:clamp(Number(readIcue("scanlineStrength",55))||0,0,100),
    glow:clamp(Number(readIcue("glowStrength",55))||0,0,100),
    flicker:clamp(Number(readIcue("flickerStrength",8))||0,0,35),
    vignette:clamp(Number(readIcue("vignetteStrength",60))||0,0,100),
    curvature:bool("crtCurvature",true)
  };
}
function fingerprint(cfg){return JSON.stringify(cfg)}
function instanceKey(suffix){
  var id="packrat";
  try{if(typeof uniqueId!=="undefined"&&uniqueId)id=String(uniqueId)}catch(e){}
  return id+":retro-terminal-pro:"+suffix;
}
function loadStore(key,fallback){
  try{var raw=localStorage.getItem(instanceKey(key));return raw?JSON.parse(raw):fallback}catch(e){return fallback}
}
function saveStore(key,value){try{localStorage.setItem(instanceKey(key),JSON.stringify(value))}catch(e){}}

function nearestSlot(){
  var w=Math.max(1,innerWidth||document.documentElement.clientWidth||840);
  var h=Math.max(1,innerHeight||document.documentElement.clientHeight||344);
  var best=SLOT_SPECS[0],score=Infinity;
  SLOT_SPECS.forEach(function(s){
    var n=Math.abs(Math.log(w/s.w))+Math.abs(Math.log(h/s.h));
    if(n<score){score=n;best=s}
  });
  return best.id;
}
function applySlot(){document.body.setAttribute("data-slot",nearestSlot())}

function paletteFor(style){
  if(style==="custom"){
    return{text:state.cfg.textColor,accent:state.cfg.accentColor,bg:state.cfg.backgroundColor,alt:state.cfg.accentColor,label:"CUSTOM"};
  }
  return PALETTES[style]||PALETTES.green;
}
function applyStyle(style,persist){
  if(["green","amber","white","blue","cyber","custom"].indexOf(style)<0)style="green";
  state.activeStyle=style;
  var p=paletteFor(style);
  var root=document.documentElement.style;
  root.setProperty("--crt-text",p.text);root.setProperty("--crt-accent",p.accent);root.setProperty("--crt-bg",p.bg);root.setProperty("--crt-alt",p.alt);
  root.setProperty("--crt-dim","color-mix(in srgb, "+p.text+" 52%, transparent)");
  document.body.setAttribute("data-style",style);
  if(byId("styleLabel"))byId("styleLabel").textContent=p.label;
  if(persist)saveStore("style",{base:state.cfg.terminalStyle,value:style});
}
function cycleStyle(){
  var i=ROTATING_STYLES.indexOf(state.activeStyle);
  applyStyle(ROTATING_STYLES[(i+1+ROTATING_STYLES.length)%ROTATING_STYLES.length],false);
  state.lastStyleRotation=Date.now();
}

function setProgram(name,reason){
  if(PROGRAMS.indexOf(name)<0)name="prompt";
  state.activeProgram=name;
  document.body.setAttribute("data-program",name);
  document.querySelectorAll("[data-program-panel]").forEach(function(el){el.classList.toggle("is-active",el.getAttribute("data-program-panel")===name)});
  document.querySelectorAll("#terminalFooter [data-program]").forEach(function(el){el.classList.toggle("is-active",el.getAttribute("data-program")===name)});
  if(byId("programLabel"))byId("programLabel").textContent=name.toUpperCase();
  if(reason==="manual")saveStore("program",{base:state.cfg.startProgram,value:name});
  if(name==="system")renderSystem();
  if(name==="prompt")renderPrompt(true);
  if(name==="clock")renderClock();
  state.lastProgramRotation=Date.now();
}
function nextProgram(reason){
  var i=PROGRAMS.indexOf(state.activeProgram);
  setProgram(PROGRAMS[(i+1)%PROGRAMS.length],reason||"auto");
}
function restoreProgram(cfg){
  var saved=loadStore("program",null);
  if(saved&&saved.base===cfg.startProgram&&PROGRAMS.indexOf(saved.value)>=0)return saved.value;
  return cfg.startProgram;
}

function applyEffects(){
  var root=document.documentElement.style,cfg=state.cfg;
  root.setProperty("--text",cfg.textColor);
  root.setProperty("--accent",cfg.accentColor);
  root.setProperty("--background",cfg.backgroundColor);
  root.setProperty("--scan-opacity",String(cfg.scanlines/100*.5));
  root.setProperty("--glow-blur",String(2+cfg.glow/100*22)+"px");
  root.setProperty("--flicker-opacity",String(cfg.flicker/100*.16));
  root.setProperty("--vignette-opacity",String(cfg.vignette/100*.82));
  root.setProperty("--curve-radius",cfg.curvature?"var(--curve-slot, 24px)":"0px");
}
function renderIdentity(){
  byId("machineLabel").textContent=state.cfg.machineName;
  byId("promptPrefix").textContent=state.cfg.username+"@"+state.cfg.machineName+":~$";
  byId("promptCommand").textContent=state.cfg.promptText;
  byId("clockMachine").textContent=state.cfg.username+"@"+state.cfg.machineName;
}
function applySettings(initial){
  var cfg=settings(),fp=fingerprint(cfg),old=state.cfg;
  if(!initial&&fp===state.settingsFingerprint)return;
  state.cfg=cfg;state.settingsFingerprint=fp;
  applyEffects();
  if(initial||!old||old.terminalStyle!==cfg.terminalStyle||cfg.terminalStyle==="custom")applyStyle(cfg.terminalStyle,false);
  renderIdentity();
  if(initial)setProgram(restoreProgram(cfg),"restore");
  else if(old&&old.startProgram!==cfg.startProgram)setProgram(cfg.startProgram,"settings");
  state.lastInteraction=Date.now();
}
globalThis.icueEvents=globalThis.icueEvents||{};
globalThis.icueEvents.onDataUpdated=function(){applySettings(false)};

function bootLines(){
  return[
    "RETRO TERMINAL PRO // LOCAL STARTUP",
    "display profile: "+state.activeStyle.toUpperCase(),
    "restoring program: "+state.activeProgram.toUpperCase(),
    "connecting to iCUE sensor provider...",
    "terminal ready."
  ];
}
function finishBoot(){
  state.booting=false;document.body.setAttribute("data-booting","false");state.started=true;state.startedAt=Date.now();
  renderPrompt(true);renderClock();discoverSensors();pollSensors();
}
function startBoot(){
  var mode=state.cfg.bootSequence;
  if(mode==="none"){byId("bootText").textContent="";finishBoot();return}
  var lines=bootLines(),out=[],i=0,delay=mode==="fast"?110:mode==="cascade"?210:360;
  byId("bootText").textContent="";
  var timer=setInterval(function(){
    if(i>=lines.length){clearInterval(timer);setTimeout(finishBoot,mode==="fast"?80:220);return}
    if(mode==="cascade"){
      out.push(lines[i].split("").map(function(ch,n){return n%7===state.ambientTick%7?ch.toLowerCase():ch}).join(""));
    }else out.push(lines[i]);
    byId("bootText").textContent=out.join("\n");
    state.ambientTick++;i++;
  },delay);
}

function promptLines(){return state.cfg.terminalLines.length?state.cfg.terminalLines:["retro terminal pro online"]}
function renderPrompt(complete){
  var lines=promptLines();
  if(complete){
    state.promptRendered=lines.slice(-5);
    byId("promptHistory").textContent=state.promptRendered.map(function(line,i){return (i?"  ":"")+line}).join("\n");
    return;
  }
  var target=lines[state.promptIndex%lines.length];
  var shown=target.slice(0,state.promptChar);
  var previous=state.promptRendered.slice(-4);
  byId("promptHistory").textContent=previous.concat([shown]).join("\n");
  state.promptChar++;
  if(state.promptChar>target.length+16){
    state.promptRendered.push(target);state.promptRendered=state.promptRendered.slice(-5);state.promptChar=0;state.promptIndex++;
  }
}
function renderTrace(){
  var width=Math.max(28,Math.min(100,Math.floor((innerWidth-60)/10)));
  var height=Math.max(8,Math.min(28,Math.floor((innerHeight-150)/18)));
  var lines=[];
  for(var y=0;y<height;y++){
    var chars=[];
    for(var x=0;x<width;x++){
      var wave=Math.sin((x+state.ambientTick)*.22)+Math.sin((x-state.ambientTick*.7)*.08);
      var band=Math.round((wave+2)/4*(height-1));
      chars.push(Math.abs(y-band)<1?(x%9===0?"#":"*"):(x+3*y+state.ambientTick)%31===0?"+":" ");
    }
    lines.push(chars.join(""));
  }
  byId("traceField").textContent=lines.join("\n");
}
function glyph(n){var chars="01ABCDEF<>/\\[]{}+-=*";return chars.charAt(Math.abs(n)%chars.length)}
function renderRain(){
  var width=Math.max(28,Math.min(110,Math.floor((innerWidth-60)/9)));
  var height=Math.max(8,Math.min(34,Math.floor((innerHeight-150)/16)));
  var lines=[];
  for(var y=0;y<height;y++){
    var row="";
    for(var x=0;x<width;x++){
      var phase=(x*13+state.ambientTick-y*3)%29;
      row+=phase===0||phase===1||phase===2?glyph(x*7+y*11+state.ambientTick):phase===3?".":" ";
    }
    lines.push(row);
  }
  byId("rainField").textContent=lines.join("\n");
}
function pad2(n){return String(n).padStart(2,"0")}
function renderClock(){
  var d=new Date();
  byId("clockTime").textContent=pad2(d.getHours())+":"+pad2(d.getMinutes())+":"+pad2(d.getSeconds());
  var days=["SUN","MON","TUE","WED","THU","FRI","SAT"],months=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  byId("clockDate").textContent=days[d.getDay()]+" // "+months[d.getMonth()]+" "+pad2(d.getDate())+" "+d.getFullYear();
}
function renderUptime(){
  var sec=Math.max(0,Math.floor((Date.now()-state.startedAt)/1000));
  var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  byId("uptimeValue").textContent=pad2(h)+":"+pad2(m)+":"+pad2(s);
}
function tickAmbient(){
  state.ambientTick++;
  if(state.activeProgram==="trace")renderTrace();
  if(state.activeProgram==="rain")renderRain();
  if(state.activeProgram==="prompt"&&!matchMedia("(prefers-reduced-motion: reduce)").matches)renderPrompt(false);
}
function plugin(){try{return window.plugins&&window.plugins.Sensorsdataprovider}catch(e){return null}}
function connectSensors(){
  var p=plugin();
  if(!p||!p.asyncResponse||typeof p.asyncResponse.connect!=="function")return false;
  if(state.sensorConnected)return true;
  try{
    p.asyncResponse.connect(function(id,value){
      var pending=state.pending[id];if(!pending)return;
      clearTimeout(pending.timer);delete state.pending[id];pending.resolve(value);
    });
    state.sensorConnected=true;return true;
  }catch(e){return false}
}
function ask(method,args){
  var p=plugin();
  if(!p||typeof p[method]!=="function"||!connectSensors())return Promise.resolve(null);
  var id=++state.requestId;
  return new Promise(function(resolve){
    var timer=setTimeout(function(){delete state.pending[id];resolve(null)},2600);
    state.pending[id]={resolve:resolve,timer:timer};
    try{p[method].apply(p,[id].concat(args||[]))}catch(e){clearTimeout(timer);delete state.pending[id];resolve(null)}
  });
}
function scoreSensor(s,role){
  var text=(s.device+" "+s.name+" "+s.type+" "+s.kind).toLowerCase(),u=s.units.toLowerCase(),score=0;
  if(role.indexOf("cpu")===0){if(/\bcpu\b|processor|package/.test(text))score+=14;if(/gpu|graphics|geforce|radeon/.test(text))score-=18}
  if(role.indexOf("gpu")===0){if(/gpu|graphics|geforce|radeon/.test(text))score+=16;if(/\bcpu\b|processor/.test(text))score-=14}
  if(role==="ram"){if(/\bram\b|memory|dram/.test(text))score+=18;if(/temp|temperature/.test(text))score-=18;if(/usage|used|load|util/.test(text))score+=6;if(/%|mb|gb|byte/.test(u))score+=5}
  if(role.indexOf("Temp")>0){if(/temp|temperature|hotspot|junction/.test(text))score+=9;if(/°c|celsius/.test(u)||/temperature/.test(s.type.toLowerCase()))score+=8;if(/load|usage|util/.test(text))score-=9}
  if(role.indexOf("Load")>0){if(/load|usage|util|activity/.test(text))score+=9;if(u.indexOf("%")>=0)score+=8;if(/temp|temperature/.test(text))score-=9}
  return score;
}
function pickSensor(list,role){
  var best=null,bestScore=2;
  list.forEach(function(s){var n=scoreSensor(s,role);if(n>bestScore){best=s.id;bestScore=n}});
  return best;
}
async function discoverSensors(){
  var ids=await ask("getAllSensorIds",[]);
  if(!Array.isArray(ids)){renderSystem();return}
  var list=await Promise.all(ids.map(async function(raw){
    var id=String(raw),parts=await Promise.all([
      ask("getSensorDeviceName",[id]),ask("getSensorName",[id]),ask("getSensorUnits",[id]),ask("getSensorType",[id]),ask("getSensorKind",[id])
    ]);
    return{id:id,device:String(parts[0]||""),name:String(parts[1]||""),units:String(parts[2]||""),type:String(parts[3]||""),kind:String(parts[4]||"")};
  }));
  state.sensorCatalog={};list.forEach(function(s){state.sensorCatalog[s.id]=s});
  ["cpuLoad","cpuTemp","gpuLoad","gpuTemp","ram"].forEach(function(role){state.sensorIds[role]=pickSensor(list,role)});
  renderSystem();
}
function formatValue(value,meta){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return"—";
  var n=Number(value),u=String(meta&&meta.units||"").trim(),low=u.toLowerCase();
  if(/bytes?/.test(low)&&!/[kmgt]b/.test(low))return(n/1073741824).toFixed(1)+" GB";
  if(low==="gb"||low==="gib")return n.toFixed(1)+" "+u;
  if(low==="mb"||low==="mib")return Math.round(n)+" "+u;
  if(low.indexOf("%")>=0)return Math.round(n)+"%";
  if(/°c|celsius/.test(low))return Math.round(n)+"°C";
  if(/°f|fahrenheit/.test(low))return Math.round(n)+"°F";
  return (Math.abs(n)>=100?Math.round(n):n.toFixed(1).replace(/\.0$/,""))+(u?" "+u:"");
}
async function pollSensors(){
  var roles=["cpuLoad","cpuTemp","gpuLoad","gpuTemp","ram"];
  await Promise.all(roles.map(async function(role){
    var id=state.sensorIds[role];if(!id)return;
    var v=await ask("getSensorValue",[String(id)]);
    var n=Number(v);if(Number.isFinite(n))state.sensorValues[role]={value:n,at:Date.now()};
  }));
  renderSystem();
}
function renderSystem(){
  var roles=["cpuLoad","cpuTemp","gpuLoad","gpuTemp","ram"],available=0,live=0;
  roles.forEach(function(role){
    var row=document.querySelector('.sensorRow[data-role="'+role+'"]');if(!row)return;
    var id=state.sensorIds[role],meta=id?state.sensorCatalog[id]:null,val=state.sensorValues[role];
    if(id)available++;if(val)live++;
    row.querySelector(".sensorValue").textContent=val?formatValue(val.value,meta):"—";
    row.querySelector(".sensorSource").textContent=meta?cleanText((meta.device?meta.device+" // ":"")+meta.name,"iCUE sensor",80):"not available";
  });
  var status=live?"LIVE iCUE // "+live+" SIGNAL"+(live===1?"":"S"):available?"WAITING FOR iCUE VALUES":"NO MATCHING iCUE SENSORS";
  byId("systemState").textContent=status;
  byId("systemUpdated").textContent=live?"UPDATED "+new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"}):"NO LIVE DATA";
  renderUptime();
}
function enterIdle(){
  if(state.idle||!state.cfg.idleEnabled)return;
  state.idle=true;state.idlePrevious=state.activeProgram;document.body.setAttribute("data-idle","true");
  setProgram(state.cfg.idleProgram,"idle");
}
function wake(){
  if(!state.idle)return;
  var previous=state.idlePrevious;state.idle=false;document.body.setAttribute("data-idle","false");
  setProgram(previous,"wake");
}
function markInteraction(){
  wake();state.lastInteraction=Date.now();state.lastProgramRotation=Date.now();state.lastStyleRotation=Date.now();
}
function lifecycleTick(){
  var now=Date.now();renderClock();renderUptime();
  if(state.cfg.idleEnabled&&!state.idle&&now-state.lastInteraction>=state.cfg.idleSeconds*1000)enterIdle();
  if(!state.idle&&state.cfg.autoProgram&&now-state.lastProgramRotation>=state.cfg.rotationSeconds*1000)nextProgram("auto");
  if(!state.idle&&state.cfg.autoStyle&&now-state.lastStyleRotation>=state.cfg.rotationSeconds*1000)cycleStyle();
}
function wireTouch(){
  document.querySelectorAll("#terminalFooter [data-program]").forEach(function(btn){
    btn.addEventListener("click",function(){markInteraction();setProgram(btn.getAttribute("data-program"),"manual")});
  });
  document.addEventListener("pointerdown",markInteraction,{passive:true});
  document.addEventListener("keydown",markInteraction);
}
function beginTimers(){
  state.timers.push(setInterval(tickAmbient,120));
  state.timers.push(setInterval(lifecycleTick,1000));
  state.timers.push(setInterval(function(){applySettings(false)},500));
  state.timers.push(setInterval(pollSensors,2200));
  state.timers.push(setInterval(function(){if(!Object.values(state.sensorIds).some(Boolean))discoverSensors()},15000));
}
function init(){
  applySlot();state.cfg=settings();state.settingsFingerprint=fingerprint(state.cfg);
  var savedStyle=loadStore("style",null);
  var initialStyle=savedStyle&&savedStyle.base===state.cfg.terminalStyle?savedStyle.value:state.cfg.terminalStyle;
  applyEffects();applyStyle(initialStyle,false);renderIdentity();setProgram(restoreProgram(state.cfg),"restore");
  wireTouch();beginTimers();startBoot();
  addEventListener("resize",applySlot);
}
globalThis.__retroTerminalPro=state;
globalThis.__retroTerminalProTest={
  setProgram:function(name){setProgram(name,"test")},
  setStyle:function(name){applyStyle(name,false)},
  rotateProgram:function(){nextProgram("test")},
  rotateStyle:function(){cycleStyle()},
  forceIdle:function(){enterIdle()},
  wake:function(){wake()},
  forcePromptComplete:function(){renderPrompt(true)},
  discoverSensors:discoverSensors,
  pollSensors:pollSensors,
  snapshot:function(){return{program:state.activeProgram,style:state.activeStyle,idle:state.idle,slot:document.body.getAttribute("data-slot"),started:state.started,sensors:JSON.parse(JSON.stringify(state.sensorValues))}}
};
init();
