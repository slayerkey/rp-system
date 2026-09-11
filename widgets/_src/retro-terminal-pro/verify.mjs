import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(here,"index.html"),"utf8");
const css=fs.readFileSync(path.join(here,"terminal.css"),"utf8");
const js=fs.readFileSync(path.join(here,"terminal.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(here,"..","..","retro-terminal-pro","manifest.json"),"utf8"));
const submission=JSON.parse(fs.readFileSync(path.join(here,"submission.json"),"utf8"));

function must(condition,message){
  if(!condition) throw new Error("VERIFY FAIL: "+message);
  console.log("OK  :",message);
}

must(manifest.author==="PackRat 🐀","canonical PackRat author");
must(manifest.id==="com.packrat.retro-terminal-pro","stable Pro reverse-DNS id");
must(manifest.name==="Retro Terminal Pro","product name");
must(manifest.version==="1.0.0","initial version");
must(manifest.interactive===true,"touch interaction enabled");
must(Array.isArray(manifest.required_plugins)&&manifest.required_plugins.includes("widgetbuilder.sensorsdataprovider:Sensors:1.0"),"Sensors provider declared");
must(submission.slug==="retro-terminal-pro","submission slug");
must(submission.name===manifest.name&&submission.version===manifest.version,"submission agrees with manifest");
must(Number(submission.price_usd)===7.99,"paid price is $7.99");
must(!("marketplace_url" in submission)&&!("marketplace_product_id" in submission),"no invented Marketplace URL or product ID");

const properties=[...html.matchAll(/name=["']x-icue-property["'][^>]*content=["']([^"']+)["']/g)].map(m=>m[1]);
for(const required of [
  "startProgram","bootSequence","autoProgram","autoStyle","rotationSeconds","idleEnabled","idleSeconds","idleProgram",
  "machineName","username","promptText","terminalLines","terminalStyle","textColor","accentColor","backgroundColor",
  "scanlineStrength","glowStrength","flickerStrength","vignetteStrength","crtCurvature"
]){
  must(properties.includes(required),"declares setting "+required);
}
const styleIndex=properties.indexOf("textColor");
must(JSON.stringify(properties.slice(styleIndex,styleIndex+3))===JSON.stringify(["textColor","accentColor","backgroundColor"]),"native Custom Style triplet is contiguous and ordered");

for(const program of ["prompt","system","trace","rain","clock"]){
  must(html.includes('data-program-panel="'+program+'"'),"program panel "+program);
  must(html.includes('data-program="'+program+'"'),"touch target "+program);
}
for(const style of ["green","amber","white","blue","cyber","custom"]){
  must(html.includes("'key':'"+style+"'"),"style option "+style);
}
for(const boot of ["classic","cascade","fast","none"]){
  must(html.includes("'key':'"+boot+"'"),"boot option "+boot);
}
for(const slot of ["s-h","s-v","m-h","m-v","l-h","l-v","xl-h","xl-v"]){
  must(css.includes('data-slot="'+slot+'"'),"responsive rules for "+slot);
}

must(!/<script[^>]+src=["']https?:/i.test(html),"no remote scripts");
must(!/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i.test(html),"no remote stylesheets");
must(js.includes("getAllSensorIds")&&js.includes("getSensorValue"),"real iCUE sensor provider is queried");
must(js.includes("getSensorDeviceName")&&js.includes("getSensorName")&&js.includes("getSensorUnits"),"sensor values retain source metadata");
must(html.includes("Only values returned by the iCUE sensor provider are shown as live system data."),"SYSTEM truthfulness disclosure");
must(html.includes("local session, not PC uptime"),"uptime is labeled as widget uptime");
must(html.includes("SYNTHETIC VISUAL"),"ambient programs are explicitly synthetic");
must(!/fake cpu|fake gpu|simulated sensor/i.test(js),"shipping runtime contains no fake sensor fallback");
must(js.includes("localStorage.setItem")&&js.includes("uniqueId"),"per-instance persistence");
must(js.includes("pointerdown")&&js.includes("data-program"),"touch interaction path");
must(js.includes("autoProgram")&&js.includes("autoStyle")&&js.includes("idleEnabled"),"rotation and idle logic present");
must(js.includes("prefers-reduced-motion"),"reduced-motion handling");
must(css.includes("#scanlines")&&css.includes("#vignette")&&css.includes("#flicker"),"CRT effects present");

console.log("RETRO TERMINAL PRO STATIC VERIFY PASS");
