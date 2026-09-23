import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";
const entry=path.resolve(process.argv[2]||"widgets/hwinfo-sensor-dashboard/index.html");
const cases=[
 ["hwinfo_not_running","Start HWiNFO"],
 ["shared_memory_disabled","Enable Shared Memory"],
 ["shared_memory_unavailable","Shared Memory unavailable"],
 ["sensors_not_active","Sensors not updating"],
 ["no_sensors","No sensors found"],
 ["access_denied","Access denied"]
];
const browser=await chromium.launch({headless:true});
try{
 for(const [status,title] of cases){
  const p=await browser.newPage({viewport:{width:840,height:696}});
  await p.addInitScript(({status})=>{globalThis.__PACKRAT_HWINFO_FIXTURE={type:"snapshot",protocol:1,companionVersion:"1.0.0",status,message:"fixture",generatedUtc:new Date().toISOString(),sensors:[]}}, {status});
  await p.goto(pathToFileURL(entry).href,{waitUntil:"load"});
  await p.waitForFunction(s=>document.body.dataset.state!=="starting"||s==="hwinfo_starting",status);
  const actual=(await p.locator("#statusTitle").textContent())||"";
  if(actual!==title)throw new Error(status+" rendered "+actual+" expected "+title);
  await p.close();
 }
 console.log("HWiNFO STATUS STATES PASS");
}finally{await browser.close()}